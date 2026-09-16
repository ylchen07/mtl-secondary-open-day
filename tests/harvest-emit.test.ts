import { describe, it, expect } from 'vitest';
import { toDraftSchool, serialise, montrealOffset, academicYearFor } from '@/lib/harvest/emit';
import { schoolFileSchema } from '@/lib/schema';
import type { ListingEntry, SchoolFacts } from '@/lib/harvest/types';

const TODAY = '2026-09-03';

const entry: ListingEntry = {
  feepSlug: 'college-international-marie-de-france',
  nameFr: 'Collège international Marie de France',
  region: 'montreal_island',
  externalUrl: 'https://www.cimf.ca/admission/sinscrire/',
  events: [
    { date: '2026-09-26', startTime: '09:00', endTime: '13:15', rawDate: '26 septembre 2026', noteFr: null },
  ],
};

const facts: SchoolFacts = {
  address: '4635, chemin Queen-Mary',
  city: 'Montréal',
  postalCode: 'H3W 1W3',
  language: 'fr',
  isSecondary: true,
  genderGuess: 'mixed',
  genderConfident: false,
};

describe('montrealOffset', () => {
  it('is -04:00 (EDT) on a September date', () => {
    expect(montrealOffset('2026-09-26', '09:00')).toBe('-04:00');
  });

  it('is -05:00 (EST) on a date after the 2026-11-01 DST changeover', () => {
    expect(montrealOffset('2026-11-21', '09:00')).toBe('-05:00');
  });

  it('is -04:00 on the last day before the 2026 changeover', () => {
    expect(montrealOffset('2026-10-31', '09:00')).toBe('-04:00');
  });

  it('is -05:00 on the changeover date itself (clocks fall back at 2am)', () => {
    expect(montrealOffset('2026-11-01', '09:00')).toBe('-05:00');
  });
});

describe('academicYearFor', () => {
  // Real, checked-in FEEP evidence for the July 1 boundary — not invented
  // data. Both entries are April (m=4 < 7), the branch the three
  // already-published September files never exercise. FEEP publishes its own
  // "Année scolaire" for each and both match this function's output exactly.

  it('matches FEEP\'s own stated "Année scolaire 2027-2028" for Collège Reine-Marie (17 avril 2027)', () => {
    // tests/fixtures/feep/listing-montreal.html: "17 avril 2027" ... "Année scolaire 2027-2028"
    expect(academicYearFor('2027-04-17')).toBe('2027-2028');
  });

  it('matches FEEP\'s own stated "Année scolaire 2026-2027" for Académie Centennial (25 avril 2026)', () => {
    // tests/fixtures/feep/listing-montreal.html: "25 avril 2026" ... "Année scolaire 2026-2027"
    expect(academicYearFor('2026-04-25')).toBe('2026-2027');
  });
});

describe('toDraftSchool', () => {
  it('produces an object the real schema accepts', () => {
    const draft = toDraftSchool(entry, facts, TODAY);
    const parsed = schoolFileSchema.safeParse(draft);
    if (!parsed.success) console.error(parsed.error.issues);
    expect(parsed.success).toBe(true);
  });

  it('marks the school AND its events as draft', () => {
    const draft = toDraftSchool(entry, facts, TODAY);
    expect(draft.status).toBe('draft');
    expect(draft.open_days[0].status).toBe('draft');
  });

  it('emits no description at all', () => {
    const draft = toDraftSchool(entry, facts, TODAY);
    expect(draft.description_en ?? null).toBeNull();
    expect(draft.description_fr ?? null).toBeNull();
  });

  it('defaults unverified boarding and registration facts to null', () => {
    const draft = toDraftSchool(entry, facts, TODAY);
    expect(draft.has_boarding).toBeNull();
    expect(draft.open_days[0].registration_required).toBeNull();
    expect(draft.open_days[0].registration_url).toBeNull();
  });

  it('converts local Montreal time to an explicit offset', () => {
    const draft = toDraftSchool(entry, facts, TODAY);
    // 26 Sep is EDT (-04:00)
    expect(draft.open_days[0].starts_at).toBe('2026-09-26T09:00:00-04:00');
    expect(draft.open_days[0].ends_at).toBe('2026-09-26T13:15:00-04:00');
  });

  it('uses EST (-05:00) for a date after the DST changeover', () => {
    const winter = { ...entry, events: [{ ...entry.events[0], date: '2026-11-21' }] };
    const draft = toDraftSchool(winter, facts, TODAY);
    expect(draft.open_days[0].starts_at).toBe('2026-11-21T09:00:00-05:00');
  });

  it('maps every event in entry.events to its own open_days row, in order', () => {
    const multi: ListingEntry = {
      ...entry,
      events: [
        { date: '2026-10-10', startTime: '09:00', endTime: '11:00', rawDate: 'a', noteFr: null },
        { date: '2026-11-14', startTime: '13:00', endTime: '16:00', rawDate: 'b', noteFr: null },
      ],
    };
    const draft = toDraftSchool(multi, facts, TODAY);
    expect(draft.open_days).toHaveLength(2);
    expect(draft.open_days[0].starts_at).toBe('2026-10-10T09:00:00-04:00');
    expect(draft.open_days[1].starts_at).toBe('2026-11-14T13:00:00-05:00');
  });

  it('carries geocode_precision "missing" with a null location', () => {
    const draft = toDraftSchool(entry, facts, TODAY);
    expect(draft.geocode_precision).toBe('missing');
    expect(draft.location ?? null).toBeNull();
  });

  it('uses the school\u2019s own externalUrl for website_url and admissions_url when present', () => {
    const draft = toDraftSchool(entry, facts, TODAY);
    expect(draft.website_url).toBe('https://www.cimf.ca/admission/sinscrire/');
    expect(draft.admissions_url).toBe('https://www.cimf.ca/admission/sinscrire/');
  });

  it('always sets source_url (school and every event) to the FEEP detail page, never the school\u2019s own site', () => {
    const draft = toDraftSchool(entry, facts, TODAY);
    const feepUrl = 'https://www.feep.qc.ca/ecoles-privees-quebec/college-international-marie-de-france';
    expect(draft.source_url).toBe(feepUrl);
    expect(draft.open_days[0].source_url).toBe(feepUrl);
  });

  it('falls back website_url/admissions_url to the FEEP page when externalUrl is null', () => {
    const noSite: ListingEntry = { ...entry, externalUrl: null };
    const draft = toDraftSchool(noSite, facts, TODAY);
    const feepUrl = 'https://www.feep.qc.ca/ecoles-privees-quebec/college-international-marie-de-france';
    expect(draft.website_url).toBe(feepUrl);
    expect(draft.admissions_url).toBe(feepUrl);
    expect(draft.source_url).toBe(feepUrl);
  });

  it('throws rather than silently emitting an untimed event', () => {
    const untimed: ListingEntry = {
      ...entry,
      events: [{ date: '2026-09-26', startTime: null, endTime: null, rawDate: 'x', noteFr: null }],
    };
    expect(() => toDraftSchool(untimed, facts, TODAY)).toThrow();
  });
});

describe('serialise', () => {
  it('is idempotent — same input, byte-identical output', () => {
    const draft = toDraftSchool(entry, facts, TODAY);
    expect(serialise(draft)).toBe(serialise(toDraftSchool(entry, facts, TODAY)));
  });

  it('ends with a trailing newline', () => {
    expect(serialise(toDraftSchool(entry, facts, TODAY)).endsWith('\n')).toBe(true);
  });

  it('orders keys stably regardless of construction order', () => {
    const a = serialise(toDraftSchool(entry, facts, TODAY));
    const reordered = { ...toDraftSchool(entry, facts, TODAY) };
    expect(serialise(reordered as never)).toBe(a);
  });

  it('produces the exact expected key order and values for a fixed input', () => {
    const draft = toDraftSchool(entry, facts, TODAY);
    expect(serialise(draft)).toBe(
      JSON.stringify(
        {
          slug: 'college-international-marie-de-france',
          name_en: 'Collège international Marie de France',
          name_fr: 'Collège international Marie de France',
          language: 'fr',
          gender: 'mixed',
          region: 'montreal_island',
          city: 'Montréal',
          address: '4635, chemin Queen-Mary',
          postal_code: 'H3W 1W3',
          location: null,
          geocode_precision: 'missing',
          website_url: 'https://www.cimf.ca/admission/sinscrire/',
          admissions_url: 'https://www.cimf.ca/admission/sinscrire/',
          tuition_annual_cad: null,
          has_boarding: null,
          programs: [],
          description_en: null,
          description_fr: null,
          source_url: 'https://www.feep.qc.ca/ecoles-privees-quebec/college-international-marie-de-france',
          last_verified_at: '2026-09-03',
          status: 'draft',
          open_days: [
            {
              starts_at: '2026-09-26T09:00:00-04:00',
              ends_at: '2026-09-26T13:15:00-04:00',
              type: 'open_house',
              academic_year: '2027-2028',
              registration_required: null,
              registration_url: null,
              notes_en: null,
              notes_fr: null,
              source_url: 'https://www.feep.qc.ca/ecoles-privees-quebec/college-international-marie-de-france',
              last_verified_at: '2026-09-03',
              status: 'draft',
            },
          ],
        },
        null,
        2,
      ) + '\n',
    );
  });
});
