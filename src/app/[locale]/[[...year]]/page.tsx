import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AgendaClient } from '@/components/AgendaClient';
import { Link } from '@/i18n/navigation';
import { academicYearFor, dayKey } from '@/lib/dates';
import { fetchAgendaEvents, schoolYears } from '@/lib/queries';
import { parseFilters } from '@/lib/filters';

export const revalidate = 3600;

type Params = Promise<{ locale: string; year?: string[] }>;

/**
 * `/[locale]` shows the school year currently recruiting; `/[locale]/2027-2028`
 * pins one cohort so its schedule stays shareable after the season turns over.
 * Any other path, including a year with no published events, is a 404.
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
  return { title: `${t('site.title')} · ${t('agenda.schoolYear', { year: year.replace('-', '–') })}` };
}

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, year: segments } = await params;
  const now = new Date();

  const [{ year, current, years, events }, t, rawSearch] = await Promise.all([
    resolveSchoolYear(segments, now),
    getTranslations('agenda'),
    searchParams,
  ]);

  const initialFilters = parseFilters(
    new URLSearchParams(
      Object.entries(rawSearch).flatMap(([k, v]) =>
        typeof v === 'string' ? [[k, v] as [string, string]] : [],
      ),
    ),
  );

  const yearPath = year === current ? '/' : `/${year}`;

  return (
    <div className="site-shell">
      <a className="skip-link" href="#events">{t('skipToEvents')}</a>
      <header className="site-header">
        <Link href="/" className="site-brand">{t('siteName')}</Link>
        <Link
          href={yearPath}
          locale={locale === 'en' ? 'fr' : 'en'}
          hrefLang={locale === 'en' ? 'fr' : 'en'}
          className="locale-switch"
        >
          {locale === 'en' ? 'Français' : 'English'}
        </Link>
      </header>
      <main>
        <div className="page-intro">
          <div className="intro-heading">
            <nav aria-label={t('schoolYearNav')} className="year-nav">
              {years.map((y) => (
                <Link
                  key={y}
                  href={y === current ? '/' : `/${y}`}
                  aria-current={y === year ? 'page' : undefined}
                  className="year-link"
                >
                  {t('schoolYear', { year: y.replace('-', '–') })}
                </Link>
              ))}
            </nav>
            <h1>{t('heading')}</h1>
          </div>
          <div className="intro-description">
            <p>{t('tagline')}</p>
            <p className="coverage">{events.length} {t('coverage')}</p>
          </div>
        </div>
        <AgendaClient
          events={events}
          initialFilters={initialFilters}
          referenceTime={now.toISOString()}
        />
      </main>
      <footer className="site-footer">
        <span>{t('siteName')}</span>
        <p>{t('footerNote')}</p>
      </footer>
    </div>
  );
}
