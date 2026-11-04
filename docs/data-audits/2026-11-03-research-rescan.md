# Research re-scan after draft removal - 2026-11-03

Removing the draft status (`2026-11-02-draft-status-removed.md`) turned 14 languages and 23 student bodies back into open gaps. This run looked for them, and for every other null school fact, on the schools' own sites.

## How

- `pnpm research` on all 45 schools: 8 lines to review. Lines reviewed while drafts still carried guessed values stayed hidden.
- `pnpm research --all --only <33 schools with a null language, gender, tuition or description>`: 97 lines to review (≈8k tokens of pack, from ≈10.2M tokens of raw HTML).
- The extractor was widened where it missed facts the pages state:
  - meta descriptions are read for language and student body (Regina Assumpta says « mixte » only there);
  - a school's statement about itself ranks ahead of team names («Soccer mixte») under the five-line cap;
  - « dispenser / recevoir en français … enseignement » counts as a language line;
  - a fees label is measured without its parenthetical note (Saint-Maurice's label ran to 121 characters);
  - « Tarifs », « Le collège », « projet éducatif » and « pourquoi choisir » pages are crawled;
  - PDFs up to 15 MB are read (was 5 MB): Saint-Sacrement's projet éducatif is 9.5 MB.
- The pack now ends with **Still missing**: schools with an open fact and nothing quotable, with their unreadable pages.

## Applied (quote checked against the fetched page)

| School | Fact | Quote | Page |
|---|---|---|---|
| Collège Citoyen | gender `mixed` | « établissement d'enseignement privé francophone, laïque et mixte » | collegecitoyen.ca/le-college/ |
| Collège Pasteur | language `fr` | « dispenser en français un enseignement général aux niveaux maternelle, primaire et secondaire » | collegepasteur.ca/admission-college-pasteur.php |
| Collège Regina Assumpta | gender `mixed`, description | « École secondaire privée mixte à Montréal depuis 1955. Six concentrations » | reginaassumpta.qc.ca (meta description) |
| Collège Reine-Marie | language `fr` | « recevoir en français les services d'enseignement en formation générale » | reine-marie.qc.ca/admission/ |
| Collège Sainte-Marcelline | gender `girls` | « Pour les filles, elle se poursuit au secondaire du Collège Sainte-Marcelline. » | college.marcelline.qc.ca/le-primaire-vous-ouvre-ses-portes/ |
| École Marie-Clarac | gender `girls` | « l'École Marie-Clarac Secondaire est un environnement 100 % féminin » | ecolemarie-clarac.qc.ca/secondaire/admission/ |
| École secondaire Marcellin-Champagnat | gender `mixed` | « accessible aux garçons et aux filles » | esmc.qc.ca/a-propos/valeurs-historique/ |
| Collège Saint-Maurice | tuition `3975` | « FRAIS DE SCOLARITÉ … 1er enfant 3 975 $ » | csm.qc.ca/pedagogie/frais-de-scolarite-et-transport/ |
| Collège Saint-Sacrement | description | « une institution d'enseignement secondaire privée, mixte, laïque et francophone. Dirigé par une corporation à but non lucratif depuis 1972 » | collegesaintsacrement.qc.ca/…/Projet_educatif.pdf |

## Not applied

- **Implied only:** Beaubois and Externat (girls' and boys' teams, a 1976 intake of « filles et garçons »), Jean-Eudes (« ouvre ses portes aux filles », history), Collège de Montréal (« français langue d'enseignement » is a subject name), Saint-Louis (« système scolaire québécois francophone » describes applicants), Azrieli (an English section is not a language of instruction for the school), Jean de la Mennais (its projet éducatif promotes French, it does not name the language of instruction).
- **Out of date:** Collège Citoyen's « Droits annuels de scolarité 4 800 $ » is from the 2025-2026 grid; the 2026-2027 grid's amounts are an image.
- **Dated, no time:** the schema needs a start and end for every event but interviews, so these stay off the site until the school publishes times: Jean-Eudes open house 1 May 2027 and 2028-2029 exam 2 Oct 2027; Notre-Dame-de-Lourdes open house 2 Oct 2027; Reine-Marie Sport-études information evening 30 Sept 2027; Trinité 2028-2029 test 17 Apr 2027; Externat tests 20 Mar 2027 (9 h, no end); CIMF secondary test 28 Nov 2026.
- **Another level:** exam and meeting dates on primary pages (Beaubois, Jean de la Mennais, Marie-Clarac, Sainte-Marcelline, École internationale, Azrieli Talmud Torah).
- **Application windows and deadlines:** Collège de Montréal and Notre-Dame-de-Lourdes rounds, Socrates II visit requests.

## Still missing

| School | Missing | Why |
|---|---|---|
| Pensionnat du Saint-Nom-de-Marie | tuition, description | Vercel bot checkpoint (`HTTP 429`, also for a browser user agent); not bypassed |
| Collège Boisbriand | gender, tuition | fees published as an image (`27-28-tarif-2.png`) |
| Danjou, Villa Sainte-Marcelline, Collège Français Montréal, Rudolf Steiner | tuition | no fees page on the site or in its sitemap |
| Esther-Blondin, Laval, Letendre, Rudolf Steiner | student body | no page says it |
| Collège Laval | language | no page says it |

Geocoding: Esther-Blondin (Saint-Jacques), Saint-Maurice (Saint-Hyacinthe) and Marcellin-Champagnat (Saint-Jean-sur-Richelieu) lie outside the map's bounding box; Trinité has no numbered OpenStreetMap match and OSM's postal code (J3N 1C3) is not the school's (J3V 4P6).

Totals after the run: language unknown for 12 schools (was 14), student body for 18 (was 23), description for 5 (was 7), tuition for 18 (was 19), position for 4.
