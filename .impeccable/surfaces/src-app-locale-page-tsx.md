---
version: 1
slug: "src-app-locale-page-tsx"
primary_target: "src/app/[locale]/page.tsx"
related_targets: ["src/app/[locale]/schools/[slug]/page.tsx","src/app/[locale]/events/[[...year]]/page.tsx"]
---

# Schools directory, school pages, events by year

Scope: `/[locale]` school directory, `/[locale]/schools/[slug]` school page, `/[locale]/events/[[...year]]` events by school year. Mode: Operate.

Audience and job: parents choosing Secondary 1 schools; find schools by where they are, read what each one is and where, check every admissions date against its source, spot clashes across the season.

Content: 45 schools (13 published, 32 draft); 3 with descriptions, 3 with coordinates; all 45 have a region and city. Gaps show as gaps (user decision): no invented descriptions, drafts show only name, city, region, sector. Location is a self-drawn SVG map from OSM geometry (`data/geo/greater-montreal.json`); no third-party tiles.

## Direction contract

THESIS: Greater Montreal drawn as the archipelago it is. Schools sit on flat-colour land lobes and the rivers do the dividing. Refuses the grey directory table with a map-tile widget bolted on.

OWN-WORLD: cream water ground #F5F1E4; flat unmodulated land per region: island green #8ED462, Laval sun #F5E211, North Shore lilac #EBC1FF, South Shore pond #2BA0FF; ink #2C2E2A; coral #FF705D reserved for entrance exams, clashes and the school pin. Capsule controls. One grotesk family (Bricolage Grotesque), display at 0.95 leading, -0.03em.

STORY: a parent scans schools by where they live, opens one, sees what it is, where it is and every dated admission event with its source, then checks the season by year on Events, where clashes are flagged.

FIRST VIEWPORT: shell first: header (wordmark, Schools / Events nav, locale switch). Directory: an archipelago band with each region lobe labelled with its school count, then search and capsule facets, and the list starting above the fold. School page: its region lobe swells across the band with the school name set on it and a coral pin when coordinates exist; facts, description, address, admissions link and events below.

FORM: Archipel, fused from aww2-zoo-gardens-guide-map; seed:e6b74b16d9b6cf4f.

SIGNATURE: the map is the region filter. Selecting a lobe floods it with colour and drains the others to pale land, in 0.4s with one overshoot; region capsules mirror it as the accessible control.
