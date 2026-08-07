/**
 * Appointments persistence via local SQLite (appointmentsDb).
 *
 * This previously depended on Supabase, which requires EXPO_PUBLIC_SUPABASE_URL /
 * EXPO_PUBLIC_SUPABASE_ANON_KEY, an appointments table, and RLS policies that are
 * not provisioned in this repo — any user without that external setup hit a hard
 * error on every appointment read/write. It also meant nutrition-reminder entries
 * created from the calorie scanner/add flow (which already write to the local
 * appointmentsDb table) were invisible to this screen, and vice versa. Routing
 * through the same local table both fixes the crash and reunifies that data.
 */
import { appointmentsDb } from '@/lib/db/appointments';
import type { Appointment } from '@/types';

export interface AppointmentServiceResult {
  success: boolean;
  error?: string;
  data?: Appointment | Appointment[] | null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

export const appointmentService = {
  async fetchAll(): Promise<AppointmentServiceResult> {
    try {
      const data = await appointmentsDb.getAll();
      return { success: true, data };
    } catch (error: unknown) {
      console.error('[AppointmentService] fetchAll failed:', errorMessage(error));
      return { success: false, error: errorMessage(error), data: [] };
    }
  },

  async getById(id: string): Promise<AppointmentServiceResult> {
    try {
      const data = await appointmentsDb.getById(id);
      return { success: true, data };
    } catch (error: unknown) {
      console.error('[AppointmentService] getById failed:', errorMessage(error));
      return { success: false, error: errorMessage(error), data: null };
    }
  },

  async create(appointment: Appointment): Promise<AppointmentServiceResult> {
    try {
      await appointmentsDb.create(appointment);
      return { success: true, data: appointment };
    } catch (error: unknown) {
      console.error('[AppointmentService] create failed:', errorMessage(error));
      return { success: false, error: errorMessage(error) };
    }
  },

  async update(appointment: Appointment): Promise<AppointmentServiceResult> {
    try {
      await appointmentsDb.update(appointment);
      return { success: true, data: appointment };
    } catch (error: unknown) {
      console.error('[AppointmentService] update failed:', errorMessage(error));
      return { success: false, error: errorMessage(error) };
    }
  },

  async delete(id: string): Promise<AppointmentServiceResult> {
    try {
      await appointmentsDb.delete(id);
      return { success: true };
    } catch (error: unknown) {
      console.error('[AppointmentService] delete failed:', errorMessage(error));
      return { success: false, error: errorMessage(error) };
    }
  },
};
