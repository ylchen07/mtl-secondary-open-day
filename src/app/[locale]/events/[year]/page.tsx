import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EventsClient } from '@/components/EventsClient';
import { Link } from '@/i18n/navigation';
import { academicYearFor, dayKey } from '@/lib/dates';
import { parseFilters } from '@/lib/filters';
import { fetchAgendaEvents, schoolYears } from '@/lib/queries';

export const revalidate = 3600;

/** The path segment that always means the school year currently recruiting. */
const CURRENT = 'current';

type Params = Promise<{ locale: string; year: string }>;

/**
 * `/[locale]/events/current` shows the school year currently recruiting and
 * moves on by itself when the season turns over; `/[locale]/events/2027-2028`
 * pins one cohort so its schedule stays shareable afterwards. Any other
 * segment, including a year with no published events, is a 404. Bare
 * `/[locale]/events` redirects to `current` (next.config.ts).
 */
async function resolveSchoolYear(segment: string, now: Date) {
  const events = await fetchAgendaEvents(now);
  const current = academicYearFor(dayKey(now.toISOString()));
  const years = schoolYears(events, current);
  const year = segment === CURRENT ? current : segment;
  if (!years.includes(year)) notFound();
  return { year, current, years, events: events.filter((event) => event.academic_year === year) };
}

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, year: segment } = await params;
  const [{ year }, t] = await Promise.all([
    resolveSchoolYear(segment, new Date()),
    getTranslations({ locale }),
  ]);
  return { title: `${t('events.heading')} · ${t('agenda.schoolYear', { year: year.replace('-', '–') })} · ${t('site.title')}` };
}

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { year: segment } = await params;
  const now = new Date();

  const [{ year, current, years, events }, t, rawSearch] = await Promise.all([
    resolveSchoolYear(segment, now),
    getTranslations(),
    searchParams,
  ]);

  const initialFilters = parseFilters(
    new URLSearchParams(
      Object.entries(rawSearch).flatMap(([k, v]) =>
        typeof v === 'string' ? [[k, v] as [string, string]] : [],
      ),
    ),
  );
  const label = (y: string) => y.replace('-', '–');

  return (
    <>
      <div className="page-intro">
        <div className="intro-heading">
          <h1>{t('events.heading')}</h1>
          <p className="lead">{t('events.lead', { year: label(year) })}</p>
        </div>
        <nav aria-label={t('agenda.schoolYearNav')} className="year-nav">
          {years.map((y) => (
            <Link
              key={y}
              href={y === current ? `/events/${CURRENT}` : `/events/${y}`}
              aria-current={y === year ? 'page' : undefined}
              className="year-link"
            >
              {t('agenda.schoolYear', { year: label(y) })}
            </Link>
          ))}
        </nav>
      </div>
      <EventsClient events={events} initialFilters={initialFilters} referenceTime={now.toISOString()} />
    </>
  );
}
