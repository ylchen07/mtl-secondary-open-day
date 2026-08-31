# Montreal Private Secondary School Open Days

Open house and entrance exam dates for private secondary schools in the
Greater Montreal area, in one searchable place.

Greater Montreal private schools each publish their admissions calendar
independently — PDFs, news posts, Facebook events, registration portals.
Families applying for Secondary 1 track dozens of schools across a dense
six-week season, then discover too late that two entrance exams fall on
the same Saturday morning.

This site collects those dates, shows what is still attendable, and flags
the conflicts.

## Status

**Design approved, implementation not started.**

See [`docs/superpowers/specs/2026-08-30-mtl-private-secondary-open-days-design.md`](docs/superpowers/specs/2026-08-30-mtl-private-secondary-open-days-design.md)
for the full design.

## Approach in one diagram

```
data/schools/*.json  ──validate──>  scripts/seed.ts  ──upsert──>  Supabase
   (git, source of truth)             (zod + service key)             │
                                                                     v
                                                        Next.js on Vercel
```

The school data lives in git and is hand-curated. Supabase is a
queryable projection of the repository — if the database is wiped,
`pnpm seed` rebuilds it.

## Scope

- **v1:** private secondary schools, French and English, Greater Montreal
- **Not v1:** public school boards, automated scraping, user accounts

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Supabase Postgres ·
Vercel · next-intl (EN/FR) · MapLibre + MapTiler

## Data corrections

Every date on the site links to the source it was taken from. If a date
here disagrees with the school, the school is right — please open an
issue.
