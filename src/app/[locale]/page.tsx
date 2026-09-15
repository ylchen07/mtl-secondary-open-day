import { getTranslations, setRequestLocale } from 'next-intl/server';
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
  setRequestLocale(locale);

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
    <main className="mx-auto max-w-[1060px] px-6 py-8 sm:py-10">
      <header className="border-b border-(--rule) pb-6 sm:pb-7">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="max-w-[15ch] font-(--font-serif) text-[clamp(2rem,3.6vw,2.5rem)] font-medium leading-[1.08] tracking-[-0.02em]">
              {t('heading')}
            </h1>
            <p className="mt-2.5 max-w-[52ch] text-sm leading-6 text-(--ink-2)">
              {t('tagline')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-(--rule-strong) p-1 text-xs font-medium">
            <Link
              href="/"
              locale={locale === 'en' ? 'fr' : 'en'}
              className="locale-switch rounded-full bg-(--ink) px-3 py-1.5"
            >
              {locale === 'en' ? 'FR' : 'EN'}
            </Link>
          </div>
        </div>
      </header>
      <div className="border-b border-(--rule) py-3 text-[13px] text-(--ink-3)">
        <span className="font-semibold text-(--ink)">{events.length}</span>{' '}
        {t('coverage')}
      </div>
      <div className="pt-5">
        <AgendaClient events={events} initialFilters={initialFilters} />
      </div>
    </main>
  );
}
