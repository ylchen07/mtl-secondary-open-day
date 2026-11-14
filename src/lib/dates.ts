import { TZDate } from '@date-fns/tz';
import { addMonths, endOfDay, format, subMilliseconds, type Locale as DateFnsLocale } from 'date-fns';
import { enUS, fr, zhCN } from 'date-fns/locale';
import { MONTREAL_TZ, type Locale } from './constants';

const FORMATS: Record<Locale, { locale: DateFnsLocale; day: string; dayHeading: string; verified: string; time: string }> = {
  en: { locale: enUS, day: 'MMM d', dayHeading: 'EEEE, MMMM d', verified: 'MMM d, yyyy', time: 'h:mm a' },
  fr: { locale: fr, day: 'd MMM', dayHeading: 'EEEE d MMMM', verified: 'd MMM yyyy', time: 'HH:mm' },
  zh: { locale: zhCN, day: 'M月d日', dayHeading: 'M月d日 EEEE', verified: 'yyyy年M月d日', time: 'HH:mm' },
};

function montreal(iso: string): TZDate {
  return new TZDate(new Date(iso), MONTREAL_TZ);
}

/** End of the same Montreal calendar date three months after now. */
export function agendaWindowEnd(now = new Date()): Date {
  const end = endOfDay(addMonths(new TZDate(now, MONTREAL_TZ), 3));
  return new Date(end.getTime());
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
    const { day, locale: dateLocale } = FORMATS[locale];
    return `${format(start, day, { locale: dateLocale })} – ${format(lastDay, day, { locale: dateLocale })}`;
  }
  const end = montreal(event.ends_at);
  const { time } = FORMATS[locale];
  return `${format(start, time)} – ${format(end, time)}`;
}

export function formatVerifiedDate(date: string, locale: Locale): string {
  return format(montreal(`${date}T12:00:00Z`), FORMATS[locale].verified, { locale: FORMATS[locale].locale });
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
  return format(new TZDate(`${day}T12:00:00`, MONTREAL_TZ), FORMATS[locale].dayHeading, { locale: FORMATS[locale].locale });
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
