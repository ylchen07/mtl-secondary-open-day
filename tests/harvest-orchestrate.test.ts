import { describe, it, expect, vi } from 'vitest';
import {
  todayInMontreal,
  loadExistingSchools,
  runHarvest,
  type HarvestDeps,
} from '@/lib/harvest/orchestrate';
import type { SchoolFile } from '@/lib/schema';

const published = (slug: string, nameFr: string): SchoolFile =>
  ({
    slug,
    name_en: nameFr,
    name_fr: nameFr,
    language: 'fr',
    gender: 'mixed',
    region: 'montreal_island',
    city: 'Montréal',
    address: '123 Rue Test',
    postal_code: 'H3W 1W4',
    location: null,
    geocode_precision: 'missing',
    website_url: 'https://example.qc.ca',
    admissions_url: 'https://example.qc.ca/admissions',
    tuition_annual_cad: null,
    has_boarding: false,
    programs: [],
    description_en: null,
    description_fr: null,
    source_url: 'https://example.qc.ca',
    last_verified_at: '2026-01-01',
    status: 'published',
    open_days: [],
  }) as SchoolFile;

describe('todayInMontreal', () => {
  it('reports the Montreal calendar date, not the UTC one, just after local midnight', () => {
    // 2026-03-15T02:30:00-04:00 (Montreal, EDT) is 2026-03-15T06:30:00Z (UTC) —
    // same day both ways, not the disagreement case.
    // The disagreement case: 2026-03-15T23:30:00-04:00 (Montreal) is
    // 2026-03-16T03:30:00Z (UTC) — UTC has already rolled to the 16th while
    // Montreal is still on the 15th.
    const lateMontrealNight = new Date('2026-03-16T03:30:00Z');
    expect(todayInMontreal(lateMontrealNight)).toBe('2026-03-15');
  });

  it('reports the Montreal calendar date correctly across the UTC→EST boundary too', () => {
    // 2026-01-01T04:30:00Z is 2025-12-31T23:30:00-05:00 in Montreal (EST) —
    // UTC has rolled to Jan 1st, Montreal is still on Dec 31st.
    const lateMontrealNightEst = new Date('2026-01-01T04:30:00Z');
    expect(todayInMontreal(lateMontrealNightEst)).toBe('2025-12-31');
  });

  it('agrees with UTC at a time with no boundary disagreement', () => {
    const noon = new Date('2026-06-15T16:00:00Z'); // noon EDT
    expect(todayInMontreal(noon)).toBe('2026-06-15');
  });
});

describe('loadExistingSchools', () => {
  it('returns parsed schools when every file is valid JSON and schema-valid', async () => {
    const readdir = vi.fn().mockResolvedValue(['a.json', 'b.json']);
    const readFile = vi.fn().mockImplementation((path: string) => {
      if (path.endsWith('a.json')) return Promise.resolve(JSON.stringify(published('a', 'A')));
      return Promise.resolve(JSON.stringify(published('b', 'B')));
    });

    const out = await loadExistingSchools({ readdir, readFile } as never);

    expect(out.map((s) => s.slug).sort()).toEqual(['a', 'b']);
  });

  it('fails closed — throws, writing nothing — when an existing file is not valid JSON', async () => {
    const readdir = vi.fn().mockResolvedValue(['broken.json']);
    const readFile = vi.fn().mockResolvedValue('{ not json');

    await expect(loadExistingSchools({ readdir, readFile } as never)).rejects.toThrow(
      /broken\.json/,
    );
  });

  it('fails closed — throws — when an existing file is schema-invalid', async () => {
    const readdir = vi.fn().mockResolvedValue(['bad-school.json']);
    const readFile = vi.fn().mockResolvedValue(JSON.stringify({ slug: 'bad-school' }));

    await expect(loadExistingSchools({ readdir, readFile } as never)).rejects.toThrow(
      /bad-school\.json/,
    );
  });

  it('never calls readFile again after the first invalid file (no partial writes downstream)', async () => {
    const readdir = vi.fn().mockResolvedValue(['broken.json', 'a.json']);
    const readFile = vi
      .fn()
      .mockResolvedValueOnce('{ not json')
      .mockResolvedValueOnce(JSON.stringify(published('a', 'A')));

    await expect(loadExistingSchools({ readdir, readFile } as never)).rejects.toThrow();
    // Order from readdir is preserved and the loader stops at the first bad file —
    // it must not race ahead and read further files after failing closed.
    expect(readFile).toHaveBeenCalledTimes(1);
  });
});

const LISTING_HTML = '<html>fixture-standin</html>';

function baseDeps(overrides: Partial<HarvestDeps> = {}): HarvestDeps {
  return {
    fetchListing: vi.fn().mockResolvedValue(LISTING_HTML),
    fetchDetail: vi.fn().mockResolvedValue('<html>detail-standin</html>'),
    parseListing: vi.fn().mockReturnValue([]),
    parseDetail: vi.fn().mockReturnValue({
      address: '1 Rue X',
      city: 'Montréal',
      postalCode: 'H1H 1H1',
      language: 'fr',
      isSecondary: true,
      genderGuess: 'mixed',
      genderConfident: true,
    }),
    existing: [],
    today: '2026-01-01',
    delay: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const entry = (slug: string) => ({
  feepSlug: slug,
  nameFr: `École ${slug}`,
  region: 'montreal_island' as const,
  externalUrl: null,
  events: [
    {
      date: '2026-10-10',
      startTime: '10:00',
      endTime: '15:00',
      rawDate: '10 octobre 2026',
      noteFr: null,
    },
  ],
});

describe('runHarvest', () => {
  it('writes one draft file per successfully-fetched, secondary, schema-valid create decision', async () => {
    const deps = baseDeps({
      parseListing: vi.fn().mockReturnValue([entry('school-a'), entry('school-b')]),
    });

    const result = await runHarvest(deps);

    expect(deps.writeFile).toHaveBeenCalledTimes(2);
    expect(result.written).toEqual(['school-a', 'school-b']);
  });

  it('only ever calls toDraftSchool-backed writing for reconcile "create" decisions — an out-of-region entry is never fetched or written', async () => {
    const deps = baseDeps({
      parseListing: vi
        .fn()
        .mockReturnValue([{ ...entry('out-of-scope'), region: null }, entry('in-scope')]),
    });

    const result = await runHarvest(deps);

    expect(deps.fetchDetail).toHaveBeenCalledTimes(1);
    expect(deps.fetchDetail).toHaveBeenCalledWith(
      expect.stringContaining('in-scope'),
    );
    expect(result.written).toEqual(['in-scope']);
  });

  it('reports a failed detail fetch as a visible skip, not silently as if it never existed', async () => {
    const fetchDetail = vi
      .fn()
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValue('<html>ok</html>');
    const deps = baseDeps({
      parseListing: vi.fn().mockReturnValue([entry('flaky'), entry('fine')]),
      fetchDetail,
    });

    const result = await runHarvest(deps);

    expect(result.written).toEqual(['fine']);
    expect(result.report).toMatch(/flaky.*detail fetch failed/i);
    // The Created section must equal what was actually written — one, not two.
    expect(result.report).toMatch(/Created: \*\*1\*\*/);
  });

  it('excludes a primary-only school from Created and lists it under primary-only exclusions, not the generic Skipped list', async () => {
    const deps = baseDeps({
      parseListing: vi.fn().mockReturnValue([entry('primary-school')]),
      parseDetail: vi.fn().mockReturnValue({
        address: '1 Rue X',
        city: 'Montréal',
        postalCode: 'H1H 1H1',
        language: 'fr',
        isSecondary: false,
        genderGuess: 'mixed',
        genderConfident: true,
      }),
    });

    const result = await runHarvest(deps);

    expect(result.written).toEqual([]);
    expect(result.report).toMatch(/Excluded as primary-only[\s\S]*primary-school/);
    expect(result.report).toMatch(/Created: \*\*0\*\*/);
  });

  it('carries a gender-unconfirmed draft into the report by slug', async () => {
    const deps = baseDeps({
      parseListing: vi.fn().mockReturnValue([entry('unsure-gender')]),
      parseDetail: vi.fn().mockReturnValue({
        address: '1 Rue X',
        city: 'Montréal',
        postalCode: 'H1H 1H1',
        language: 'fr',
        isSecondary: true,
        genderGuess: 'mixed',
        genderConfident: false,
      }),
    });

    const result = await runHarvest(deps);

    expect(result.written).toEqual(['unsure-gender']);
    expect(result.report).toMatch(/Gender unconfirmed[\s\S]*unsure-gender/);
  });

  it('never writes a file for a school whose existing file is already published', async () => {
    const deps = baseDeps({
      parseListing: vi.fn().mockReturnValue([entry('villa-maria')]),
      existing: [published('villa-maria', 'Villa Maria')],
    });

    const result = await runHarvest(deps);

    expect(deps.writeFile).not.toHaveBeenCalled();
    expect(result.written).toEqual([]);
    expect(result.report).toMatch(/villa-maria.*already published/);
  });

  it('delays between every detail-page attempt, including a failed fetch and a primary-only result — never back-to-back', async () => {
    const fetchDetail = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce('<html>primary</html>')
      .mockResolvedValueOnce('<html>ok</html>');
    const parseDetail = vi
      .fn()
      .mockReturnValueOnce({
        address: '1 Rue X',
        city: 'Montréal',
        postalCode: 'H1H 1H1',
        language: 'fr',
        isSecondary: false,
        genderGuess: 'mixed',
        genderConfident: true,
      })
      .mockReturnValueOnce({
        address: '1 Rue X',
        city: 'Montréal',
        postalCode: 'H1H 1H1',
        language: 'fr',
        isSecondary: true,
        genderGuess: 'mixed',
        genderConfident: true,
      });
    const delay = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      parseListing: vi.fn().mockReturnValue([entry('fails'), entry('primary'), entry('good')]),
      fetchDetail,
      parseDetail,
      delay,
    });

    await runHarvest(deps);

    // Three detail-page attempts were made (one per candidate) — the delay
    // must run after each attempt regardless of outcome, or the harvester is
    // hammering FEEP back-to-back on every non-success path.
    expect(deps.fetchDetail).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(3);
  });

  it('drops a draft that fails schema validation rather than writing malformed data, and surfaces it visibly', async () => {
    // FEEP's slug is a URL path segment, not something reconcile() or
    // toDraftSchool validate — a slug with an underscore or uppercase
    // character reaches schoolFileSchema's kebab-case regex unchanged and
    // fails there. This is the one realistic way a `create` decision built
    // from live FEEP markup produces a schema-invalid draft.
    const deps = baseDeps({
      parseListing: vi.fn().mockReturnValue([entry('Not_Kebab_Case')]),
    });

    const result = await runHarvest(deps);

    expect(deps.writeFile).not.toHaveBeenCalled();
    expect(result.written).toEqual([]);
    expect(result.report).toMatch(/Not_Kebab_Case.*(draft failed validation|schema)/i);
  });

  it('is idempotent: running twice against the same inputs writes the same bytes both times', async () => {
    const deps1 = baseDeps({ parseListing: vi.fn().mockReturnValue([entry('repeat-me')]) });
    const result1 = await runHarvest(deps1);
    const firstBytes = (deps1.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];

    const deps2 = baseDeps({ parseListing: vi.fn().mockReturnValue([entry('repeat-me')]) });
    const result2 = await runHarvest(deps2);
    const secondBytes = (deps2.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];

    expect(firstBytes).toBe(secondBytes);
    expect(result1.written).toEqual(result2.written);
  });
});
