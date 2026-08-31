import { createReadClient } from './supabase';
import type { AgendaEvent } from './types';

/**
 * Every published, not-yet-past event with its school.
 * The full result is shipped to the browser once; filtering happens there.
 */
export async function fetchUpcomingEvents(): Promise<AgendaEvent[]> {
  const supabase = createReadClient();

  const { data, error } = await supabase
    .from('open_days')
    .select('*, school:schools!inner(*)')
    .eq('status', 'published')
    .eq('school.status', 'published')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch upcoming events: ${error.message}`);
  return (data ?? []) as unknown as AgendaEvent[];
}
