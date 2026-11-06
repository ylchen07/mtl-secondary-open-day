# Descriptions and school facts from Wikipedia - 2026-11-05

A school's description, language, student body and boarding may now come from its Wikipedia article. Dates, fees and admission rules still come only from the school's own site; `pnpm research:apply` refuses a fee or an event quoted from Wikipedia.

## Matching

`pnpm research:wiki` matched 24 schools: Wikidata files the item as a school and either lists the school's website or puts it within 1.5 km of the school under a title with the school's distinctive name. Rejected along the way: the Villa-Maria metro station (beside the school, but not a school), the defunct Loyola College (shares loyola.ca), École secondaire d'Anjou (a different, public school), a Collège Saint-Louis disambiguation page, and the Héritage cégep in Gatineau.

Set by hand after reading the lead, because their Wikidata items carry neither coordinates nor the school's website: The Study, Collège Sainte-Anne, Azrieli Talmud Torah | Herzliah (United Talmud Torahs of Montreal).

Not linked: Socrates-Démosthène's article describes a Pre-K to Grade 6 school, while this record is the Socrates II campus taking Secondary 1 applications.

27 schools have an article; 18 have none.

## Applied (quote checked against the article lead)

Round 1: Beaubois, both Charles-Lemoyne campuses, Collège de Montréal, Durocher Saint-Lambert, Esther-Blondin, Collège Français Longueuil, Marie de France, Jean de la Mennais, Jean-Eudes, Laval, Regina Assumpta, Sainte-Anne, École internationale de Montréal, Marcellin-Champagnat, Azrieli, Lower Canada College, Villa Sainte-Marcelline: 18 descriptions, 0 rejections.

Round 2, once Wikipedia was accepted as the description source for every school with an article: Collège Français Montréal, Brébeuf, Notre-Dame-de-Lourdes, Notre-Dame, Saint-Sacrement, Saint-Nom-de-Marie, The Study, Villa Maria. Loyola keeps the description from loyola.ca, because it carries an admission rule (applicants need a certificate of eligibility for English instruction) that the article lead does not state.

Each records its article in `fact_sources.description` (the earlier `description_source_url` moved there), and the school page credits it.

Volatile figures in the leads (enrolment, tuition, the principal's name) and rankings or praise ("prestigieux") were left out.

## School facts from Wikipedia (round 2, 0 rejections)

| Field | Value | Schools | Quoted from |
|---|---|---|---|
| language | French | Collège de Montréal, Laval, Jean-Eudes, Regina Assumpta, Marie de France, Jean de la Mennais, École internationale, Sainte-Anne | infobox `language`/`langue` row or "French-language" / « francophone » in the lead |
| student body | co-ed | Beaubois, Laval, Jean de la Mennais, Azrieli | « aux filles et aux garçons », « devenu mixte en 1996 », « mixte », "co-educational" |
| boarding | no | Regina Assumpta, Azrieli, Villa Maria | "Day school" infobox rows; "stopped boarding students in 1966" |

Not applied:

- Azrieli's language: the infobox's "English, French, Hebrew" does not say whether the school is bilingual in our sense.
- Brébeuf's boarding: the article's "optional boarding facilities" is the residence, which brebeuf.qc.ca scopes to the collégial (cégep) sector, not Secondary 1. Applied at first, then reverted; the description no longer mentions boarding.

## Wikipedia disagrees with the record (record kept)

- Loyola tuition: infobox $10,450; the school's own page, $6,008.
- Villa Maria tuition: lead "$4,900 (2024–2025)"; the school's own page, $5,520.
