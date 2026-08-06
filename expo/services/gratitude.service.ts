/**
 * Gratitude persistence via local SQLite (gratitudeDb).
 *
 * This previously depended on Supabase, which requires EXPO_PUBLIC_SUPABASE_URL /
 * EXPO_PUBLIC_SUPABASE_ANON_KEY, a gratitude_entries table, and RLS policies that
 * are not provisioned in this repo — any user without that external setup would
 * hit a hard error on every gratitude read/write. Every other feature in this app
 * (habits, goals, calorie tracker, financial planner) is local-first SQLite, so
 * gratitude now follows the same pattern for consistency and reliability.
 */
import { gratitudeDb } from '@/lib/database';
import type { GratitudeEntry } from '@/types';

export interface GratitudeServiceResult {
  success: boolean;
  error?: string;
  data?: GratitudeEntry | GratitudeEntry[] | null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

export const gratitudeService = {
  async getAll(): Promise<GratitudeServiceResult> {
    try {
      const data = await gratitudeDb.getAll();
      return { success: true, data };
    } catch (error: unknown) {
      console.error('[GratitudeService] getAll failed:', errorMessage(error));
      return { success: false, error: errorMessage(error), data: [] };
    }
  },

  async getByDate(entryDate: number): Promise<GratitudeServiceResult> {
    try {
      const data = await gratitudeDb.getByDate(entryDate);
      return { success: true, data };
    } catch (error: unknown) {
      console.error('[GratitudeService] getByDate failed:', errorMessage(error));
      return { success: false, error: errorMessage(error), data: null };
    }
  },

  /**
   * Save a gratitude entry. Creates if none exists for this date, otherwise updates it.
   */
  async save(entry: GratitudeEntry): Promise<GratitudeServiceResult> {
    try {
      await gratitudeDb.save(entry);
      return { success: true, data: entry };
    } catch (error: unknown) {
      console.error('[GratitudeService] save failed:', errorMessage(error));
      return { success: false, error: errorMessage(error) };
    }
  },

  async update(entry: GratitudeEntry): Promise<GratitudeServiceResult> {
    try {
      await gratitudeDb.update(entry);
      return { success: true, data: entry };
    } catch (error: unknown) {
      console.error('[GratitudeService] update failed:', errorMessage(error));
      return { success: false, error: errorMessage(error) };
    }
  },

  async create(entry: GratitudeEntry): Promise<GratitudeServiceResult> {
    try {
      await gratitudeDb.create(entry);
      return { success: true, data: entry };
    } catch (error: unknown) {
      console.error('[GratitudeService] create failed:', errorMessage(error));
      return { success: false, error: errorMessage(error) };
    }
  },

  async delete(id: string): Promise<GratitudeServiceResult> {
    try {
      await gratitudeDb.delete(id);
      return { success: true };
    } catch (error: unknown) {
      console.error('[GratitudeService] delete failed:', errorMessage(error));
      return { success: false, error: errorMessage(error) };
    }
  },
};
