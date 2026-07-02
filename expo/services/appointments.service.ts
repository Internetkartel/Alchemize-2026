/**
 * Appointments persistence via Supabase.
 *
 * Design:
 * - Every appointment has: id, user_id, title, category, date, time, notes, created_at, updated_at
 * - CRUD uses the real Supabase row id — never array index or composite key
 * - Business and Personal appointments share the same CRUD service
 * - After any mutation, the caller is responsible for refreshing local state
 */
import { getSupabase, getSupabaseUserId, logSupabaseOp } from '@/lib/supabase';
import type { Appointment } from '@/types';

export interface AppointmentServiceResult {
  success: boolean;
  error?: string;
  data?: Appointment | Appointment[] | null;
}

const TABLE = 'appointments';

function mapRow(row: any): Appointment {
  return {
    id: row.id,
    title: row.title ?? '',
    date: row.date ?? 0,
    time: row.time ?? '09:00',
    category: row.category ?? 'personal',
    notes: row.notes ?? '',
    reminder: Boolean(row.reminder),
    createdAt: row.createdAt ?? row.created_at ?? Date.now(),
    metadata: row.metadata ?? null,
  };
}

function mapToRow(appointment: Appointment, userId: string) {
  return {
    id: appointment.id,
    user_id: userId,
    title: appointment.title,
    date: appointment.date,
    time: appointment.time,
    category: appointment.category,
    notes: appointment.notes,
    reminder: appointment.reminder,
    createdAt: appointment.createdAt,
    metadata: appointment.metadata ?? null,
  };
}

async function fetchAllForUser(userId: string): Promise<Appointment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  logSupabaseOp('SELECT', TABLE, { error }, `count=${data?.length ?? 0}`);
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

async function createAppointment(appointment: Appointment): Promise<Appointment> {
  const userId = getSupabaseUserId();
  const supabase = getSupabase();
  const row = mapToRow(appointment, userId);

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select()
    .single();

  logSupabaseOp('INSERT', TABLE, { error }, `id=${appointment.id} title="${appointment.title}"`);
  if (error) throw error;
  return mapRow(data);
}

async function updateAppointmentById(appointment: Appointment): Promise<Appointment> {
  const userId = getSupabaseUserId();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      title: appointment.title,
      date: appointment.date,
      time: appointment.time,
      category: appointment.category,
      notes: appointment.notes,
      reminder: appointment.reminder,
      metadata: appointment.metadata ?? null,
    })
    .eq('id', appointment.id)
    .eq('user_id', userId)
    .select()
    .single();

  logSupabaseOp('UPDATE', TABLE, { error }, `id=${appointment.id} title="${appointment.title}"`);
  if (error) throw error;
  return mapRow(data);
}

async function deleteAppointmentById(id: string): Promise<void> {
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

// Public API — structured results for safe UI consumption

export const appointmentSupabase = {
  async fetchAll(): Promise<AppointmentServiceResult> {
    try {
      const userId = getSupabaseUserId();
      const data = await fetchAllForUser(userId);
      return { success: true, data };
    } catch (error: any) {
      console.error('[AppointmentService] fetchAll failed:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to load appointments', data: [] };
    }
  },

  async create(appointment: Appointment): Promise<AppointmentServiceResult> {
    try {
      const data = await createAppointment(appointment);
      return { success: true, data };
    } catch (error: any) {
      console.error('[AppointmentService] create failed:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to create appointment' };
    }
  },

  async update(appointment: Appointment): Promise<AppointmentServiceResult> {
    try {
      const data = await updateAppointmentById(appointment);
      return { success: true, data };
    } catch (error: any) {
      console.error('[AppointmentService] update failed:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to update appointment' };
    }
  },

  async delete(id: string): Promise<AppointmentServiceResult> {
    try {
      await deleteAppointmentById(id);
      return { success: true };
    } catch (error: any) {
      console.error('[AppointmentService] delete failed:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to delete appointment' };
    }
  },
};
