/**
 * Automatic image compression and Supabase Storage upload.
 *
 * Flow:
 * 1. Accept a file (from expo-image-picker or similar)
 * 2. Compress: resize to max 1600px, convert to JPEG/WebP at 0.75 quality
 * 3. Upload to Supabase Storage under users/{userId}/uploads/{timestamp}-{safeFilename}
 * 4. Return the public URL and metadata
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getSupabase, getSupabaseUserId, logSupabaseOp } from '@/lib/supabase';

const MAX_DIMENSION = 1600;
const COMPRESSION_QUALITY = 0.75;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB reject threshold before compression
const BUCKET = 'user-uploads';

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
  publicUrl?: string;
  path?: string;
  metadata?: CompressedImage;
}

/**
 * Sanitize a filename: remove special chars, limit length, keep extension.
 */
function safeFilename(originalName: string): string {
  const ext = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '.jpg';
  const base = originalName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50);
  return `${base}${ext}`;
}

/**
 * Compress an image before upload.
 *
 * @param fileUri - The local file URI (from image picker or camera)
 * @param fileName - Original filename for safe naming
 * @returns CompressedImage with metadata, or throws on failure
 */
export async function compressImageBeforeUpload(
  fileUri: string,
  fileName: string = 'image.jpg'
): Promise<CompressedImage> {
  console.log('[ImageUpload] Starting compression for:', fileName);

  // Get original file info
  let originalSize = 0;
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists && fileInfo.size) {
      originalSize = fileInfo.size;
    }
  } catch {
    console.warn('[ImageUpload] Could not get original file size');
  }

  // Reject files over max size before compression
  if (originalSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File is too large (${(originalSize / 1024 / 1024).toFixed(1)} MB). Maximum allowed is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
    );
  }

  // Compress with expo-image-manipulator
  const result = await manipulateAsync(
    fileUri,
    [
      {
        resize: {
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
        },
      },
    ],
    {
      compress: COMPRESSION_QUALITY,
      format: SaveFormat.JPEG,
    }
  );

  // Get compressed file size
  let compressedSize = 0;
  try {
    const compressedInfo = await FileSystem.getInfoAsync(result.uri);
    if (compressedInfo.exists && compressedInfo.size) {
      compressedSize = compressedInfo.size;
    }
  } catch {
    console.warn('[ImageUpload] Could not get compressed file size');
  }

  const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

  console.log(
    `[ImageUpload] Compressed: ${(originalSize / 1024).toFixed(1)} KB → ${(compressedSize / 1024).toFixed(1)} KB (${(compressionRatio * 100).toFixed(0)}%)`
  );

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

/**
 * Upload a compressed image to Supabase Storage.
 *
 * @param compressedImage - Result from compressImageBeforeUpload()
 * @param fileName - Original filename for path construction
 * @returns UploadResult with public URL on success
 */
export async function uploadImageToSupabase(
  compressedImage: CompressedImage,
  fileName: string = 'image.jpg'
): Promise<UploadResult> {
  try {
    const userId = getSupabaseUserId();
    const supabase = getSupabase();
    const timestamp = Date.now();
    const safeName = safeFilename(fileName);
    const storagePath = `users/${userId}/uploads/${timestamp}-${safeName}`;

    console.log('[ImageUpload] Uploading to:', storagePath);

    // Read the compressed file as base64
    const base64 = await FileSystem.readAsStringAsync(compressedImage.uri, {
      encoding: 'base64' as const,
    });

    // Convert to blob-like format for Supabase
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: compressedImage.mimeType });

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, blob, {
        contentType: compressedImage.mimeType,
        upsert: false,
      });

    logSupabaseOp('STORAGE_UPLOAD', BUCKET, { error }, `path=${storagePath}`);

    if (error) throw error;

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    return {
      success: true,
      publicUrl: publicUrlData.publicUrl,
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

/**
 * Full pipeline: compress then upload.
 * This is the main entry point for image handling.
 */
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
