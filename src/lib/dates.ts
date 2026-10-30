import { TZDate } from '@date-fns/tz';
import { addMonths, endOfDay, format, startOfWeek, subMilliseconds } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { MONTREAL_TZ, type Locale } from './constants';

const dateFnsLocale = { en: enUS, fr } as const;

function montreal(iso: string): TZDate {
  return new TZDate(new Date(iso), MONTREAL_TZ);
}

/** End of the same Montreal calendar date three months after now. */
export function agendaWindowEnd(now = new Date()): Date {
  const end = endOfDay(addMonths(new TZDate(now, MONTREAL_TZ), 3));
  return new Date(end.getTime());
}

/** ISO date of the Monday starting this event's week, in Montreal time. */
export function weekKey(iso: string): string {
  return format(startOfWeek(montreal(iso), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/**
 * Instant bounds for either event shape. A date-only event covers its whole
 * Montreal days: it starts at local midnight of `starts_on` and ends, exclusively,
 * at local midnight after `ends_on`.
 */
export function eventBounds(
  event: { starts_at: string; ends_at: string } | { starts_on: string; ends_on: string },
): { starts_at: string; ends_at: string; all_day: boolean } {
  if (!('starts_on' in event)) {
    return { starts_at: event.starts_at, ends_at: event.ends_at, all_day: false };
  }
  const midnight = (date: string, dayOffset: number) => {
    const [y, m, d] = date.split('-').map(Number);
    return format(new TZDate(y, m - 1, d + dayOffset, MONTREAL_TZ), "yyyy-MM-dd'T'HH:mm:ssXXX");
  };
  return { starts_at: midnight(event.starts_on, 0), ends_at: midnight(event.ends_on, 1), all_day: true };
}

/**
 * The entry cohort ("Année scolaire") an admissions date feeds. Events in the
 * second half of a calendar year (July onward) recruit for the intake that
 * starts the *following* September; earlier events recruit for the intake
 * starting that same September.
 *
 * FEEP's own labels confirm the boundary: Collège Reine-Marie's open house on
 * 17 avril 2027 is "Année scolaire 2027-2028" and Académie Centennial's on
 * 25 avril 2026 is "Année scolaire 2026-2027" (both in
 * `tests/fixtures/feep/listing-montreal.html`).
 */
export function academicYearFor(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 7 ? y + 1 : y;
  return `${start}-${start + 1}`;
}

/**
 * Clock range for a timed event. A date-only event has no clock times: a
 * single day returns null and the caller says so; a window returns its first
 * and last day.
 */
export function formatEventRange(
  event: { starts_at: string; ends_at: string; all_day: boolean },
  locale: Locale,
): string | null {
  const start = montreal(event.starts_at);
  if (event.all_day) {
    const lastDay = montreal(subMilliseconds(new Date(event.ends_at), 1).toISOString());
    if (dayKey(event.starts_at) === format(lastDay, 'yyyy-MM-dd')) return null;
    const dayFmt = locale === 'fr' ? 'd MMM' : 'MMM d';
    const opts = { locale: dateFnsLocale[locale] };
    return `${format(start, dayFmt, opts)} – ${format(lastDay, dayFmt, opts)}`;
  }
  const end = montreal(event.ends_at);
  const timeFmt = locale === 'fr' ? 'HH:mm' : 'h:mm a';
  return `${format(start, timeFmt)} – ${format(end, timeFmt)}`;
}

export function formatEventTime(
  startsAt: string,
  endsAt: string,
  locale: Locale,
): string {
  const start = montreal(startsAt);
  const opts = { locale: dateFnsLocale[locale] };
  const day = format(start, locale === 'fr' ? 'EEEE d MMMM' : 'EEEE, MMMM d', opts);
  return `${day} · ${formatEventRange({ starts_at: startsAt, ends_at: endsAt, all_day: false }, locale)}`;
}

export function formatVerifiedDate(date: string, locale: Locale): string {
  return format(montreal(`${date}T12:00:00Z`), locale === 'fr' ? 'd MMM yyyy' : 'MMM d, yyyy', {
    locale: dateFnsLocale[locale],
  });
}

export function isPastEvent(endsAt: string, now = new Date()): boolean {
  return new Date(endsAt).getTime() < now.getTime();
}

export function partitionAgendaEvents<T extends { starts_at: string; ends_at: string }>(
  events: T[],
  now = new Date(),
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const event of events) {
    (isPastEvent(event.ends_at, now) ? past : upcoming).push(event);
  }

  const byStart = (a: T, b: T) => a.starts_at.localeCompare(b.starts_at);
  return { upcoming: upcoming.sort(byStart), past: past.sort(byStart) };
}

export function dayKey(iso: string): string {
  return format(montreal(iso), 'yyyy-MM-dd');
}

export function formatDayHeading(day: string, locale: Locale): string {
  return format(new TZDate(`${day}T12:00:00`, MONTREAL_TZ), locale === 'fr' ? 'EEEE d MMMM' : 'EEEE, MMMM d', {
    locale: dateFnsLocale[locale],
  });
}

export function groupByDay<T extends { starts_at: string }>(
  events: T[],
): { day: string; events: T[] }[] {
  const buckets = new Map<string, T[]>();

  for (const event of events) {
    const key = dayKey(event.starts_at);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(event);
    else buckets.set(key, [event]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayEvents]) => ({
      day,
      events: [...dayEvents].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    }));
}

export function groupByWeek<T extends { starts_at: string }>(
  events: T[],
): { weekStart: string; events: T[] }[] {
  const buckets = new Map<string, T[]>();

  for (const event of events) {
    const key = weekKey(event.starts_at);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(event);
    else buckets.set(key, [event]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, weekEvents]) => ({
      weekStart,
      events: [...weekEvents].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    }));
}
