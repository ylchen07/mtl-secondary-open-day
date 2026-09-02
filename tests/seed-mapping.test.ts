import { describe, expect, it } from 'vitest';
import { toOpenDayRows, toSchoolRow } from '@/lib/seed-mapping';
import type { SchoolFile } from '@/lib/schema';

const file = {
  slug: 'villa-maria',
  name_en: 'Villa Maria',
  name_fr: 'Villa Maria',
  language: 'bilingual',
  gender: 'girls',
  region: 'montreal_island',
  city: 'Montreal',
  address: '4245 Decarie Blvd',
  postal_code: 'H4A 3K4',
  location: { lat: 45.4739, lng: -73.6206 },
  geocode_precision: 'exact',
  website_url: 'https://www.villamaria.qc.ca',
  admissions_url: 'https://www.villamaria.qc.ca/admissions',
  tuition_annual_cad: 5200,
  has_boarding: false,
  programs: ['ib'],
  description_en: 'A school.',
  description_fr: 'Une ecole.',
  source_url: 'https://www.villamaria.qc.ca/admissions',
  last_verified_at: '2026-08-30',
  status: 'published',
  open_days: [
    {
      starts_at: '2026-09-26T13:00:00-04:00',
      ends_at: '2026-09-26T16:00:00-04:00',
      type: 'open_house',
      academic_year: '2027-2028',
      registration_required: true,
      registration_url: 'https://www.villamaria.qc.ca/register',
      notes_en: null,
      notes_fr: null,
      source_url: 'https://www.villamaria.qc.ca/admissions',
      last_verified_at: '2026-08-30',
      status: 'published',
    },
  ],
} as SchoolFile;

describe('toSchoolRow', () => {
  it('flattens location into lat and lng', () => {
    const row = toSchoolRow(file);
    expect(row.lat).toBe(45.4739);
    expect(row.lng).toBe(-73.6206);
    expect('location' in row).toBe(false);
  });

  it('drops open_days from the school row', () => {
    expect('open_days' in toSchoolRow(file)).toBe(false);
  });

  it('nulls coordinates when location is absent', () => {
    const row = toSchoolRow({ ...file, location: null, geocode_precision: 'missing' });
    expect(row.lat).toBeNull();
    expect(row.lng).toBeNull();
  });
});

describe('toOpenDayRows', () => {
  it('normalizes timestamps to UTC', () => {
    const [row] = toOpenDayRows(file, 'school-uuid');
    expect(row.starts_at).toBe('2026-09-26T17:00:00.000Z');
    expect(row.school_id).toBe('school-uuid');
  });
});
