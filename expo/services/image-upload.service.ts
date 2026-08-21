/**
 * Automatic image compression and Supabase Storage upload.
 *
 * Flow:
 * 1. Accept a file (from expo-image-picker or similar)
 * 2. Compress: resize to max 1600px, convert to JPEG at 0.75 quality
 * 3. Upload to Supabase Storage under an opaque user-scoped UUID path
 * 4. Return a short-lived signed URL and metadata
 */
import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode as base64Decode } from 'base64-arraybuffer';
import { getSupabase, getSupabaseUserId, logSupabaseOp } from '@/lib/supabase';

const MAX_DIMENSION = 1600;
const COMPRESSION_QUALITY = 0.75;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const BUCKET = 'user-uploads';
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export interface CompressedImage {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface UploadResult {
  success: boolean;
  error?: string;
  signedUrl?: string;
  signedUrlExpiresInSeconds?: number;
  path?: string;
  metadata?: CompressedImage;
}

function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

/**
 * Compress an image before upload while preserving aspect ratio and avoiding
 * unnecessary upscaling of images that are already within the size limit.
 */
export async function compressImageBeforeUpload(
  fileUri: string,
  _fileName: string = 'image.jpg'
): Promise<CompressedImage> {
  const fileInfo = await FileSystem.getInfoAsync(fileUri);

  if (!fileInfo.exists || !fileInfo.size || fileInfo.size <= 0) {
    throw new Error('Could not determine image file size.');
  }

  const originalSize = fileInfo.size;

  if (originalSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File is too large (${(originalSize / 1024 / 1024).toFixed(1)} MB). Maximum allowed is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
    );
  }

  const dimensions = await getImageDimensions(fileUri);
  const largestDimension = Math.max(dimensions.width, dimensions.height);
  const actions = largestDimension > MAX_DIMENSION
    ? [
        dimensions.width >= dimensions.height
          ? { resize: { width: MAX_DIMENSION } }
          : { resize: { height: MAX_DIMENSION } },
      ]
    : [];

  const result = await manipulateAsync(fileUri, actions, {
    compress: COMPRESSION_QUALITY,
    format: SaveFormat.JPEG,
  });

  const compressedInfo = await FileSystem.getInfoAsync(result.uri);
  if (!compressedInfo.exists || !compressedInfo.size || compressedInfo.size <= 0) {
    throw new Error('Could not determine compressed image file size.');
  }

  const compressedSize = compressedInfo.size;
  const compressionRatio = compressedSize / originalSize;

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: 'image/jpeg',
    originalSize,
    compressedSize,
    compressionRatio,
  };
}

/** Upload a compressed image to private Supabase Storage. */
export async function uploadImageToSupabase(
  compressedImage: CompressedImage,
  _fileName: string = 'image.jpg'
): Promise<UploadResult> {
  try {
    const userId = getSupabaseUserId();
    const supabase = getSupabase();
    const storagePath = `users/${userId}/uploads/${Crypto.randomUUID()}.jpg`;

    const base64 = await FileSystem.readAsStringAsync(compressedImage.uri, {
      encoding: 'base64' as const,
    });

    const arrayBuffer = base64Decode(base64);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: compressedImage.mimeType,
        upsert: false,
      });

    logSupabaseOp('STORAGE_UPLOAD', BUCKET, { error }, 'upload');
    if (error) throw error;

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    logSupabaseOp('STORAGE_SIGNED_URL', BUCKET, { error: signedUrlError }, 'signed-url');
    if (signedUrlError) throw signedUrlError;

    return {
      success: true,
      signedUrl: signedUrlData.signedUrl,
      signedUrlExpiresInSeconds: SIGNED_URL_EXPIRY_SECONDS,
      path: storagePath,
      metadata: compressedImage,
    };
  } catch (error: any) {
    console.error('[ImageUpload] Upload failed:', error?.message || error);
    return {
      success: false,
      error: error?.message || 'Failed to upload image',
    };
  }
}

export async function compressAndUpload(
  fileUri: string,
  fileName: string = 'image.jpg'
): Promise<UploadResult> {
  try {
    const compressed = await compressImageBeforeUpload(fileUri, fileName);
    return await uploadImageToSupabase(compressed, fileName);
  } catch (error: any) {
    console.error('[ImageUpload] Pipeline failed:', error?.message || error);
    return {
      success: false,
      error: error?.message || 'Image upload failed',
    };
  }
}
