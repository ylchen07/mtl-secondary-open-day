import { getTranslations } from 'next-intl/server';
import { RegionMap } from '@/components/RegionMap';
import { SchoolDirectory } from '@/components/SchoolDirectory';
import { redirect } from '@/i18n/navigation';
import { parseFilters, serializeFilters } from '@/lib/filters';
import { regionLabelPositions } from '@/lib/geo';
import type { Box } from '@/lib/regions';
import { fetchAgendaEvents, fetchSchoolListings } from '@/lib/queries';

export const revalidate = 3600;

/** Laval, the island and both shores, with the coast running off every edge. */
const DIRECTORY_VIEW: Box = { x: 70, y: 30, w: 930, h: 660 };

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: `${t('directory.heading')} · ${t('site.title')}` };
}

export default async function DirectoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const rawSearch = await searchParams;
  const query = new URLSearchParams(
    Object.entries(rawSearch).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v] as [string, string]] : [])),
  );
  const filters = parseFilters(query);

  // The calendar used to be a tab here; old shared links land on the events page.
  if (rawSearch.view === 'calendar') {
    const rest = serializeFilters(filters).toString();
    redirect({ href: rest ? `/events?${rest}` : '/events', locale });
  }

  const now = new Date();
  const [events, t] = await Promise.all([fetchAgendaEvents(now), getTranslations('directory')]);

  return (
    <SchoolDirectory
      schools={fetchSchoolListings()}
      events={events}
      initialFilters={{ ...filters, type: [] }}
      referenceTime={now.toISOString()}
      mapView={DIRECTORY_VIEW}
      labelPositions={regionLabelPositions(DIRECTORY_VIEW)}
      map={<RegionMap view={DIRECTORY_VIEW} label={t('regionsLabel')} />}
      intro={
        <>
          <h1>{t('heading')}</h1>
          <p className="lead">{t('lead')}</p>
        </>
      }
    />
  );
}
