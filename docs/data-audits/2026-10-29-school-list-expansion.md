# School-list expansion — 2026-10-29

Verification date: **2026-10-29**

Thirteen schools were requested. Eight were already on file and were rechecked; five were added. Two of the new schools are public school-board schools with their own Secondary 1 admission process, so every record now carries `sector` (`private` | `public`), shown on each event and filterable.

The publication bar is unchanged (see `2026-09-15-nullable-evidence-audit.md`): a school is published only when its own official pages explicitly establish address, language of instruction, whole-school gender and Secondary 1 admission, and it has at least one published event with an official date, start and end time. Where a required enum has no explicit statement, the record carries the most likely value as an unverified placeholder and stays draft.

## Result

No new school or event was published. Published totals stay at 13 schools and 16 events.

| School | Sector | Status | Remaining blocker(s) |
|---|---|---|---|
| `college-jean-eudes` (new) | private | draft | Language of instruction and current whole-school gender not stated; 2027-2028 entrance exam (« samedi 3 octobre 2026 ») has no times. |
| `college-de-montreal` (new) | private | draft | Language of instruction not stated; open houses « 11 et 13 septembre 2026 » have no times; admission is file-based (no exam). |
| `college-sainte-anne` (new, Lachine campus) | private | draft | Language of instruction not stated. Two verified exam sessions are on file as draft events. |
| `college-saint-louis` (new) | public | draft | Language and gender not stated; open house « vendredi 25 septembre, de 15h30 à 18h30 » has no year; selection activities are by convocation without dates. |
| `ecole-internationale-de-montreal` (new) | public | draft | Language and gender not stated. Verified open house on file as a draft event; entrance exam 17 octobre 2026 « Horaire : à confirmer ». |
| `villa-maria` | private | published | — (no new 2027-2028 Secondary 1 event; no exam: « Il n'y a plus de sessions d'examen ») |
| `college-jean-de-brebeuf` | private | published | — (no Secondary 1 open house for 2027-2028; the 11 November open house is the collégial's) |
| `villa-sainte-marcelline` | private | published | — (« février/mars 2027 » interview round has no date yet) |
| `college-notre-dame` | private | published | — (no exam; Secondary 1 applications closed) |
| `college-sainte-marcelline` | private | draft | Secondary is « École secondaire privée pour filles » and « Langue d'enseignement: français », but the school also runs préscolaire/primaire with no stated gender; no publishable event (exam 26 September has no times; next open house « Septembre 2027 … date à venir »). |
| `college-regina-assumpta` | private | draft | Language of instruction not stated; Secondary 1 2027-2028 « Complet », no exam, no open house listed. |
| `pensionnat-du-saint-nom-de-marie` | private | draft | All school facts pass (« École secondaire privée francophone pour filles »); no event: Secondary 1 2027-2028 « complet », the 24 April 2027 open house has no times and belongs to the 2028-2029 cycle. |
| `college-international-marie-de-france` | private | draft | Language and gender not stated; the 26 September open house does not name incoming 6e families; « TEST D'ADMISSION … 2ème session le Samedi 28 Novembre » has no year or times. |

## Evidence for the new records

### Collège Jean-Eudes — https://www.cje.qc.ca/

- Address (/nous-joindre/): « 3535, boulevard Rosemont, Montréal QC H1X 1K7 »
- Secondary 1 admission (/admission/): « La période d'inscription pour les examens d'admission de 1re secondaire, pour l'année scolaire 2027-2028 est à présent terminée. »
- Exam (/admission/): « Les examens d'admission pour l'année scolaire 2027-2028 auront lieu le samedi 3 octobre 2026. » — no times, not added.
- Open house « Samedi 2 mai 2026, de 13h à 16h » (/information-importante/portes-ouvertes-2026/) — neither its cycle nor its Secondary 1 audience is stated, so it is not on file; « Prochaines portes ouvertes : 1er mai 2027 » has no times.
- Tuition left null: the only figure is for 2026-2027 (« 5 285 $ »).

### Collège de Montréal — https://college-montreal.qc.ca/

- Sector and gender (home): « le Collège de Montréal est une institution privée mixte qui accueille plus de 1500 élèves, de la 1re à la 5e secondaire. »
- Address (/nous-joindre/): « 1931, rue Sherbrooke Ouest / Montréal (Québec) H3H 1E3 »
- Secondary 1 admission (https://moncdm.college-montreal.qc.ca/admission/): « Pour l'entrée en 1re secondaire en 2027-2028, la date limite pour déposer une demande d'admission est le 15 septembre 2026. »
- Tuition 5360 from « NOS FRAIS DE SCOLARITÉ 2026-2027 … Scolarité 5 360 $ » (base line only).

### Collège Sainte-Anne (Lachine) — https://secondaire.lachine.sainteanne.ca/

`secondaire.sainteanne.ca` is a portal for two separate secondary schools; this record is the Lachine campus. The Dorval campus is not on file.

- Address (footer): « 1250, boulevard Saint-Joseph, Lachine (QC) H8S 2M8 »
- Gender (https://sainteanne.ca/qui-sommes-nous/): « 1988 École mixte … l'école devient mixte! »
- Secondary 1 admission (/admission/): « La période pour faire des demandes d'admission en 1re secondaire pour l'année scolaire 2027-2028 sera du 10 août 2026 au 14 septembre 2026, inclusivement. »
- Draft events (/admission/): « seuls les candidats sélectionnés seront convoqués à l'une des séances aux dates suivantes … : Dimanche 27 septembre 2026, de 9 h à 12 h / Dimanche 27 septembre 2026, de 13 h à 16 h »
- Not added: « Portes ouvertes 12 septembre 2026 » and « Auditions pour les programmes 17 octobre 2026 » (no times).

### Collège Saint-Louis — https://collegesaintlouis.ecolelachine.com/

- Sector (/historique/): « une école d'éducation internationale du Centre de services scolaire Marguerite-Bourgeoys (CSSMB) » … « une école publique du Québec exclusivement dédiée au programme d'éducation internationale. »
- Address (/nous-joindre/): « 275 36e Avenue Lachine (Québec) H8T 2A4 »
- Secondary 1 admission (Critères d'inscription 2027-2028 PDF): « 1. ÉLÈVES DE 1ÈRE SECONDAIRE — La sélection des élèves se fera en deux étapes successives »

### École internationale de Montréal — https://ecole-internationale.cssdm.gouv.qc.ca/

- Sector: Centre de services scolaire de Montréal school; « l'École internationale de Montréal n'est pas une école de quartier ».
- Address of the secondary building (/nous-joindre/): « École internationale de Montréal – Secondaire 11, Chemin de la Côte-Saint-Antoine Westmount (Québec) H3Y 2H7 »
- Secondary 1 admission (/sinscrire-secondaire/): « environ 60 places sont disponibles par année en 1ère secondaire »; « Pour une admission au secondaire 1, 2 ou 3, à la rentrée 2027-2028, l'examen se tiendra le samedi 17 octobre 2026. » — « Horaire : à confirmer », not added.
- Draft event (/sinscrire-secondaire/): « Étape 1 (facultative) Assister à nos portes ouvertes du 19 septembre 2026 Heures : de 13 h à 16 h »

## Leads for the next check

- École internationale de Montréal and Collège Saint-Louis: an explicit statement of language and student body would publish both once a timed event exists.
- PSNM: publishable as soon as a timed 2028-2029 event is posted (24 April 2027 open house).
- CIMF: the 28 November admission-test session, once a year and times are posted.
- Collège Sainte-Anne, Dorval campus: not yet on file.
