# Research pipeline, second run — 2026-11-02

Second full run of `pnpm research` → review → `pnpm research:apply`, plus `pnpm research:geocode`, over all 45 schools. Re-running the first run's crawl found 0 new lines, because the remaining gaps sat on pages it never reached. This run widened the crawl first, then reviewed what it found. How the pipeline works is in the README ("Keeping the data fresh").

## Crawl changes

| Change | Why | What it found |
|---|---|---|
| Seed the site root | Danjou and Saint-Maurice's records point at one deep page | Home-page summaries |
| Gap-aware link picking, two hops, 10 pages | Open-house links (weight 5) crowded out fees (1) and about (2) pages | Fees pages for Beaubois, LCC, The Study, Durocher and others |
| Sitemap links | Menus hide the fees page; the sitemap lists it | CSJV's fees page, Brébeuf and Herzliah admission pages |
| Read the 2 best PDFs | Fees grids are PDFs | Regina Assumpta and Sainte-Marcelline fees, Notre-Dame-de-Lourdes admission policy |
| Fees tables kept as level, label and amounts | Amounts sit on their own rows under a label and a level heading | Every tuition below |
| Next.js streamed text | CSJV's fees are in a closed accordion, present only in the RSC payload | CSJV tuition |

## Cost

About 375 pages read per full run (7 rendered in headless Chromium). Token figures are estimates at 4 characters per token.

| Stage | Tokens |
|---|---|
| Raw HTML | ≈15.9M |
| Visible page text | ≈529k |
| Main review pack | ≈5.7k: 50 lines; 29 draft addresses settled by postal code without review |
| Follow-up packs, after each crawl change | ≈4k in total: 8, 9, 5 and 4 lines |
| Re-run right after applying | 0 lines to review |

## Applied

Every fact below was applied by `research:apply` after its quote was found in the cited page. One answer was rejected and corrected: Durocher's fees label and amount are not adjacent on the page, so the quote became the `Scolarité 4595 $` row.

- **Tuition (10):** Beaubois 6 196 $ (secondary column, 2027-2028); Charles-Lemoyne, both campuses, 5 390 $ (one secondary fee table on the shared site); Durocher 4 595 $; Regina Assumpta 5 450 $ (fees PDF, all students); Saint-Sacrement 5 325 $; Sainte-Marcelline 5 335 $ (secondary admission page); St-Jean-Vianney 8 525 $ (secondary, 2027-2028); Lower Canada College $27,615 (Grade 7); The Study 35 005 $.
- **Descriptions (4):** Collège international Marie de France and École internationale de Montréal (drafts); The Study and Villa Sainte-Marcelline (published). Promotional wording in the quotes ("exceptional natural setting") was left out.
- **Confirmed on the school's own site, value unchanged:** language `fr` for Citoyen, Esther-Blondin, Notre-Dame-de-Lourdes and St-Jean-Vianney; St-Jean-Vianney `mixed`, from « un environnement mixte, inclusif et francophone ».
- **Event (1, draft):** Collège Héritage de Châteauguay entrance exam, « 23 janvier 2027 de 9h à 11h30 », for 2027-2028. Apply wrote its ledger row in `2026-09-15-nullable-evidence-audit.md`.
- **Record fix:** Collège Beaubois' postal code was the placeholder `H0H 0H0`; its contact page gives « 4901 rue du Collège-Beaubois, Pierrefonds (Québec) H8Y 3T4 ».

No school was promoted.

## Not applied, by design

- **Other levels:** the Brébeuf « portes ouvertes le 6 novembre » line is a 2019 contest for the college (cégep) program, and its 11 November 2026 evening is on the college admission pages. Azrieli's « du 4 au 6 novembre 2026 » open house is Talmud Torah's elementary admission (grades 1–6), not Herzliah's.
- **Past or unrelated dates:** Brébeuf hockey open houses (April–May 2026), Collège Laval term exams (2–5 November 2026).
- **Historical or implied statements:** Esther-Blondin « ouvre ses portes sur la mixité » (1998), Externat « filles et garçons » (founding year), Sainte-Anne « École mixte » (timeline, level unclear), LCC English proficiency, Saint-Louis evaluation of francophone applicants.
- **Promotional text as description:** Collège d'Anjou « à la fine pointe de la technologie ».

## Geocoding

Five more schools placed, all `approximate`: Beaubois (after the postal fix), Citoyen, North Star Academy, Sainte-Marcelline and St-Jean-Vianney. The first run's refusals came from the geocoder, not the records: queries without a city matched a namesake street, and OpenStreetMap tags some buildings with a wrong postal code (St-Jean-Vianney `J6V 1B5`, Sainte-Marcelline `H7W 5J6`). Queries now name the city, and the same house number, street and city vouch for a building whose OSM postal code disagrees. Esther-Blondin's and Sainte-Marcelline's record postal codes match their own sites; the first run's « record postal code wrong » was mistaken.

41 of 45 schools are on the map. The four left:

| School | Why |
|---|---|
| `college-esther-blondin` (Saint-Jacques) | Outside the Greater Montreal map |
| `college-saint-maurice` (Saint-Hyacinthe) | Outside the Greater Montreal map |
| `ecole-secondaire-marcellin-champagnat` (Saint-Jean-sur-Richelieu) | Outside the Greater Montreal map |
| `college-trinite` | OpenStreetMap has rang des Vingt with no house number; a street-only pin was refused |

## Promotions

The publication bar changed on 2026-11-02: a school whose address, language of instruction, whole-school student body and Secondary 1 admission are confirmed on its own site is published even before it posts an event. Its page says no admissions event has been observed yet. Event requirements are unchanged. Evidence for each promotion is in the publication matrix of `2026-09-15-nullable-evidence-audit.md`.

| School | Event | Note |
|---|---|---|
| Collège Français Montréal | Open house, Sunday 4 October 2026, 13h–16h (past) | The event's only blocker since 2026-09-15 was whole-school gender, confirmed by « Premier Collège laïque et mixte au Québec » |
| Collège d'Anjou | none yet | « Un établissement privé francophone mixte » |
| Lower Canada College | none yet | « independent, coed, global day school … the only English high school in Quebec » |
| Collège St-Jean-Vianney | none yet | « de langue française »; « une école secondaire et primaire mixte » |
| Loyola High School | none yet | Co-ed per its FAQ; English instruction per « Applicants must have an English Eligibility Certificate ». Postal code corrected to H4B 1R2 from its contact page; description trimmed to what loyola.ca states |

Not promoted, pending a decision: École Marie-Clarac states « SECONDAIRE – 100 % FILLES » but « GARDERIE, PRÉSCOLAIRE et PRIMAIRE – MIXTE ». The bar asks for the whole school's student body, which is the same blocker that keeps Collège Sainte-Marcelline in draft.

Totals: 18 published schools, 27 drafts, 18 published events.

## Published schools with missing facts

After the promotions, 7 of 18 published schools had no description and 6 had no tuition. Three causes were in the pipeline, not on the sites:

- Descriptions were looked for only on the record's own website URL (often a deep page, such as Trinité's `/portes-ouvertes/`) and on about-style URLs. Sentences where a school states what it is, on any page, are now taken first.
- `\b` in JavaScript regexes treats accented letters as non-word characters, so `\bétablissement` and `\bécole` never matched after a space. The self-reference and identity patterns now use Unicode letter boundaries. This had hidden sentences such as Trinité's « est un établissement d’enseignement secondaire privé francophone » since the first run.
- North Star's fees header row « Grades 7 – 10 / Grade 11 » flattened into two lines, and the nearest one (Grade 11) dropped the row. A run of heading cells is now read as one heading. The amount collector also stops at the end of its row.

Applied, all quote-verified: descriptions for North Star, both Charles-Lemoyne campuses, d'Anjou, Durocher and Trinité (published), and for Beaubois, Citoyen, Notre-Dame-de-Lourdes, Externat Sacré-Coeur, Azrieli and Marcellin-Champagnat (drafts); North Star tuition $10,050 (Canadian students, Grades 7–11, 2026-2027); Beaubois language `fr` (« offerts en français »).

What published schools still lack, and why:

| School | Missing | Why |
|---|---|---|
| Collège Saint-Sacrement | description | Its site has promotional text only (« programmes d’études secondaires de qualité, des installations exceptionnelles ») and history |
| d'Anjou, Collège Français Montréal, Trinité, Villa Sainte-Marcelline | tuition | No annual fee is published on any page the crawl reached, sitemap included |
| Collège Saint-Maurice | tuition | Its fees page lists other fees and payment plans, but no annual tuition amount |
| Collège Saint-Maurice | map position | Saint-Hyacinthe is outside the Greater Montreal map |
| Collège Trinité | map position | OpenStreetMap has rang des Vingt with no house number; a street-level pin was refused |

## Still open

- **Upcoming events:** 4 events on file are today or later. Most schools publish next fall's open houses in spring or summer, so the next run should be then.
- **Tuition (19) and descriptions (7):** their sites have no fees page or factual summary the crawl can reach. Several are public schools (École internationale, Saint-Louis), which charge no private tuition.
- **Pensionnat du Saint-Nom-de-Marie:** its site answers every request with Vercel's bot checkpoint (HTTP 429). The pipeline does not get around a site's bot protection; this school needs a person.
- **Admission portals** (PedNet, Pluriportail) are application forms with no public facts.
