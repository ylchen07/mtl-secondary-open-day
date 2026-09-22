# Removed / backlog: unverifiable events

Events removed from `data/schools/*.json` runtime data because their dates have
passed and no current official-source evidence can verify them, per the
zero-draft-events objective (unverifiable events should not sit as permanent
drafts — they should be resolved, published, or removed). Removed events are
recorded here so a future harvest can re-add them if the school publishes a new
cycle, and so removal reasoning stays auditable.

## Lower Canada College — 3 events removed 2026-09-20

School record retained (`data/schools/lower-canada-college.json`), now with
`open_days: []`. Address (4090, avenue Royal, H4A 2M5), gender (mixed), and
language (en) are all now confirmed by explicit official evidence and kept on
the school record for the next harvest to attach fresh events to.

Removed events:

| Original identity | Reason |
|---|---|
| `2026-09-17T09:15:00-04:00 \| open_house` | Date has passed; the official page that previously described this event (`https://www.lcc.ca/admissions/apply/grade-7-to-8`) no longer contains any event-specific content. |
| `2026-09-17T17:00:00-04:00 \| open_house` | Same page, same reason. |
| `2026-09-19T09:00:00-04:00 \| open_house` | The official Admissions Calendar page (`https://www.lcc.ca/admissions/calendar`) that previously described this event no longer contains any event-specific content. |

**What we learned along the way, for the next harvest:**

- The stored `notes_en` for all three events said "4099 Royal Avenue," which
  conflicted with the school record's confirmed address of "4090, avenue
  Royal." A 2026-09-19 recheck found an official Grade-7-to-8 page and
  Admissions Calendar that also independently stated "4099 Royal Avenue" in a
  location field — a genuine same-day school-owned conflict at that time.
- By 2026-09-20, both of those pages had already rotated their event-specific
  content out entirely (no dates, times, or address text remain on either
  page). The live site only states "4090, avenue Royal" anywhere (site footer,
  general admissions calendar page intro). "4099" no longer appears anywhere
  on lcc.ca.
- This means the discrepancy cannot be resolved after the fact — the pages
  that contained the conflicting evidence no longer exist. It also means LCC's
  own event pages are ephemeral and get replaced/removed once an event date
  passes, which future harvests should account for (verify close to the event
  date, not weeks after).
- LCC's own official statement, useful for any future record: *"LCC is a
  diverse and inclusive, coeducational, K-11 school... L'ECC est une école
  anglophone mixte de la maternelle à la 5e secondaire menant au DES du MEQ."*
  (`https://www.lcc.ca/admissions/calendar` site footer, 2026-09-20). This
  resolves gender and language for any future LCC record without needing to
  re-derive them.

## Group D — 3 events removed 2026-09-21

All three school records retained (`has_boarding`, address, gender, and
language already confirmed and kept), now with `open_days: []`.

| School | Original identity | Reason |
|---|---|---|
| `college-beaubois.json` | `2026-09-12T08:30:00-04:00 \| open_house` | Date has passed. The official page (`https://collegebeaubois.qc.ca/portes-ouvertes/`) still headlines this exact same date ("PORTES OUVERTES — 12 SEPTEMBRE 2026") as of the 2026-09-21 recheck — the school has not published a next-cycle date. |
| `college-danjou.json` | `2026-09-12T13:00:00-04:00 \| open_house` | Date has passed. The official page (`https://collegedanjou.qc.ca/portes-ouvertes-presentielles/`) now states "Les prochaines portes ouvertes auront lieu en septembre 2027" — an intent statement, not a scheduled event: no day or time is given, so no replacement event can be constructed yet. |
| `ecole-marie-clarac.json` | `2026-09-11T17:00:00-04:00 \| open_house` | Date has passed. The official page (`https://www.ecolemarie-clarac.qc.ca/admission-de-lecole-marie-clarac/`) still shows the same passed Sept 11 date for the Secondaire (girls) open house. The page does list one newer date (Oct 23, 2026), but that session is explicitly "Garderie, Préscolaire et Primaire (mixte)" — outside this product's Secondary-1 scope, so it is not a valid replacement. |

**What we learned along the way, for the next harvest:**

- All three follow the same pattern as Lower Canada College: a harvested Sept
  2026 event whose date passed before the site was refreshed, checked again
  —roughly 9 days later— with no resolution available (either the page is
  simply stale, or it only gives a vague future-year statement instead of a
  bookable date).
- Collège d'Anjou is the one case with a genuine forward signal ("septembre
  2027"). Re-harvest this school first once fall 2027 approaches — the
  school has told us in advance, on its own domain, that a new date is coming.
- École Marie-Clarac publishes two separate open-house tracks (Secondaire
  girls-only vs. Garderie/Préscolaire/Primaire mixed) on the same admission
  page. Future harvests of this school must keep matching only the
  Secondaire line to this product's Secondary-1 scope — the Primaire line
  looks like a valid replacement at a glance but isn't.
