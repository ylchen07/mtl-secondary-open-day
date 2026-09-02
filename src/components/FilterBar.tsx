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
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">{t('search')}</span>
        <input
          type="search"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded border border-neutral-300 px-3 py-2"
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
    <fieldset>
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {tFilters(facet)}
      </legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {FACET_OPTIONS[facet].map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(facet, value)}
              className={`rounded-full border px-3 py-1 text-sm ${
                active
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-300 text-neutral-700'
              }`}
            >
              {tValues(value)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
