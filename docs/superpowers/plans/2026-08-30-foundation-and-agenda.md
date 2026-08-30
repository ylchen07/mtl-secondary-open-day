# Foundation + Agenda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed, bilingual (EN/FR) site listing upcoming open house and entrance exam dates for Greater Montreal private secondary schools, with filters and same-day conflict detection, seeded from git-versioned JSON.

**Architecture:** Hand-curated JSON files in `data/schools/` are the source of truth. A zod-validated seed script upserts them into Supabase Postgres. Next.js server components read from Supabase with an anon key under read-only RLS, ship the full published dataset to the browser once, and all filtering happens client-side. Deployed on Vercel with ISR plus on-demand revalidation triggered by the seed script.

**Tech Stack:** Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS v4 · Supabase Postgres · `@supabase/supabase-js` · `next-intl` v4 · `zod` v4 · `date-fns` v4 + `@date-fns/tz` · Vitest · Playwright · pnpm

**Spec:** `docs/superpowers/specs/2026-08-30-mtl-private-secondary-open-days-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Node 20+**, package manager is **pnpm**. Never run `npm install` or `yarn`.
- **TypeScript strict mode on.** No `any` in committed code. No `@ts-ignore`.
- **Locales are exactly `en` and `fr`.** Default locale `en`. Every user-visible string must exist in both `messages/en.json` and `messages/fr.json`.
- **Every school and event must have both `name_en`/`name_fr` and both `description_en`/`description_fr` non-empty.** This is enforced by schema, not convention.
- **All timestamps stored UTC, always rendered in `America/Toronto`.** Never render in the visitor's local timezone.
- **All URLs must parse and use the `https:` protocol.**
- **`SUPABASE_SERVICE_ROLE_KEY` is never set as a Vercel environment variable** and never imported into any file under `src/app/`. It exists only in `.env.local` and CI secrets.
- **Greater Montreal bounding box** (used for coordinate validation): latitude `45.30`–`45.75`, longitude `-74.05`–`-73.30`.
- **Never invent data.** Every date, tuition figure, and URL in `data/schools/*.json` must be transcribed from the school's own published page, with that page recorded in `source_url` and the date of transcription in `last_verified_at`.
- **Commit after every task.** Conventional Commits format (`feat:`, `test:`, `chore:`, `docs:`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/schema.ts` | Zod schemas for seed files; all TypeScript types inferred from here |
| `src/lib/dates.ts` | Toronto-timezone formatting and week grouping |
| `src/lib/filters.ts` | Pure filter predicates and accent-insensitive search |
| `src/lib/clash.ts` | Event overlap detection |
| `src/lib/supabase.ts` | Client factories (anon read client, service-role write client) |
| `src/lib/queries.ts` | Typed Supabase reads used by server components |
| `src/i18n/routing.ts` | next-intl locale configuration |
| `src/i18n/request.ts` | next-intl per-request message loading |
| `src/middleware.ts` | Locale negotiation and redirects |
| `src/app/[locale]/layout.tsx` | Locale shell, fonts, providers |
| `src/app/[locale]/page.tsx` | Agenda — server fetch, delegates filtering to client |
| `src/app/api/revalidate/route.ts` | On-demand revalidation endpoint for the seed script |
| `src/components/AgendaClient.tsx` | Client-side filter state and URL sync |
| `src/components/EventCard.tsx` | One event, with provenance footer |
| `src/components/FilterBar.tsx` | Filter controls |
| `src/components/EmptyState.tsx` | Honest empty-season messaging |
| `data/schools/*.json` | Source of truth, one file per school |
| `scripts/seed.ts` | Validate-then-upsert pipeline |
| `supabase/migrations/*.sql` | Schema as reviewable diffs |
| `messages/{en,fr}.json` | UI strings |

---

## Task 1: Project scaffold and test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.local.example`
- Create: `src/app/layout.tsx`, `src/app/globals.css`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `pnpm test` / `pnpm build` / `pnpm dev`; all later tasks assume Vitest resolves `@/` to `src/`

- [ ] **Step 1: Scaffold the Next.js app**

Run from the repository root. The trailing `.` scaffolds in place — the directory already contains `README.md`, `.gitignore`, and `docs/`, which is expected.

```bash
pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-turbopack
```

When prompted about the non-empty directory, choose to continue. If it refuses to overwrite `README.md` or `.gitignore`, keep the existing versions — they are intentional.

- [ ] **Step 2: Install project dependencies**

```bash
pnpm add @supabase/supabase-js next-intl zod@^3 date-fns @date-fns/tz
pnpm add -D vitest vite-tsconfig-paths tsx dotenv
```

**Zod is pinned to v3 deliberately.** Every schema in Task 2 uses the v3 API
(`z.string().url()`, `z.string().datetime({ offset: true })`). Those forms are
deprecated in zod v4 in favour of `z.url()` and `z.iso.datetime()`. Do not
upgrade to v4 as part of this plan — it is a clean, separate change once the
schema has settled.

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "seed": "tsx scripts/seed.ts"
  }
}
```

- [ ] **Step 4: Write a failing smoke test**

Create `tests/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GREATER_MONTREAL_BBOX } from '@/lib/constants';

describe('test harness', () => {
  it('resolves the @/ alias into src/', () => {
    expect(GREATER_MONTREAL_BBOX.minLat).toBe(45.3);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
pnpm test
```

Expected: FAIL — cannot resolve `@/lib/constants`. This proves the test actually exercises the alias rather than passing vacuously.

- [ ] **Step 6: Create the constants module**

Create `src/lib/constants.ts`:

```ts
export const MONTREAL_TZ = 'America/Toronto';

export const GREATER_MONTREAL_BBOX = {
  minLat: 45.3,
  maxLat: 45.75,
  minLng: -74.05,
  maxLng: -73.3,
} as const;

export const LOCALES = ['en', 'fr'] as const;
export const DEFAULT_LOCALE = 'en';

export type Locale = (typeof LOCALES)[number];
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
pnpm test && pnpm typecheck
```

Expected: 1 test passes, no type errors.

- [ ] **Step 8: Create the env template**

Create `.env.local.example` (this file IS committed; `.env.local` is not):

```bash
# Public — safe to expose to the browser, read-only under RLS
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Secret — bypasses RLS. Local machine and CI only. NEVER set this in Vercel.
SUPABASE_SERVICE_ROLE_KEY=

# Shared secret for the on-demand revalidation endpoint
REVALIDATE_SECRET=
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest harness"
```

---

## Task 2: Seed file schema

**Files:**
- Create: `src/lib/schema.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Consumes: `GREATER_MONTREAL_BBOX` from `@/lib/constants`
- Produces:
  - `schoolFileSchema: z.ZodType<SchoolFile>`
  - `type SchoolFile` — the parsed shape of one `data/schools/*.json` file
  - `type OpenDayInput` — one element of `SchoolFile['open_days']`
  - `validateSchoolFiles(files: {path: string, json: unknown}[]): {ok: SchoolFile[], errors: string[]}`

- [ ] **Step 1: Write the failing tests**

Create `tests/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { schoolFileSchema, validateSchoolFiles } from '@/lib/schema';

const valid = {
  slug: 'villa-maria',
  name_en: 'Villa Maria',
  name_fr: 'Villa Maria',
  language: 'bilingual',
  gender: 'girls',
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

  it('rejects a missing French description', () => {
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/schema.test.ts
```

Expected: FAIL — cannot resolve `@/lib/schema`.

- [ ] **Step 3: Implement the schema**

Create `src/lib/schema.ts`:

```ts
import { z } from 'zod';
import { GREATER_MONTREAL_BBOX } from './constants';

const httpsUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith('https://'), { message: 'must use https' });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

const nonEmpty = z.string().trim().min(1);

const publicationStatus = z.enum(['published', 'draft', 'archived']);

const academicYear = z
  .string()
  .regex(/^\d{4}-\d{4}$/, 'must be YYYY-YYYY')
  .refine((v) => {
    const [a, b] = v.split('-').map(Number);
    return b === a + 1;
  }, { message: 'academic year must span consecutive years' });

const EIGHTEEN_MONTHS_MS = 1000 * 60 * 60 * 24 * 550;

const openDaySchema = z
  .object({
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
    type: z.enum(['open_house', 'info_session', 'entrance_exam', 'tour', 'virtual']),
    academic_year: academicYear,
    registration_required: z.boolean(),
    registration_url: httpsUrl.nullish(),
    notes_en: z.string().nullish(),
    notes_fr: z.string().nullish(),
    source_url: httpsUrl,
    last_verified_at: isoDate,
    status: publicationStatus,
  })
  .refine((e) => new Date(e.starts_at) < new Date(e.ends_at), {
    message: 'starts_at must be before ends_at',
    path: ['ends_at'],
  })
  .refine(
    (e) => new Date(e.starts_at).getTime() - Date.now() < EIGHTEEN_MONTHS_MS,
    { message: 'event is more than 18 months out — likely a year typo', path: ['starts_at'] },
  );

export const schoolFileSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case'),
    name_en: nonEmpty,
    name_fr: nonEmpty,
    language: z.enum(['fr', 'en', 'bilingual']),
    gender: z.enum(['mixed', 'girls', 'boys']),
    region: z.enum([
      'montreal_island',
      'west_island',
      'laval',
      'north_shore',
      'south_shore',
    ]),
    city: nonEmpty,
    address: nonEmpty,
    postal_code: nonEmpty,
    location: z
      .object({
        lat: z.number().min(GREATER_MONTREAL_BBOX.minLat).max(GREATER_MONTREAL_BBOX.maxLat),
        lng: z.number().min(GREATER_MONTREAL_BBOX.minLng).max(GREATER_MONTREAL_BBOX.maxLng),
      })
      .nullish(),
    geocode_precision: z.enum(['exact', 'approximate', 'missing']),
    website_url: httpsUrl,
    admissions_url: httpsUrl,
    tuition_annual_cad: z.number().int().positive().nullish(),
    has_boarding: z.boolean(),
    programs: z.array(z.string()),
    description_en: nonEmpty,
    description_fr: nonEmpty,
    source_url: httpsUrl,
    last_verified_at: isoDate,
    status: publicationStatus,
    open_days: z.array(openDaySchema),
  })
  .refine((s) => (s.geocode_precision === 'missing') === (s.location == null), {
    message: 'location must be present unless geocode_precision is "missing"',
    path: ['location'],
  });

export type SchoolFile = z.infer<typeof schoolFileSchema>;
export type OpenDayInput = SchoolFile['open_days'][number];

export function validateSchoolFiles(
  files: { path: string; json: unknown }[],
): { ok: SchoolFile[]; errors: string[] } {
  const ok: SchoolFile[] = [];
  const errors: string[] = [];
  const seenSlugs = new Map<string, string>();

  for (const file of files) {
    const parsed = schoolFileSchema.safeParse(file.json);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const where = issue.path.join('.') || '(root)';
        errors.push(`${file.path}: ${where} — ${issue.message}`);
      }
      continue;
    }

    const school = parsed.data;
    const expectedFilename = `${school.slug}.json`;

    if (!file.path.endsWith(`/${expectedFilename}`)) {
      errors.push(
        `${file.path}: slug "${school.slug}" does not match filename (expected ${expectedFilename})`,
      );
    }

    const previous = seenSlugs.get(school.slug);
    if (previous) {
      errors.push(`${file.path}: duplicate slug "${school.slug}" (also in ${previous})`);
    } else {
      seenSlugs.set(school.slug, file.path);
    }

    ok.push(school);
  }

  return { ok, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/schema.test.ts && pnpm typecheck
```

Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts src/lib/constants.ts tests/schema.test.ts
git commit -m "feat: add zod schema for school seed files"
```

---

## Task 3: First seed data and the data-integrity test

**Files:**
- Create: `data/schools/college-jean-de-brebeuf.json`
- Create: `data/schools/villa-maria.json`
- Create: `data/schools/loyola-high-school.json`
- Test: `tests/data-integrity.test.ts`

**Interfaces:**
- Consumes: `validateSchoolFiles` from `@/lib/schema`
- Produces: a populated `data/schools/` directory; the CI gate that every later data edit must pass

- [ ] **Step 1: Write the failing data-integrity test**

Create `tests/data-integrity.test.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateSchoolFiles } from '@/lib/schema';

const DATA_DIR = join(process.cwd(), 'data', 'schools');

function loadAll() {
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = join(DATA_DIR, f);
      return { path, json: JSON.parse(readFileSync(path, 'utf8')) as unknown };
    });
}

describe('data/schools', () => {
  it('contains at least one school', () => {
    expect(loadAll().length).toBeGreaterThan(0);
  });

  it('every file passes validation', () => {
    const { errors } = validateSchoolFiles(loadAll());
    expect(errors).toEqual([]);
  });

  it('every published school has at least one event', () => {
    const { ok } = validateSchoolFiles(loadAll());
    const barren = ok
      .filter((s) => s.status === 'published' && s.open_days.length === 0)
      .map((s) => s.slug);
    expect(barren).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test tests/data-integrity.test.ts
```

Expected: FAIL — `data/schools` does not exist.

- [ ] **Step 3: Research the three schools**

> **This step produces real data. Do not invent values.**

For each of the three schools below, open its admissions page and transcribe what is actually published. If a school has not yet posted dates for the coming season, set `"open_days": []` and `"status": "draft"` for that school, and pick a different school that has published dates — the test requires every *published* school to have at least one event.

| Slug | School | Site |
|---|---|---|
| `college-jean-de-brebeuf` | Collège Jean-de-Brébeuf | https://www.brebeuf.qc.ca |
| `villa-maria` | Villa Maria | https://www.villamaria.qc.ca |
| `loyola-high-school` | Loyola High School | https://www.loyola.ca |

For each, record: the exact *portes ouvertes* / open house date and time, the entrance exam date if published, whether registration is required and its URL, annual tuition if published, and the precise page URL you took it from. Set `last_verified_at` to today's date.

For coordinates, use the school's address; `geocode_precision: "exact"` only if you took the coordinates from a map pin on the building, otherwise `"approximate"`.

- [ ] **Step 4: Write the three JSON files**

Use exactly this structure. **The values below are structural illustration — replace every date, price, URL, and description with what you verified in Step 3.**

```json
{
  "slug": "villa-maria",
  "name_en": "Villa Maria",
  "name_fr": "Villa Maria",
  "language": "bilingual",
  "gender": "girls",
  "region": "montreal_island",
  "city": "Montreal",
  "address": "4245 Decarie Blvd, Montreal, QC H4A 3K4",
  "postal_code": "H4A 3K4",
  "location": { "lat": 45.4739, "lng": -73.6206 },
  "geocode_precision": "approximate",
  "website_url": "https://www.villamaria.qc.ca",
  "admissions_url": "https://www.villamaria.qc.ca/admissions",
  "tuition_annual_cad": null,
  "has_boarding": false,
  "programs": ["ib"],
  "description_en": "Two or three sentences, written from the school's own materials.",
  "description_fr": "Deux ou trois phrases, redigees a partir des documents de l'ecole.",
  "source_url": "https://www.villamaria.qc.ca/admissions",
  "last_verified_at": "2026-08-30",
  "status": "published",
  "open_days": [
    {
      "starts_at": "2026-09-26T13:00:00-04:00",
      "ends_at": "2026-09-26T16:00:00-04:00",
      "type": "open_house",
      "academic_year": "2027-2028",
      "registration_required": true,
      "registration_url": "https://www.villamaria.qc.ca/admissions",
      "notes_en": null,
      "notes_fr": null,
      "source_url": "https://www.villamaria.qc.ca/admissions",
      "last_verified_at": "2026-08-30",
      "status": "published"
    }
  ]
}
```

Note the `-04:00` offset: Montreal is on EDT from March to November, EST (`-05:00`) otherwise. Use the offset in effect on the event's own date.

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm test tests/data-integrity.test.ts
```

Expected: 3 tests pass. If validation fails, the error messages name the file and field — fix the data, not the schema.

- [ ] **Step 6: Commit**

```bash
git add data/schools tests/data-integrity.test.ts
git commit -m "feat: add seed data for first three schools with integrity test"
```

---

## Task 4: Supabase schema migration

**Files:**
- Create: `supabase/migrations/20260830120000_init.sql`
- Create: `supabase/config.toml` (generated by `supabase init`)

**Interfaces:**
- Consumes: the field list from `SchoolFile` in Task 2
- Produces: tables `schools` and `open_days` with RLS enabled; unique constraints `schools.slug` and `open_days (school_id, starts_at, type)` that Task 6 upserts against

- [ ] **Step 1: Initialize Supabase locally**

```bash
pnpm add -D supabase
pnpm supabase init
pnpm supabase start
```

`supabase start` requires Docker running. It prints an API URL, anon key, and service-role key — copy them into `.env.local` (create it from `.env.local.example`).

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260830120000_init.sql`:

```sql
create type school_language as enum ('fr', 'en', 'bilingual');
create type school_gender as enum ('mixed', 'girls', 'boys');
create type mtl_region as enum (
  'montreal_island', 'west_island', 'laval', 'north_shore', 'south_shore'
);
create type geocode_precision as enum ('exact', 'approximate', 'missing');
create type open_day_type as enum (
  'open_house', 'info_session', 'entrance_exam', 'tour', 'virtual'
);
create type publication_status as enum ('published', 'draft', 'archived');

create table schools (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name_en            text not null check (length(trim(name_en)) > 0),
  name_fr            text not null check (length(trim(name_fr)) > 0),
  language           school_language not null,
  gender             school_gender not null,
  region             mtl_region not null,
  city               text not null,
  address            text not null,
  postal_code        text not null,
  lat                double precision,
  lng                double precision,
  geocode_precision  geocode_precision not null default 'missing',
  website_url        text not null,
  admissions_url     text not null,
  tuition_annual_cad integer check (tuition_annual_cad is null or tuition_annual_cad > 0),
  has_boarding       boolean not null default false,
  programs           text[] not null default '{}',
  description_en     text not null check (length(trim(description_en)) > 0),
  description_fr     text not null check (length(trim(description_fr)) > 0),
  source_url         text not null,
  last_verified_at   date not null,
  status             publication_status not null default 'draft',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint location_matches_precision check (
    (geocode_precision = 'missing' and lat is null and lng is null)
    or (geocode_precision <> 'missing' and lat is not null and lng is not null)
  )
);

create table open_days (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references schools(id) on delete cascade,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  type                  open_day_type not null,
  academic_year         text not null,
  registration_required boolean not null default false,
  registration_url      text,
  notes_en              text,
  notes_fr              text,
  source_url            text not null,
  last_verified_at      date not null,
  status                publication_status not null default 'draft',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint ends_after_starts check (ends_at > starts_at),
  constraint unique_event_per_school unique (school_id, starts_at, type)
);

create index open_days_starts_at_idx on open_days (starts_at);
create index open_days_school_id_idx on open_days (school_id);
create index schools_status_idx on schools (status);

-- Keep updated_at honest
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger schools_updated_at before update on schools
  for each row execute function set_updated_at();
create trigger open_days_updated_at before update on open_days
  for each row execute function set_updated_at();

-- RLS: the browser may read published rows and nothing else.
-- Writes require the service-role key, which bypasses RLS entirely.
alter table schools enable row level security;
alter table open_days enable row level security;

create policy "anon reads published schools" on schools
  for select to anon, authenticated using (status = 'published');

create policy "anon reads published open days" on open_days
  for select to anon, authenticated using (status = 'published');
```

- [ ] **Step 3: Apply and verify the migration**

```bash
pnpm supabase db reset
```

Expected: the reset replays the migration with no errors.

- [ ] **Step 4: Verify RLS actually blocks anonymous writes**

```bash
pnpm supabase db reset && psql "$(pnpm supabase status -o json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DB_URL"])')" -c "set role anon; insert into schools (slug, name_en, name_fr, language, gender, region, city, address, postal_code, website_url, admissions_url, description_en, description_fr, source_url, last_verified_at) values ('x','X','X','fr','mixed','laval','L','A','H0H 0H0','https://a.qc.ca','https://a.qc.ca','d','d','https://a.qc.ca','2026-08-30');"
```

Expected: `ERROR: new row violates row-level security policy`. If this insert *succeeds*, the policy is wrong — stop and fix it before continuing.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: add Supabase schema with read-only RLS"
```

---

## Task 5: Supabase clients and typed queries

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/types.ts`
- Create: `src/lib/queries.ts`
- Test: `tests/supabase-client.test.ts`

**Interfaces:**
- Consumes: env vars from `.env.local`
- Produces:
  - `createReadClient(): SupabaseClient` — anon key, safe anywhere
  - `createWriteClient(): SupabaseClient` — service-role key, throws if called where the key is absent
  - `type SchoolRow`, `type OpenDayRow`, `type AgendaEvent` (an `OpenDayRow` with its `school: SchoolRow`)
  - `fetchUpcomingEvents(): Promise<AgendaEvent[]>`

- [ ] **Step 1: Write the failing test**

Create `tests/supabase-client.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { createWriteClient } from '@/lib/supabase';

const original = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = original;
});

describe('createWriteClient', () => {
  it('throws a clear error when the service-role key is absent', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createWriteClient()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test tests/supabase-client.test.ts
```

Expected: FAIL — cannot resolve `@/lib/supabase`.

- [ ] **Step 3: Implement types**

Create `src/lib/types.ts`:

```ts
export type SchoolRow = {
  id: string;
  slug: string;
  name_en: string;
  name_fr: string;
  language: 'fr' | 'en' | 'bilingual';
  gender: 'mixed' | 'girls' | 'boys';
  region: 'montreal_island' | 'west_island' | 'laval' | 'north_shore' | 'south_shore';
  city: string;
  address: string;
  postal_code: string;
  lat: number | null;
  lng: number | null;
  geocode_precision: 'exact' | 'approximate' | 'missing';
  website_url: string;
  admissions_url: string;
  tuition_annual_cad: number | null;
  has_boarding: boolean;
  programs: string[];
  description_en: string;
  description_fr: string;
  source_url: string;
  last_verified_at: string;
  status: 'published' | 'draft' | 'archived';
};

export type OpenDayRow = {
  id: string;
  school_id: string;
  starts_at: string;
  ends_at: string;
  type: 'open_house' | 'info_session' | 'entrance_exam' | 'tour' | 'virtual';
  academic_year: string;
  registration_required: boolean;
  registration_url: string | null;
  notes_en: string | null;
  notes_fr: string | null;
  source_url: string;
  last_verified_at: string;
  status: 'published' | 'draft' | 'archived';
};

export type AgendaEvent = OpenDayRow & { school: SchoolRow };
```

- [ ] **Step 4: Implement the clients**

Create `src/lib/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** Anon key, read-only under RLS. Safe in server components. */
export function createReadClient(): SupabaseClient {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } },
  );
}

/**
 * Service-role key — bypasses RLS. Scripts and CI only.
 * Never import this from anything under src/app/.
 */
export function createWriteClient(): SupabaseClient {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 5: Implement the agenda query**

Create `src/lib/queries.ts`:

```ts
import { createReadClient } from './supabase';
import type { AgendaEvent } from './types';

/**
 * Every published, not-yet-past event with its school.
 * The full result is shipped to the browser once; filtering happens there.
 */
export async function fetchUpcomingEvents(): Promise<AgendaEvent[]> {
  const supabase = createReadClient();

  const { data, error } = await supabase
    .from('open_days')
    .select('*, school:schools!inner(*)')
    .eq('status', 'published')
    .eq('school.status', 'published')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch upcoming events: ${error.message}`);
  return (data ?? []) as unknown as AgendaEvent[];
}
```

Note `gte('ends_at', ...)` rather than `starts_at`: an open house running until 4pm should stay on the agenda at 2pm, not disappear at 1:01pm.

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm test && pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase.ts src/lib/types.ts src/lib/queries.ts tests/supabase-client.test.ts
git commit -m "feat: add Supabase clients and agenda query"
```

---

## Task 6: Seed script

**Files:**
- Create: `scripts/seed.ts`
- Test: `tests/seed-mapping.test.ts`
- Create: `src/lib/seed-mapping.ts`

**Interfaces:**
- Consumes: `validateSchoolFiles`, `SchoolFile` (Task 2); `createWriteClient` (Task 5)
- Produces:
  - `toSchoolRow(file: SchoolFile): Omit<SchoolRow,'id'>` — flattens `location` into `lat`/`lng`
  - `toOpenDayRows(file: SchoolFile, schoolId: string): Omit<OpenDayRow,'id'>[]`
  - a working `pnpm seed`

- [ ] **Step 1: Write the failing mapping test**

Create `tests/seed-mapping.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test tests/seed-mapping.test.ts
```

Expected: FAIL — cannot resolve `@/lib/seed-mapping`.

- [ ] **Step 3: Implement the mapping**

Create `src/lib/seed-mapping.ts`:

```ts
import type { SchoolFile } from './schema';
import type { OpenDayRow, SchoolRow } from './types';

export function toSchoolRow(file: SchoolFile): Omit<SchoolRow, 'id'> {
  const { location, open_days: _events, ...rest } = file;
  return {
    ...rest,
    tuition_annual_cad: file.tuition_annual_cad ?? null,
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
  };
}

export function toOpenDayRows(
  file: SchoolFile,
  schoolId: string,
): Omit<OpenDayRow, 'id'>[] {
  return file.open_days.map((event) => ({
    school_id: schoolId,
    starts_at: new Date(event.starts_at).toISOString(),
    ends_at: new Date(event.ends_at).toISOString(),
    type: event.type,
    academic_year: event.academic_year,
    registration_required: event.registration_required,
    registration_url: event.registration_url ?? null,
    notes_en: event.notes_en ?? null,
    notes_fr: event.notes_fr ?? null,
    source_url: event.source_url,
    last_verified_at: event.last_verified_at,
    status: event.status,
  }));
}
```

- [ ] **Step 4: Run the mapping test to verify it passes**

```bash
pnpm test tests/seed-mapping.test.ts
```

- [ ] **Step 5: Implement the seed script**

Create `scripts/seed.ts`:

```ts
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateSchoolFiles } from '../src/lib/schema';
import { toOpenDayRows, toSchoolRow } from '../src/lib/seed-mapping';
import { createWriteClient } from '../src/lib/supabase';

const DATA_DIR = join(process.cwd(), 'data', 'schools');

function loadFiles() {
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = join(DATA_DIR, f);
      try {
        return { path, json: JSON.parse(readFileSync(path, 'utf8')) as unknown };
      } catch (cause) {
        throw new Error(`${path}: invalid JSON — ${(cause as Error).message}`);
      }
    });
}

async function main() {
  // 1. PARSE + 2. VALIDATE
  const files = loadFiles();
  const { ok, errors } = validateSchoolFiles(files);

  // 3. REPORT — every error at once, before touching the database
  if (errors.length > 0) {
    console.error(`\n${errors.length} validation error(s):\n`);
    for (const e of errors) console.error(`  ${e}`);
    console.error('\nNothing was written to the database.\n');
    process.exit(1);
  }

  console.log(`Validated ${ok.length} school file(s).`);

  // 4. UPSERT
  const supabase = createWriteClient();

  const { data: schools, error: schoolError } = await supabase
    .from('schools')
    .upsert(ok.map(toSchoolRow), { onConflict: 'slug' })
    .select('id, slug');

  if (schoolError) throw new Error(`School upsert failed: ${schoolError.message}`);

  const idBySlug = new Map(schools!.map((s) => [s.slug as string, s.id as string]));

  const eventRows = ok.flatMap((file) =>
    toOpenDayRows(file, idBySlug.get(file.slug)!),
  );

  if (eventRows.length > 0) {
    const { error: eventError } = await supabase
      .from('open_days')
      .upsert(eventRows, { onConflict: 'school_id,starts_at,type' });
    if (eventError) throw new Error(`Event upsert failed: ${eventError.message}`);
  }

  // Archive schools that no longer have a file, rather than deleting them,
  // so bookmarked URLs never 404. Guarded: an empty slug list would build
  // the invalid PostgREST filter `in.()` and archive nothing while erroring.
  const liveSlugs = ok.map((s) => s.slug);
  if (liveSlugs.length > 0) {
    const { error: archiveError } = await supabase
      .from('schools')
      .update({ status: 'archived' })
      .not('slug', 'in', `(${liveSlugs.map((s) => `"${s}"`).join(',')})`);

    if (archiveError) throw new Error(`Archiving failed: ${archiveError.message}`);
  }

  console.log(`Upserted ${ok.length} school(s) and ${eventRows.length} event(s).`);

  // Tell Vercel to rebuild the affected pages now rather than in up to an hour
  const hook = process.env.REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (hook && secret) {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret }),
    });
    console.log(res.ok ? 'Revalidation triggered.' : `Revalidation failed: ${res.status}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

- [ ] **Step 6: Verify the seed runs and is idempotent**

```bash
pnpm seed && pnpm seed
```

Expected: both runs succeed and report the same counts. Confirm in Supabase Studio (http://localhost:54323) that `schools` has exactly 3 rows after the second run, not 6.

- [ ] **Step 7: Verify the failure path**

Temporarily break a data file (set `"description_fr": ""`), then:

```bash
pnpm seed
```

Expected: exit code 1, the error names the file and field, and the database is unchanged. Restore the file afterward.

- [ ] **Step 8: Commit**

```bash
git add scripts/seed.ts src/lib/seed-mapping.ts tests/seed-mapping.test.ts
git commit -m "feat: add validate-then-upsert seed pipeline"
```

---

## Task 7: Locale routing and messages

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`
- Create: `src/middleware.ts`
- Create: `messages/en.json`, `messages/fr.json`
- Create: `src/app/[locale]/layout.tsx`
- Modify: `next.config.ts`
- Delete: `src/app/page.tsx` and `src/app/layout.tsx`

> **Why both root files are deleted:** `src/app/[locale]/layout.tsx` becomes the
> root layout — it is the file that renders `<html>` and `<body>`. Leaving
> `src/app/layout.tsx` in place produces two nested `<html>` elements and a
> hydration error. `src/app/globals.css` stays where it is; the locale layout
> imports it. This is the layout structure next-intl documents for the App
> Router.

**Interfaces:**
- Consumes: `LOCALES`, `DEFAULT_LOCALE` from `@/lib/constants`
- Produces: `/en` and `/fr` routes; `useTranslations()` available in components; `Link` from `@/i18n/navigation` preserving locale

- [ ] **Step 1: Configure next-intl**

Create `src/i18n/routing.ts`:

```ts
import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/constants';

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
});
```

Create `src/i18n/navigation.ts`:

```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
```

Create `src/i18n/request.ts`:

```ts
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

Create `src/middleware.ts`:

```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/(en|fr)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

Modify `next.config.ts`:

```ts
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 2: Write the message catalogs**

Create `messages/en.json`:

```json
{
  "site": {
    "title": "Montreal Private Secondary Open Days",
    "tagline": "Open houses and entrance exams, in one place."
  },
  "agenda": {
    "heading": "Upcoming",
    "resultCount": "{count, plural, =0 {No events} one {# event} other {# events}}",
    "clashWith": "Overlaps with {school} ({type})",
    "verifiedOn": "Verified {date}",
    "source": "source",
    "register": "Register",
    "registrationRequired": "Registration required",
    "emptyTitle": "No upcoming open days right now",
    "emptyBody": "Most private schools publish their dates in August for the autumn season. Browse the school directory in the meantime.",
    "emptyFiltered": "No events match these filters.",
    "clearFilters": "Clear filters"
  },
  "filters": {
    "search": "Search schools",
    "searchPlaceholder": "Name, city, or program",
    "language": "Language",
    "region": "Region",
    "gender": "Student body",
    "type": "Event type"
  },
  "language": { "fr": "French", "en": "English", "bilingual": "Bilingual" },
  "gender": { "mixed": "Co-ed", "girls": "Girls", "boys": "Boys" },
  "region": {
    "montreal_island": "Montreal Island",
    "west_island": "West Island",
    "laval": "Laval",
    "north_shore": "North Shore",
    "south_shore": "South Shore"
  },
  "eventType": {
    "open_house": "Open house",
    "info_session": "Info session",
    "entrance_exam": "Entrance exam",
    "tour": "Guided tour",
    "virtual": "Virtual event"
  }
}
```

Create `messages/fr.json` with the identical key structure:

```json
{
  "site": {
    "title": "Portes ouvertes des écoles secondaires privées de Montréal",
    "tagline": "Portes ouvertes et examens d'admission, au même endroit."
  },
  "agenda": {
    "heading": "À venir",
    "resultCount": "{count, plural, =0 {Aucun événement} one {# événement} other {# événements}}",
    "clashWith": "Chevauche {school} ({type})",
    "verifiedOn": "Vérifié le {date}",
    "source": "source",
    "register": "S'inscrire",
    "registrationRequired": "Inscription requise",
    "emptyTitle": "Aucune porte ouverte à venir pour le moment",
    "emptyBody": "La plupart des écoles privées publient leurs dates en août pour la saison d'automne. Consultez le répertoire des écoles entre-temps.",
    "emptyFiltered": "Aucun événement ne correspond à ces filtres.",
    "clearFilters": "Effacer les filtres"
  },
  "filters": {
    "search": "Rechercher une école",
    "searchPlaceholder": "Nom, ville ou programme",
    "language": "Langue",
    "region": "Région",
    "gender": "Clientèle",
    "type": "Type d'événement"
  },
  "language": { "fr": "Français", "en": "Anglais", "bilingual": "Bilingue" },
  "gender": { "mixed": "Mixte", "girls": "Filles", "boys": "Garçons" },
  "region": {
    "montreal_island": "Île de Montréal",
    "west_island": "West Island",
    "laval": "Laval",
    "north_shore": "Rive-Nord",
    "south_shore": "Rive-Sud"
  },
  "eventType": {
    "open_house": "Portes ouvertes",
    "info_session": "Séance d'information",
    "entrance_exam": "Examen d'admission",
    "tour": "Visite guidée",
    "virtual": "Événement virtuel"
  }
}
```

- [ ] **Step 3: Write the failing message-parity test**

Create `tests/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import fr from '../messages/fr.json';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('message catalogs', () => {
  it('en and fr define exactly the same keys', () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  it('no message is left empty', () => {
    for (const catalog of [en, fr]) {
      const empties = keys(catalog).filter((path) => {
        const value = path
          .split('.')
          .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], catalog);
        return typeof value === 'string' && value.trim() === '';
      });
      expect(empties).toEqual([]);
    }
  });
});
```

- [ ] **Step 4: Run the test**

```bash
pnpm test tests/messages.test.ts
```

Expected: PASS. If it fails, one catalog is missing a key — this is the guard that stops English-only drift.

- [ ] **Step 5: Create the locale layout**

```bash
rm src/app/page.tsx src/app/layout.tsx
```

Create `src/app/[locale]/layout.tsx`:

```tsx
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });
  return { title: t('title'), description: t('tagline') };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="bg-white text-neutral-900 antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify both locales resolve**

```bash
pnpm dev
```

Visit `http://localhost:3000/en` and `http://localhost:3000/fr`. Both should render (a 404 from the missing page is expected at this stage — what matters is that the locale layout applies and `/` redirects to `/en`). Then:

```bash
pnpm build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add EN/FR locale routing with message parity test"
```

---

## Task 8: Date formatting and week grouping

**Files:**
- Create: `src/lib/dates.ts`
- Test: `tests/dates.test.ts`

**Interfaces:**
- Consumes: `MONTREAL_TZ` from `@/lib/constants`
- Produces:
  - `formatEventTime(startsAt: string, endsAt: string, locale: Locale): string`
  - `formatVerifiedDate(date: string, locale: Locale): string`
  - `weekKey(iso: string): string` — ISO `YYYY-MM-DD` of the Monday of that event's Montreal week
  - `groupByWeek<T extends {starts_at: string}>(events: T[]): {weekStart: string, events: T[]}[]`

- [ ] **Step 1: Write the failing tests**

Create `tests/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatEventTime, groupByWeek, weekKey } from '@/lib/dates';

describe('weekKey', () => {
  it('returns the Monday of the event week in Montreal time', () => {
    // 2026-09-26 is a Saturday; its Monday is 2026-09-21
    expect(weekKey('2026-09-26T17:00:00.000Z')).toBe('2026-09-21');
  });

  it('assigns a late-Sunday-UTC event to the correct Montreal week', () => {
    // 2026-09-21T02:00Z is Sunday 22:00 in Montreal — still the week of Sep 14
    expect(weekKey('2026-09-21T02:00:00.000Z')).toBe('2026-09-14');
  });
});

describe('formatEventTime', () => {
  it('renders in Montreal time regardless of the runtime timezone', () => {
    const out = formatEventTime(
      '2026-09-26T17:00:00.000Z',
      '2026-09-26T20:00:00.000Z',
      'en',
    );
    expect(out).toContain('1:00');
    expect(out).toContain('4:00');
  });
});

describe('groupByWeek', () => {
  it('groups events into weeks in chronological order', () => {
    const groups = groupByWeek([
      { starts_at: '2026-09-26T17:00:00.000Z' },
      { starts_at: '2026-10-03T17:00:00.000Z' },
      { starts_at: '2026-09-27T17:00:00.000Z' },
    ]);
    expect(groups.map((g) => g.weekStart)).toEqual(['2026-09-21', '2026-09-28']);
    expect(groups[0].events).toHaveLength(1);
    expect(groups[1].events).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/dates.test.ts
```

Expected: FAIL — cannot resolve `@/lib/dates`.

- [ ] **Step 3: Implement**

Create `src/lib/dates.ts`:

```ts
import { TZDate } from '@date-fns/tz';
import { format, startOfWeek } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { MONTREAL_TZ, type Locale } from './constants';

const dateFnsLocale = { en: enUS, fr } as const;

function montreal(iso: string): TZDate {
  return new TZDate(new Date(iso), MONTREAL_TZ);
}

/** ISO date of the Monday starting this event's week, in Montreal time. */
export function weekKey(iso: string): string {
  return format(startOfWeek(montreal(iso), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function formatEventTime(
  startsAt: string,
  endsAt: string,
  locale: Locale,
): string {
  const start = montreal(startsAt);
  const end = montreal(endsAt);
  const opts = { locale: dateFnsLocale[locale] };
  const day = format(start, locale === 'fr' ? 'EEEE d MMMM' : 'EEEE, MMMM d', opts);
  const timeFmt = locale === 'fr' ? 'HH:mm' : 'h:mm a';
  return `${day} · ${format(start, timeFmt, opts)} – ${format(end, timeFmt, opts)}`;
}

export function formatVerifiedDate(date: string, locale: Locale): string {
  return format(montreal(`${date}T12:00:00Z`), locale === 'fr' ? 'd MMM yyyy' : 'MMM d, yyyy', {
    locale: dateFnsLocale[locale],
  });
}

export function groupByWeek<T extends { starts_at: string }>(
  events: T[],
): { weekStart: string; events: T[] }[] {
  const buckets = new Map<string, T[]>();

  for (const event of events) {
    const key = weekKey(event.starts_at);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(event);
    else buckets.set(key, [event]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, weekEvents]) => ({
      weekStart,
      events: [...weekEvents].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
TZ=America/Vancouver pnpm test tests/dates.test.ts
```

Running under a deliberately wrong `TZ` proves the Montreal rendering is not an accident of the machine's timezone. All tests must pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts tests/dates.test.ts
git commit -m "feat: add Montreal-timezone date formatting and week grouping"
```

---

## Task 9: Filter logic

**Files:**
- Create: `src/lib/filters.ts`
- Test: `tests/filters.test.ts`

**Interfaces:**
- Consumes: `AgendaEvent` from `@/lib/types`
- Produces:
  - `type FilterState = {q: string, language: string[], region: string[], gender: string[], type: string[]}`
  - `EMPTY_FILTERS: FilterState`
  - `normalize(s: string): string` — lowercase, accents stripped
  - `applyFilters(events: AgendaEvent[], filters: FilterState): AgendaEvent[]`
  - `parseFilters(params: URLSearchParams): FilterState`
  - `serializeFilters(filters: FilterState): URLSearchParams`

- [ ] **Step 1: Write the failing tests**

Create `tests/filters.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/filters.test.ts
```

- [ ] **Step 3: Implement**

Create `src/lib/filters.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/filters.test.ts && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/filters.ts tests/filters.test.ts
git commit -m "feat: add accent-insensitive filtering with URL round-trip"
```

---

## Task 10: Clash detection

**Files:**
- Create: `src/lib/clash.ts`
- Test: `tests/clash.test.ts`

**Interfaces:**
- Consumes: `AgendaEvent` from `@/lib/types`
- Produces: `findClashes(events: AgendaEvent[]): Map<string, AgendaEvent[]>` — event id → the other events it overlaps

- [ ] **Step 1: Write the failing tests**

Create `tests/clash.test.ts`. Reuse the `school()` and `event()` helpers from `tests/filters.test.ts` by copying them into this file — duplicated fixtures in tests are cheaper than a shared helper that couples two test files.

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/clash.test.ts
```

- [ ] **Step 3: Implement**

Create `src/lib/clash.ts`:

```ts
import type { AgendaEvent } from './types';

/**
 * Two events clash when their time ranges overlap and they belong to
 * different schools. Same-school events are never a clash — a school does
 * not schedule against itself, and if it does, attending both was never
 * the plan.
 *
 * Events are sorted by start, so the inner loop can stop as soon as a
 * candidate starts after the current event ends.
 */
export function findClashes(events: AgendaEvent[]): Map<string, AgendaEvent[]> {
  const sorted = [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const clashes = new Map<string, AgendaEvent[]>();

  function record(a: AgendaEvent, b: AgendaEvent): void {
    const existing = clashes.get(a.id);
    if (existing) existing.push(b);
    else clashes.set(a.id, [b]);
  }

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const currentEnd = new Date(current.ends_at).getTime();

    for (let j = i + 1; j < sorted.length; j++) {
      const other = sorted[j];
      if (new Date(other.starts_at).getTime() >= currentEnd) break;
      if (other.school.id === current.school.id) continue;
      record(current, other);
      record(other, current);
    }
  }

  return clashes;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/clash.test.ts && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/clash.ts tests/clash.test.ts
git commit -m "feat: add cross-school event clash detection"
```

---

## Task 11: Agenda page

**Files:**
- Create: `src/app/[locale]/page.tsx`
- Create: `src/components/AgendaClient.tsx`
- Create: `src/components/EventCard.tsx`
- Create: `src/components/FilterBar.tsx`
- Create: `src/components/EmptyState.tsx`

**Interfaces:**
- Consumes: `fetchUpcomingEvents` (Task 5), `groupByWeek`/`formatEventTime`/`formatVerifiedDate` (Task 8), `applyFilters`/`parseFilters`/`serializeFilters`/`EMPTY_FILTERS` (Task 9), `findClashes` (Task 10), messages (Task 7)
- Produces: the rendered agenda at `/en` and `/fr`

- [ ] **Step 1: Build the event card**

Create `src/components/EventCard.tsx`:

```tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatEventTime, formatVerifiedDate } from '@/lib/dates';
import type { AgendaEvent } from '@/lib/types';
import type { Locale } from '@/lib/constants';

export function EventCard({
  event,
  clashes,
}: {
  event: AgendaEvent;
  clashes: AgendaEvent[];
}) {
  const t = useTranslations('agenda');
  const tType = useTranslations('eventType');
  const locale = useLocale() as Locale;
  const schoolName = locale === 'fr' ? event.school.name_fr : event.school.name_en;

  return (
    <article className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">{schoolName}</h3>
        <span className="shrink-0 rounded bg-neutral-100 px-2 py-0.5 text-xs">
          {tType(event.type)}
        </span>
      </div>

      <p className="mt-1 text-sm text-neutral-700">
        {formatEventTime(event.starts_at, event.ends_at, locale)}
      </p>
      <p className="text-sm text-neutral-500">{event.school.city}</p>

      {clashes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {clashes.map((clash) => (
            <li key={clash.id} className="text-sm text-amber-700">
              {t('clashWith', {
                school: locale === 'fr' ? clash.school.name_fr : clash.school.name_en,
                type: tType(clash.type),
              })}
            </li>
          ))}
        </ul>
      )}

      {event.registration_required && event.registration_url && (
        <a
          href={event.registration_url}
          className="mt-3 inline-block rounded bg-neutral-900 px-3 py-1.5 text-sm text-white"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('register')}
        </a>
      )}

      <footer className="mt-3 text-xs text-neutral-500">
        {t('verifiedOn', { date: formatVerifiedDate(event.last_verified_at, locale) })}
        {' · '}
        <a
          href={event.source_url}
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('source')}
        </a>
      </footer>
    </article>
  );
}
```

- [ ] **Step 2: Build the filter bar**

Create `src/components/FilterBar.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import type { FilterState } from '@/lib/filters';

const FACET_OPTIONS = {
  language: ['fr', 'en', 'bilingual'],
  region: ['montreal_island', 'west_island', 'laval', 'north_shore', 'south_shore'],
  gender: ['mixed', 'girls', 'boys'],
  type: ['open_house', 'info_session', 'entrance_exam', 'tour', 'virtual'],
} as const;

type Facet = keyof typeof FACET_OPTIONS;

const NAMESPACE: Record<Facet, string> = {
  language: 'language',
  region: 'region',
  gender: 'gender',
  type: 'eventType',
};

export function FilterBar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const t = useTranslations('filters');

  function toggle(facet: Facet, value: string): void {
    const current = filters[facet];
    onChange({
      ...filters,
      [facet]: current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">{t('search')}</span>
        <input
          type="search"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      {(Object.keys(FACET_OPTIONS) as Facet[]).map((facet) => (
        <FacetGroup
          key={facet}
          facet={facet}
          selected={filters[facet]}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}

function FacetGroup({
  facet,
  selected,
  onToggle,
}: {
  facet: Facet;
  selected: string[];
  onToggle: (facet: Facet, value: string) => void;
}) {
  const tFilters = useTranslations('filters');
  const tValues = useTranslations(NAMESPACE[facet]);

  return (
    <fieldset>
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {tFilters(facet)}
      </legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {FACET_OPTIONS[facet].map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(facet, value)}
              className={`rounded-full border px-3 py-1 text-sm ${
                active
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-300 text-neutral-700'
              }`}
            >
              {tValues(value)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 3: Build the empty state**

Create `src/components/EmptyState.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';

export function EmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  const t = useTranslations('agenda');

  if (filtered) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center">
        <p className="text-neutral-700">{t('emptyFiltered')}</p>
        <button
          type="button"
          onClick={onClear}
          className="mt-3 text-sm underline"
        >
          {t('clearFilters')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center">
      <h2 className="font-medium">{t('emptyTitle')}</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-neutral-600">
        {t('emptyBody')}
      </p>
    </div>
  );
}
```

Note: this never shows last season's dates. Stale dates presented as upcoming are worse than none — see the spec, §3.

- [ ] **Step 4: Build the client agenda**

Create `src/components/AgendaClient.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState } from './EmptyState';
import { EventCard } from './EventCard';
import { FilterBar } from './FilterBar';
import { groupByWeek } from '@/lib/dates';
import { EMPTY_FILTERS, applyFilters, serializeFilters, type FilterState } from '@/lib/filters';
import { findClashes } from '@/lib/clash';
import type { AgendaEvent } from '@/lib/types';
import type { Locale } from '@/lib/constants';

export function AgendaClient({
  events,
  initialFilters,
}: {
  events: AgendaEvent[];
  initialFilters: FilterState;
}) {
  const t = useTranslations('agenda');
  const locale = useLocale() as Locale;
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  function update(next: FilterState): void {
    setFilters(next);
    const query = serializeFilters(next).toString();
    // Keep the URL shareable without re-running the server component.
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }

  const visible = useMemo(() => applyFilters(events, filters), [events, filters]);
  // Clashes are computed over ALL events, not the filtered subset: a conflict
  // with a school you filtered out is still a conflict on your calendar.
  const clashes = useMemo(() => findClashes(events), [events]);
  const weeks = useMemo(() => groupByWeek(visible), [visible]);

  const isFiltered =
    filters.q !== '' ||
    filters.language.length + filters.region.length + filters.gender.length + filters.type.length > 0;

  return (
    <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
      <aside>
        <FilterBar filters={filters} onChange={update} />
      </aside>

      <section>
        <p className="mb-4 text-sm text-neutral-500">
          {t('resultCount', { count: visible.length })}
        </p>

        {visible.length === 0 ? (
          <EmptyState filtered={isFiltered} onClear={() => update(EMPTY_FILTERS)} />
        ) : (
          <div className="space-y-8">
            {weeks.map((week) => (
              <div key={week.weekStart}>
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
                  {new Intl.DateTimeFormat(locale, {
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(`${week.weekStart}T12:00:00Z`))}
                </h2>
                <div className="space-y-3">
                  {week.events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      clashes={clashes.get(event.id) ?? []}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Build the server page**

Create `src/app/[locale]/page.tsx`:

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AgendaClient } from '@/components/AgendaClient';
import { fetchUpcomingEvents } from '@/lib/queries';
import { parseFilters } from '@/lib/filters';

export const revalidate = 3600;

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [events, t, rawSearch] = await Promise.all([
    fetchUpcomingEvents(),
    getTranslations('agenda'),
    searchParams,
  ]);

  const initialFilters = parseFilters(
    new URLSearchParams(
      Object.entries(rawSearch).flatMap(([k, v]) =>
        typeof v === 'string' ? [[k, v] as [string, string]] : [],
      ),
    ),
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{t('heading')}</h1>
      <div className="mt-8">
        <AgendaClient events={events} initialFilters={initialFilters} />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Verify against real seeded data**

```bash
pnpm supabase start && pnpm seed && pnpm dev
```

Check all of the following at `http://localhost:3000/en`:

1. Events from your three seeded schools render, grouped by week
2. Times display in Montreal time
3. Clicking a language filter narrows the list and updates the URL
4. Reloading that filtered URL preserves the filter state
5. Typing `brebeuf` (no accent) matches Collège Jean-de-Brébeuf
6. `/fr` shows French UI chrome

- [ ] **Step 7: Verify the empty state honestly**

Temporarily set every seeded event's `starts_at` to a past date, re-seed, and reload. Expected: the "no upcoming open days" message — **not** past events. Restore the dates and re-seed.

- [ ] **Step 8: Commit**

```bash
git add src/app src/components
git commit -m "feat: add agenda page with filters and clash badges"
```

---

## Task 12: Deploy to Vercel

**Files:**
- Create: `src/app/api/revalidate/route.ts`

**Interfaces:**
- Consumes: `REVALIDATE_SECRET` env var
- Produces: a live URL; `POST /api/revalidate` that the seed script calls

- [ ] **Step 1: Create the revalidation endpoint**

Create `src/app/api/revalidate/route.ts`:

```ts
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { secret?: string };
  if (body.secret !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  revalidatePath('/[locale]', 'page');
  return NextResponse.json({ revalidated: true });
}
```

- [ ] **Step 2: Create the production Supabase project**

Create a project at https://supabase.com/dashboard, then link and push the migration:

```bash
pnpm supabase link --project-ref <your-project-ref>
pnpm supabase db push
```

Verify in the dashboard that both tables exist and RLS is enabled on each.

- [ ] **Step 3: Deploy**

```bash
pnpm dlx vercel@latest
```

Accept the defaults. Then set environment variables in the Vercel dashboard (Settings → Environment Variables) for Production and Preview:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon key |
| `REVALIDATE_SECRET` | A random string (`openssl rand -hex 32`) |

**Do not set `SUPABASE_SERVICE_ROLE_KEY`.** Vercel only reads.

- [ ] **Step 4: Seed production**

Add the production values to `.env.local`, including:

```bash
REVALIDATE_URL=https://<your-deployment>.vercel.app/api/revalidate
REVALIDATE_SECRET=<the same random string>
```

Then:

```bash
pnpm seed
```

Expected: "Upserted 3 school(s)…" followed by "Revalidation triggered."

- [ ] **Step 5: Verify the live site**

Visit the deployment. Confirm events render in both `/en` and `/fr`, and that filters work.

Then confirm the service-role key is genuinely absent from the client bundle:

```bash
pnpm build && grep -r "service_role" .next/static/ || echo "OK: no service-role key in client bundle"
```

Expected: `OK: no service-role key in client bundle`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api
git commit -m "feat: add on-demand revalidation endpoint"
```

---

## Task 13: CI and Playwright smoke test

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `playwright.config.ts`
- Create: `e2e/agenda.spec.ts`

**Interfaces:**
- Consumes: everything above
- Produces: a green CI gate on every push

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: Configure Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Write the smoke test**

Create `e2e/agenda.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('agenda renders in English', async ({ page }) => {
  await page.goto('/en');
  await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible();
});

test('agenda renders in French', async ({ page }) => {
  await page.goto('/fr');
  await expect(page.getByRole('heading', { name: 'À venir' })).toBeVisible();
});

test('a filter narrows results and updates the URL', async ({ page }) => {
  await page.goto('/en');
  const before = await page.getByRole('article').count();

  await page.getByRole('button', { name: 'Girls' }).click();

  await expect(page).toHaveURL(/gender=girls/);
  expect(await page.getByRole('article').count()).toBeLessThanOrEqual(before);
});

test('root redirects to the default locale', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en$/);
});
```

- [ ] **Step 4: Run it locally**

```bash
pnpm exec playwright test
```

Expected: 4 tests pass. Ensure `pnpm supabase start` is running and data is seeded first.

- [ ] **Step 5: Add the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - name: Validate school data
        run: pnpm test tests/data-integrity.test.ts
      - name: Unit tests
        run: pnpm test
```

Note the data-integrity test runs as its own named step even though `pnpm test` covers it. When someone's data edit breaks CI, the failing step name should say so directly.

Playwright is deliberately not in CI for v1 — it needs a seeded database, which means either a Supabase service container or production credentials in CI. Run it locally before deploying. Add it to CI when the data settles.

- [ ] **Step 6: Add the script and commit**

Add to `package.json`:

```json
{ "scripts": { "test:e2e": "playwright test" } }
```

Add to `.gitignore`:

```
/e2e-results/
/playwright/.cache/
```

```bash
git add -A
git commit -m "ci: add GitHub Actions workflow and Playwright smoke test"
```

- [ ] **Step 7: Push to GitHub**

```bash
gh repo create mtl-secondary-open-day --private --source=. --remote=origin --push
```

Confirm the CI workflow runs green on GitHub.

---

## Definition of done

- [ ] `pnpm test` passes; `pnpm typecheck` and `pnpm lint` clean
- [ ] `pnpm seed` is idempotent and refuses to write invalid data
- [ ] Live Vercel URL renders real open-day dates at `/en` and `/fr`
- [ ] Filters narrow results and survive a page reload via the URL
- [ ] Clash badges appear when two schools' events overlap
- [ ] Every event card shows a verification date and a working source link
- [ ] `grep -r "service_role" .next/static/` finds nothing
- [ ] CI green on GitHub

## What Plan 2 covers

School directory, school detail pages, the MapLibre + MapTiler map view, geocoding the full school list, expanding `data/schools/` from 3 to the full Greater Montreal private set, and an `/about` page documenting methodology and corrections.
