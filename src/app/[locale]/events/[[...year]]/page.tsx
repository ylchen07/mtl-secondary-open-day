import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EventsClient } from '@/components/EventsClient';
import { Link } from '@/i18n/navigation';
import { academicYearFor, dayKey } from '@/lib/dates';
import { parseFilters } from '@/lib/filters';
import { fetchAgendaEvents, schoolYears } from '@/lib/queries';

export const revalidate = 3600;

type Params = Promise<{ locale: string; year?: string[] }>;

/**
 * `/[locale]/events` shows the school year currently recruiting;
 * `/[locale]/events/2027-2028` pins one cohort so its schedule stays shareable
 * after the season turns over. Any other path, including a year with no
 * published events, is a 404.
 */
async function resolveSchoolYear(segments: string[] | undefined, now: Date) {
  const events = await fetchAgendaEvents(now);
  const current = academicYearFor(dayKey(now.toISOString()));
  const years = schoolYears(events, current);
  if (segments && (segments.length !== 1 || !years.includes(segments[0]))) notFound();
  const year = segments?.[0] ?? current;
  return { year, current, years, events: events.filter((event) => event.academic_year === year) };
}

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, year: segments } = await params;
  const [{ year }, t] = await Promise.all([
    resolveSchoolYear(segments, new Date()),
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
  const { year: segments } = await params;
  const now = new Date();

  const [{ year, current, years, events }, t, rawSearch] = await Promise.all([
    resolveSchoolYear(segments, now),
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
              href={y === current ? '/events' : `/events/${y}`}
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
