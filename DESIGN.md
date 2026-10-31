---
name: Montreal Secondary Open Days
description: Greater Montreal drawn as the archipelago it is; schools sit on flat-colour land and the rivers do the dividing.
colors:
  water-cream: "#F5F1E4"
  water-shade: "#ECE5CF"
  ink: "#2C2E2A"
  ink-secondary: "#575A50"
  rule-sand: "#D9D1B8"
  muted-reed: "#8C8A7C"
  coral: "#FF705D"
  land-island: "#8ED462"
  land-laval: "#F5E211"
  land-north: "#EBC1FF"
  land-south: "#2BA0FF"
  land-other: "#E2DBC4"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 2.2rem + 2.6vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.03em"
  display-band:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 1.8rem + 4vw, 5.5rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title-sm:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  lead:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.3
  label-xs:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
rounded:
  card: "16px"
  pill: "999px"
spacing:
  3xs: "2px"
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
  3xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.land-island}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.water-cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.water-shade}"
  facet-capsule:
    backgroundColor: "{colors.water-cream}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  facet-capsule-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.water-cream}"
  region-pin:
    backgroundColor: "{colors.water-cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 4px 0 16px"
    height: "40px"
  region-pin-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.water-cream}"
  search-input:
    backgroundColor: "{colors.water-cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px 0 40px"
    height: "44px"
  nav-link:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  nav-link-active:
    backgroundColor: "{colors.land-island}"
  type-cap:
    textColor: "{colors.ink}"
    typography: "{typography.label-xs}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  type-cap-entrance-exam:
    backgroundColor: "{colors.coral}"
  event-card:
    backgroundColor: "{colors.water-cream}"
    rounded: "{rounded.card}"
    padding: "16px 24px"
  clash-flag:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
---

# Design System: Montreal Secondary Open Days

## Overview

**Creative North Star: "Archipel"**

The page is water. Greater Montreal is drawn as the archipelago it actually is, from OSM geometry rendered as a self-drawn SVG: flat, unmodulated land lobes, one colour per region, separated by cream rivers. Schools live on that land. The map is not an illustration bolted onto a directory; it *is* the region filter, and every other surface (rows, swatches, counts, the school page band) inherits its colour by region.

Everything around the map is quiet and ink-drawn: one grotesk family set tight and heavy for titles, hairline sand rules between rows, and capsule controls outlined in ink at 1.5px. Colour is spent almost entirely on land. Coral is the only alarm in the system and it is rationed to what a parent must not miss: entrance exams, clashes, and the school pin. Motion has one voice, a 0.4s overshoot, so selecting a region feels like the land swelling into place rather than a tab switching.

Gaps are shown as gaps. A draft school renders only what is known (name, city, region, sector) with a dashed-outline note, never filler.

**Key Characteristics:**
- Cream water ground; flat colour land per region; no gradients, no texture on land.
- The map is the region filter; region capsules mirror it as the accessible control.
- Capsule-shaped everything interactive, 1.5px ink outlines, no shadows.
- One family (Bricolage Grotesque, optical size axis) for display and body.
- Coral rationed to entrance exams, clashes and the map pin.
- One motion grammar: 0.4s with a single overshoot.

## Colors

A cream-water ground with four saturated, flat land colours that carry region identity, one ink, and one rationed coral.

### Primary
- **Ink** (`ink`): text, 1.5px control outlines, selected capsule fill (ink ground, cream text), the strong rule above each agenda day, focus ring.

### Secondary
- **Coral** (`coral`): entrance-exam type cap fill, clash flags, clash card outline with a 10% coral wash, the school map pin dot. Nothing else.

### Tertiary: the land
- **Island Green** (`land-island`): Montreal island. Also the primary-button fill and active nav capsule (see the Island Action Rule).
- **Laval Sun** (`land-laval`): Laval only.
- **North Shore Lilac** (`land-north`): North Shore only.
- **South Shore Pond** (`land-south`): South Shore only.
- **Other Land** (`land-other`): context land outside the four regions; never selectable, never drained.

Region colour travels through a `data-region` attribute that sets `--land`; map lobes, row swatches, pin counts and the school band all read it. Unselected lobes drain to a 42% mix of their land colour into cream (`--drain: 42%`); hovered lobes darken with 12% ink.

### Neutral
- **Water Cream** (`water-cream`): page ground, the water between lobes, capsule and input fills, pin halo.
- **Water Shade** (`water-shade`): hover wash for rows, nav, secondary buttons and text buttons; empty-state ground.
- **Secondary Ink** (`ink-secondary`): lead text, metadata, legends, descriptions, placeholders.
- **Sand Rule** (`rule-sand`): 1px hairlines between rows and the filter band; resting outline of facet and year capsules and past caps.
- **Reed** (`muted-reed`): scrollbar thumb only.

### Named Rules
**The Land Is Identity Rule.** The four land colours mean "this region". Don't use them as decoration, status or category colour.

**The Island Action Rule.** The one sanctioned exception: island green fills the primary button and the active nav capsule. No other land colour does action work.

**The Coral Ration Rule.** Coral marks only entrance exams, clashes and the map pin. If something else turns coral, the alarm stops meaning anything.

**The Cream-Only Secondary Ink Rule.** Secondary ink is legal only on cream grounds (`water-cream`, `water-shade`, the coral wash). It fails contrast on land colours; text on land is always full ink.

## Typography

**Display Font:** Bricolage Grotesque (via next/font, `opsz` axis, with system-ui fallback)
**Body Font:** Bricolage Grotesque (same family)

**Character:** One grotesk carries everything. Optical sizing (`font-optical-sizing: auto`) lets the same family go condensed-and-punchy at display size and open at text size, so no second face is needed.

### Hierarchy
- **Display** (700, `clamp(2.5rem, 2.2rem + 2.6vw, 4.5rem)`, 0.95, -0.03em): directory and events page h1, max ~13ch, balanced.
- **Display Band** (700, `clamp(2.75rem, 1.8rem + 4vw, 5.5rem)`, 0.95): the school name set on its swollen region lobe, max 16ch.
- **Headline** (700, 2rem, 1.05): section h2 on school and events pages, agenda day headings.
- **Title** (600, 1.5rem, 1.1): school row names in the directory list.
- **Title Small** (600, 1.1875rem, 1.2): event headings, year-group headings.
- **Body** (400, 1rem, 1.55): running text, max 65ch; descriptions 68ch.
- **Lead** (400, 1.1875rem, 1.45): intro paragraphs in secondary ink, max 44ch.
- **Label** (500, 0.875rem): capsules, metadata rows, counts. **Label XS** (500, 0.75rem, leading 1) for type caps.

Dates, counts and times use tabular numerals.

### Named Rules
**The Two-Step Weight Rule.** h1 and h2 sit at 700 with -0.03em tracking; h3 and list headings drop to 600 so long lists scan. Interface labels are 500. Never synthesize weights (`font-synthesis: none`).

## Layout

A 1320px container with a fluid gutter (`clamp(16px, 4vw, 48px)`). The directory opens on a band: intro (5fr) beside the archipelago (7fr), with the map bleeding to the right viewport edge. Below it a hairline-ruled filter strip (search capsule, facet capsule groups), then the school list as full-width rows on a three-column grid (name/description, place, next event at 190px/290px).

The school page breaks the container entirely: a full-bleed band (`clamp(340px, 30vw, 440px)` tall) where the school's region lobe swells across and the h1 sits bottom-left on it, aligned to the container's gutter. Below, a main column plus a 340px aside. Events are an agenda: a 240px sticky day heading beside a stack of event cards, each day divided by a 1.5px ink rule.

Spacing runs on a 2/4/8/12/16/24/40/64/96 scale; sections are separated by 64-96px, rows breathe at 24px.

Responsive: at 1080px the school row folds to two columns; at 860px the band stacks, region pins leave the map and become a wrapping capsule row under it, school body and agenda go single-column; at 720px the header wraps nav to its own line, filters collapse behind a capsule toggle with a rotating chevron, and the school band becomes a 220px map above a static title.

## Elevation & Depth

Flat. There are no shadows anywhere. Depth comes from the map metaphor itself: land sits on water by colour alone, selected land floods while the rest drains toward cream, and the coral pin sits on a cream halo with an ink stroke. Hover is a tonal wash (`water-shade`) or an outline darkening from sand to ink, never a lift.

### Named Rules
**The Flat Land Rule.** Land and surfaces are flat colour. No drop shadows, no gradients, no relief shading on lobes.

## Shapes

Two radii: capsules (999px) for every control, cap, flag and pin, and a gently rounded card (16px) for event cards, the draft note and the empty state. Rows are square-edged and divided by hairlines. Outlines are 1.5px (ink when active or primary, sand at rest); rules are 1px sand, except the 1.5px ink rule that opens each agenda day and the past archive. The one organic form is the region swatch: a 14×12px blob with uneven radii, a tiny land lobe beside each school's place.

## Components

### Buttons
- **Shape:** capsule (999px), 48px tall, 1.5px ink outline.
- **Primary:** island-green fill, ink text, weight 500, with a trailing 32px ink circle holding a cream arrow icon that overhangs the right padding.
- **Hover / Active:** primary darkens 14% toward ink and its arrow chip nudges right and tilts (-8deg) on the overshoot; press scales to 0.97.
- **Secondary:** transparent with ink outline; hover washes `water-shade`.
- **Text button:** underlined label, capsule hover wash.

### Chips
- **Facet capsules:** 36px, sand outline, transparent; hover outline turns ink; pressed fills ink with cream text; press scales 0.96.
- **Year links:** the same grammar at 40px; the current year is ink-filled.
- **Type caps:** 24px, ink outline, 0.75rem; entrance exams fill coral. Past events revert to sand outline and secondary ink.
- **Fact caps (school band):** cream capsules sitting on the land; the region cap is ink-filled.

### Cards / Containers
- **Event card:** 16px corners, 1.5px sand outline turning ink on hover, 16px/24px padding, no shadow. A clash gets a coral outline and a 10% coral wash plus coral pill flags naming the clashing schools.
- **Draft note:** 16px corners, 1.5px dashed ink outline.
- **Empty state:** 16px corners on `water-shade`.

### Inputs / Fields
- **Search:** 44px capsule, 1.5px ink outline, cream fill, leading 16px search icon in secondary ink.
- **Focus:** global 2px ink outline, 2px offset. Caret is coral.

### Navigation
- Wordmark at 1.1875rem/500, -0.02em. Nav links are 40px capsules; hover washes `water-shade`, the active page fills island green. The locale switch is an ink-outlined capsule pushed to the right. At 720px nav wraps to its own row.

### Archipelago Map (signature)
The SVG map is the region filter. Each region lobe is clickable; selecting one floods it with full land colour and drains the others to 42% into cream, transitioned on `fill` over 0.4s. Region pins sit over the lobes as cream capsules (ink outline, label plus a 30px land-coloured count disc); a pressed pin inverts to ink and its count disc scales to 1.12 on the overshoot. Below 860px the pins leave the map and wrap as a capsule row. On the school page the same map renders the school's region swelled across the band with a coral pin when coordinates exist. Credit for OSM geometry sits in the footer.

### School Row
A full-width, hairline-topped row with a stretched link on the name; hover and focus-within wash `water-shade`, focus adds an inset ink outline. Name in Title, two-line clamped description, place with a region swatch blob, and the next event with its type cap and source link.

## Do's and Don'ts

### Do:
- **Do** route all motion through the overshoot easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) at 0.4s for transforms; colour and fill changes use plain ease at the same 0.4s.
- **Do** set region colour through `data-region` so lobes, swatches, counts and bands stay in sync.
- **Do** make every interactive control a capsule with a 1.5px outline: sand at rest, ink when active.
- **Do** put full ink, never secondary ink, on any land colour.
- **Do** show missing data as an honest gap in secondary ink.

### Don't:
- **Don't** use coral for anything but entrance exams, clashes and the map pin.
- **Don't** use land colours for non-region meaning; island green's button/nav role is the only exception.
- **Don't** add shadows, gradients or texture to land or surfaces.
- **Don't** bring in map tiles or a third-party map widget; the archipelago is self-drawn from OSM geometry.
- **Don't** add a second typeface; Bricolage Grotesque's optical sizes cover display and text.
