import type { AgendaEvent, SchoolListing } from './types';

export type FilterState = {
  q: string;
  language: string[];
  region: string[];
  gender: string[];
  sector: string[];
  type: string[];
  boarding: boolean;
};

export const EMPTY_FILTERS: FilterState = {
  q: '',
  language: [],
  region: [],
  gender: [],
  sector: [],
  type: [],
  boarding: false,
};

/** Lowercase and strip diacritics so "brebeuf" matches "Brébeuf". */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** The school facts a filter can test; a null fact is unconfirmed. */
type FilterableSchool = Pick<
  SchoolListing,
  'name_en' | 'name_fr' | 'city' | 'programs' | 'region' | 'sector' | 'language' | 'gender' | 'has_boarding'
>;

function matchesQuery(school: FilterableSchool, q: string): boolean {
  if (!q) return true;
  const haystack = normalize(
    [school.name_en, school.name_fr, school.city, ...school.programs].join(' '),
  );
  return normalize(q)
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

function matchesFacet(selected: string[], value: string | null): boolean {
  // An unconfirmed fact never satisfies a filter: a guess must not answer "girls only?".
  return selected.length === 0 || (value !== null && selected.includes(value));
}

/** Within a facet, values are OR'd. Across facets, they are AND'd. The event-type facet is not a school fact. */
export function matchesSchool(school: FilterableSchool, filters: FilterState): boolean {
  return (
    matchesQuery(school, filters.q) &&
    matchesFacet(filters.language, school.language) &&
    matchesFacet(filters.region, school.region) &&
    matchesFacet(filters.gender, school.gender) &&
    matchesFacet(filters.sector, school.sector) &&
    (!filters.boarding || school.has_boarding === true)
  );
}

export function applyFilters(
  events: AgendaEvent[],
  filters: FilterState,
): AgendaEvent[] {
  return events.filter(
    (event) => matchesSchool(event.school, filters) && matchesFacet(filters.type, event.type),
  );
}

const FACETS = ['language', 'region', 'gender', 'sector', 'type'] as const;

export function parseFilters(params: URLSearchParams): FilterState {
  const state: FilterState = {
    ...EMPTY_FILTERS,
    q: params.get('q') ?? '',
    boarding: params.get('boarding') === 'true',
  };
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
  if (filters.boarding) params.set('boarding', 'true');
  return params;
}
