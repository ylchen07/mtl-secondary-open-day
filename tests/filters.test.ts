import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  applyFilters,
  normalize,
  parseFilters,
  serializeFilters,
} from '@/lib/filters';
import type { AgendaEvent, SchoolRow } from '@/lib/types';

function school(over: Partial<SchoolRow> = {}): SchoolRow {
  return {
    id: 's1', slug: 'brebeuf', name_en: 'Brébeuf College', name_fr: 'Collège Jean-de-Brébeuf',
    language: 'fr', gender: 'mixed', region: 'montreal_island', city: 'Montréal',
    address: 'a', postal_code: 'H1H 1H1', lat: null, lng: null, geocode_precision: 'missing',
    website_url: 'https://a.qc.ca', admissions_url: 'https://a.qc.ca',
    tuition_annual_cad: null, has_boarding: false, programs: ['ib'],
    description_en: 'd', description_fr: 'd', source_url: 'https://a.qc.ca',
    last_verified_at: '2026-08-30', status: 'published', ...over,
  };
}

function event(over: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: 'e1', school_id: 's1', starts_at: '2026-09-26T17:00:00.000Z',
    ends_at: '2026-09-26T20:00:00.000Z', type: 'open_house', academic_year: '2027-2028',
    registration_required: false, registration_url: null, notes_en: null, notes_fr: null,
    source_url: 'https://a.qc.ca', last_verified_at: '2026-08-30', status: 'published',
    school: school(), ...over,
  };
}

describe('normalize', () => {
  it('strips accents and lowercases', () => {
    expect(normalize('Collège Jean-de-Brébeuf')).toBe('college jean-de-brebeuf');
  });
});

describe('applyFilters', () => {
  const events = [
    event(),
    event({ id: 'e2', type: 'entrance_exam', school: school({ id: 's2', slug: 'loyola', name_en: 'Loyola High School', name_fr: 'Loyola High School', language: 'en', gender: 'boys', city: 'Montreal', programs: [] }) }),
  ];

  it('returns everything when no filters are set', () => {
    expect(applyFilters(events, EMPTY_FILTERS)).toHaveLength(2);
  });

  it('matches an unaccented query against an accented name', () => {
    const out = applyFilters(events, { ...EMPTY_FILTERS, q: 'brebeuf' });
    expect(out.map((e) => e.id)).toEqual(['e1']);
  });

  it('matches on program', () => {
    const out = applyFilters(events, { ...EMPTY_FILTERS, q: 'ib' });
    expect(out.map((e) => e.id)).toEqual(['e1']);
  });

  it('treats values within one facet as OR', () => {
    const out = applyFilters(events, { ...EMPTY_FILTERS, language: ['fr', 'en'] });
    expect(out).toHaveLength(2);
  });

  it('treats separate facets as AND', () => {
    const out = applyFilters(events, {
      ...EMPTY_FILTERS, language: ['en'], type: ['open_house'],
    });
    expect(out).toHaveLength(0);
  });
});

describe('filter URL round-trip', () => {
  it('survives serialization', () => {
    const filters = { q: 'brebeuf', language: ['fr'], region: [], gender: ['mixed'], type: ['entrance_exam'] };
    expect(parseFilters(serializeFilters(filters))).toEqual(filters);
  });

  it('parses empty params into empty filters', () => {
    expect(parseFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });
});
