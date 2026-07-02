import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId } from '@/lib/db/core';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

/**
 * Creates (or returns) the singleton Supabase client.
 * On native platforms, uses AsyncStorage for session persistence.
 * On web, relies on localStorage (Supabase default).
 */
export function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
    // Return a no-op client that won't crash but logs errors
    throw new Error(
      'Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.'
    );
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  console.log('[Supabase] Client initialized');
  return supabaseInstance;
}

/**
 * Returns the current authenticated user ID.
 * Uses the app's auth system (not Supabase Auth).
 */
export function getSupabaseUserId(): string {
  const userId = getCurrentUserId();
  if (!userId || userId === 'guest') {
    throw new Error('User is not authenticated. Please sign in.');
  }
  return userId;
}

/**
 * Logs a Supabase operation result for development visibility.
 * In production, errors still log; successes are silent unless verbose.
 */
export function logSupabaseOp(
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' | 'STORAGE_UPLOAD',
  tableOrBucket: string,
  result: { error: any } | null,
  extra?: string
): void {
  if (result?.error) {
    console.error(
      `[Supabase] ${operation} FAILED on ${tableOrBucket}:`,
      result.error.message || result.error,
      extra ?? ''
    );
  } else if (__DEV__) {
    console.log(`[Supabase] ${operation} OK on ${tableOrBucket}`, extra ?? '');
  }
}
