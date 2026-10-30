import type { Locale } from './constants';
import { isPastEvent } from './dates';
import { matchesSchool, type FilterState } from './filters';
import type { AgendaEvent, SchoolListing } from './types';

export type SchoolListRow = {
  school: SchoolListing;
  /** The soonest upcoming published event, or null: nothing observed yet. */
  next: AgendaEvent | null;
  moreUpcoming: number;
};

/**
 * One row per school passing the school facets, paired with its next upcoming
 * event among `events` (the school year's events, already filtered). A school
 * with nothing upcoming stays listed; only an event-type filter drops schools,
 * because "which schools hold an entrance exam?" has no answer without one.
 * Schools with an upcoming event come first, soonest first, then by name.
 */
export function listSchools(
  schools: SchoolListing[],
  events: AgendaEvent[],
  filters: FilterState,
  now: Date,
  locale: Locale,
): SchoolListRow[] {
  const withEvents = new Set<string>();
  const upcoming = new Map<string, AgendaEvent[]>();
  for (const event of events) {
    withEvents.add(event.school_id);
    if (isPastEvent(event.ends_at, now)) continue;
    const list = upcoming.get(event.school_id);
    if (list) list.push(event);
    else upcoming.set(event.school_id, [event]);
  }

  const name = (school: SchoolListing) => (locale === 'fr' ? school.name_fr : school.name_en);

  return schools
    .filter((school) => matchesSchool(school, filters))
    .filter((school) => filters.type.length === 0 || withEvents.has(school.id))
    .map((school) => {
      const soonest = [...(upcoming.get(school.id) ?? [])].sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
      return { school, next: soonest[0] ?? null, moreUpcoming: Math.max(0, soonest.length - 1) };
    })
    .sort((a, b) => {
      if (a.next && b.next) {
        const byDate = new Date(a.next.starts_at).getTime() - new Date(b.next.starts_at).getTime();
        if (byDate !== 0) return byDate;
      } else if (a.next || b.next) {
        return a.next ? -1 : 1;
      }
      return name(a.school).localeCompare(name(b.school), locale);
    });
}
