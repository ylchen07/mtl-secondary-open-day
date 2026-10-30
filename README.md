# Montreal Secondary School Open Days

Open house, entrance exam and admission interview dates for private and
public (selective-program) secondary schools in the Greater Montreal area,
in one searchable place, published by school year.

Greater Montreal secondary schools each publish their admissions calendar
independently — PDFs, news posts, Facebook events, registration portals.
Families applying for Secondary 1 track dozens of schools across a dense
six-week season, then discover too late that two entrance exams fall on
the same Saturday morning.

This site collects those dates, shows what is still attendable, and flags
the conflicts.

## Status

**v1 implementation complete.**

The site features:
- Agenda at `/en` and `/fr` listing upcoming open houses, entrance exams and admission interviews, with filters and conflict detection
- One page per school year (entry cohort): `/en` shows the year currently recruiting, `/en/2027-2028` pins a year; unknown years 404
- Admission interviews may be date-only (`starts_on`/`ends_on`, inclusive) when the school publishes a day or window but no clock times; every other event type still needs `starts_at`/`ends_at`
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

- **In scope:** private secondary schools and public schools with their own
  Secondary 1 admission process (`sector: private | public`), French and
  English, Greater Montreal
- **Not in scope:** automated scraping, user accounts

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Vercel · next-intl (EN/FR)

## Keeping the data fresh

`pnpm update:scan` watches each school's `admissions_url` without using any LLM tokens. It saves a normalized text snapshot per school in `data/watch/` (committed, so changes show up as git diffs), compares each fresh fetch against it, and writes `work/queue.md`: only the lines that gained a date or time. A changed page waits in `work/pending/` rather than replacing the baseline, so re-running the scan before reviewing never loses a change. Pages that fail to load, or return too little text (blocked or JS-rendered), are reported and never baselined.

## Data corrections

Every date on the site links to the source it was taken from. If a date
here disagrees with the school, the school is right — please open an
issue.
