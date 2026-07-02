/**
 * Gratitude persistence via Supabase.
 *
 * Design:
 * - One entry per user per entryDate (UNIQUE constraint on userId + entryDate)
 * - Uses UPSERT for create-or-update semantics
 * - Falls back gracefully with structured error objects
 * - Local SQLite remains as read-through cache (not modified by this service)
 */
import { getSupabase, getSupabaseUserId, logSupabaseOp } from '@/lib/supabase';
import type { GratitudeEntry } from '@/types';

export interface GratitudeServiceResult {
  success: boolean;
  error?: string;
  data?: GratitudeEntry | GratitudeEntry[] | null;
}

const TABLE = 'gratitude_entries';

function mapRow(row: any): GratitudeEntry {
  return {
    id: row.id,
    entryDate: row.entryDate ?? row.entry_date,
    gratitude1: row.gratitude1 ?? row.gratitude_1 ?? '',
    gratitude2: row.gratitude2 ?? row.gratitude_2 ?? null,
    gratitude3: row.gratitude3 ?? row.gratitude_3 ?? null,
    reflection: row.reflection ?? null,
    createdAt: row.createdAt ?? row.created_at ?? Date.now(),
  };
}

function mapToRow(entry: GratitudeEntry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    entryDate: entry.entryDate,
    gratitude1: entry.gratitude1,
    gratitude2: entry.gratitude2 ?? null,
    gratitude3: entry.gratitude3 ?? null,
    reflection: entry.reflection ?? null,
    createdAt: entry.createdAt,
  };
}

async function fetchAllForUser(userId: string): Promise<GratitudeEntry[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('entryDate', { ascending: false });

  logSupabaseOp('SELECT', TABLE, { error }, `count=${data?.length ?? 0}`);
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

async function fetchByDate(userId: string, entryDate: number): Promise<GratitudeEntry | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('entryDate', entryDate)
    .maybeSingle();

  logSupabaseOp('SELECT', TABLE, { error }, `entryDate=${entryDate} found=${!!data}`);
  if (error) throw error;
  return data ? mapRow(data) : null;
}

/**
 * Create a new gratitude entry. If an entry already exists for this user+date,
 * use upsertGratitude() instead.
 */
async function createGratitude(entry: GratitudeEntry): Promise<GratitudeEntry> {
  const userId = getSupabaseUserId();
  const supabase = getSupabase();
  const row = mapToRow(entry, userId);

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select()
    .single();

  logSupabaseOp('INSERT', TABLE, { error }, `id=${entry.id}`);
  if (error) throw error;
  return mapRow(data);
}

/**
 * Upsert a gratitude entry — creates or replaces the entry for a given user+date.
 * Uses the entryDate + user_id as the conflict key.
 */
async function upsertGratitude(entry: GratitudeEntry): Promise<GratitudeEntry> {
  const userId = getSupabaseUserId();
  const supabase = getSupabase();
  const row = mapToRow(entry, userId);

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(row, {
      onConflict: 'user_id,entryDate',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  logSupabaseOp('UPSERT', TABLE, { error }, `id=${entry.id}`);
  if (error) throw error;
  return mapRow(data);
}

/**
 * Update an existing gratitude entry by its Supabase row id.
 */
async function updateGratitude(entry: GratitudeEntry): Promise<GratitudeEntry> {
  const userId = getSupabaseUserId();
  const supabase = getSupabase();
  const row = mapToRow(entry, userId);

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      gratitude1: row.gratitude1,
      gratitude2: row.gratitude2,
      gratitude3: row.gratitude3,
      reflection: row.reflection,
    })
    .eq('id', entry.id)
    .eq('user_id', userId)
    .select()
    .single();

  logSupabaseOp('UPDATE', TABLE, { error }, `id=${entry.id}`);
  if (error) throw error;
  return mapRow(data);
}

/**
 * Delete a gratitude entry by id.
 */
async function deleteGratitude(id: string): Promise<void> {
  const userId = getSupabaseUserId();
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  logSupabaseOp('DELETE', TABLE, { error }, `id=${id}`);
  if (error) throw error;
}

// Public API — returns structured results for safe consumption in UI

export const gratitudeSupabase = {
  async getAll(): Promise<GratitudeServiceResult> {
    try {
      const userId = getSupabaseUserId();
      const data = await fetchAllForUser(userId);
      return { success: true, data };
    } catch (error: any) {
      console.error('[GratitudeService] getAll failed:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to load gratitude entries', data: [] };
    }
  },

  async getByDate(entryDate: number): Promise<GratitudeServiceResult> {
    try {
      const userId = getSupabaseUserId();
      const data = await fetchByDate(userId, entryDate);
      return { success: true, data };
    } catch (error: any) {
      console.error('[GratitudeService] getByDate failed:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to load gratitude entry', data: null };
    }
  },

  /**
   * Save a gratitude entry. Uses UPSERT semantics — creates if new,
   * replaces if one already exists for this user+date.
   */
  async save(entry: GratitudeEntry): Promise<GratitudeServiceResult> {
    try {
      const data = await upsertGratitude(entry);
      return { success: true, data };
    } catch (error: any) {
      console.error('[GratitudeService] save failed:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to save gratitude entry' };
    }
  },

  async update(entry: GratitudeEntry): Promise<GratitudeServiceResult> {
    try {
      const data = await updateGratitude(entry);
      return { success: true, data };
    } catch (error: any) {
      console.error('[GratitudeService] update failed:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to update gratitude entry' };
    }
  },

  async create(entry: GratitudeEntry): Promise<GratitudeServiceResult> {
    try {
      const data = await createGratitude(entry);
      return { success: true, data };
    } catch (error: any) {
      console.error('[GratitudeService] create failed:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to create gratitude entry' };
    }
  },

  async delete(id: string): Promise<GratitudeServiceResult> {
    try {
      await deleteGratitude(id);
      return { success: true };
    } catch (error: any) {
      console.error('[GratitudeService] delete failed:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to delete gratitude entry' };
    }
  },
};
