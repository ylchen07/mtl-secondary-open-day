# Draft status removed — 2026-11-02

## Where `draft` came from

The 2026-09-03 spec (`docs/superpowers/specs/2026-09-03-data-breadth-and-visual-identity.md`) added a FEEP harvester (`pnpm harvest`) that bulk-imported schools from an aggregator directory. Its dates were "low confidence, often stale" and it guessed `gender`, defaulting to `"mixed"`. Every harvested file was `status: "draft"`, and a draft was invisible until a person checked the whole record against the school's own site and set it to `published`. The status was a quarantine for an unverified import.

## Why it went

The research pipeline (`pnpm research` / `research:apply`) verifies facts one at a time, each against a quote on the school's own page. A school-level switch then hid facts that were already verified. Drafts also still carried the harvester's guesses: all 27 drafts said `language: fr` and most said `gender: mixed`, verified or not. "Draft" mixed two different things, a confirmed fact and a guess, under one label.

## The rule now

Every value on file is confirmed on the school's own site, or it is `null`. There is no unverified staging state, so the site shows every school with everything confirmed about it. An unknown language or student body is not shown and never matches a filter. An event is on file only once it meets the event bar: exact date with year, start and end, Secondary 1 relevance, and a school-owned source.

## Changes

- **Schema:** `status` removed from schools and events. `language` and `gender` are nullable.
- **Harvester retired:** `scripts/harvest-feep.ts`, `src/lib/harvest/` and its tests and fixtures were removed; it existed only to write drafts from FEEP. The school-file loader, serialiser and Montreal date helper moved to `src/lib/school-files.ts`.
- **Research:** a fact is a gap while it is `null`. The draft-only address re-check is gone, since every address on file is confirmed.
- **Source guard:** `pnpm check:sources` now checks every school and event, not only published ones. This caught Collège Beaubois, whose `source_url` still cited FEEP; it is now the school's home page, where its description and language were quoted.
- **Tests:** the publication-count and publication-matrix tests were removed. The matrix in `2026-09-15-nullable-evidence-audit.md` stays as history. The event-ledger coverage test still requires exactly one row per event on file.

## Data

**Language kept** (confirmed by a school-owned quote in an audit or research run): Beaubois, Boisbriand, Citoyen, Esther-Blondin, Collège Français Longueuil, Héritage, Letendre, Notre-Dame-de-Lourdes, Rudolf Steiner, Socrates-Démosthène II, Marie-Clarac, Sainte-Marcelline and Pensionnat du Saint-Nom-de-Marie.

**Language set to `null`** (14 schools, never stated on their sites): Collège de Montréal, CIMF, Jean de la Mennais, Jean-Eudes, Collège Laval, Pasteur, Regina Assumpta, Reine-Marie, Saint-Louis, Sainte-Anne, École internationale, Marcellin-Champagnat, Externat Sacré-Coeur and Azrieli.

**Student body kept:** Collège de Montréal (« institution privée mixte »), CIMF (« le collège devient mixte »), Sainte-Anne (« l'école devient mixte! ») and Pensionnat (« pour filles »).

**Student body set to `null`:** the other 23 former drafts. These include Marie-Clarac and Sainte-Marcelline, whose secondary is girls-only but whose primary is mixed; their whole-school student body is not stated.

**Events deleted**, each because no school-owned page showed it was for incoming Secondary 1 families (all were past):

| School | Event |
|---|---|
| Collège international Marie de France | Open house, 2026-09-26 |
| Collège Pasteur | Open house, 2026-09-26 |
| Socrates-Démosthène II | Open house, 2026-10-03 |

**Events now shown** (they were held only because their school was a draft): Héritage entrance exam 2027-01-23; Reine-Marie open house 2027-04-17; and past events from Notre-Dame-de-Lourdes, Sainte-Anne (two exam sessions), École internationale and Rudolf Steiner.

**Correction:** Reine-Marie's 17 April 2027 open house moved from 2027-2028 to 2028-2029. Its admission page lists « ADMISSION 2028-2029 … Admission : 13 au 20 avril 2027 », the week of the open house.

Totals: 45 schools and 25 events, all shown.
