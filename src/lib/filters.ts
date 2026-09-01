import type { AgendaEvent } from './types';

export type FilterState = {
  q: string;
  language: string[];
  region: string[];
  gender: string[];
  type: string[];
};

export const EMPTY_FILTERS: FilterState = {
  q: '',
  language: [],
  region: [],
  gender: [],
  type: [],
};

/** Lowercase and strip diacritics so "brebeuf" matches "Brébeuf". */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function matchesQuery(event: AgendaEvent, q: string): boolean {
  if (!q) return true;
  const haystack = normalize(
    [
      event.school.name_en,
      event.school.name_fr,
      event.school.city,
      ...event.school.programs,
    ].join(' '),
  );
  return normalize(q)
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

/** Within a facet, values are OR'd. Across facets, they are AND'd. */
export function applyFilters(
  events: AgendaEvent[],
  filters: FilterState,
): AgendaEvent[] {
  return events.filter(
    (event) =>
      matchesQuery(event, filters.q) &&
      (filters.language.length === 0 || filters.language.includes(event.school.language)) &&
      (filters.region.length === 0 || filters.region.includes(event.school.region)) &&
      (filters.gender.length === 0 || filters.gender.includes(event.school.gender)) &&
      (filters.type.length === 0 || filters.type.includes(event.type)),
  );
}

const FACETS = ['language', 'region', 'gender', 'type'] as const;

export function parseFilters(params: URLSearchParams): FilterState {
  const state: FilterState = { ...EMPTY_FILTERS, q: params.get('q') ?? '' };
  for (const facet of FACETS) {
    const raw = params.get(facet);
    state[facet] = raw ? raw.split(',').filter(Boolean) : [];
  }
  return state;
}

export function serializeFilters(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const facet of FACETS) {
    if (filters[facet].length > 0) params.set(facet, filters[facet].join(','));
  }
  return params;
}
