# PRODUCT.md

## What this is

A public, bilingual (FR/EN) listing of open houses and entrance exams for
private secondary schools in Greater Montreal. One page answers one question:
**what can I still attend, and does it clash with anything else I care about?**

## Who it is for

Parents in Greater Montreal applying for Secondary 1 entry. They are typically
choosing for a 10–11 year old, comparing somewhere between 3 and 20 schools,
and working inside a compressed season: most open houses and every entrance
exam fall in a six-week window from mid-September to late October.

They are not browsing. They are scheduling. Many are bilingual; a French school
name in an English interface is normal and expected, and vice versa.

## The job it does

1. Show what is still attendable, soonest first.
2. Surface time conflicts between schools — especially **entrance exams**, which
   are hard deadlines. Two exams on the same Saturday morning is the single most
   expensive thing a family can fail to notice.
3. Let a parent verify any date in one click against the school's own page.

## What makes it credible

Provenance is the product. Every event carries the date it was verified and a
link to the school page it came from. The site never presents itself as
authoritative — a wrong date costs a family their Saturday, so it always shows
its work.

Corollary: the site would rather show **less** than guess. Events with a
published date but no published time are omitted rather than given an invented
start time. Deadlines are not listed as events because you cannot attend a
deadline.

## Content truth

- Data is hand-curated JSON in git, validated, then projected into Postgres.
- Schools are `draft` until a human confirms them against the school's own site;
  drafts are invisible to visitors.
- Descriptions, tuition and coordinates are optional. A verified date with a
  source link is the whole product; everything else is decoration.
- Both languages are first-class. Any user-visible string exists in FR and EN or
  the build fails.

## Scale to design for

Today: 3 schools, 4 events. Target this season: ~40 schools, 60+ events,
clustered heavily into four or five Saturdays. **The design must be judged at 60
events, not at 4** — density and conflict legibility are the real test.

## Mode

**Operate.** The visitor is completing a task, not being persuaded. Scanability
and trust outrank expression. Personality lives in precision, not decoration.

## Constraints

- Next.js App Router, server-rendered, filtered client-side; no client data fetching.
- Times always render in `America/Toronto`, never the visitor's zone.
- Filters live in the URL so a filtered view is shareable.
- No accounts, no tracking, no email capture. There is nothing to sign up for.

## Explicitly not this

- Not a school-ranking or review site. No opinions about school quality.
- Not a directory to browse for pleasure. It is a scheduling instrument.
- Not a brochure for the schools. It links out; it does not sell.
