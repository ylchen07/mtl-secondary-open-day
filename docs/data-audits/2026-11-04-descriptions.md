# Descriptions from the schools' own about pages - 2026-11-04

After `website_url` was corrected to each school's home page (`f14bfd6`), descriptions were the thinnest field: 5 schools had none and 13 had only a label such as "Collège Jean-Eudes is a secondary school in Montreal."

## What changed in research

- A description under 100 characters now counts as a gap (`THIN_DESCRIPTION_CHARS`), so research looks for more than a label.
- `admission` no longer matches the about-page rule's `mission`. Every admission page had ranked as an about page, so a school's eight crawl slots went to admission pages while its « Présentation », « Historique » or « Notre mission » page was never read (Collège Français Longueuil), and admission pages counted as about pages for description lines.
- « Présentation », « le collège » and « projet éducatif » pages count as about pages.
- A stated mission (« a pour mission », "our mission") or founding (« fondé en / par », « voit le jour en », "founded in") ranks ahead of other lines under the four-line description cap.

The run: `pnpm research --all --only <18 schools>`, ≈5.75M tokens of raw HTML → ≈219k of page text → ≈6.5k pack (83 lines).

## Applied (quote checked against the fetched page)

Each description states only what its quote says. Lengths are `description_en` characters.

| School | Before | After | Quoted page |
|---|---|---|---|
| `academie-etoile-du-nord-laval-north-star-academy-laval` | 85 | 143 | northstaracademy.ca/en/ |
| `college-citoyen` | 47 | 129 | www.collegecitoyen.ca/le-college/ |
| `college-francais-secondaire-longueuil` | none | 114 | secondaire.collegefrancais.ca/le-college/presentation/ |
| `college-jean-de-la-mennais` | none | 139 | jdlm.qc.ca/histoire-et-projet-educatif/ |
| `college-jean-eudes` | 53 | 134 | www.cje.qc.ca/a-propos-du-college/ |
| `college-laval` | 78 | 169 | collegelaval.ca/college/notre-mission-et-notre-histoire/ |
| `college-mont-royal` | 88 | 158 | collegemont-royal.qc.ca/ |
| `college-regina-assumpta` | 81 | 138 | reginaassumpta.qc.ca/le-college/ |
| `college-saint-maurice` | 71 | 137 | portesouvertes.csm.qc.ca/ |
| `college-sainte-anne` | none | 189 | secondaire.lachine.sainteanne.ca/qui-sommes-nous/ |
| `college-sainte-marcelline` | none | 131 | college.marcelline.qc.ca/ |
| `ecole-secondaire-marcellin-champagnat` | 58 | 137 | esmc.qc.ca/a-propos/valeurs-historique/ |
| `ecole-socrates-demosthene-campus-socrates-ii` | 89 | 110 | www.socdem.org/ |
| `externat-sacre-coeur` | 73 | 136 | www.externat.qc.ca/pourquoi-nous-choisir |
| `les-ecoles-azrieli-talmud-torah-herzliah` | 55 | 129 | www.azrieli-tth.ca/ |
| `study` | 67 | 178 | www.thestudy.qc.ca/ |
| `villa-sainte-marcelline` | 83 | 169 | villa.marcelline.qc.ca/admissions/open-house/ |

## Saint-Nom-de-Marie, read by browser (2026-11-05)

The site answers scripted requests with `HTTP 429` (Vercel Security Checkpoint). On 2026-11-05 six pages (home, admission, portes-ouvertes, histoire-et-mission, a-propos, droits-scolarite) were read once in an ordinary Chromium, which passes the checkpoint as a visitor's browser does, and run through the same extractor and quote check:

- Description: « La vision même des Sœurs des Saints Noms de Jésus et de Marie, fondatrices de l'institution en 1905, … » (psnm.qc.ca/histoire-et-mission).
- Tuition `6150`: « Droits de scolarité* 6 150 $ », profile « Être et devenir », 2026-2027 (psnm.qc.ca/droits-scolarite).
- Not added: the open house of Saturday 24 April 2027 has no hours on either page.

Descriptions left as they were: the 27 schools already at 100 characters or more.
