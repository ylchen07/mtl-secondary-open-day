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
- `/en` and `/fr` open on the **school directory**: every school on file, published or draft, over a map of Greater Montreal whose regions (Montreal Island, Laval, North Shore, South Shore) filter the list. Each row shows the school's short description when one exists, its city and region, and its next confirmed event or "No upcoming event observed". Draft schools show only confirmed facts (name, city, region, sector); their unconfirmed language, student body, description and address are hidden and never match a filter
- `/en/schools/<slug>`: one page per school with its region on the map (a pin when coordinates are confirmed), description, address, admissions and website links, and every published event grouped by school year, with clashes flagged
- `/en/events/current`: admissions events for the school year currently recruiting, by day, with conflict detection and the past-events archive; it moves to the next year on its own when the season turns over (July). `/en/events/2027-2028` pins a year and stays shareable afterwards; unknown years 404. Filters live in the URL. `/en/events` and old links (`/en/2027-2028`, `/en?view=calendar`) redirect here
- The map is drawn from committed OpenStreetMap geometry in `data/geo/greater-montreal.json` (regenerate with `pnpm map:build`); visitors' browsers never contact a map tile server
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

Next.js 16 · React 19 · TypeScript · Tailwind v4 · next-intl (EN/FR) · deployed to Vercel and Cloudflare Workers

## Deploying

Every host runs `pnpm` scripts only; the app itself is always built by `pnpm build`.

| Host | Install | Build | Deploy |
|---|---|---|---|
| Vercel (set in `vercel.json`) | `pnpm install --frozen-lockfile` | `pnpm build` | automatic |
| Cloudflare Workers Builds (set in the dashboard: Worker → Settings → Build) | automatic (pnpm, from the lockfile) | `pnpm build:cloudflare` | `pnpm deploy:cloudflare` |

- `pnpm build:cloudflare` runs the [OpenNext adapter](https://opennext.js.org/cloudflare), which calls `pnpm build` and packages the result as a Worker (config in `wrangler.jsonc` and `open-next.config.ts`). Preview the Worker locally with `pnpm preview:cloudflare`.
- A Worker has no filesystem, so school data is compiled into the bundle: `pnpm data:index` writes `src/lib/school-files.generated.ts` (gitignored) from `data/schools/*.json`, and runs automatically before `dev`, `build`, `typecheck` and `test`.
- `src/middleware.ts` stays on Next's older `middleware` convention on purpose: Next 16's `proxy.ts` runs on Node.js, which OpenNext supports on Cloudflare only experimentally.

## Keeping the data fresh

School data is filled and kept current by a research pipeline built to spend as few model tokens as possible: scripts do all the reading, and a model (or a person) reviews only the few lines that can answer an open question.

```sh
pnpm research           # fetch each school's site, write work/research/pack.md (no model)
# review pack.md, write work/research/answers.json
pnpm research:apply     # check every quote against the fetched page, write data/schools/*.json
pnpm research:geocode   # place schools on the map from their street address (no model)
```

**`pnpm research`** reads up to 10 pages per school: its admissions, source and home pages and the site root, then, over two hops, the best links for what the record is missing. Candidates come from the pages read and from the site's sitemap, which lists the fees and about pages menus often hide. Each open gap first reserves its own best link (open house and exam pages for events, the fees page for tuition, the about page for description, language and student body, the contact page for the address), so a strong open-house link cannot crowd out the one fees page. The school's two best PDFs (fees grids, admission guides) are read as text too. It respects `robots.txt`, pauses between requests to the same site, opens JS-rendered or bot-blocked pages in headless Chromium, and recovers the text a Next.js site streams for closed tabs and accordions. It never sends a page to a model. For each school it looks only for what the record is missing: events always; description and tuition when empty; address, language and student body while the school is a draft. It keeps only the lines that can answer those, as verbatim quotes in `pack.md`. Fees tables keep their shape: the level heading, the label row and the amounts under it, with kindergarten, primary and Grade 8+ rows dropped. It drops:

- dates already past, yearless dates that just passed, and events already on file;
- deadlines and replies (you cannot attend a deadline), and other levels (primaire, collégial, Secondary 2–5);
- lines repeated across pages, long paragraphs beyond the matching sentence, and lines already reviewed (`data/research/reviewed.json`, committed).

A draft's address is settled without review when its postal code appears on the school's own site.

**Review** answers in `answers.json` (format at the top of `pack.md`). Every fact carries a verbatim `quote` and the `page` it came from; a table row is quoted as its label and amount joined by a space. A school with nothing usable is listed as `{}` so its lines are never shown again.

**`pnpm research:apply`** rejects a school's whole answer if any quote is not in the fetched page text or the result fails the schema. That makes a hallucinated date or fact impossible to write. It does not publish schools: promoting a draft stays a human decision against the publication bar.

**`pnpm research:geocode`** asks OpenStreetMap Nominatim (one request per second) for each school without a location, naming the street and city. It keeps a result only inside Greater Montreal, and only if it carries the school's own postal code (`exact` for a numbered building with the full code, else `approximate`) or is the record's own building (same house number, street and city) under a postal code OpenStreetMap got wrong (`approximate`).

Token counts are estimates at 4 characters per token:

| Stage | First run, 2026-11-01 | Second run, 2026-11-02 |
|---|---|---|
| Pages read | 252 | ≈375, with sitemaps and PDFs |
| Raw HTML | ≈10.9M | ≈15.9M |
| Visible text | ≈324k | ≈529k |
| Review pack | ≈14k (247 lines) | ≈5.7k (50 lines), then 4 follow-up packs totalling ≈4k |
| Re-run with nothing changed | 0 lines | 0 lines |

## Data corrections

Every date on the site links to the source it was taken from. If a date
here disagrees with the school, the school is right — please open an
issue.
