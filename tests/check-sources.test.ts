import { describe, expect, it } from 'vitest';
import type { SchoolFile } from '@/lib/schema';
import { findAggregatorSources } from '../scripts/check-sources';

function school(over: Partial<SchoolFile>): SchoolFile {
  return {
    slug: 's',
    name_en: 'S',
    name_fr: 'S',
    language: 'fr',
    gender: 'mixed',
    region: 'montreal_island',
    city: 'Montreal',
    address: 'a',
    postal_code: 'H1A 1A1',
    location: { lat: 45.5, lng: -73.6 },
    geocode_precision: 'approximate',
    website_url: 'https://s.qc.ca',
    admissions_url: 'https://s.qc.ca/a',
    tuition_annual_cad: null,
    has_boarding: false,
    programs: [],
    description_en: null,
    description_fr: null,
    source_url: 'https://s.qc.ca/a',
    last_verified_at: '2026-09-03',
    status: 'published',
    open_days: [],
    ...over,
  };
}

function event(over: Partial<SchoolFile['open_days'][number]> = {}): SchoolFile['open_days'][number] {
  return {
    starts_at: '2026-10-03T10:00:00-04:00',
    ends_at: '2026-10-03T15:00:00-04:00',
    type: 'open_house',
    academic_year: '2027-2028',
    registration_required: false,
    registration_url: null,
    notes_en: null,
    notes_fr: null,
    source_url: 'https://s.qc.ca/a',
    last_verified_at: '2026-09-03',
    status: 'published',
    ...over,
  };
}

describe('findAggregatorSources', () => {
  it('passes a published school sourced from its own site', () => {
    expect(findAggregatorSources([school({ open_days: [event()] })])).toEqual([]);
  });

  it('flags a published school sourced from FEEP', () => {
    const out = findAggregatorSources([
      school({ source_url: 'https://www.feep.qc.ca/ecoles-privees-quebec/s' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/feep\.qc\.ca/);
  });

  it('flags a published event sourced from FEEP', () => {
    const out = findAggregatorSources([
      school({ open_days: [event({ source_url: 'https://feep.qc.ca/x' })] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/feep\.qc\.ca/);
  });

  it('allows a DRAFT school to cite FEEP — that is the whole point of drafts', () => {
    const out = findAggregatorSources([
      school({ status: 'draft', source_url: 'https://www.feep.qc.ca/x' }),
    ]);
    expect(out).toEqual([]);
  });

  it('allows a draft event under a published school', () => {
    const out = findAggregatorSources([
      school({ open_days: [event({ status: 'draft', source_url: 'https://feep.qc.ca/x' })] }),
    ]);
    expect(out).toEqual([]);
  });

  it('matches subdomains but not lookalike domains', () => {
    expect(
      findAggregatorSources([school({ source_url: 'https://a.feep.qc.ca/x' })]),
    ).toHaveLength(1);
    expect(findAggregatorSources([school({ source_url: 'https://notfeep.qc.ca/x' })])).toEqual([]);
  });

  it('is not evaded by a fully-qualified host with a trailing dot', () => {
    expect(
      findAggregatorSources([school({ source_url: 'https://www.feep.qc.ca./x' })]),
    ).toHaveLength(1);
  });
});
