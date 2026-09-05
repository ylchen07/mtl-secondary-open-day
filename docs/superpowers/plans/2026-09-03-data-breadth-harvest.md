# Data Breadth — FEEP Harvest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the FEEP directory into reviewable draft school files so a human can verify and publish thirty-plus Greater Montreal private secondary schools during the running season.

**Architecture:** A parsing pipeline in `src/lib/harvest/` (pure functions, tested against checked-in HTML fixtures) driven by a thin CLI at `scripts/harvest-feep.ts`. The harvester only ever writes `status: "draft"` files, which existing RLS policies and query filters already make invisible to the site. A separate CI guard makes it impossible to publish a row that cites an aggregator as its source.

**Tech Stack:** TypeScript (strict), Zod v3, Vitest 4, cheerio (new devDependency), pnpm, Node 22.

**Spec:** [docs/superpowers/specs/2026-09-03-data-breadth-and-visual-identity.md](../specs/2026-09-03-data-breadth-and-visual-identity.md)

## Global Constraints

- **Never invent data.** Every published date, time, and URL is transcribed from the school's own page. The harvester writes leads, never truths.
- **Aggregators are leads, not sources.** No published row may cite `feep.qc.ca` in `source_url`.
- The harvester writes `status: "draft"` and nothing else. It never emits `"published"`.
- The harvester never modifies a file that is already `status: "published"`.
- TypeScript strict. No `any`, no `@ts-ignore`.
- pnpm only. Never `npm` or `yarn`.
- Tests run offline. Parsing is tested against checked-in HTML fixtures, never the live FEEP site.
- An event with a published date but no published time is **excluded**, not guessed (ruling R10).
- All stored timestamps are UTC or carry an explicit offset; rendering is always `America/Toronto`.
- `SUPABASE_SERVICE_ROLE_KEY` is never imported under `src/app/` and is never a Vercel env var.
- Existing published files (`villa-maria`, `loyola-high-school`, `college-jean-de-brebeuf`) must remain byte-identical after any harvest run.

### Test file locations — read this before writing any test

`vitest.config.ts` sets `include: ['tests/**/*.test.ts']`. **A test file anywhere else is silently never run, and `pnpm test` still reports success.** Every test in this plan therefore lives in `tests/`, flat, with the module path folded into the filename:

| Module under test | Test file |
|---|---|
| `src/lib/schema.ts` | `tests/schema.test.ts` (exists — add to it) |
| `src/lib/check-sources.ts` | `tests/check-sources.test.ts` |
| `src/lib/harvest/parse-listing.ts` | `tests/harvest-parse-listing.test.ts` |
| `src/lib/harvest/parse-detail.ts` | `tests/harvest-parse-detail.test.ts` |
| `src/lib/harvest/reconcile.ts` | `tests/harvest-reconcile.test.ts` |
| `src/lib/harvest/emit.ts` | `tests/harvest-emit.test.ts` |

Tests import via the `@/` alias (`@/lib/harvest/reconcile`), which `vite-tsconfig-paths` resolves. `scripts/` has no alias, which is one reason no test imports a script: as built, every `scripts/*.ts` file is CLI-only and exports nothing, and the logic worth testing lives under `src/lib/`. **Source files keep their own relative imports** (`./types`, `../schema`) — do not rewrite those.

After adding any test file, confirm it actually ran: the reported test count must increase. A suite that passes without running your new tests is worse than a failing one.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/harvest/types.ts` | `ListingEntry`, `SchoolFacts`, `HarvestDecision` types shared by the pipeline |
| `src/lib/harvest/parse-listing.ts` | FEEP region listing HTML → `ListingEntry[]` |
| `src/lib/harvest/parse-detail.ts` | FEEP school detail HTML → `SchoolFacts` |
| `src/lib/harvest/reconcile.ts` | Decide create / skip / flag against existing `data/schools/` |
| `src/lib/harvest/emit.ts` | Build draft `SchoolFile` objects in stable key order |
| `src/lib/harvest/report.ts` | Render `harvest-report.md` |
| `scripts/harvest-feep.ts` | CLI: fetch or read fixtures, run pipeline, write files |
| `src/lib/check-sources.ts` | Aggregator detection: `AGGREGATOR_HOSTS`, `findAggregatorSources` |
| `scripts/check-sources.ts` | CI guard CLI: loads `data/schools/`, validates, reports; exports nothing |
| `tests/fixtures/feep/listing-montreal.html` | Checked-in listing fixture |
| `tests/fixtures/feep/detail-marie-de-france.html` | Checked-in detail fixture |
| `src/lib/schema.ts` | **Modified** — descriptions become optional, all-or-nothing |
| `src/lib/types.ts` | **Modified** — `SchoolRow` description fields become `string \| null` |
| `src/lib/seed-mapping.ts` | **Modified** — `?? null` normalisation, mirroring `tuition_annual_cad` |
| `supabase/migrations/20260903120000_descriptions_nullable.sql` | **Created** — drops `NOT NULL`, retains the non-empty CHECK |

---

### Task 1: Make descriptions optional, all-or-nothing

**Files:**
- Modify: `src/lib/schema.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `schoolFileSchema` accepting a school with neither `description_en` nor `description_fr`, and rejecting one with exactly one of them. `SchoolFile['description_en']` becomes `string | null | undefined`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/schema.test.ts`. Build the valid-school fixture with the helper already used in that file if one exists; otherwise inline a complete valid school object and spread over it.

```typescript
import { describe, it, expect } from 'vitest';
import { schoolFileSchema } from './schema';

const baseSchool = {
  slug: 'test-school',
  name_en: 'Test School',
  name_fr: 'École Test',
  language: 'fr' as const,
  gender: 'mixed' as const,
  region: 'montreal_island' as const,
  city: 'Montreal',
  address: '1 rue Test, Montréal, QC H1A 1A1',
  postal_code: 'H1A 1A1',
  location: { lat: 45.5, lng: -73.6 },
  geocode_precision: 'approximate' as const,
  website_url: 'https://example.qc.ca',
  admissions_url: 'https://example.qc.ca/admission',
  tuition_annual_cad: 5000,
  has_boarding: false,
  programs: [],
  description_en: 'An English description.',
  description_fr: 'Une description française.',
  source_url: 'https://example.qc.ca/admission',
  last_verified_at: '2026-09-03',
  status: 'draft' as const,
  open_days: [],
};

describe('description optionality', () => {
  it('accepts a school with both descriptions', () => {
    expect(schoolFileSchema.safeParse(baseSchool).success).toBe(true);
  });

  it('accepts a school with neither description', () => {
    const { description_en: _en, description_fr: _fr, ...without } = baseSchool;
    expect(schoolFileSchema.safeParse(without).success).toBe(true);
  });

  it('accepts explicit nulls for both descriptions', () => {
    const result = schoolFileSchema.safeParse({
      ...baseSchool,
      description_en: null,
      description_fr: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects English description without French', () => {
    const result = schoolFileSchema.safeParse({ ...baseSchool, description_fr: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/both .* or neither/i);
    }
  });

  it('rejects French description without English', () => {
    const result = schoolFileSchema.safeParse({ ...baseSchool, description_en: null });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm vitest run tests/schema.test.ts -t 'description optionality'`
Expected: the "neither description" and "explicit nulls" cases FAIL (schema currently requires non-empty strings); the two rejection cases also FAIL because the schema currently rejects for the wrong reason (missing required field) — but confirm the *messages* do not yet match `/both .* or neither/i`.

- [ ] **Step 3: Change the schema**

In `src/lib/schema.ts`, change the two description fields on `schoolFileSchema` from `nonEmpty` to `nonEmpty.nullish()`:

```typescript
    description_en: nonEmpty.nullish(),
    description_fr: nonEmpty.nullish(),
```

Then add a refinement alongside the existing `geocode_precision` refinement. Note `schoolFileSchema` already ends with `.refine(...)`; chain this one after it:

```typescript
  .refine(
    (s) => (s.description_en == null) === (s.description_fr == null),
    {
      message:
        'descriptions must be both present or neither — a one-sided description would render the wrong language',
      path: ['description_fr'],
    },
  );
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/schema.test.ts`
Expected: PASS, including all pre-existing schema tests.

- [ ] **Step 5: Confirm the seed pipeline still handles absent descriptions**

Read `src/lib/seed-mapping.ts`. If it maps `description_en` / `description_fr` directly, confirm the database columns are nullable:

Run: `grep -n 'description' supabase/migrations/*.sql`

If either column is `not null`, write a new migration `supabase/migrations/20260903120000_descriptions_nullable.sql`:

```sql
alter table schools alter column description_en drop not null;
alter table schools alter column description_fr drop not null;
```

Apply it:

```bash
set -a && source .env.local && set +a
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  "postgresql://postgres@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres" \
  -f supabase/migrations/20260903120000_descriptions_nullable.sql
```

If the columns are already nullable, skip the migration and say so in the commit body.

- [ ] **Step 6: Verify the whole suite and types**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: 0 type errors, 0 lint errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/schema.ts tests/schema.test.ts supabase/migrations/
git commit -m "feat(schema): make descriptions optional, both-or-neither

FEEP supplies no usable bilingual description. Requiring them is the
largest cost per school for the smallest benefit. The refinement prevents
the real failure mode: a one-sided description rendering English prose to
a French-speaking parent on /fr."
```

---

### Task 2: CI guard — no published row may cite an aggregator

> **AS BUILT (differs from the steps below — read this first).** Review of
> the first cut found the single-file layout forced an `import.meta.url`
> entry-point heuristic that had its own silent-no-op mode. The task was
> completed with the logic **split**:
> - `src/lib/check-sources.ts` — pure logic, exports `AGGREGATOR_HOSTS` and
>   `findAggregatorSources`. Internally uses a private
>   `sourceProblem(url): string | null` classifier rather than a boolean, so
>   each URL is parsed once and carries its own reason.
> - `scripts/check-sources.ts` — CLI only, exports nothing, bare
>   `main().catch(...)` matching `scripts/seed.ts`. No heuristic.
> - `tests/check-sources.test.ts` imports `@/lib/check-sources`, not `../scripts/...`.
>
> Also added beyond the steps below: a **floor check** failing when zero
> school files are found (the guard previously reported clean having checked
> nothing), and **fail-closed** handling for URLs that will not parse *or*
> that parse with an empty host (`javascript:`, `mailto:`, `data:`).
> Rulings R34–R37.

**Files:**
- Create: `src/lib/check-sources.ts` (pure logic)
- Create: `scripts/check-sources.ts` (CLI only)
- Create: `tests/check-sources.test.ts`
- Modify: `package.json` (add `check:sources` script)
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `schoolFileSchema`, `SchoolFile` from Task 1.
- Produces: `findAggregatorSources(schools: SchoolFile[]): string[]` returning one human-readable violation string per offending published row. Empty array means clean.

- [ ] **Step 1: Write the failing test**

Create `tests/check-sources.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findAggregatorSources } from '../scripts/check-sources';
import type { SchoolFile } from '@/lib/schema';

function school(over: Partial<SchoolFile>): SchoolFile {
  return {
    slug: 's', name_en: 'S', name_fr: 'S', language: 'fr', gender: 'mixed',
    region: 'montreal_island', city: 'Montreal', address: 'a', postal_code: 'H1A 1A1',
    location: { lat: 45.5, lng: -73.6 }, geocode_precision: 'approximate',
    website_url: 'https://s.qc.ca', admissions_url: 'https://s.qc.ca/a',
    tuition_annual_cad: null, has_boarding: false, programs: [],
    description_en: null, description_fr: null,
    source_url: 'https://s.qc.ca/a', last_verified_at: '2026-09-03',
    status: 'published', open_days: [],
    ...over,
  } as SchoolFile;
}

const event = (over: Record<string, unknown> = {}) => ({
  starts_at: '2026-10-03T10:00:00-04:00',
  ends_at: '2026-10-03T15:00:00-04:00',
  type: 'open_house' as const,
  academic_year: '2027-2028',
  registration_required: false,
  registration_url: null,
  notes_en: null,
  notes_fr: null,
  source_url: 'https://s.qc.ca/a',
  last_verified_at: '2026-09-03',
  status: 'published' as const,
  ...over,
});

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
    expect(findAggregatorSources([school({ source_url: 'https://a.feep.qc.ca/x' })])).toHaveLength(1);
    expect(findAggregatorSources([school({ source_url: 'https://notfeep.qc.ca/x' })])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run tests/check-sources.test.ts`
Expected: FAIL — cannot resolve `./check-sources`.

- [ ] **Step 3: Implement the guard**

Create `scripts/check-sources.ts`:

```typescript
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateSchoolFiles, type SchoolFile } from '../src/lib/schema';

/** Hosts that are directories of schools, not schools themselves. */
const AGGREGATOR_HOSTS = ['feep.qc.ca'];

function isAggregator(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return AGGREGATOR_HOSTS.some((a) => host === a || host.endsWith(`.${a}`));
}

export function findAggregatorSources(schools: SchoolFile[]): string[] {
  const violations: string[] = [];

  for (const school of schools) {
    if (school.status === 'published' && isAggregator(school.source_url)) {
      violations.push(
        `${school.slug}: published school cites aggregator ${school.source_url}`,
      );
    }
    for (const event of school.open_days) {
      if (event.status === 'published' && isAggregator(event.source_url)) {
        violations.push(
          `${school.slug} (${event.starts_at}): published event cites aggregator ${event.source_url}`,
        );
      }
    }
  }

  return violations;
}

async function main(): Promise<void> {
  const dir = path.join(process.cwd(), 'data', 'schools');
  const names = (await readdir(dir)).filter((n) => n.endsWith('.json'));

  const files = await Promise.all(
    names.map(async (name) => ({
      path: path.join(dir, name),
      json: JSON.parse(await readFile(path.join(dir, name), 'utf8')) as unknown,
    })),
  );

  const { ok, errors } = validateSchoolFiles(files);
  if (errors.length > 0) {
    console.error('Schema errors:\n' + errors.map((e) => `  ${e}`).join('\n'));
    process.exit(1);
  }

  const violations = findAggregatorSources(ok);
  if (violations.length > 0) {
    console.error(
      'Published rows may not cite an aggregator as their source.\n' +
        'FEEP is a lead, not a source. Verify against the school\u2019s own page.\n\n' +
        violations.map((v) => `  ${v}`).join('\n'),
    );
    process.exit(1);
  }

  console.log(`check:sources — ${ok.length} school files clean.`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  void main();
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/check-sources.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Wire it into package.json and CI**

Add to `package.json` scripts, matching the runner already used by `pnpm seed` (check whether it is `tsx` or `node --experimental-strip-types` and copy that exactly):

```json
"check:sources": "tsx scripts/check-sources.ts"
```

In `.github/workflows/ci.yml`, add a step after the lint step and before the build step:

```yaml
      - name: Check data sources
        run: pnpm check:sources
```

- [ ] **Step 6: Run the guard against real data**

Run: `pnpm check:sources`
Expected: `check:sources — 3 school files clean.` The three existing schools all cite their own admissions pages.

- [ ] **Step 7: Prove the guard actually catches a violation**

Temporarily edit `data/schools/villa-maria.json`, setting `source_url` to `https://www.feep.qc.ca/ecoles-privees-quebec/villa-maria`.

Run: `pnpm check:sources`
Expected: exit code 1, message naming `villa-maria`.

Then revert: `git checkout data/schools/villa-maria.json`

Run: `pnpm check:sources`
Expected: clean again. **Do not commit the temporary edit.**

- [ ] **Step 8: Commit**

```bash
git add scripts/check-sources.ts tests/check-sources.test.ts package.json .github/workflows/ci.yml
git commit -m "feat(ci): fail the build if a published row cites an aggregator

Turns 'aggregators are leads, not sources' into something that cannot be
forgotten at 1am. Drafts may cite FEEP freely — that is what drafts are
for. Only published rows are held to the bar."
```

---

### Task 3: Capture FEEP fixtures and parse the region listing

**Files:**
- Create: `tests/fixtures/feep/listing-montreal.html`
- Create: `src/lib/harvest/types.ts`
- Create: `src/lib/harvest/parse-listing.ts`
- Create: `tests/harvest-parse-listing.test.ts`
- Modify: `package.json` (add `cheerio` devDependency)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type ListingEntry = { feepSlug: string; nameFr: string; region: Region | null; externalUrl: string | null; events: ListingEvent[] }`
  - `type ListingEvent = { date: string | null; startTime: string | null; endTime: string | null; rawDate: string; noteFr: string | null }`
  - `parseListing(html: string): ListingEntry[]`

- [ ] **Step 1: Add cheerio and capture the fixture**

```bash
pnpm add -D cheerio
mkdir -p tests/fixtures/feep
curl -sSL --compressed \
  -H 'User-Agent: Mozilla/5.0 (compatible; mtl-open-day-harvest/1.0)' \
  'https://www.feep.qc.ca/ecoles-privees-quebec/portes-ouvertes' \
  -o tests/fixtures/feep/listing-montreal.html
wc -c tests/fixtures/feep/listing-montreal.html
```

Expected: a file well over 100 KB. If it is under 20 KB you have received an error or challenge page — stop and report rather than parsing it.

- [ ] **Step 2: Inspect the fixture to derive selectors**

You must read the real markup before writing selectors. Do not guess.

```bash
grep -o 'id="montreal"[^>]*' tests/fixtures/feep/listing-montreal.html | head
grep -c 'Portes ouvertes' tests/fixtures/feep/listing-montreal.html
```

Then open the region anchor and read ~120 lines after it to learn the repeating unit — the element wrapping one school, where its name and FEEP link live, and how the date and time range are marked up:

Use the `read` tool on the fixture around the `id="montreal"` offset.

Record in the commit body which selectors you found. The tests below assert on **parsed output**, not on selectors, precisely so that the markup can change without rewriting the test's intent.

- [ ] **Step 3: Write the failing test**

Create `tests/harvest-parse-listing.test.ts`. These expectations are transcribed from the live FEEP listing as of 2026-09-03 and are known-correct:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseListing } from '@/lib/harvest/parse-listing';
import type { ListingEntry } from '@/lib/harvest/types';

let entries: ListingEntry[];

beforeAll(() => {
  const html = readFileSync(
    path.join(process.cwd(), 'tests/fixtures/feep/listing-montreal.html'),
    'utf8',
  );
  entries = parseListing(html);
});

const find = (fragment: string): ListingEntry => {
  const hit = entries.find((e) => e.nameFr.includes(fragment));
  if (!hit) throw new Error(`no entry matching "${fragment}"`);
  return hit;
};

describe('parseListing', () => {
  it('finds a substantial number of schools', () => {
    expect(entries.length).toBeGreaterThan(80);
  });

  it('assigns every entry a non-empty French name and FEEP slug', () => {
    for (const e of entries) {
      expect(e.nameFr.length).toBeGreaterThan(0);
      expect(e.feepSlug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('parses a date and a time range', () => {
    const [ev] = find('Regina Assumpta').events;
    expect(ev.date).toBe('2026-09-12');
    expect(ev.startTime).toBe('09:00');
    expect(ev.endTime).toBe('14:30');
  });

  it('parses a 24-hour-crossing afternoon range correctly', () => {
    const [ev] = find('Français Secondaire Montréal').events;
    expect(ev.date).toBe('2026-10-04');
    expect(ev.startTime).toBe('13:00');
    expect(ev.endTime).toBe('16:00');
  });

  it('parses a non-round end time', () => {
    const [ev] = find('Marie de France').events;
    expect(ev.date).toBe('2026-09-26');
    expect(ev.endTime).toBe('13:15');
  });

  it('returns null date for "Sur rendez-vous"', () => {
    const [ev] = find('Marie-Claire').events;
    expect(ev.date).toBeNull();
    expect(ev.rawDate).toMatch(/rendez-vous/i);
  });

  it('returns null times when only a date is published', () => {
    const entry = find('Dorval');
    const ev = entry.events[0];
    expect(ev.date).toBe('2026-10-03');
    expect(ev.startTime).toBeNull();
  });

  it('assigns the region from the listing grouping', () => {
    expect(find('Regina Assumpta').region).toBe('montreal_island');
  });
});
```

- [ ] **Step 4: Run it and confirm it fails**

Run: `pnpm vitest run tests/harvest-parse-listing.test.ts`
Expected: FAIL — cannot resolve `./parse-listing`.

- [ ] **Step 5: Write the types**

Create `src/lib/harvest/types.ts`:

```typescript
import type { SchoolFile } from '../schema';

export type Region = SchoolFile['region'];

export type ListingEvent = {
  /** ISO date `YYYY-MM-DD`, or null when the entry has no parseable date. */
  date: string | null;
  /** 24-hour `HH:mm`, or null when no time range was published. */
  startTime: string | null;
  endTime: string | null;
  /** The original text, kept so a human can see what we refused to parse. */
  rawDate: string;
  noteFr: string | null;
};

export type ListingEntry = {
  feepSlug: string;
  nameFr: string;
  region: Region | null;
  /** The school's own site, from the "En savoir plus" link. */
  externalUrl: string | null;
  events: ListingEvent[];
};

export type SchoolFacts = {
  address: string | null;
  city: string | null;
  postalCode: string | null;
  language: SchoolFile['language'] | null;
  /** True only when the detail page's Education Level mentions secondary. */
  isSecondary: boolean;
  /** Inferred from prose; always treated as unconfirmed. */
  genderGuess: SchoolFile['gender'];
  genderConfident: boolean;
};
```

- [ ] **Step 6: Implement the parser**

Create `src/lib/harvest/parse-listing.ts`. Use the selectors you recorded in Step 2. The date and time helpers below are complete and must be used as written — they encode ruling R10 (no time means no guess):

```typescript
import * as cheerio from 'cheerio';
import type { ListingEntry, ListingEvent, Region } from './types';

const MONTHS_FR: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10,
  novembre: 11, décembre: 12, decembre: 12,
};

const REGION_BY_ANCHOR: Record<string, Region> = {
  montreal: 'montreal_island',
  laval: 'laval',
  monteregie: 'south_shore',
  laurentides: 'north_shore',
  lanaudiere: 'north_shore',
};

/** "12 septembre 2026" -> "2026-09-12". Null when unparseable. */
export function parseFrenchDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS_FR[m[2].toLowerCase()];
  if (!month) return null;
  const day = Number(m[1]);
  if (day < 1 || day > 31) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** "9:00 AM à 2:30 PM" -> { startTime: "09:00", endTime: "14:30" }. */
export function parseTimeRange(
  text: string,
): { startTime: string | null; endTime: string | null } {
  const times = [...text.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)].map((m) => {
    let hour = Number(m[1]) % 12;
    if (m[3].toUpperCase() === 'PM') hour += 12;
    return `${String(hour).padStart(2, '0')}:${m[2]}`;
  });
  if (times.length < 2) return { startTime: null, endTime: null };
  return { startTime: times[0], endTime: times[1] };
}

export function parseListing(html: string): ListingEntry[] {
  const $ = cheerio.load(html);
  const entries: ListingEntry[] = [];

  // Replace the two selectors below with the ones recorded in Step 2.
  // SCHOOL_BLOCK_SELECTOR must select exactly one element per school.
  const SCHOOL_BLOCK_SELECTOR = 'REPLACE_ME';
  const REGION_SECTION_SELECTOR = 'REPLACE_ME';

  $(REGION_SECTION_SELECTOR).each((_, section) => {
    const anchorId = ($(section).attr('id') ?? '').toLowerCase();
    const region = REGION_BY_ANCHOR[anchorId] ?? null;

    $(section)
      .find(SCHOOL_BLOCK_SELECTOR)
      .each((__, block) => {
        const $block = $(block);
        const link = $block.find('a[href*="/ecoles-privees-quebec/"]').first();
        const href = link.attr('href') ?? '';
        const feepSlug = href.split('/').filter(Boolean).pop() ?? '';
        const nameFr = link.text().trim();
        if (!feepSlug || !nameFr) return;

        const externalUrl =
          $block
            .find('a')
            .toArray()
            .map((a) => $(a).attr('href') ?? '')
            .find((h) => h.startsWith('http') && !h.includes('feep.qc.ca')) ?? null;

        const text = $block.text();
        const rawDate = text.replace(/\s+/g, ' ').trim();
        const date = parseFrenchDate(rawDate);
        const { startTime, endTime } = parseTimeRange(rawDate);

        const events: ListingEvent[] = [
          { date, startTime, endTime, rawDate, noteFr: null },
        ];

        entries.push({ feepSlug, nameFr, region, externalUrl, events });
      });
  });

  return entries;
}
```

Replace both `REPLACE_ME` constants with the real selectors. Iterate against the test until it passes — that is what the fixture is for.

- [ ] **Step 7: Run the tests until they pass**

Run: `pnpm vitest run tests/harvest-parse-listing.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 8: Commit**

```bash
git add tests/fixtures/feep/listing-montreal.html src/lib/harvest/ package.json pnpm-lock.yaml
git commit -m "feat(harvest): parse the FEEP region listing into candidate entries

Tested against a checked-in fixture so the suite never depends on a third
party's markup being reachable. Entries with no published time range yield
null times rather than guessed ones (ruling R10)."
```

---

### Task 4: Parse the FEEP school detail page

**Files:**
- Create: `tests/fixtures/feep/detail-marie-de-france.html`
- Create: `tests/fixtures/feep/detail-primary-only.html`
- Create: `src/lib/harvest/parse-detail.ts`
- Create: `tests/harvest-parse-detail.test.ts`

**Interfaces:**
- Consumes: `SchoolFacts` from `./types` (Task 3).
- Produces: `parseDetail(html: string): SchoolFacts`.

- [ ] **Step 1: Capture two fixtures**

One secondary school and one primary-only school, so the exclusion rule has something to bite on:

```bash
curl -sSL --compressed -H 'User-Agent: Mozilla/5.0 (compatible; mtl-open-day-harvest/1.0)' \
  'https://www.feep.qc.ca/ecoles-privees-quebec/college-international-marie-de-france' \
  -o tests/fixtures/feep/detail-marie-de-france.html
curl -sSL --compressed -H 'User-Agent: Mozilla/5.0 (compatible; mtl-open-day-harvest/1.0)' \
  'https://www.feep.qc.ca/ecoles-privees-quebec/college-sainte-anne-prescolaire-primaire-dorval' \
  -o tests/fixtures/feep/detail-primary-only.html
```

Read both with the `read` tool. Locate the Contact Information block and the Education Level / Language of Instruction fields. If the second school's Education Level does mention secondary, pick a different primary-only school from the listing and adjust the filename and test accordingly — record which you used.

- [ ] **Step 2: Write the failing test**

Create `tests/harvest-parse-detail.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseDetail, parsePostalLine, inferGender } from '@/lib/harvest/parse-detail';

const fixture = (name: string): string =>
  readFileSync(path.join(process.cwd(), 'tests/fixtures/feep', name), 'utf8');

describe('parsePostalLine', () => {
  it('splits "Montréal (Quebec) H3W 1W4"', () => {
    expect(parsePostalLine('Montréal (Quebec) H3W 1W4')).toEqual({
      city: 'Montréal',
      postalCode: 'H3W 1W4',
    });
  });

  it('handles a postal code with no internal space', () => {
    expect(parsePostalLine('Laval (Quebec) H7N4Y3')).toEqual({
      city: 'Laval',
      postalCode: 'H7N 4Y3',
    });
  });

  it('returns nulls for an unrecognisable line', () => {
    expect(parsePostalLine('Canada')).toEqual({ city: null, postalCode: null });
  });
});

describe('inferGender', () => {
  it('detects girls-only from French prose', () => {
    expect(inferGender('école pour filles')).toEqual({ genderGuess: 'girls', genderConfident: true });
  });

  it('detects boys-only', () => {
    expect(inferGender('collège pour garçons')).toEqual({ genderGuess: 'boys', genderConfident: true });
  });

  it('detects co-ed from "mixte"', () => {
    expect(inferGender('établissement mixte')).toEqual({ genderGuess: 'mixed', genderConfident: true });
  });

  it('falls back to mixed but UNCONFIDENT when prose is silent', () => {
    expect(inferGender('un collège privé subventionné')).toEqual({
      genderGuess: 'mixed',
      genderConfident: false,
    });
  });
});

describe('parseDetail', () => {
  it('extracts address, city and postal code for a secondary school', () => {
    const facts = parseDetail(fixture('detail-marie-de-france.html'));
    expect(facts.address).toBeTruthy();
    expect(facts.city).toBeTruthy();
    expect(facts.postalCode).toMatch(/^[A-Z]\d[A-Z] \d[A-Z]\d$/);
  });

  it('marks a secondary school as secondary', () => {
    expect(parseDetail(fixture('detail-marie-de-france.html')).isSecondary).toBe(true);
  });

  it('marks a primary-only school as NOT secondary', () => {
    expect(parseDetail(fixture('detail-primary-only.html')).isSecondary).toBe(false);
  });

  it('reads language of instruction', () => {
    expect(parseDetail(fixture('detail-marie-de-france.html')).language).toBe('fr');
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm vitest run tests/harvest-parse-detail.test.ts`
Expected: FAIL — cannot resolve `./parse-detail`.

- [ ] **Step 4: Implement**

Create `src/lib/harvest/parse-detail.ts`. The pure helpers are complete as written; derive only the field-lookup selector from the fixture:

```typescript
import * as cheerio from 'cheerio';
import type { SchoolFacts } from './types';
import type { SchoolFile } from '../schema';

const POSTAL = /([A-Z]\d[A-Z])\s*(\d[A-Z]\d)/i;

export function parsePostalLine(line: string): {
  city: string | null;
  postalCode: string | null;
} {
  const m = line.match(POSTAL);
  if (!m) return { city: null, postalCode: null };
  const city = line.slice(0, m.index).replace(/\(.*?\)/g, '').trim();
  return {
    city: city.length > 0 ? city : null,
    postalCode: `${m[1].toUpperCase()} ${m[2].toUpperCase()}`,
  };
}

export function inferGender(prose: string): {
  genderGuess: SchoolFile['gender'];
  genderConfident: boolean;
} {
  const t = prose.toLowerCase();
  if (/\bfilles\b|\bgirls\b/.test(t) && !/\bgarçons\b|\bboys\b/.test(t)) {
    return { genderGuess: 'girls', genderConfident: true };
  }
  if (/\bgarçons\b|\bboys\b/.test(t) && !/\bfilles\b|\bgirls\b/.test(t)) {
    return { genderGuess: 'boys', genderConfident: true };
  }
  if (/\bmixte\b|\bco-?ed\b|\bcoéducation\b/.test(t)) {
    return { genderGuess: 'mixed', genderConfident: true };
  }
  return { genderGuess: 'mixed', genderConfident: false };
}

export function parseDetail(html: string): SchoolFacts {
  const $ = cheerio.load(html);
  const body = $('body').text().replace(/\u00a0/g, ' ');

  // Replace with the selector recorded from the fixture. It must return the
  // text of the labelled field, e.g. field('Education Level').
  const field = (label: string): string => {
    const node = $(`*:contains("${label}")`).last();
    return node.length > 0 ? node.text().replace(/\s+/g, ' ').trim() : '';
  };

  const contact = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const postalIdx = contact.findIndex((l) => POSTAL.test(l) && !/^Canada$/i.test(l));
  const { city, postalCode } =
    postalIdx >= 0 ? parsePostalLine(contact[postalIdx]) : { city: null, postalCode: null };
  const address = postalIdx > 0 ? contact[postalIdx - 1] : null;

  const level = `${field('Education Level')} ${field("Niveau d'enseignement")}`.toLowerCase();
  const isSecondary = /secondar/.test(level);

  const langText = `${field('Language of Instruction')} ${field("Langue d'enseignement")}`.toLowerCase();
  let language: SchoolFile['language'] | null = null;
  const hasFr = /fran[çc]ais|french/.test(langText);
  const hasEn = /anglais|english/.test(langText);
  if (hasFr && hasEn) language = 'bilingual';
  else if (hasFr) language = 'fr';
  else if (hasEn) language = 'en';

  return { address, city, postalCode, language, isSecondary, ...inferGender(body) };
}
```

Adjust `field` and the contact-block extraction until the tests pass. `*:contains()` is a blunt instrument — if the fixture has a cleaner structure (a definition list, a labelled table), use that instead.

- [ ] **Step 5: Run the tests until they pass**

Run: `pnpm vitest run tests/harvest-parse-detail.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/feep/ src/lib/harvest/parse-detail.ts tests/harvest-parse-detail.test.ts
git commit -m "feat(harvest): parse FEEP detail pages for address, level and language

gender has no structured field anywhere on FEEP, only prose. inferGender
returns a confidence flag alongside its guess, and 'mixed' with
genderConfident=false is the honest default — it means 'nobody has
checked', not 'this school is co-ed'."
```

---

### Task 5: Reconcile candidates against existing files

**Files:**
- Create: `src/lib/harvest/reconcile.ts`
- Create: `tests/harvest-reconcile.test.ts`

**Interfaces:**
- Consumes: `ListingEntry`, `SchoolFacts` (Tasks 3–4); `SchoolFile` (Task 1).
- Produces: `type HarvestDecision = { kind: 'create'; slug: string; entry: ListingEntry } | { kind: 'skip'; slug: string; reason: string } | { kind: 'conflict'; slug: string; existingSlug: string; reason: string }` and `reconcile(entries, existing, today): HarvestDecision[]`, plus `normaliseName(name: string): string`.

- [ ] **Step 1: Write the failing test**

Create `tests/harvest-reconcile.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reconcile, normaliseName } from '@/lib/harvest/reconcile';
import type { ListingEntry } from '@/lib/harvest/types';
import type { SchoolFile } from '@/lib/schema';

const TODAY = '2026-09-03';

const entry = (over: Partial<ListingEntry> = {}): ListingEntry => ({
  feepSlug: 'new-school',
  nameFr: 'Nouvelle École',
  region: 'montreal_island',
  externalUrl: 'https://new.qc.ca',
  events: [
    { date: '2026-10-10', startTime: '10:00', endTime: '15:00', rawDate: '10 octobre 2026', noteFr: null },
  ],
  ...over,
});

const existing = (slug: string, nameFr: string, status: 'published' | 'draft'): SchoolFile =>
  ({ slug, name_fr: nameFr, name_en: nameFr, status } as SchoolFile);

describe('normaliseName', () => {
  it('strips accents, case, and punctuation', () => {
    expect(normaliseName('Collège Jean-de-Brébeuf')).toBe(normaliseName('college jean de brebeuf'));
  });

  it('does not collapse genuinely different schools', () => {
    expect(normaliseName('Collège Sainte-Anne')).not.toBe(normaliseName('Collège Sainte-Marcelline'));
  });
});

describe('reconcile', () => {
  it('creates a school it has never seen', () => {
    const out = reconcile([entry()], [], TODAY);
    expect(out).toEqual([{ kind: 'create', slug: 'new-school', entry: entry() }]);
  });

  it('SKIPS a school whose file is already published', () => {
    const out = reconcile(
      [entry({ feepSlug: 'villa-maria', nameFr: 'Villa Maria' })],
      [existing('villa-maria', 'Villa Maria', 'published')],
      TODAY,
    );
    expect(out[0].kind).toBe('skip');
    expect(out[0].slug).toBe('villa-maria');
  });

  it('flags a CONFLICT when FEEP uses a different slug for a school we already hold', () => {
    const out = reconcile(
      [entry({ feepSlug: 'college-jean-de-brebeuf-montreal', nameFr: 'Collège Jean-de-Brébeuf' })],
      [existing('college-jean-de-brebeuf', 'Collège Jean-de-Brébeuf', 'published')],
      TODAY,
    );
    expect(out[0].kind).toBe('conflict');
    if (out[0].kind === 'conflict') {
      expect(out[0].existingSlug).toBe('college-jean-de-brebeuf');
    }
  });

  it('re-creates a school whose existing file is still a draft', () => {
    const out = reconcile(
      [entry()],
      [existing('new-school', 'Nouvelle École', 'draft')],
      TODAY,
    );
    expect(out[0].kind).toBe('create');
  });

  it('skips an entry with no future dated event', () => {
    const out = reconcile(
      [entry({ events: [{ date: null, startTime: null, endTime: null, rawDate: 'Sur rendez-vous', noteFr: null }] })],
      [], TODAY,
    );
    expect(out[0].kind).toBe('skip');
    expect(out[0].reason).toMatch(/no usable event/i);
  });

  it('skips an entry whose only event is in the past', () => {
    const out = reconcile(
      [entry({ events: [{ date: '2024-10-05', startTime: '10:00', endTime: '15:00', rawDate: '5 octobre 2024', noteFr: null }] })],
      [], TODAY,
    );
    expect(out[0].kind).toBe('skip');
    expect(out[0].reason).toMatch(/past/i);
  });

  it('skips an event that has a date but no time (R10)', () => {
    const out = reconcile(
      [entry({ events: [{ date: '2026-10-24', startTime: null, endTime: null, rawDate: '24 octobre 2026', noteFr: null }] })],
      [], TODAY,
    );
    expect(out[0].kind).toBe('skip');
    expect(out[0].reason).toMatch(/no published time/i);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run tests/harvest-reconcile.test.ts`
Expected: FAIL — cannot resolve `./reconcile`.

- [ ] **Step 3: Implement**

Create `src/lib/harvest/reconcile.ts`:

```typescript
import type { ListingEntry } from './types';
import type { SchoolFile } from '../schema';

export type HarvestDecision =
  | { kind: 'create'; slug: string; entry: ListingEntry }
  | { kind: 'skip'; slug: string; reason: string }
  | { kind: 'conflict'; slug: string; existingSlug: string; reason: string };

export function normaliseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function reconcile(
  entries: ListingEntry[],
  existing: SchoolFile[],
  today: string,
): HarvestDecision[] {
  const bySlug = new Map(existing.map((s) => [s.slug, s]));
  const byName = new Map(existing.map((s) => [normaliseName(s.name_fr), s]));

  return entries.map((entry): HarvestDecision => {
    const slug = entry.feepSlug;

    const sameSlug = bySlug.get(slug);
    if (sameSlug && sameSlug.status === 'published') {
      return { kind: 'skip', slug, reason: 'already published — a human verified this' };
    }

    const sameName = byName.get(normaliseName(entry.nameFr));
    if (sameName && sameName.slug !== slug) {
      return {
        kind: 'conflict',
        slug,
        existingSlug: sameName.slug,
        reason: `FEEP slug differs from ours for what looks like the same school — adjudicate before writing`,
      };
    }

    const usable = entry.events.filter((e) => e.date !== null);
    if (usable.length === 0) {
      return { kind: 'skip', slug, reason: 'no usable event — no parseable date' };
    }

    const future = usable.filter((e) => e.date! >= today);
    if (future.length === 0) {
      return { kind: 'skip', slug, reason: 'all events are in the past — stale FEEP entry' };
    }

    const timed = future.filter((e) => e.startTime !== null && e.endTime !== null);
    if (timed.length === 0) {
      return { kind: 'skip', slug, reason: 'no published time — refusing to guess (R10)' };
    }

    return { kind: 'create', slug, entry: { ...entry, events: timed } };
  });
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/harvest-reconcile.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/harvest/reconcile.ts tests/harvest-reconcile.test.ts
git commit -m "feat(harvest): reconcile candidates against existing files

Two protections a human cannot be relied on to remember: published files
are never touched, and a name match under a different slug is reported for
adjudication rather than written as a duplicate school."
```

---

### Task 6: Emit draft files, idempotently, with a report

**Files:**
- Create: `src/lib/harvest/emit.ts`
- Create: `tests/harvest-emit.test.ts`
- Create: `src/lib/harvest/report.ts`

**Interfaces:**
- Consumes: `HarvestDecision` (Task 5), `SchoolFacts` (Task 4), `schoolFileSchema` (Task 1).
- Produces: `toDraftSchool(entry: ListingEntry, facts: SchoolFacts, today: string): SchoolFile` and `serialise(school: SchoolFile): string`, plus `renderReport(decisions: HarvestDecision[], flagged: string[]): string`.

- [ ] **Step 1: Write the failing test**

Create `tests/harvest-emit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toDraftSchool, serialise } from '@/lib/harvest/emit';
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

  it('carries geocode_precision "missing" with a null location', () => {
    const draft = toDraftSchool(entry, facts, TODAY);
    expect(draft.geocode_precision).toBe('missing');
    expect(draft.location ?? null).toBeNull();
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
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run tests/harvest-emit.test.ts`
Expected: FAIL — cannot resolve `./emit`.

- [ ] **Step 3: Implement**

Create `src/lib/harvest/emit.ts`. The offset helper must derive the offset from the IANA zone rather than hardcoding `-04:00`, or November dates will be an hour wrong:

```typescript
import type { ListingEntry, SchoolFacts } from './types';
import type { SchoolFile } from '../schema';

const ZONE = 'America/Toronto';

/** Offset for a given local date-time in Montreal, as "-04:00" / "-05:00". */
export function montrealOffset(date: string, time: string): string {
  const utcGuess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    timeZoneName: 'longOffset',
  }).formatToParts(utcGuess);
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-05:00';
  const m = raw.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : '-05:00';
}

function localIso(date: string, time: string): string {
  return `${date}T${time}:00${montrealOffset(date, time)}`;
}

/** Academic year a September-to-June admissions cycle feeds. */
function academicYearFor(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 7 ? y + 1 : y;
  return `${start}-${start + 1}`;
}

export function toDraftSchool(
  entry: ListingEntry,
  facts: SchoolFacts,
  today: string,
): SchoolFile {
  const feepUrl = `https://www.feep.qc.ca/ecoles-privees-quebec/${entry.feepSlug}`;
  const site = entry.externalUrl ?? feepUrl;

  return {
    slug: entry.feepSlug,
    name_en: entry.nameFr,
    name_fr: entry.nameFr,
    language: facts.language ?? 'fr',
    gender: facts.genderGuess,
    region: entry.region ?? 'montreal_island',
    city: facts.city ?? 'Montréal',
    address: facts.address ?? 'UNVERIFIED — transcribe from the school page',
    postal_code: facts.postalCode ?? 'H0H 0H0',
    location: null,
    geocode_precision: 'missing',
    website_url: site,
    admissions_url: site,
    tuition_annual_cad: null,
    has_boarding: false,
    programs: [],
    description_en: null,
    description_fr: null,
    source_url: feepUrl,
    last_verified_at: today,
    status: 'draft',
    open_days: entry.events.map((e) => ({
      starts_at: localIso(e.date!, e.startTime!),
      ends_at: localIso(e.date!, e.endTime!),
      type: 'open_house' as const,
      academic_year: academicYearFor(e.date!),
      registration_required: false,
      registration_url: null,
      notes_en: null,
      notes_fr: e.noteFr,
      source_url: feepUrl,
      last_verified_at: today,
      status: 'draft' as const,
    })),
  };
}

const KEY_ORDER: (keyof SchoolFile)[] = [
  'slug', 'name_en', 'name_fr', 'language', 'gender', 'region', 'city',
  'address', 'postal_code', 'location', 'geocode_precision', 'website_url',
  'admissions_url', 'tuition_annual_cad', 'has_boarding', 'programs',
  'description_en', 'description_fr', 'source_url', 'last_verified_at',
  'status', 'open_days',
];

export function serialise(school: SchoolFile): string {
  const ordered: Record<string, unknown> = {};
  for (const key of KEY_ORDER) ordered[key] = school[key];
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
```

Create `src/lib/harvest/report.ts`:

```typescript
import type { HarvestDecision } from './reconcile';

export function renderReport(decisions: HarvestDecision[], flagged: string[]): string {
  const created = decisions.filter((d) => d.kind === 'create');
  const skipped = decisions.filter((d) => d.kind === 'skip');
  const conflicts = decisions.filter((d) => d.kind === 'conflict');

  const lines = [
    '# FEEP harvest report',
    '',
    'Every file below is a **draft**. Drafts are invisible to the site.',
    'Before publishing, open the school\u2019s own admissions page, confirm the',
    'date and time, replace `source_url`, stamp `last_verified_at`, confirm',
    '`gender`, and set `status` to `published`.',
    '',
    `- Created: **${created.length}**`,
    `- Skipped: **${skipped.length}**`,
    `- Conflicts needing adjudication: **${conflicts.length}**`,
    `- Gender unconfirmed: **${flagged.length}**`,
    '',
  ];

  if (conflicts.length > 0) {
    lines.push('## Conflicts — resolve by hand', '');
    for (const c of conflicts) {
      if (c.kind === 'conflict') {
        lines.push(`- \`${c.slug}\` vs existing \`${c.existingSlug}\` — ${c.reason}`);
      }
    }
    lines.push('');
  }

  lines.push('## Created drafts', '');
  for (const c of created) lines.push(`- [ ] \`${c.slug}\``);
  lines.push('', '## Skipped', '');
  for (const s of skipped) {
    if (s.kind === 'skip') lines.push(`- \`${s.slug}\` — ${s.reason}`);
  }

  return `${lines.join('\n')}\n`;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/harvest-emit.test.ts`
Expected: PASS (9 tests). The DST test is the one that matters most — if it fails, `montrealOffset` is wrong and every November event would be an hour off.

- [ ] **Step 5: Commit**

```bash
git add src/lib/harvest/emit.ts tests/harvest-emit.test.ts src/lib/harvest/report.ts
git commit -m "feat(harvest): emit schema-valid draft files with stable key order

Offsets are derived from America/Toronto rather than hardcoded, so events
after the November DST changeover are not silently an hour wrong. Output is
byte-stable, which is what makes re-running the harvester a no-op."
```

---

### Task 7: Wire the CLI and run the first real harvest

**Files:**
- Create: `scripts/harvest-feep.ts`
- Modify: `package.json` (add `harvest` script)
- Modify: `.gitignore` (ignore `harvest-report.md`)

**Interfaces:**
- Consumes: everything from Tasks 3–6.
- Produces: `pnpm harvest` writing draft files into `data/schools/` and a `harvest-report.md` at the repo root.

- [ ] **Step 1: Write the CLI**

Create `scripts/harvest-feep.ts`:

```typescript
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseListing } from '../src/lib/harvest/parse-listing';
import { parseDetail } from '../src/lib/harvest/parse-detail';
import { reconcile } from '../src/lib/harvest/reconcile';
import { toDraftSchool, serialise } from '../src/lib/harvest/emit';
import { renderReport } from '../src/lib/harvest/report';
import { schoolFileSchema, type SchoolFile } from '../src/lib/schema';
import type { SchoolFacts } from '../src/lib/harvest/types';

const LISTING = 'https://www.feep.qc.ca/ecoles-privees-quebec/portes-ouvertes';
const UA = 'Mozilla/5.0 (compatible; mtl-open-day-harvest/1.0)';
const DATA_DIR = path.join(process.cwd(), 'data', 'schools');

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function loadExisting(): Promise<SchoolFile[]> {
  const names = (await readdir(DATA_DIR)).filter((n) => n.endsWith('.json'));
  const out: SchoolFile[] = [];
  for (const name of names) {
    const raw = JSON.parse(await readFile(path.join(DATA_DIR, name), 'utf8')) as unknown;
    const parsed = schoolFileSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
    else console.warn(`skipping unparseable ${name}`);
  }
  return out;
}

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await loadExisting();

  console.log(`Fetching listing… (${existing.length} existing files)`);
  const entries = parseListing(await get(LISTING));
  console.log(`Parsed ${entries.length} listing entries.`);

  const decisions = reconcile(entries, existing, today);
  const creates = decisions.filter((d) => d.kind === 'create');
  console.log(`${creates.length} candidates to create. Fetching detail pages…`);

  const flagged: string[] = [];
  let written = 0;

  for (const decision of creates) {
    if (decision.kind !== 'create') continue;
    const url = `https://www.feep.qc.ca/ecoles-privees-quebec/${decision.slug}`;

    let facts: SchoolFacts;
    try {
      facts = parseDetail(await get(url));
    } catch (err) {
      console.warn(`  ! ${decision.slug}: detail fetch failed — ${String(err)}`);
      continue;
    }

    if (!facts.isSecondary) {
      console.log(`  - ${decision.slug}: primary only, skipped`);
      continue;
    }

    const draft = toDraftSchool(decision.entry, facts, today);
    const parsed = schoolFileSchema.safeParse(draft);
    if (!parsed.success) {
      console.warn(`  ! ${decision.slug}: draft failed validation, not written`);
      for (const issue of parsed.error.issues) {
        console.warn(`      ${issue.path.join('.')}: ${issue.message}`);
      }
      continue;
    }

    await writeFile(path.join(DATA_DIR, `${draft.slug}.json`), serialise(draft), 'utf8');
    written += 1;
    if (!facts.genderConfident) flagged.push(draft.slug);

    // Be a polite guest on someone else's server.
    await new Promise((r) => setTimeout(r, 400));
  }

  await writeFile(
    path.join(process.cwd(), 'harvest-report.md'),
    renderReport(decisions, flagged),
    'utf8',
  );

  console.log(`\nWrote ${written} drafts. See harvest-report.md.`);
  console.log('Drafts are invisible to the site until a human verifies them.');
}

void main();
```

Add to `package.json`:

```json
"harvest": "tsx scripts/harvest-feep.ts"
```

Add to `.gitignore`:

```
harvest-report.md
```

- [ ] **Step 2: Verify the published-file protection BEFORE running for real**

```bash
shasum data/schools/*.json > /tmp/before.txt
```

- [ ] **Step 3: Run the harvest**

Run: `pnpm harvest`
Expected: it prints a listing count above 80, fetches detail pages with a visible pause between each, and reports the number of drafts written.

- [ ] **Step 4: Confirm the three published files are untouched**

```bash
shasum -c /tmp/before.txt
```

Expected: all three report `OK`. **If any file changed, stop.** Rule 1 has been violated; fix `reconcile` before continuing.

- [ ] **Step 5: Confirm every new file is a draft and the guard is clean**

```bash
grep -L '"status": "draft"' data/schools/*.json
```

Expected: only the three published files are listed.

```bash
pnpm check:sources
```

Expected: clean — drafts are allowed to cite FEEP.

```bash
pnpm typecheck && pnpm lint && pnpm vitest run
```

Expected: all green.

- [ ] **Step 6: Confirm idempotency against the live site**

```bash
pnpm harvest && git status --short data/schools/
```

Expected: no modified files from the second run. Newly created files from Step 3 may appear as untracked; nothing should appear as `M`.

- [ ] **Step 7: Read the report before committing**

Read `harvest-report.md`. Confirm the conflict section is either empty or contains only genuine ambiguities. If Brébeuf appears under a different FEEP slug, that is Rule 8 working correctly — resolve it by deleting the spurious draft.

- [ ] **Step 8: Commit**

```bash
git add scripts/harvest-feep.ts package.json .gitignore data/schools/
git commit -m "feat(harvest): add CLI and harvest the first batch of drafts

Every file added here is a draft and is invisible to the site. None is
publishable until a human has opened the school's own admissions page and
confirmed the date, the time, and the coeducation status."
```

---

### Task 8: Verify and publish the first region

**Files:**
- Modify: `data/schools/*.json` (drafts for one region only)

This task has no code. It is the plan's actual product, and it is done by
the agent reading live school pages — never by a subagent working from a
summary, and never from FEEP.

**Interfaces:**
- Consumes: drafts from Task 7, the guard from Task 2.
- Produces: at least ten published schools with verified upcoming events.

- [ ] **Step 1: List the region's drafts**

```bash
grep -l '"region": "montreal_island"' data/schools/*.json \
  | xargs grep -l '"status": "draft"'
```

- [ ] **Step 2: For each school, verify against its own page**

For each draft, in batches of five:

1. Fetch the school's own admissions page — the `website_url` in the draft, or find it from the school's homepage. **Do not use the FEEP page.**
2. Confirm the event date and both times. If the school's page disagrees with the draft, **the school's page wins**. If the school's page does not state a time, delete the event (R10).
3. Confirm `gender` against the school's own description. This is the field most likely to be wrong.
4. Confirm `language`, `address`, `city`, `postal_code`.
5. Set `name_en` properly — the harvester copied the French name into both.
6. Set `source_url` on both the school and each event to the page you actually read.
7. Set `last_verified_at` to today.
8. Set `status` to `"published"` on the school and on each confirmed event.

If a page is unreachable, or silent on dates, **leave it a draft**. A draft left behind is a normal outcome.

- [ ] **Step 3: Validate after each batch of five**

```bash
pnpm check:sources && pnpm vitest run
```

Expected: clean. A failure here means a published row still cites FEEP — fix it before continuing.

- [ ] **Step 4: Seed and verify**

```bash
pnpm seed
```

Expected: validates, upserts, prints "Revalidation triggered."

- [ ] **Step 5: Confirm the site shows the new events and only the new events**

```bash
curl -s https://mtl-secondary-open-day.vercel.app/en | grep -c 'Villa Maria'
```

Then open `/en` and `/fr` in a browser. Confirm:
- Published schools appear; drafts do not.
- Times render in Montreal time.
- Any newly created clash is displayed.

- [ ] **Step 6: Commit**

```bash
git add data/schools/
git commit -m "data: verify and publish Montreal Island schools

Each date confirmed against the school's own admissions page, which is
recorded in source_url. Schools whose pages were unreachable or silent on
times remain drafts."
```

- [ ] **Step 7: Repeat for the remaining regions**

Repeat Steps 1–6 with `laval`, `south_shore`, `north_shore`, and
`west_island`. Each region is an independently shippable slice — seed and
deploy after each rather than batching them all.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Harvester writes drafts only | 6, 7 |
| Never touches published files | 5 (test), 7 (verified with checksums) |
| Never emits `published` | 6 (test) |
| Drops primary-only schools | 4 (test), 7 (CLI check) |
| Drops events with no published time | 5 (test) |
| Drops stale events | 5 (test) |
| Idempotent | 6 (test), 7 (live check) |
| Writes `harvest-report.md` | 6, 7 |
| Never duplicates an existing school | 5 (conflict test) |
| Descriptions optional, all-or-nothing | 1 |
| Address/city/postal stay required | 1 (unchanged) |
| CI guard on aggregator sources | 2 |
| Fixtures checked in, tests offline | 3, 4 |
| Verification by agent, batched by region | 8 |
| Publish bar = verified date + source link | 8 |
| Incremental, sliceable delivery | 8 (step 7) |

Visual identity is deliberately absent — it is the sibling plan.

**Placeholder scan:** The two `REPLACE_ME` selector constants in Task 3
Step 6 are intentional and are the one thing that cannot be written
without the fixture in hand; Step 2 requires reading the real markup
first, and the tests assert on parsed output so they stay valid whatever
the selectors turn out to be. Everything else is concrete.

**Type consistency:** `ListingEntry`, `ListingEvent`, `SchoolFacts`,
`Region` are defined once in Task 3's `types.ts` and imported unchanged by
Tasks 4–7. `HarvestDecision` is defined in `reconcile.ts` (Task 5) and
imported by `report.ts` (Task 6) and the CLI (Task 7). `toDraftSchool`,
`serialise`, `renderReport`, `parseListing`, `parseDetail`, `reconcile`,
`normaliseName`, `findAggregatorSources` are each defined once and called
with matching signatures.

**Known risk:** Task 3 and Task 4 depend on FEEP's markup, which no test
can pin down in advance. If the fixtures reveal a structure that defeats
the sketched parser — for example, schools not nested inside region
sections — the implementer should restructure `parseListing` freely. The
tests encode the *contract*, and the contract is what must hold.
