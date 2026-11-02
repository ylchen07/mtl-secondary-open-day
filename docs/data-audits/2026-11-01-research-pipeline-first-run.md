# Research pipeline, first run — 2026-11-01

First full run of `pnpm research` → review → `pnpm research:apply`, plus `pnpm research:geocode`, over all 45 schools on file. How the pipeline works is in the README ("Keeping the data fresh").

## Cost

The scripts read 252 pages. Of those, 3 were rendered in headless Chromium, and 9 could not be read (thin admission portals, or images linked as pages). Token figures are estimates at 4 characters per token.

| Stage | Tokens |
|---|---|
| Raw HTML | ≈10.9M |
| Visible page text | ≈324k |
| Review pack | ≈14k: 247 lines; 24 draft addresses settled by postal code without review |
| Re-run right after applying | 0 lines to review |

## Applied

Every fact below was applied by `research:apply` after its quote was found verbatim in the cited page. There were 0 rejections. Each school's `last_verified_at` is 2026-11-01.

- **Descriptions (18):**
  - Published: `college-mont-royal`, `college-notre-dame`, `college-saint-maurice`.
  - Draft: `college-boisbriand`, `college-de-montreal`, `college-esther-blondin`, `college-francais-secondaire-montreal`, `college-heritage-de-chateauguay-inc`, `college-jean-eudes`, `college-laval`, `college-letendre`, `college-pasteur`, `college-reine-marie`, `college-saint-louis`, `college-st-jean-vianney`, `ecole-marie-clarac`, `ecole-rudolf-steiner-de-montreal`, `ecole-socrates-demosthene-campus-socrates-ii`, `lower-canada-college`.
- **Language of instruction (11 drafts):** `fr` for Boisbriand, d'Anjou, both Collège Français campuses, Héritage, Letendre, St-Jean-Vianney, Marie-Clarac, Rudolf Steiner and Socrates-Démosthène; `en` for Lower Canada College and Loyola.
- **Student body (6 drafts):** `mixed` for d'Anjou, Collège de Montréal, Collège Français Montréal, St-Jean-Vianney, LCC and Loyola. Loyola's evidence is « in 2027-2028 we will be a fully co-educational institution ». `girls` for Marie-Clarac, quoted « SECONDAIRE – 100 % FILLES ».
- **Tuition (10):** the base yearly amount for Esther-Blondin, Jean-Eudes, Laval, Letendre, Mont-Royal, Notre-Dame-de-Lourdes, Notre-Dame, Marcellin-Champagnat, Externat Sacré-Coeur and Herzliah.
- **Event (1):** `college-saint-sacrement`, open house « Samedi 18 septembre 2027 » « de 10h à 14 h », published for 2028-2029. The school is published, and the event has an official date, start and end.

No school was promoted. Drafts still show only name, city, region and sector until a human checks each against the publication bar in `2026-09-15-nullable-evidence-audit.md`.

## Not applied, by design

- **Events without an end time or a year:** École internationale de Montréal exam « samedi 14 novembre 2026 à 9h »; Externat Sacré-Coeur tests « samedi 20 mars 2027, 9 h »; CIMF « Samedi 28 novembre 2026 (2ème session) »; Notre-Dame-de-Lourdes « 2 octobre 2027 »; Jean-Eudes « 1er mai 2027 ».
- **Events for other levels:** Sainte-Marcelline 16 January 2027 is primaire; Marie-Clarac's 14 and 28 November meetings are primaire and garderie.
- **Implied facts:** language from « français langue d'enseignement » as a subject name (Collège de Montréal); gender from sports teams or alumni stories (Beaubois, Sainte-Anne, LCC teams).

## Geocoding

33 of 42 schools without a location now have one: 13 `exact` and 20 `approximate`. Nine were refused because the result's postal code did not match the record. Several refusals point to wrong postal codes in the records, which came from the FEEP directory:

| School | Record | Nominatim | Likely issue |
|---|---|---|---|
| `college-beaubois` | H0H 0H0 | H8Y 1P6 | placeholder postal code in record |
| `college-esther-blondin` | J0K 2R0 | J3X 1R3 | record postal code wrong |
| `college-sainte-marcelline` | H4K 1C3 | H7W 5J6 | record or address mismatch |
| `college-trinite` | J3V 4P6 | J3N 1C3 | record postal code wrong |
| `academie-etoile-du-nord-laval-north-star-academy-laval` | H7W 0C6 | H7X 4G5 | check |
| `college-citoyen` | H7R 1W6 | H7L 4A4 | site confirms H7R 1W6; Nominatim result wrong |
| `college-st-jean-vianney` | H1C 1C1 | J6V 1B5 | site confirms H1C 1C1; Nominatim result wrong |
| `college-saint-maurice`, `ecole-secondaire-marcellin-champagnat` | | no result | address not in OpenStreetMap |
