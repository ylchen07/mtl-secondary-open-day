import { describe, expect, it } from 'vitest';
import { findClashes } from '@/lib/clash';
import type { AgendaEvent, SchoolRow } from '@/lib/types';

function school(over: Partial<SchoolRow> = {}): SchoolRow {
  return {
    id: 's1', slug: 'brebeuf', name_en: 'Brébeuf', name_fr: 'Brébeuf',
    language: 'fr', gender: 'mixed', region: 'montreal_island', city: 'Montréal',
    address: 'a', postal_code: 'H1H 1H1', lat: null, lng: null, geocode_precision: 'missing',
    website_url: 'https://a.qc.ca', admissions_url: 'https://a.qc.ca',
    tuition_annual_cad: null, has_boarding: false, programs: [],
    description_en: 'd', description_fr: 'd', source_url: 'https://a.qc.ca',
    last_verified_at: '2026-08-30', status: 'published', ...over,
  };
}

function event(id: string, startsAt: string, endsAt: string, over: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id, school_id: over.school?.id ?? 's1', starts_at: startsAt, ends_at: endsAt,
    type: 'open_house', academic_year: '2027-2028', registration_required: false,
    registration_url: null, notes_en: null, notes_fr: null,
    source_url: 'https://a.qc.ca', last_verified_at: '2026-08-30', status: 'published',
    school: school(), ...over,
  };
}

describe('findClashes', () => {
  it('finds two overlapping events at different schools', () => {
    const a = event('a', '2026-09-26T17:00:00Z', '2026-09-26T20:00:00Z');
    const b = event('b', '2026-09-26T18:00:00Z', '2026-09-26T21:00:00Z', {
      school: school({ id: 's2', slug: 'loyola', name_en: 'Loyola', name_fr: 'Loyola' }),
    });
    const clashes = findClashes([a, b]);
    expect(clashes.get('a')?.map((e) => e.id)).toEqual(['b']);
    expect(clashes.get('b')?.map((e) => e.id)).toEqual(['a']);
  });

  it('does not report events that merely touch at the boundary', () => {
    const a = event('a', '2026-09-26T17:00:00Z', '2026-09-26T20:00:00Z');
    const b = event('b', '2026-09-26T20:00:00Z', '2026-09-26T22:00:00Z', {
      school: school({ id: 's2' }),
    });
    expect(findClashes([a, b]).size).toBe(0);
  });

  it('does not report two events at the same school as a clash', () => {
    const a = event('a', '2026-09-26T17:00:00Z', '2026-09-26T20:00:00Z');
    const b = event('b', '2026-09-26T18:00:00Z', '2026-09-26T21:00:00Z');
    expect(findClashes([a, b]).size).toBe(0);
  });

  it('returns an empty map for non-overlapping events', () => {
    const a = event('a', '2026-09-26T17:00:00Z', '2026-09-26T20:00:00Z');
    const b = event('b', '2026-10-03T17:00:00Z', '2026-10-03T20:00:00Z', {
      school: school({ id: 's2' }),
    });
    expect(findClashes([a, b]).size).toBe(0);
  });
});
