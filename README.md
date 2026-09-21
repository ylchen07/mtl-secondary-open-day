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

**v1 implementation complete.**

The site features:
- Agenda at `/en` and `/fr` listing upcoming open houses and entrance exams, with filters and conflict detection
- School and event data hand-curated and verified against official sources in `data/schools/`
- Reads directly from those git-committed JSON files — no database
- Unit tests + Playwright e2e tests, CI on every push

See [`docs/superpowers/specs/2026-08-30-mtl-private-secondary-open-days-design.md`](docs/superpowers/specs/2026-08-30-mtl-private-secondary-open-days-design.md)
for the full design.

## Getting started

1. **Install dependencies:**
   ```sh
   pnpm install
   ```

2. **Start the dev server:**
   ```sh
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Run tests:**
   ```sh
   pnpm test          # Unit and integration tests
   pnpm test:e2e      # End-to-end tests
   ```

No environment variables or external services are required.

## Approach in one diagram

```
data/schools/*.json  ──validate──>  Next.js on Vercel
   (git, source of truth)
```

The school data lives in git and is hand-curated and verified against each
school's own official website before publication. The site reads those
files directly at build/request time — there is nothing to seed, migrate,
or keep in sync. Every deploy already rebuilds from whatever was last
merged to `main`.

## Scope

- **v1:** private secondary schools, French and English, Greater Montreal
- **Not v1:** public school boards, automated scraping, user accounts

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Vercel · next-intl (EN/FR)

## Data corrections

Every date on the site links to the source it was taken from. If a date
here disagrees with the school, the school is right — please open an
issue.
