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
    <div className="space-y-5">
      <label className="relative block">
        <span className="sr-only">{t('search')}</span>
        <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--ink-3)" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder={t('searchPlaceholder')}
          className="w-full border border-transparent bg-(--paper-sunk) py-2 pl-9 pr-3 text-sm text-(--ink) placeholder:text-(--ink-3) focus:border-(--rule-strong) focus:bg-(--paper) focus:outline-none"
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
      <legend className="text-[11px] font-semibold uppercase tracking-[0.07em] text-(--ink-3)">
        {tFilters(facet)}
      </legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FACET_OPTIONS[facet].map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(facet, value)}
              className={`border px-2.5 py-1 text-[13px] transition-colors ${
                active
                  ? 'border-(--ink) bg-(--ink) text-(--paper)'
                  : 'border-(--rule-strong) text-(--ink-2) hover:border-(--ink-3) hover:text-(--ink)'
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
