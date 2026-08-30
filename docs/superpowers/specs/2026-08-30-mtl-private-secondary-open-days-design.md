# Montreal Private Secondary School Open Days — Design

**Date:** 2026-08-30
**Status:** Approved design, pending implementation plan

## Problem

Greater Montreal private secondary schools each publish their open house
and entrance exam dates independently — on PDFs, news posts, Facebook
events, and registration portals. Families applying for Secondary 1 must
track roughly 60–90 schools across a dense six-week season, then discover
too late that two entrance exams fall on the same Saturday morning.

No single source lists these dates together. This project builds one.

## Scope

**In scope for v1:** private secondary schools in Greater Montreal, both
French-language and English-language.

**Out of scope for v1:** public school boards (CSSDM, EMSB, LBPSB, and
peers). The schema does not preclude them — a `network` dimension can be
added later — but public board open houses follow a different rhythm and
would triple the curation burden before the core idea is proven.

## Success criteria

1. A parent can answer "what can I still attend, and does it conflict
   with anything else I care about?" in under 30 seconds.
2. Every date on the site links to the source it came from.
3. Updating a school's dates for a new season is a single-file edit.
4. The site is free to run.

---

## 1. Architecture

Next.js 15 (App Router) + TypeScript + Tailwind, deployed on Vercel.
Supabase Postgres as the read store. **The school data itself lives in
git.**

```
data/schools/*.json  ──validate──>  scripts/seed.ts  ──upsert──>  Supabase
   (git, source of truth)             (zod + service key)             │
                                                                     │ anon key
                                                                     │ RLS read-only
                                                                     v
                                                        Next.js server components
                                                                     │
                                                                     v
                                                              Vercel (ISR)
```

### Git is the source of truth

Supabase is a queryable projection of the repository, not an independent
store. If the database is wiped, `pnpm seed` rebuilds it completely.

This is what keeps the door open to automated collection: a future
scraper writes proposals as `status: 'draft'` rows, a human reviews and
promotes them into `data/`, and the same seed path publishes them. The
scraper never becomes an unreviewed write path into production data.

### Authentication

None in v1. The site is public and read-only.

- RLS policy: `anon` may `SELECT` rows where `status = 'published'`
- All writes require the service-role key
- The service-role key never reaches the browser and is never set as a
  Vercel environment variable

### Migrations

Supabase CLI, `supabase/migrations/*.sql`, committed to git. Schema
changes are reviewable diffs rather than dashboard clicks.

### Internationalization

`next-intl` with locale-prefixed routes `/en/...` and `/fr/...`.
Middleware negotiates the initial locale from `Accept-Language`. UI
strings live in `messages/en.json` and `messages/fr.json`. Content is
bilingual at the column level (see §2).

### Rendering

Server components read from Supabase. Pages revalidate hourly via ISR.
The seed script pings an on-demand revalidation endpoint after a
successful run, so data updates go live in seconds rather than up to an
hour later.

---

## 2. Data model

Two tables. Everything else is an enum.

### `schools`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `slug` | text unique | Stable URL key, e.g. `college-jean-de-brebeuf` |
| `name_en` | text not null | |
| `name_fr` | text not null | Often identical to `name_en` (proper nouns) |
| `language` | enum | `fr` \| `en` \| `bilingual` |
| `gender` | enum | `mixed` \| `girls` \| `boys` |
| `region` | enum | `montreal_island` \| `west_island` \| `laval` \| `north_shore` \| `south_shore` |
| `city` | text | |
| `address` | text | |
| `postal_code` | text | |
| `lat` | double precision | Nullable |
| `lng` | double precision | Nullable |
| `geocode_precision` | enum | `exact` \| `approximate` \| `missing` |
| `website_url` | text | |
| `admissions_url` | text | |
| `tuition_annual_cad` | integer | Nullable |
| `has_boarding` | boolean | |
| `programs` | text[] | e.g. `['ib', 'sports_etudes', 'peda_enrichie']` |
| `description_en` | text not null | 2–3 sentences |
| `description_fr` | text not null | 2–3 sentences |
| `source_url` | text | |
| `last_verified_at` | date | |
| `status` | enum | `published` \| `draft` \| `archived` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `open_days`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `school_id` | uuid fk → schools | |
| `starts_at` | timestamptz | Stored UTC |
| `ends_at` | timestamptz | Stored UTC |
| `type` | enum | `open_house` \| `info_session` \| `entrance_exam` \| `tour` \| `virtual` |
| `academic_year` | text | Entry cohort served, e.g. `2027-2028` |
| `registration_required` | boolean | |
| `registration_url` | text | Nullable |
| `notes_en` | text | Nullable, e.g. "Sec 1 families only" |
| `notes_fr` | text | Nullable |
| `source_url` | text | |
| `last_verified_at` | date | |
| `status` | enum | `published` \| `draft` \| `archived` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### Design decisions

**Entrance exams are events, not a separate table.** For private schools
the exam date is more load-bearing than the open house — it is a hard
deadline. Keeping exams in the same timeline is what lets the agenda
surface collisions between two schools' exams on the same morning.

**Provenance is a first-class field, not metadata.** `source_url` and
`last_verified_at` render in the UI on every event. A wrong date costs a
family their Saturday, so the site shows its work rather than presenting
itself as authoritative.

**Geo uses two scalar columns, not PostGIS.** At ~90 schools, distance
sorting is a haversine function in TypeScript. PostGIS earns its keep at
thousands of rows with spatial indexes. Migration later is additive and
lossless:

```sql
alter table schools add column location geography(Point, 4326);
update schools set location = st_point(lng, lat)::geography;
```

**`geocode_precision` prevents false confidence.** Coordinates eyeballed
off a map must not be silently treated as authoritative.

### Seed file format

One JSON file per school, holding the school and its events together, at
`data/schools/<slug>.json`. Small diffs, and a single school can be
updated without touching any other.

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
  "location": { "lat": 45.4739, "lng": -73.6206 },
  "geocode_precision": "exact",
  "website_url": "https://www.villamaria.qc.ca",
  "admissions_url": "https://www.villamaria.qc.ca/admissions",
  "tuition_annual_cad": 5200,
  "has_boarding": false,
  "programs": ["ib"],
  "description_en": "...",
  "description_fr": "...",
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
      "registration_url": "https://...",
      "notes_en": "Sec 1 families only",
      "notes_fr": "Familles du secondaire 1 seulement",
      "source_url": "https://...",
      "last_verified_at": "2026-08-30",
      "status": "published"
    }
  ]
}
```

The nested `location` object is flattened into `lat`/`lng` by the seed
script. Hand-edited files stay readable; the database stays queryable.

---

## 3. Pages and UX

### Routes

All locale-prefixed under `/[locale]`.

| Route | Purpose |
|---|---|
| `/[locale]` | **Agenda** — upcoming events, date-ascending, grouped by week |
| `/[locale]/schools` | **Directory** — all schools, searchable, list/map toggle |
| `/[locale]/schools/[slug]` | **School page** — profile plus that school's events |
| `/[locale]/about` | Methodology, sources, how to report a wrong date |

### Data fetching: fetch once, filter in the browser

The published dataset is ~90 schools and a few hundred events —
approximately 150 KB of JSON. The agenda's server component fetches all
upcoming published events joined with their schools and ships that to the
client once. Every subsequent filter interaction is local state.

No round trips, no loading spinners, no server-side pagination. At this
scale a search index would be ceremony.

### Filters

Multi-select, reflected in URL query params so a filtered view is
shareable and works with the back button.

- **Language** — `fr` / `en` / `bilingual`
- **Region** — Montreal Island / West Island / Laval / North Shore / South Shore
- **Gender** — mixed / girls / boys
- **Event type** — open house / info session / entrance exam / tour / virtual
- **Date range** — this week / next 30 days / all upcoming / custom
- **Free-text search** — school name, city, programs; client-side and
  accent-insensitive, so `brebeuf` matches `Brébeuf`

### Three details that carry the value

**Clash badges.** When two events a user could plausibly attend overlap
in time, the agenda flags it: *"Overlaps with Regina Assumpta entrance
exam."* A spreadsheet can list dates; it will not tell you two exams
collide on the morning of October 18. This is the feature that justifies
the site existing.

**Provenance on every card.** Date, time, school, type, a *Register*
button when `registration_url` is present, and a quiet footer line:
*"Verified Sep 14 · source"* linking to `source_url`.

**Past events gray out on school pages, and only there.** Someone
browsing in June benefits from knowing a school typically holds its open
house in late September. The agenda itself never shows past events.

### Empty season

Between seasons the agenda shows an honest empty state pointing to the
directory. It does **not** fall back to displaying last season's dates —
stale dates presented as upcoming are worse than no dates.

### Timezone

Stored UTC, always rendered `America/Toronto`, never the visitor's local
timezone. A Montreal parent on a laptop still set to Vancouver time must
not see 6:00 AM.

### Map

A list/map toggle on `/schools`, with ~90 pins; clicking a pin opens that
school's card. **MapLibre GL JS with MapTiler's free tier** (100k
requests, 5k map sessions per month, non-commercial, attribution
required) — comfortably beyond this site's traffic, and roughly an hour
to integrate.

No map on the agenda page. The agenda answers a time question; a map
there would dilute it.

**Documented escape hatch:** Protomaps. Extract a Greater Montreal
bounding box to a single `.pmtiles` file (~50–150 MB) and serve it from
Supabase Storage. No account, no key, no rate limit, no commercial
restriction. Swapping is a one-day job touching one module.

> **Assumption to verify before committing to that path:** that Supabase
> Storage honors HTTP range requests, which PMTiles requires. Worth a
> 20-minute spike if the escape hatch is ever needed.

### Geocoding

A one-time job: batch the ~90 addresses through Nominatim (OSM's free
geocoder, rate-limited to 1 request/second), spot-check results, write
`location` into the seed files, and set `geocode_precision` per school.
Afterward the coordinates are static data in git.

---

## 4. Seed pipeline

Four stages. **The pipeline fails before it touches the database, never
during.**

```
data/schools/*.json
   │
   ├─ 1. PARSE     every file; collect errors, don't stop at the first
   ├─ 2. VALIDATE  zod schema plus cross-file rules
   ├─ 3. REPORT    all errors at once; exit 1 if any
   └─ 4. UPSERT    only if zero errors — schools first, then open_days
```

### Zod is the single source of truth for shape

The schema is defined once in `src/lib/schema.ts`. TypeScript types are
inferred from it via `z.infer`, so the seed script, the application, and
the tests cannot disagree about what a school is.

### Validation rules

- Slugs unique across all files; each slug matches its filename
- Every URL parses and uses `https:`
- `starts_at` < `ends_at`
- Events dated more than 18 months out are flagged — usually a typo
- `academic_year` matches `\d{4}-\d{4}` with consecutive years
- `name_en`, `name_fr`, `description_en`, `description_fr` all non-empty
  — the i18n guard, and the rule most likely to catch a contributor who
  filled in English and moved on
- `lat`/`lng` within a Greater Montreal bounding box, so a transposed
  coordinate pair lands in the Indian Ocean and fails rather than ships
- `location` present if and only if `geocode_precision != 'missing'`

### Idempotency

Upserts key on `slug` for schools and `(school_id, starts_at, type)` for
events. Running the seed ten times produces the same database as running
it once.

Rows in Supabase whose slug no longer appears in `data/` are set to
`status = 'archived'` rather than deleted, so a bookmarked URL never
404s.

### After a successful seed

The script pings Vercel's on-demand revalidation endpoint.

---

## 5. Testing and deployment

### Testing — Vitest, three layers

**1. Data integrity tests (highest value).** The full `data/` directory
runs through the zod schema in CI on every push. A malformed date or a
missing French description fails the build. This is where the bugs will
actually be, because the data is the product and it is hand-edited.

**2. Pure function tests.** Filter logic, accent-insensitive search,
timezone formatting, and clash detection — all pure functions over
fixtures. No database, no network.

**3. One Playwright smoke test.** Load `/en`, assert events render; load
`/fr`, assert the UI is French; apply a filter, assert the URL updates
and the list narrows.

No Supabase mocking and no markup snapshot tests. Both cost maintenance
and catch little.

### Environments

| | Local | Vercel Preview | Vercel Production |
|---|---|---|---|
| Supabase | Local via CLI (Docker) | Shared staging project | Production project |
| Service-role key | `.env.local`, gitignored | Absent | Absent |

Vercel only ever reads. The service-role key exists on the maintainer's
machine and in the seeding GitHub Action, nowhere else.

### CI

GitHub Actions on push to `main`: typecheck → lint → data validation →
unit tests.

Seeding stays a manual `pnpm seed` for v1. Auto-seeding on merge is a
footgun until the data settles.

### Repository layout

```
src/app/[locale]/           agenda, schools, schools/[slug], about
src/components/             EventCard, FilterBar, SchoolMap, ...
src/lib/                    schema.ts, supabase.ts, filters.ts,
                            clash.ts, dates.ts
data/schools/*.json         source of truth
supabase/migrations/*.sql
scripts/seed.ts
messages/{en,fr}.json
tests/
docs/superpowers/specs/
```

---

## Deferred, deliberately

| Item | Why deferred |
|---|---|
| Public school boards | Triples curation before the idea is proven |
| Automated scraping | Schema is ready for it; correctness of the seed data comes first |
| User accounts, saved schools, reminders | Requires auth, email infrastructure, and a privacy policy for a feature nobody has asked for yet |
| Calendar grid view | Agenda answers the real question; revisit if data proves otherwise |
| PostGIS | Unnecessary at 90 rows |
| `.ics` export | Plausible next feature, but not needed to prove the concept |
