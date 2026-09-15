import { createReadClient } from './supabase';
import type { AgendaEvent } from './types';

/**
 * Every published event with its published school, including historical events.
 * The full result is shipped to the browser once; filtering happens there.
 */
export async function fetchAgendaEvents(): Promise<AgendaEvent[]> {
  const supabase = createReadClient();

  const { data, error } = await supabase
    .from('open_days')
    .select('*, school:schools!inner(*)')
    .eq('status', 'published')
    .eq('school.status', 'published')
    .order('starts_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch upcoming events: ${error.message}`);
  return (data ?? []) as unknown as AgendaEvent[];
}
