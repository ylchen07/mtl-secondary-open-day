'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FilterBar, type Facet } from './FilterBar';
import { EMPTY_FILTERS, serializeFilters, type FilterState } from '@/lib/filters';

/** Filter state mirrored into the query string, so a filtered view is shareable. */
export function useUrlFilters(initial: FilterState) {
  const [filters, setFilters] = useState<FilterState>(initial);
  function update(next: FilterState): void {
    setFilters(next);
    const query = serializeFilters(next).toString();
    // Keep the URL shareable without re-running the server component.
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }
  return [filters, update] as const;
}

export function isFiltered(filters: FilterState): boolean {
  return (
    filters.q !== '' ||
    filters.boarding ||
    filters.language.length + filters.region.length + filters.gender.length + filters.sector.length + filters.type.length > 0
  );
}

export function FilterPanel({
  filters,
  facets,
  onChange,
}: {
  filters: FilterState;
  facets: Facet[];
  onChange: (next: FilterState) => void;
}) {
  const t = useTranslations('agenda');
  const [open, setOpen] = useState(false);

  return (
    <section aria-label={t('filtersLandmark')} className="filter-panel">
      <div className="filter-heading">
        <button
          type="button"
          className="mobile-filter-toggle"
          aria-expanded={open}
          aria-controls="filter-options"
          onClick={() => setOpen(!open)}
        >
          {t('filtersLandmark')}
          <svg aria-hidden="true" viewBox="0 0 16 16" className="toggle-chevron" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isFiltered(filters) && (
          <button type="button" className="text-button" onClick={() => onChange(EMPTY_FILTERS)}>
            {t('clearFilters')}
          </button>
        )}
      </div>
      <div id="filter-options" className="filter-options" data-open={open}>
        <FilterBar filters={filters} facets={facets} onChange={onChange} />
      </div>
    </section>
  );
}
