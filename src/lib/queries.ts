import { createReadClient } from './supabase';
import { agendaWindowEnd } from './dates';
import type { AgendaEvent } from './types';

/**
 * Published historical events and upcoming events within the rolling
 * three-calendar-month Montreal window, each with its published school.
 * The result is shipped to the browser once; filtering happens there.
 */
export async function fetchAgendaEvents(): Promise<AgendaEvent[]> {
  const supabase = createReadClient();

  const { data, error } = await supabase
    .from('open_days')
    .select('*, school:schools!inner(*)')
    .eq('status', 'published')
    .eq('school.status', 'published')
    .lte('starts_at', agendaWindowEnd().toISOString())
    .order('starts_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch agenda events: ${error.message}`);
  return (data ?? []) as unknown as AgendaEvent[];
}
