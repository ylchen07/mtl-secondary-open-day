import { TZDate } from '@date-fns/tz';
import { format, startOfWeek } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { MONTREAL_TZ, type Locale } from './constants';

const dateFnsLocale = { en: enUS, fr } as const;

function montreal(iso: string): TZDate {
  return new TZDate(new Date(iso), MONTREAL_TZ);
}

/** ISO date of the Monday starting this event's week, in Montreal time. */
export function weekKey(iso: string): string {
  return format(startOfWeek(montreal(iso), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function formatEventRange(
  startsAt: string,
  endsAt: string,
  locale: Locale,
): string {
  const start = montreal(startsAt);
  const end = montreal(endsAt);
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
  return `${day} · ${formatEventRange(startsAt, endsAt, locale)}`;
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
