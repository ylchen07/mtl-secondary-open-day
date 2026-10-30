import { describe, expect, it } from 'vitest';
import { schoolFileSchema, validateSchoolFiles } from '@/lib/schema';

const valid = {
  slug: 'villa-maria',
  name_en: 'Villa Maria',
  name_fr: 'Villa Maria',
  language: 'bilingual',
  gender: 'girls',
  sector: 'private',
  region: 'montreal_island',
  city: 'Montreal',
  address: '4245 Decarie Blvd, Montreal, QC H4A 3K4',
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
      notes_en: 'Sec 1 families only',
      notes_fr: 'Familles du secondaire 1 seulement',
      source_url: 'https://www.villamaria.qc.ca/admissions',
      last_verified_at: '2026-08-30',
      status: 'published',
    },
  ],
};

describe('schoolFileSchema', () => {
  it('accepts a well-formed school', () => {
    expect(schoolFileSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts unknown boarding and registration evidence', () => {
    const result = schoolFileSchema.safeParse({
      ...valid,
      has_boarding: null,
      open_days: [
        {
          ...valid.open_days[0],
          registration_required: null,
          registration_url: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it.each([
    [true, null],
    [false, 'https://school.example/register'],
    [null, 'https://school.example/register'],
  ] as const)(
    'rejects registration invariant %s / %s',
    (registration_required, registration_url) => {
      const result = schoolFileSchema.safeParse({
        ...valid,
        open_days: [
          {
            ...valid.open_days[0],
            registration_required,
            registration_url,
          },
        ],
      });
      expect(result.success).toBe(false);
    },
  );

  it.each([
    [true, 'https://school.example/register'],
    [false, null],
    [null, null],
  ] as const)(
    'accepts registration invariant %s / %s',
    (registration_required, registration_url) => {
      const result = schoolFileSchema.safeParse({
        ...valid,
        open_days: [
          {
            ...valid.open_days[0],
            registration_required,
            registration_url,
          },
        ],
      });
      expect(result.success).toBe(true);
    },
  );

  it('rejects an empty French description', () => {
    const r = schoolFileSchema.safeParse({ ...valid, description_fr: '' });
    expect(r.success).toBe(false);
  });

  it('rejects a non-https url', () => {
    const r = schoolFileSchema.safeParse({ ...valid, website_url: 'http://x.qc.ca' });
    expect(r.success).toBe(false);
  });

  it('rejects coordinates outside Greater Montreal', () => {
    const r = schoolFileSchema.safeParse({
      ...valid,
      location: { lat: -73.6206, lng: 45.4739 },
    });
    expect(r.success).toBe(false);
  });

  it('requires location to be absent when geocode_precision is missing', () => {
    const r = schoolFileSchema.safeParse({ ...valid, geocode_precision: 'missing' });
    expect(r.success).toBe(false);
  });

  it('rejects an event ending before it starts', () => {
    const r = schoolFileSchema.safeParse({
      ...valid,
      open_days: [{ ...valid.open_days[0], ends_at: '2026-09-26T12:00:00-04:00' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a non-consecutive academic year', () => {
    const r = schoolFileSchema.safeParse({
      ...valid,
      open_days: [{ ...valid.open_days[0], academic_year: '2027-2029' }],
    });
    expect(r.success).toBe(false);
  });
});

describe('date-only interviews', () => {
  const { starts_at: _s, ends_at: _e, ...timedless } = valid.open_days[0];
  const interview = {
    ...timedless,
    type: 'interview',
    starts_on: '2026-11-02',
    ends_on: '2026-11-20',
    registration_required: null,
    registration_url: null,
  };

  it('accepts an interview window with dates and no clock times', () => {
    expect(schoolFileSchema.safeParse({ ...valid, open_days: [interview] }).success).toBe(true);
  });

  it('accepts a timed interview', () => {
    const r = schoolFileSchema.safeParse({
      ...valid,
      open_days: [{ ...valid.open_days[0], type: 'interview' }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects date-only events for every other type, so no open house gets a guessed time', () => {
    const r = schoolFileSchema.safeParse({ ...valid, open_days: [{ ...interview, type: 'open_house' }] });
    expect(r.success).toBe(false);
  });

  it('rejects an event carrying both shapes', () => {
    const r = schoolFileSchema.safeParse({
      ...valid,
      open_days: [{ ...interview, starts_at: '2026-11-02T09:00:00-05:00' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a window that ends before it starts', () => {
    const r = schoolFileSchema.safeParse({ ...valid, open_days: [{ ...interview, ends_on: '2026-11-01' }] });
    expect(r.success).toBe(false);
  });

  it('reports the issue from the shape the curator meant, not an opaque union error', () => {
    const { errors } = validateSchoolFiles([
      {
        path: 'data/schools/villa-maria.json',
        json: { ...valid, open_days: [{ ...interview, ends_on: '2026-11-01' }] },
      },
      {
        path: 'data/schools/villa-maria.json',
        json: { ...valid, open_days: [{ ...valid.open_days[0], type: 'interveiw' }] },
      },
    ]);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/open_days\.0\.ends_on — starts_on must not be after ends_on/);
    expect(errors[1]).toMatch(/open_days\.0\.type — Invalid enum value/);
  });
});

describe('description optionality', () => {
  it('accepts a school with both descriptions', () => {
    expect(schoolFileSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a school with neither description', () => {
    const { description_en: _en, description_fr: _fr, ...without } = valid;
    expect(schoolFileSchema.safeParse(without).success).toBe(true);
  });

  it('accepts explicit nulls for both descriptions', () => {
    const r = schoolFileSchema.safeParse({
      ...valid,
      description_en: null,
      description_fr: null,
    });
    expect(r.success).toBe(true);
  });

  it('rejects English description without French', () => {
    const r = schoolFileSchema.safeParse({ ...valid, description_fr: null });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /both .* or neither/i.test(i.message))).toBe(true);
    }
  });

  it('rejects French description without English', () => {
    const r = schoolFileSchema.safeParse({ ...valid, description_en: null });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /both .* or neither/i.test(i.message))).toBe(true);
    }
  });

  // JSON has no `undefined`, so an absent description arrives as an OMITTED key,
  // not as null. This is the shape the harvester will actually emit. The
  // refinement handles it only because it uses loose `== null`; tightening that
  // to `=== null` would silently reopen the /fr-renders-English hole with the
  // whole suite still green. These two tests are what would catch that.
  it('rejects an omitted French description when English is present', () => {
    const { description_fr: _fr, ...withoutFr } = valid;
    const r = schoolFileSchema.safeParse(withoutFr);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /both .* or neither/i.test(i.message))).toBe(true);
    }
  });

  it('rejects an omitted English description when French is present', () => {
    const { description_en: _en, ...withoutEn } = valid;
    const r = schoolFileSchema.safeParse(withoutEn);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /both .* or neither/i.test(i.message))).toBe(true);
    }
  });

  it('still rejects an empty-string description', () => {
    const r = schoolFileSchema.safeParse({ ...valid, description_en: '', description_fr: '' });
    expect(r.success).toBe(false);
  });
});

describe('validateSchoolFiles', () => {
  it('reports duplicate slugs across files', () => {
    const { errors } = validateSchoolFiles([
      { path: 'data/schools/villa-maria.json', json: valid },
      { path: 'data/schools/other.json', json: { ...valid, slug: 'villa-maria' } },
    ]);
    expect(errors.some((e) => e.includes('duplicate slug'))).toBe(true);
  });

  it('reports a slug that does not match its filename', () => {
    const { errors } = validateSchoolFiles([
      { path: 'data/schools/wrong-name.json', json: valid },
    ]);
    expect(errors.some((e) => e.includes('filename'))).toBe(true);
  });

  it('collects errors from every file rather than stopping at the first', () => {
    const { errors, ok } = validateSchoolFiles([
      { path: 'data/schools/a.json', json: { slug: 'a' } },
      { path: 'data/schools/b.json', json: { slug: 'b' } },
    ]);
    expect(ok).toHaveLength(0);
    expect(errors.filter((e) => e.startsWith('data/schools/a.json')).length).toBeGreaterThan(0);
    expect(errors.filter((e) => e.startsWith('data/schools/b.json')).length).toBeGreaterThan(0);
  });

  it('excludes files with file-level errors from ok array', () => {
    const validSchool = { ...valid, slug: 'school-a' };
    const duplicateSlugSchool = { ...valid, slug: 'school-a' };
    const { errors, ok } = validateSchoolFiles([
      { path: 'data/schools/school-a.json', json: validSchool },
      { path: 'data/schools/other.json', json: duplicateSlugSchool },
    ]);
    expect(errors.some((e) => e.includes('duplicate slug'))).toBe(true);
    expect(ok).toHaveLength(1);
    expect(ok[0].slug).toBe('school-a');
  });
});
