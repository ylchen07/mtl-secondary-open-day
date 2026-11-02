# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Parents in Greater Montreal applying for Secondary 1 entry. They are typically
choosing for a 10–11 year old, comparing somewhere between 3 and 20 schools,
and working inside a compressed season: most open houses and every entrance
exam fall in a six-week window from mid-September to late October, with
admission interviews running into November.

They are not browsing. They are scheduling. Many are bilingual; a French school
name in an English interface is normal and expected, and vice versa.

## Product Purpose

A public, bilingual (FR/EN) record of the admissions schedule (open houses,
entrance exams and admission interviews) for Greater Montreal secondary
schools, published by school year (the Secondary 1 entry cohort, e.g.
2027–2028).

The job it does:

1. List every school a family is considering, with where it is, what it is
   (when the school describes itself) and its next confirmed date or "No
   upcoming event observed", so a school with nothing published yet does not
   disappear. Each school has its own page; the events of a school year,
   soonest first, have theirs.
2. Surface time conflicts between schools — especially **entrance exams**, which
   are hard deadlines. Two exams on the same Saturday morning is the single most
   expensive thing a family can fail to notice.
3. Let a parent verify any date in one click against the school's own page.

## Positioning

Schools publish their admissions calendars independently, in PDFs, news posts,
Facebook events and registration portals. This site collects them in **one
place**, and every fact in it comes from the school's own website, not from a
directory, a federation or word of mouth. A family no longer has to visit
twenty sites to know what is on; when a date matters, the source is one click
away.

## Operating Context

- **Coverage:** private schools, plus public schools that run their own
  admissions process (entrance exams, interviews, special programmes). Public
  schools without a selective process are out of scope.
- **Curation:** data is hand-curated JSON in git (`data/schools/*.json`),
  validated on every build (`pnpm check:sources`, Zod schema). Candidate schools
  come from the FEEP directory (`pnpm harvest`) and stay `draft` until a human
  confirms them against the school's own site.
- **Freshness:** `pnpm research` reads each school's own site with scripts
  only and hands a reviewer just the quotable lines that answer what the record
  is missing; `pnpm research:apply` writes an answer only if its quote is in
  the fetched page. Lines once reviewed are never shown again, so an unchanged
  site costs nothing to re-check.
- **Corrections:** if a date disagrees with the school, the school is right;
  corrections arrive as GitHub issues.
- **Delivery:** Next.js on Vercel, deployed from `main` after CI passes.

## Capabilities and Constraints

- Next.js App Router, server-rendered, filtered client-side; no client data
  fetching. No database: the site reads the committed JSON directly.
- Three surfaces: the school directory (`/en`), one page per school
  (`/en/schools/<slug>`), and events by school year
  (`/en/events/current` always shows the year currently recruiting,
  `/en/events/2027-2028` pins a year; unknown years 404).
- Times always render in `America/Toronto`, never the visitor's zone.
- Filters live in the URL so a filtered view is shareable.
- Location is drawn from committed OpenStreetMap geometry; no map tiles or
  third-party requests.
- No accounts, no tracking, no email capture. There is nothing to sign up for.
- Both languages are first-class. Any user-visible string exists in FR and EN or
  the build fails.

### Content truth

- A school is `draft` until a human confirms its address, language of
  instruction, student body and Secondary 1 admission on the school's own
  site. Draft schools appear in the directory with only their confirmed facts
  (name, city, region, sector); unconfirmed facts such as language, student
  body, description and street address are hidden and never match a filter.
  A confirmed school is published even before it posts any event: its page
  says no admissions event has been observed yet. Draft events are never shown.
- Descriptions, tuition and coordinates are optional. A verified date with a
  source link is the whole product; everything else is decoration.
- Events with a published date but no published time are omitted rather than
  given an invented start time. The one exception is admission interviews:
  schools publish an interview day or window and assign each family a private
  slot, so an interview may carry dates only and renders as "Time not
  published". Date-only interviews never raise clash warnings.
- Deadlines are not listed as events because you cannot attend a deadline; an
  interview that is only "we will contact you" is not an event either.

### Scale to design for

As of 2026-11-02: 45 schools on file (18 published, 27 draft; 43 private,
2 public) and 18 published events. Target per season: ~40+ schools and 60+
events, clustered heavily into four or five Saturdays. **The design must be
judged at 60 events, not at today's count**: density and conflict legibility
are the real test.

## Brand Commitments

- Name: "Montréal school agenda" / "Agenda scolaire de Montréal".
- Voice: plain and factual. The site never presents itself as authoritative;
  its standing line is "Confirm dates and registration with each school before
  your visit."

## Evidence on Hand

- `data/schools/*.json`: 45 school records with per-event `source_url` and
  `last_verified_at`.
- `data/research/reviewed.json`: which evidence lines have been reviewed per
  school.
- `docs/data-audits/`: dated audits of what was verified, removed and why.
- No logo, imagery, testimonials, usage figures or school endorsements exist.
  Do not fabricate any of them.

## Product Principles

1. **One place, school's own truth.** Every fact traces to the school's own
   website, with the date it was checked. If it can't be traced, it isn't shown.
2. **Show less rather than guess.** A missing time stays missing; an
   unconfirmed fact stays hidden. A wrong date costs a family their Saturday.
3. **Every school stays visible.** A school with nothing published still has a
   row, so absence of dates is information, not disappearance.
4. **Conflicts are the expensive failure.** Clashes between schools, above all
   entrance exams, must be impossible to miss.
5. **A scheduling instrument, not a brochure.** No rankings, no opinions on
   school quality, no selling; it links out.

## Mode

**Operate.** The visitor is completing a task, not being persuaded. Scanability
and trust outrank expression. Personality lives in precision, not decoration.
