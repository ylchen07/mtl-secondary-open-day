import { getTranslations } from 'next-intl/server';
import { AgendaClient } from '@/components/AgendaClient';
import { Link } from '@/i18n/navigation';
import { fetchAgendaEvents } from '@/lib/queries';
import { parseFilters } from '@/lib/filters';

export const revalidate = 3600;

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;

  const [events, t, rawSearch] = await Promise.all([
    fetchAgendaEvents(),
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

  return (
    <div className="site-shell">
      <a className="skip-link" href="#events">{t('skipToEvents')}</a>
      <header className="site-header">
        <Link href="/" className="site-brand">{t('siteName')}</Link>
        <Link
          href="/"
          locale={locale === 'en' ? 'fr' : 'en'}
          hrefLang={locale === 'en' ? 'fr' : 'en'}
          className="locale-switch"
        >
          {locale === 'en' ? 'Français' : 'English'}
        </Link>
      </header>
      <main>
        <div className="page-intro">
          <h1>{t('heading')}</h1>
          <div className="intro-description">
            <p>{t('tagline')}</p>
            <p className="coverage">{events.length} {t('coverage')}</p>
          </div>
        </div>
        <AgendaClient
          events={events}
          initialFilters={initialFilters}
          referenceTime={new Date().toISOString()}
        />
      </main>
      <footer className="site-footer">
        <span>{t('siteName')}</span>
        <p>{t('footerNote')}</p>
      </footer>
    </div>
  );
}
