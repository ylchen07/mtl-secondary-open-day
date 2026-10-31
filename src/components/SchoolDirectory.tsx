'use client';

import { useMemo, type MouseEvent, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState } from './EmptyState';
import { FilterPanel, isFiltered, useUrlFilters } from './FilterPanel';
import { SchoolList } from './SchoolList';
import { EMPTY_FILTERS, applyFilters, matchesSchool, type FilterState } from '@/lib/filters';
import { MAP_REGIONS, mapRegionFor, type Box, type MapRegion } from '@/lib/regions';
import { listSchools } from '@/lib/schools';
import type { AgendaEvent, SchoolListing } from '@/lib/types';
import type { Locale } from '@/lib/constants';

function isMapRegion(value: string | null | undefined): value is MapRegion {
  return MAP_REGIONS.includes(value as MapRegion);
}

export function SchoolDirectory({
  schools,
  events,
  initialFilters,
  referenceTime,
  intro,
  map,
  mapView,
  labelPositions,
}: {
  schools: SchoolListing[];
  events: AgendaEvent[];
  initialFilters: FilterState;
  referenceTime: string;
  intro: ReactNode;
  /** The archipelago, rendered on the server; its lobes carry `data-region`. */
  map: ReactNode;
  mapView: Box;
  labelPositions: Record<MapRegion, { left: string; top: string }>;
}) {
  const t = useTranslations('directory');
  const tAgenda = useTranslations('agenda');
  const tRegion = useTranslations('region');
  const locale = useLocale() as Locale;
  const [filters, update] = useUrlFilters(initialFilters);

  const now = useMemo(() => new Date(referenceTime), [referenceTime]);
  const visible = useMemo(() => applyFilters(events, filters), [events, filters]);
  const rows = useMemo(() => listSchools(schools, visible, filters, now, locale), [schools, visible, filters, now, locale]);

  // Each lobe counts the schools every other filter leaves, so picking a
  // region never makes its neighbours read zero.
  const counts = useMemo(() => {
    const byRegion = Object.fromEntries(MAP_REGIONS.map((r) => [r, 0])) as Record<MapRegion, number>;
    const rest = { ...filters, region: [] };
    for (const school of schools) if (matchesSchool(school, rest)) byRegion[mapRegionFor(school.region)]++;
    return byRegion;
  }, [schools, filters]);

  function toggleRegion(region: MapRegion): void {
    const selected = filters.region.includes(region);
    update({ ...filters, region: selected ? filters.region.filter((r) => r !== region) : [...filters.region, region] });
  }

  // The lobes are a pointer shortcut; the region buttons are the control.
  function onMapClick(event: MouseEvent<HTMLDivElement>): void {
    const region = (event.target as Element).closest('[data-region]')?.getAttribute('data-region');
    if (isMapRegion(region)) toggleRegion(region);
  }

  return (
    <>
      <div className="directory-band">
        <div className="band-intro">{intro}</div>
        <div className="archipelago" data-selected={filters.region.join(' ') || undefined}>
          <div className="archipelago-map" aria-hidden="true" onClick={onMapClick} style={{ aspectRatio: `${mapView.w} / ${mapView.h}` }}>
            {map}
          </div>
          <fieldset className="region-pins">
            <legend className="visually-hidden">{t('regionsLabel')}</legend>
            {MAP_REGIONS.map((region) => (
              <button
                key={region}
                type="button"
                className="region-pin"
                data-region={region}
                aria-pressed={filters.region.includes(region)}
                onClick={() => toggleRegion(region)}
                style={labelPositions[region]}
              >
                <span>{tRegion(region)}</span>
                <span className="pin-count" aria-hidden="true">{counts[region]}</span>
                <span className="visually-hidden">{t('regionCount', { count: counts[region] })}</span>
              </button>
            ))}
          </fieldset>
        </div>
      </div>

      <FilterPanel filters={filters} facets={['sector', 'language', 'gender']} onChange={update} />

      <section aria-labelledby="school-list-heading" className="directory-results">
        <div className="results-heading">
          <h2 id="school-list-heading">{tAgenda('schoolCount', { count: rows.length })}</h2>
        </div>
        <p className="visually-hidden" role="status">{tAgenda('schoolCount', { count: rows.length })}</p>
        {rows.length === 0 ? (
          <EmptyState filtered={isFiltered(filters)} message={tAgenda('emptySchoolsFiltered')} onClear={() => update(EMPTY_FILTERS)} />
        ) : (
          <SchoolList rows={rows} />
        )}
      </section>
    </>
  );
}
