import type { AgendaEvent } from './types';

/**
 * Two events clash when their time ranges overlap and they belong to
 * different schools. Same-school events are never a clash — a school does
 * not schedule against itself, and if it does, attending both was never
 * the plan.
 *
 * All-day events never clash: they are interview days or windows where the
 * school assigns each family a private slot, so there are no published hours
 * to collide with, and flagging every timed event inside a two-week window
 * would bury the real conflicts.
 *
 * Events are sorted by start, so the inner loop can stop as soon as a
 * candidate starts after the current event ends.
 */
export function findClashes(events: AgendaEvent[]): Map<string, AgendaEvent[]> {
  const sorted = events
    .filter((event) => !event.all_day)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const clashes = new Map<string, AgendaEvent[]>();

  function record(a: AgendaEvent, b: AgendaEvent): void {
    const existing = clashes.get(a.id);
    if (existing) existing.push(b);
    else clashes.set(a.id, [b]);
  }

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const currentEnd = new Date(current.ends_at).getTime();

    for (let j = i + 1; j < sorted.length; j++) {
      const other = sorted[j];
      if (new Date(other.starts_at).getTime() >= currentEnd) break;
      if (other.school.id === current.school.id) continue;
      record(current, other);
      record(other, current);
    }
  }

  return clashes;
}
