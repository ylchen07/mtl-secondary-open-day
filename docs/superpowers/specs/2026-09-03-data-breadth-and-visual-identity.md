# Data Breadth and Visual Identity — Design

**Date:** 2026-09-03
**Status:** Approved design, pending implementation plan
**Follows:** [2026-08-30 Foundation and Agenda](./2026-08-30-mtl-private-secondary-open-days-design.md)

## Problem

Plan 1 shipped a correct, deployed, bilingual site — with three schools on
it. The season it exists to serve has already started: the first event in
the database is 12 September 2026, nine days out. A parent visiting today
gets a working tool that answers almost nothing, and the two features that
justify the project — "does this clash with something else I care about"
and "what else is on that Saturday" — cannot fire at all, because clashes
need a populated calendar to be found in.

The bottleneck is not the software. It is that curating a school by hand
means opening the school's site, finding the admissions page, transcribing
a date, a time range, an address, a postal code, and a coeducation status,
and doing that forty times.

There is a second, smaller problem. The deployed page is an unstyled
wireframe: default Tailwind, no typographic hierarchy, no colour, no
treatment for the clash warning that is supposed to be the product's
sharpest moment. Restyling twelve components is cheap now and expensive
after forty schools of data and a map have landed on top of them.

## Scope

**In scope:** a semi-automated harvest that turns the FEEP directory into
reviewable draft files; a human verification step that promotes drafts to
published; guardrails that make it impossible to publish an unverified
date; and a visual identity applied to the existing components.

**Out of scope:** the map, school detail pages, and geocoding. These were
originally Plan 2 scope and have been moved to Plan 3. Breadth of correct
data beats depth of presentation while the season is running.

## Success criteria

1. Thirty or more Greater Montreal private **secondary** schools are
   published, each with at least one verified upcoming event.
2. No published event cites `feep.qc.ca` as its `source_url`. Enforced in CI.
3. The harvester cannot modify a file whose `status` is `published`.
   Enforced by test.
4. Re-running the harvester against unchanged input produces no diff.
5. The agenda at forty schools reads as a designed schedule, not a list.

---

## 1. Why a harvester, and why it is not a scraper

The Plan 1 spec deferred "automated scraping" on the grounds that
correctness of the seed data comes first. That still holds, and this
design does not reverse it.

The distinction that makes automation safe here is between a **roster**
and a **source**. FEEP is a reliable roster: it knows which private
schools exist, which regions they are in, which offer secondary
education, and roughly when they hold open houses. It is an unreliable
source: the listing carries entries reading `5 octobre 2024` and
`Année scolaire 2023-2024`, verbatim, today.

So the harvester harvests the roster and *never* the truth. It produces a
file that says "this school probably exists at this address and probably
has an event around this date — go check." A human then opens the
school's own page, confirms or corrects every field, replaces the
`source_url` with the school's own URL, stamps `last_verified_at`, and
flips `status` to `published`.

The rule from Plan 1 is unchanged and now mechanically enforced:
**aggregators are leads, not sources.**

### Pipeline

```
FEEP listing + detail pages
        │  scripts/harvest-feep.ts
        ▼
data/schools/*.json   status: "draft"     ← invisible to the site
        │  human verification
        ▼
data/schools/*.json   status: "published" ← source_url now the school's own page
        │  pnpm seed
        ▼
Supabase → site
```

### The draft mechanism already exists

This is the part that makes the plan small. Plan 1 already built every
safety mechanism this needs, for other reasons:

- `publication_status` enum with `not null default 'draft'` on both tables
- RLS policies granting `anon` select only `where status = 'published'`
- `fetchUpcomingEvents` filtering `.eq('status','published')` on both the
  event and its school

A draft school seeded into Supabase is therefore invisible three times
over — the query excludes it, and if the query were wrong, the database
would refuse to serve it to an anonymous client. Nothing new is required
to make drafts safe. The harvester simply writes `"status": "draft"` and
the existing machinery does the rest.

### What the harvester extracts

From the region-grouped listing pages
(`/ecoles-privees-quebec/portes-ouvertes` and its `/en/` twin):

| Field | Source | Confidence |
|---|---|---|
| `name_fr`, `name_en` | Listing heading, both locales | High |
| `slug` | Derived from FEEP's own URL slug | High |
| `region` | The listing's region grouping | High |
| `website_url`, `admissions_url` | "En savoir plus" link | Medium |
| `open_days[].starts_at` / `ends_at` | Date + time range | **Low — often stale** |

From each school's FEEP detail page:

| Field | Source | Confidence |
|---|---|---|
| `address`, `city`, `postal_code` | Contact Information block | High |
| `language` | "Language of Instruction" field | High |
| *(secondary or not)* | "Education Level" field | High |

`gender` has no structured field anywhere on FEEP — only prose
("mixte", "filles", "garçons", "co-ed"). The harvester infers it from
that prose when it can and otherwise emits `"mixed"` with an explicit
flag in the review queue. It is the single field most likely to be wrong,
so verification treats it as unconfirmed by default regardless of what
was inferred.

### Rules the harvester obeys

1. **Never touch a published file.** If `data/schools/<slug>.json` exists
   with `status: "published"`, skip it entirely and report the skip. A
   human's verified work is never overwritten by a machine. Tested.
2. **Never emit `published`.** Every file it writes is `draft`.
3. **Drop primary-only schools.** "Education Level" must include
   secondary. This removes a large fraction of the 140 FEEP schools —
   including several `Collège Sainte-Anne` preschool/primary campuses
   that would otherwise pollute the list.
4. **Drop events with no published time.** Plan 1's ruling R10 stands:
   a date with no time range is excluded, not guessed. FEEP entries
   reading `Sur rendez-vous` or `Information non disponible` produce a
   school with zero events, not an invented one.
5. **Drop stale events.** Anything whose date is in the past at harvest
   time is not written. Stale entries are the FEEP listing's defining
   failure mode.
6. **Be idempotent.** Re-running against unchanged input produces no
   diff. Fields are written in a stable key order.
7. **Be offline-reviewable.** The harvester writes a
   `harvest-report.md` summarising what it created, skipped, and flagged,
   so verification can be planned before any file is opened.
8. **Never create a second file for an existing school.** FEEP's slug for
   a school will not always match ours — we already hold
   `college-jean-de-brebeuf`, and FEEP may name it differently. Writing
   a new file under FEEP's slug would silently duplicate a school that is
   already published, and both copies would appear on the agenda. The
   harvester therefore matches candidates against existing files by
   normalised name as well as by slug, and reports a suspected match for
   human adjudication rather than writing anything. Tested with
   Brébeuf as the fixture.

## 2. Schema changes

Only one change, and it is a relaxation.

**`description_en` / `description_fr` become optional, all-or-nothing.**

They are currently `nonEmpty` and required. FEEP does not supply a usable
bilingual description, and writing forty pairs of them by hand is the
single largest cost in this plan for the smallest benefit — a parent
choosing which open house to attend is served by date, time, language,
and location, not by a paragraph of prose.

They become optional, with a refinement enforcing that both are present
or neither. A school may not have an English description and no French
one, because `/fr` would then render an English blob to a French-speaking
parent. That asymmetry is the actual failure mode, and the refinement is
what prevents it.

The three existing schools keep their descriptions; nothing is deleted.

**`address`, `city`, `postal_code` stay required.** These were considered
for relaxation and the answer is no: the FEEP detail pages supply all
three in a parseable Contact Information block, so they cost nothing to
populate, and they are what Plan 3's map will need.

## 3. Verification, and what "published" means

Promoting a draft to published requires, per event:

1. Opening the school's own admissions page — not FEEP.
2. Confirming the date and the time range against that page.
3. Setting `source_url` to that page's URL.
4. Setting `last_verified_at` to today.
5. Confirming `gender`, which the harvester guessed.
6. Setting `status` to `"published"`.

The publish bar is **a verified date and a source link**. Not a
description, not coordinates, not tuition. Those are enrichment and may
be absent.

### Who verifies, and why that is the real constraint

The harvester is cheap. Verification is the entire cost of this plan, and
it does not parallelise across machines — it is thirty-odd rounds of
"open the school's admissions page, read it, correct the draft."

Verification is done **by the agent, in batches, against the live school
page**, and it is the one part of this plan that must not be delegated to
a subagent working from a summary. The verifier reads the school's own
page directly and transcribes from it. A subagent that is told "confirm
this date" and cannot reach the page will confirm it anyway; that failure
mode is exactly the one this project cannot survive.

Batching is by region, not alphabetically, so that a partial run still
leaves the site coherent. Any school whose page is unreachable,
paywalled, or silent on dates stays a draft and is listed in the report.
A draft left behind is a normal outcome, not a failure.

Because verification is incremental and every batch is independently
shippable, the plan must be executable in slices — publish ten schools,
seed, deploy, continue. The season is running; the site should improve
weekly rather than land all at once.

This has a consequence worth stating plainly, because it was briefly
designed the other way during prototyping: **unverified events are not
shown at all.** There is no "unverified" badge on the live site. A parent
never sees a date the project has not personally confirmed. Showing a
possibly-stale date with a warning label attached still costs a family
their Saturday when they trust it, and a warning label is a way of
transferring that risk to the reader rather than carrying it. Drafts are
invisible.

## 4. Guardrails

Three, all mechanical, because the rule they protect is the one the
project cannot afford to break.

1. **CI check: no published event may cite an aggregator.** A published
   event or school whose `source_url` host is `feep.qc.ca` fails the
   build. This is the rule "aggregators are leads, not sources" turned
   into something that cannot be forgotten at 1am.
2. **Test: the harvester refuses published files.** Given a fixture
   directory containing a published school, the harvester must leave it
   byte-identical.
3. **Test: the harvester is idempotent.** Two consecutive runs over the
   same fixture produce identical output.

Harvester parsing is tested against **checked-in HTML fixtures**, not the
live FEEP site. Tests must not depend on a third party's markup being
reachable or unchanged.

## 5. Visual identity

A prototype exists at `demo/agenda-prototype.html` (gitignored, throwaway)
built against thirteen real dates. It is the reference for this section.
It has not yet been reviewed; the direction below is settled enough to
implement, and the plan should treat colour and type as adjustable
without restructuring.

**Direction: calm civic utility.** The reference points are a transit
departures board and a public library notice — the site is a schedule
that happens to be well set, not a brochure. The interface is in
*Operate* mode: it helps someone complete a task, and it does not
persuade.

**Structure.** Compact rows grouped under date headings, not cards. At
sixty events, cards would mean scrolling past the same border sixty
times. Time sits left in tabular figures so the column scans vertically;
the school name is the anchor; language, region, and coeducation status
are subordinate metadata.

**Colour does one job.** A warm paper ground and near-black ink, with a
single loud colour — vermilion — reserved exclusively for schedule
clashes. Entrance exams carry their own quieter, weightier treatment,
because they are hard deadlines rather than optional visits. Nothing else
is permitted to shout, which is what makes the clash legible at a glance.

**Type.** A serif for date headings and an editorial grotesque for
everything else — both from newspaper/civic lineage rather than the
startup-default sans. Tabular numerals throughout, which is
non-negotiable for a time column.

**The clash treatment is the product.** It states which event is clashing,
by name, with its time range, and — when one of the two is an entrance
exam — says that the exam cannot be rescheduled. That sentence is the
single most valuable string on the site and must be translated with the
same care as the rest.

**Browser surfaces are themed:** selection, focus ring, caret, and
scrollbar. Full states — hover, focus-visible, empty — are implemented,
not just the default state.

The honest empty state from Plan 1 is preserved exactly: when a filter
matches nothing, the site says so. It never falls back to showing past
events.

Accessibility is a floor, not a goal: contrast at or above 4.5:1 for body
text, focus visible on every interactive element, and the clash warning
conveyed by text rather than by colour alone.

## Deferred to Plan 3

| Item | Why |
|---|---|
| Map | Needs exact geocodes; breadth first |
| School detail pages | Needs descriptions, which this plan makes optional |
| Geocoding to `exact` | All three current schools are `approximate`; harmless until there is a map |
| `.ics` export | Still the most plausible next feature |
| Automated re-verification | Revisit once a season's worth of drift has been observed |
