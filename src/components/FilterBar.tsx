'use client';

import { useTranslations } from 'next-intl';
import type { FilterState } from '@/lib/filters';

const FACET_OPTIONS = {
  language: ['fr', 'en', 'bilingual'],
  region: ['montreal_island', 'west_island', 'laval', 'north_shore', 'south_shore'],
  gender: ['mixed', 'girls', 'boys'],
  type: ['open_house', 'info_session', 'entrance_exam', 'tour', 'virtual'],
} as const;

type Facet = keyof typeof FACET_OPTIONS;

const NAMESPACE: Record<Facet, string> = {
  language: 'language',
  region: 'region',
  gender: 'gender',
  type: 'eventType',
};

export function FilterBar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const t = useTranslations('filters');

  function toggle(facet: Facet, value: string): void {
    const current = filters[facet];
    onChange({
      ...filters,
      [facet]: current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    });
  }

  return (
    <div className="filter-fields">
      <label className="search-field">
        <span className="sr-only">{t('search')}</span>
        <svg aria-hidden="true" className="search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder={t('searchPlaceholder')}
          className="search-input"
        />
      </label>

      {(Object.keys(FACET_OPTIONS) as Facet[]).map((facet) => (
        <FacetGroup
          key={facet}
          facet={facet}
          selected={filters[facet]}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}

function FacetGroup({
  facet,
  selected,
  onToggle,
}: {
  facet: Facet;
  selected: string[];
  onToggle: (facet: Facet, value: string) => void;
}) {
  const tFilters = useTranslations('filters');
  const tValues = useTranslations(NAMESPACE[facet]);

  return (
    <fieldset className="filter-facet">
      <legend>
        {tFilters(facet)}
      </legend>
      <div className="facet-options">
        {FACET_OPTIONS[facet].map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(facet, value)}
              className="facet-option"
            >
              {tValues(value)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
