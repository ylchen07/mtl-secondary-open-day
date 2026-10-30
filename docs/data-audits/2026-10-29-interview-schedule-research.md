# Admission interview research — 2026-10-29

Verification date: **2026-10-29**

Every school record in `data/schools/` was checked for published admission-interview dates (entrevue / entretien d'admission / interview) for Secondary 1 entry. An interview is published only when a school-owned page states, explicitly: that it is an admission interview including Secondary 1 applicants, the concrete date or date range with its year, and the admission cycle it belongs to. Statements such as "candidates may be invited to an interview" or "the admissions office will contact you to set a date" are not events, and off-domain sources are not evidence.

Interviews are frequently published as a day or window with each family's slot assigned privately, so the schema allows `interview` events with inclusive `starts_on`/`ends_on` dates and no clock times. Every other event type still requires published start and end times.

## Result

One interview published:

| School | School year | Date | Official source | Verbatim evidence |
|---|---|---|---|---|
| `villa-sainte-marcelline` | 2027-2028 | Wednesday 2026-11-04 (date-only) | https://villa.marcelline.qc.ca/admissions/ | « **Date limite 30 octobre** pour les entretiens d'admission du mercredi 4 novembre. » under the banner « Pour tous les niveaux jusqu'à la 3e secondaire, 2027-2028 et pour la 1re secondaire 2028-2029 »; Secondaire section: « 2027-2028 – Les admissions sont ouvertes pour 1re à 3e secondaire. » and « Les élèves qui ont déposé un dossier complet seront invitées à une rencontre d'admission. » |

Not published from the same page: « Les prochains entretiens d'admission auront lieu en février/mars 2027 » — no date. The same banner also opens 2028-2029 Secondary 1 files; the page does not say whether those applicants attend on 4 November, so the event is filed under 2027-2028 only.

## Per-school ledger

| School | Outcome | Official URL(s) checked | Evidence |
|---|---|---|---|
| `academie-etoile-du-nord-laval-north-star-academy-laval` | none published | https://northstaracademy.ca/en/admissions/open-house-new.html ; https://northstaracademy.ca/en/admissions.html | No interview mention. |
| `college-beaubois` | none published | https://collegebeaubois.qc.ca/admission/ ; https://collegebeaubois.qc.ca/ | No interview mention in admissions; "Entrevue Beaubois" homepage items are news articles. |
| `college-boisbriand` | none published | https://collegeboisbriand.qc.ca/procedure-dadmission/ | No interview mention. |
| `college-charles-lemoyne-campus-longueuil-saint-lambert` | none published | https://monccl.com ; https://monccl.com/admission/ | No interview mention. |
| `college-charles-lemoyne-campus-ville-de-sainte-catherine` | none published | https://monccl.com ; https://monccl.com/admission/ | No interview mention. |
| `college-citoyen` | vague only | https://www.collegecitoyen.ca/admission-en-ligne | « Un questionnaire de motivation et une entrevue avec la direction de niveau complètent l'étude de ta candidature. » — no date, in the non-Secondary-1 section. |
| `college-danjou` | none published | https://collegedanjou.qc.ca/ ; https://collegedanjou.qc.ca/admission/ | No interview mention. |
| `college-durocher-saint-lambert` | no interview in process | https://cdsl.qc.ca/admission/ | Admission by report cards and a student video; « La 1re secondaire est actuellement complète pour l'année scolaire 2027-2028. » |
| `college-esther-blondin` | none published | https://www.collegeblondin.qc.ca/admission ; https://www.collegeblondin.qc.ca/admission/demande-dadmission | No interview mention. |
| `college-francais-secondaire-longueuil` | none published | https://secondaire.collegefrancais.ca/admission/ ; https://secondaire.collegefrancais.ca/admission-3/procedure-dinscription/ | No interview mention. |
| `college-francais-secondaire-montreal` | none published | https://secondaire-mtl.collegefrancais.ca/admission/ | No interview mention. |
| `college-heritage-de-chateauguay-inc` | none published | https://www.collegeheritage.ca/ | No interview mention. |
| `college-international-marie-de-france` | none published | https://www.cimf.ca/admission/sinscrire/ | No interview mention. |
| `college-jean-de-brebeuf` | none published | https://www.brebeuf.qc.ca/secondaire/admission/ | No interview mention; no 2027-2028 admission FAQ published yet. |
| `college-jean-de-la-mennais` | none published | https://jdlm.qc.ca/admissions-et-inscriptions-secondaire/ | No interview mention. |
| `college-laval` | none published | https://collegelaval.ca/ ; https://collegelaval.ca/admission/ | No interview mention. |
| `college-letendre` | none published | https://www.collegeletendre.qc.ca/admission/ | No interview mention. |
| `college-mont-royal` | none published | https://collegemont-royal.qc.ca/admission-college-mont-royal/ | No interview mention. |
| `college-notre-dame-de-lourdes` | none published | https://www.ndl.qc.ca/admissions/ | No interview mention (site reachable this time). |
| `college-notre-dame` | none published | https://www.collegenotredame.com/admissions/ | No interview mention. |
| `college-pasteur` | none published | https://collegepasteur.ca/ | No interview mention. |
| `college-regina-assumpta` | prior cycle only | https://reginaassumpta.qc.ca/procedure-admission/ | « Convocation à une entrevue et à un test de français écrit dans la semaine du 14 février 2026… » — past 2026-2027 cycle, one of several possible outcomes; no 2027-2028 date yet. |
| `college-reine-marie` | none published | https://www.reine-marie.qc.ca/admission/ | No interview mention. |
| `college-saint-maurice` | none published | https://www.csm.qc.ca/admission/ | No interview mention. |
| `college-saint-sacrement` | none published | https://collegesaintsacrement.qc.ca/procedures-admission ; https://collegesaintsacrement.qc.ca/examens-admission/ | No interview mention. |
| `college-sainte-marcelline` | none published | https://college.marcelline.qc.ca/admission/ ; https://college.marcelline.qc.ca/secondaire/demande-dadmission/ | No interview mention. |
| `college-st-jean-vianney` | none published | https://www.csjv.ca/fr/admission-secondaire-1 | No interview mention. |
| `college-trinite` | none published | https://collegetrinite.ca/le-college/admission/ | No interview mention. |
| `ecole-marie-clarac` | vague only | https://www.ecolemarie-clarac.qc.ca/secondaire/admission/ | « Une entrevue peut être organisée dans certains cas. Vous serez contacté si c'est nécessaire. » The dated « Rencontre d'admission obligatoire : 14 novembre 2026 » is on the préscolaire/primaire pages only. |
| `ecole-rudolf-steiner-de-montreal` | none published | https://ersm.org/admission-ecole/ | Only the 3 October open house; no interview mention. |
| `ecole-secondaire-marcellin-champagnat` | none published | https://esmc.qc.ca/admission/demandes-admission/ | No interview mention. |
| `ecole-socrates-demosthene-campus-socrates-ii` | none published | https://www.socdem.org/admission-en-ligne/ ; 2026-2027 Secondaire calendar PDF | No interview mention. |
| `externat-sacre-coeur` | vague only | https://www.externat.qc.ca/demarche-admission | « Les candidats pourraient être reçus afin de réaliser une entrevue avec un membre de la direction. » |
| `les-ecoles-azrieli-talmud-torah-herzliah` | vague only | https://www.azrieli-tth.ca/fr/admissions-herzliah | « La directrice des admissions communiquera avec les parents pour fixer la date de l'entrevue d'admission. » |
| `lower-canada-college` | vague only | https://www.lcc.ca/admissions/ ; https://www.lcc.ca/admissions/calendar | "Appointments are made in conjunction with the admissions office." The Grade 7 calendar dates are admission tests, not interviews. |
| `loyola-high-school` | none published | https://loyola.ca/admissions | Live page lists only "Nov 8 Application Decisions"; the earlier Activity Day (which included an interview) is gone from the page and past. |
| `pensionnat-du-saint-nom-de-marie` | none published | https://www.psnm.qc.ca/admission | Site rate-limited (HTTP 429); search snippet of the official page: « Admission 1re secondaire - rentrée scolaire 2027-2028 (complet) ». |
| `study` | none published | https://www.thestudy.qc.ca/fr/admission ; https://www.thestudy.qc.ca/admissions | No interview mention. |
| `villa-maria` | none published | https://villamaria.qc.ca/admission/ | No interview mention. |
| `villa-sainte-marcelline` | **published 1** | https://villa.marcelline.qc.ca/admissions/ | See Result above. |

## Leads for the next check

- Villa Sainte-Marcelline: the « février/mars 2027 » interview round, once a date is posted.
- Collège Regina Assumpta: the February interview week for the 2027-2028 cycle, once posted (last cycle: week of 14 February 2026).
- Pensionnat du Saint-Nom-de-Marie: recheck when the site stops rate-limiting.
