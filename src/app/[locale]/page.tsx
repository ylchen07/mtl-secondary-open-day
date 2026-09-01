import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AgendaClient } from '@/components/AgendaClient';
import { fetchUpcomingEvents } from '@/lib/queries';
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
    fetchUpcomingEvents(),
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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{t('heading')}</h1>
      <div className="mt-8">
        <AgendaClient events={events} initialFilters={initialFilters} />
      </div>
    </main>
  );
}
