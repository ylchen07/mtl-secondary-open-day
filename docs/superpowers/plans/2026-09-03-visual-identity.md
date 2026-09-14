# Visual Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the deployed wireframe into a designed schedule that stays legible at sixty events, and make a scheduling clash the sharpest thing on the page.

**Architecture:** Design tokens as CSS custom properties in `globals.css`, two self-hosted faces via `next/font/google`, and a restyle of the four existing components. One structural change: the agenda groups by **day** rather than by week, because a day is the unit a parent actually schedules against.

**Tech Stack:** Next 16, React 19, Tailwind, next-intl, TypeScript strict, Vitest 4, Playwright.

**Spec:** [docs/superpowers/specs/2026-09-03-data-breadth-and-visual-identity.md](../specs/2026-09-03-data-breadth-and-visual-identity.md) — section 5.

**Reference:** `demo/agenda-prototype.html` (gitignored). Read it before Task 1. It is the visual target, built against thirteen real dates.

## Global Constraints

- Full EN/FR parity. Every new string exists in both `messages/en.json` and `messages/fr.json`. No English fallback on `/fr`.
- Times always render `America/Toronto`, never the visitor's zone.
- The honest empty state is preserved: when nothing matches, say so. **Never** fall back to showing past events.
- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI borders.
- The clash warning is conveyed by **text**, not by colour alone.
- Focus is visible on every interactive element. Never remove an outline without replacing it.
- Tabular numerals on every time and date figure.
- Icons are drawn SVG. Never emoji, never unicode glyphs as icons.
- No `any`, no `@ts-ignore`. `pnpm typecheck && pnpm lint` clean at every commit.
- Respect `prefers-reduced-motion`.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/globals.css` | **Modified** — design tokens, browser surface theming, base type |
| `src/app/[locale]/layout.tsx` | **Modified** — font loading, body classes |
| `src/lib/dates.ts` | **Modified** — add `groupByDay`, `formatDayHeading` |
| `src/components/AgendaClient.tsx` | **Modified** — day grouping, day headings |
| `src/components/EventCard.tsx` | **Modified** — compact row, clash treatment |
| `src/components/FilterBar.tsx` | **Modified** — chips, search field, states |
| `src/components/EmptyState.tsx` | **Modified** — restyle only, copy unchanged |
| `src/components/ClashIcon.tsx` | **Created** — the one drawn icon |
| `messages/{en,fr}.json` | **Modified** — day headings, exam-clash string |

---

### Task 1: Design tokens, fonts, and browser surfaces

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/[locale]/layout.tsx`

**Interfaces:**
- Produces: CSS custom properties `--paper`, `--paper-sunk`, `--ink`, `--ink-2`, `--ink-3`, `--rule`, `--rule-strong`, `--flag`, `--flag-wash`, `--exam`, `--exam-wash`; CSS variables `--font-sans` and `--font-serif` bound to the loaded faces. Later tasks reference these names exactly.

- [ ] **Step 1: Read the prototype**

Read `demo/agenda-prototype.html`. The `:root` block in its `<style>` is the token set this task ports. If the file is missing, the token values below are complete and authoritative.

- [ ] **Step 2: Tailwind v4 is confirmed — port the CSS accordingly**

`package.json` pins `tailwindcss@^4.3.3` with `@tailwindcss/postcss`. This is **v4**, verified 2026-09-03. Do not re-litigate it; act on it:

1. `globals.css` currently opens with the v3 directives `@tailwind base/components/utilities`. Replace all three with a single `@import "tailwindcss";`.
2. **Every `[--token]` arbitrary value in Tasks 2, 3, and 4 of this plan must be written `(--token)` instead.** v4 changed the syntax for CSS-variable shorthand. `text-[--ink-3]` is parsed by v4 as an arbitrary *value*, not a variable reference, and silently produces no style. Example: `border-[--rule]` becomes `border-(--rule)`.
3. Confirm before building on it. After the first styled commit, inspect one rendered element in devtools and check the computed colour is the token value, not the browser default. **The build will not warn you.**

```bash
grep -n '"tailwindcss"' package.json
grep -rn '\[--' src/ || echo "no v3-style variable classes remain"
```

- [ ] **Step 3: Load the fonts**

In `src/app/[locale]/layout.tsx`, add above the component. `next/font/google` self-hosts at build time — no runtime request to Google, which is both faster and better for privacy:

```typescript
import { Newsreader, Libre_Franklin } from 'next/font/google';

const serif = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-serif',
});

const sans = Libre_Franklin({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-sans',
});
```

Both faces must carry `subsets: ['latin']` — French accented characters (é, à, ç, î, ô) are in the latin subset, and omitting it would break every French school name.

Apply the variables to `<html>`, preserving the existing `lang` and any other attributes already there:

```tsx
<html lang={locale} className={`${serif.variable} ${sans.variable}`}>
```

- [ ] **Step 4: Write the tokens and base styles**

Replace `src/app/globals.css` with (keeping whichever Tailwind import form Step 2 established):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --paper: #fbfaf7;
    --paper-sunk: #f4f2ed;
    --ink: #1a1917;
    --ink-2: #4a4741;
    --ink-3: #6f6a61;
    --rule: #e2dfd7;
    --rule-strong: #cfcabe;
    --flag: #a8341a;
    --flag-wash: #fbf0ec;
    --exam: #2c4a3b;
    --exam-wash: #eef3f0;
  }

  html {
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-sans), system-ui, sans-serif;
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
  }

  ::selection {
    background: var(--ink);
    color: var(--paper);
  }

  :focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 3px;
    border-radius: 2px;
  }

  * {
    scrollbar-width: thin;
    scrollbar-color: var(--rule-strong) transparent;
  }
  *::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  *::-webkit-scrollbar-thumb {
    background: var(--rule-strong);
    border: 3px solid var(--paper);
    border-radius: 99px;
  }
  *::-webkit-scrollbar-track {
    background: transparent;
  }
}
```

`--ink-3` is `#6f6a61` rather than the prototype's `#7c776e`: the lighter value measures 4.3:1 on `--paper` and fails the 4.5:1 floor for the metadata line. Do not revert it.

- [ ] **Step 5: Verify contrast before building on it**

```bash
node -e '
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const lin=c=>c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4;
const L=h=>{const[r,g,b]=hex(h).map(lin);return .2126*r+.7152*g+.0722*b};
const R=(a,b)=>{const[x,y]=[L(a),L(b)].sort((p,q)=>q-p);return ((x+.05)/(y+.05)).toFixed(2)};
const P="#fbfaf7";
for(const[n,c]of[["ink","#1a1917"],["ink-2","#4a4741"],["ink-3","#6f6a61"],["flag","#a8341a"],["exam","#2c4a3b"]])
  console.log(n.padEnd(7), R(c,P), Number(R(c,P))>=4.5?"PASS":"FAIL");
console.log("flag on wash", R("#a8341a","#fbf0ec"));
console.log("exam on wash", R("#2c4a3b","#eef3f0"));
'
```

Expected: every row PASS, and both wash pairings at or above 4.5. If any fails, darken the token until it passes and use the corrected value everywhere.

- [ ] **Step 6: Verify the app still builds and renders**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Expected: clean. Then `pnpm dev`, open `http://localhost:3000/en`, and confirm the page background is warm paper and the text is set in Libre Franklin, not the system default.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css "src/app/[locale]/layout.tsx"
git commit -m "feat(ui): add design tokens, self-hosted faces, themed browser surfaces

Newsreader and Libre Franklin are both newspaper/civic lineage rather than
the startup-default sans, and next/font self-hosts them so no request
reaches Google at runtime. --ink-3 is darker than the prototype's value
because the prototype's failed 4.5:1 on the metadata line."
```

---

### Task 2: Group the agenda by day, not by week

**Files:**
- Modify: `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`
- Modify: `src/components/AgendaClient.tsx`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: `groupByDay<T extends { starts_at: string }>(events: T[]): { day: string; events: T[] }[]` where `day` is a Montreal-local `YYYY-MM-DD`, groups are date-ascending, and events within a group are start-time ascending. Also `formatDayHeading(day: string, locale: Locale): string`.

`groupByWeek` is left in place and untouched; its tests must keep passing.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/dates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { groupByDay, formatDayHeading } from './dates';

const ev = (starts_at: string) => ({ starts_at });

describe('groupByDay', () => {
  it('returns an empty array for no events', () => {
    expect(groupByDay([])).toEqual([]);
  });

  it('groups two events on the same Montreal day together', () => {
    const groups = groupByDay([
      ev('2026-09-12T10:00:00-04:00'),
      ev('2026-09-12T09:00:00-04:00'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].day).toBe('2026-09-12');
  });

  it('orders events within a day by start time', () => {
    const groups = groupByDay([
      ev('2026-09-12T10:00:00-04:00'),
      ev('2026-09-12T09:00:00-04:00'),
    ]);
    expect(groups[0].events.map((e) => e.starts_at)).toEqual([
      '2026-09-12T09:00:00-04:00',
      '2026-09-12T10:00:00-04:00',
    ]);
  });

  it('orders days ascending', () => {
    const groups = groupByDay([
      ev('2026-10-03T10:00:00-04:00'),
      ev('2026-09-12T10:00:00-04:00'),
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-09-12', '2026-10-03']);
  });

  it('groups by MONTREAL day, not UTC day', () => {
    // 21:00 EDT on 12 Sep is 01:00 UTC on 13 Sep. It belongs to the 12th.
    const groups = groupByDay([ev('2026-09-12T21:00:00-04:00')]);
    expect(groups[0].day).toBe('2026-09-12');
  });

  it('separates two events that share a UTC day but not a Montreal day', () => {
    const groups = groupByDay([
      ev('2026-09-12T21:00:00-04:00'),
      ev('2026-09-13T09:00:00-04:00'),
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe('formatDayHeading', () => {
  it('renders an English weekday and date', () => {
    const out = formatDayHeading('2026-09-12', 'en');
    expect(out).toMatch(/Saturday/);
    expect(out).toMatch(/12/);
  });

  it('renders a French weekday and date', () => {
    const out = formatDayHeading('2026-09-12', 'fr');
    expect(out.toLowerCase()).toMatch(/samedi/);
  });

  it('does not shift the date across the timezone boundary', () => {
    expect(formatDayHeading('2026-09-12', 'en')).toMatch(/12/);
    expect(formatDayHeading('2026-01-01', 'en')).toMatch(/1/);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run src/lib/dates.test.ts`
Expected: FAIL — `groupByDay` is not exported.

- [ ] **Step 3: Implement**

Add to `src/lib/dates.ts`. Reuse the existing `TIME_ZONE` constant if the file already defines one rather than declaring a second:

```typescript
/** Montreal-local calendar day for an instant, as YYYY-MM-DD. */
export function montrealDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function groupByDay<T extends { starts_at: string }>(
  events: T[],
): { day: string; events: T[] }[] {
  const buckets = new Map<string, T[]>();

  for (const event of events) {
    const day = montrealDay(event.starts_at);
    const bucket = buckets.get(day);
    if (bucket) bucket.push(event);
    else buckets.set(day, [event]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, group]) => ({
      day,
      events: [...group].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    }));
}

export function formatDayHeading(day: string, locale: Locale): string {
  // Parse as midday UTC so the date cannot slip a day in either direction.
  const date = new Date(`${day}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    timeZone: 'America/Toronto',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}
```

`en-CA` is deliberate for `montrealDay` — it yields `YYYY-MM-DD` directly, which is exactly the sort key needed.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run src/lib/dates.test.ts`
Expected: PASS, including every pre-existing `groupByWeek` test.

- [ ] **Step 5: Switch AgendaClient to day grouping**

Read `src/components/AgendaClient.tsx`. Replace the `groupByWeek` call with `groupByDay`, and render a heading per day. Keep the existing filter logic, the `findClashes` call, the empty-state branch, and the `eventsLandmark` region exactly as they are:

```tsx
import { groupByDay, formatDayHeading } from '@/lib/dates';

// …inside the component, replacing the week-group render:
{groupByDay(filtered).map(({ day, events }) => (
  <section key={day} className="mt-9 first:mt-0">
    <div className="flex items-baseline gap-3 border-b border-[--rule-strong] pb-2">
      <h2
        className="font-[family-name:var(--font-serif)] text-[23px] font-medium tracking-[-0.01em]"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatDayHeading(day, locale)}
      </h2>
      <span className="ml-auto text-[12.5px] text-[--ink-3]">
        {t('resultCount', { count: events.length })}
      </span>
    </div>
    <ul>
      {events.map((event) => (
        <li key={event.id}>
          <EventCard event={event} clashes={clashes.get(event.id) ?? []} />
        </li>
      ))}
    </ul>
  </section>
))}
```

- [ ] **Step 6: Verify in the browser**

```bash
pnpm typecheck && pnpm lint && pnpm vitest run && pnpm dev
```

Open `/en`. Expect day headings in Newsreader. Brébeuf's two exams sit under **two separate day headings** (26 and 27 September), which is the visible proof that day grouping works — under week grouping they shared one bucket.

Open `/fr`. Expect `samedi 26 septembre`, lowercase, which is correct French.

- [ ] **Step 7: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts src/components/AgendaClient.tsx
git commit -m "feat(ui): group the agenda by day instead of by week

A day is the unit a parent schedules against — 'can I make Saturday' is
the question, not 'can I make week 38'. Grouping uses the Montreal
calendar day, so a 21:00 event does not jump to tomorrow via UTC."
```

---

### Task 3: The event row and the clash treatment

**Files:**
- Create: `src/components/ClashIcon.tsx`
- Modify: `src/components/EventCard.tsx`
- Modify: `messages/en.json`, `messages/fr.json`

**Interfaces:**
- Consumes: tokens (Task 1), day grouping (Task 2), existing `findClashes` and `AgendaEvent`.
- Produces: `EventCard` keeping its current props exactly — `{ event: AgendaEvent; clashes: AgendaEvent[] }`. No signature change.

- [ ] **Step 1: Add the new strings to both locales**

The existing `agenda.clashWith` stays. Add one sibling for the case that matters most — a clash where one side is an entrance exam, which cannot be moved.

`messages/en.json`, inside `agenda`:

```json
    "clashWithExam": "Overlaps with {school} ({type}). That one is an entrance exam and cannot be rescheduled.",
    "clashLabel": "Scheduling conflict",
```

`messages/fr.json`, inside `agenda`:

```json
    "clashWithExam": "Chevauche {school} ({type}). Il s'agit d'un examen d'admission, non reportable.",
    "clashLabel": "Conflit d'horaire",
```

Confirm `messages/fr.json` already has a `clashWith` entry. If it does not, that is a pre-existing parity bug — add it: `"clashWith": "Chevauche {school} ({type})"`.

- [ ] **Step 2: Verify locale parity mechanically**

```bash
node -e '
const en=require("./messages/en.json"), fr=require("./messages/fr.json");
const keys=o=>Object.entries(o).flatMap(([k,v])=>typeof v==="object"&&v?keys(v).map(s=>k+"."+s):[k]);
const a=new Set(keys(en)), b=new Set(keys(fr));
const miss=[...a].filter(k=>!b.has(k)), extra=[...b].filter(k=>!a.has(k));
console.log("missing in fr:",miss); console.log("extra in fr:",extra);
process.exit(miss.length||extra.length?1:0);'
```

Expected: both lists empty, exit 0.

- [ ] **Step 3: Create the icon**

Create `src/components/ClashIcon.tsx`. A drawn triangle, not an emoji — emoji render differently on every platform and cannot inherit colour:

```tsx
export function ClashIcon({ className }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M8 2.6 14.4 13.4H1.6L8 2.6Z" strokeLinejoin="round" />
      <path d="M8 6.6v3.1" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  );
}
```

`aria-hidden` is correct here because the clash is fully stated in the adjacent text. The icon is decoration; the sentence carries the meaning.

- [ ] **Step 4: Rewrite EventCard as a row**

Replace the body of `src/components/EventCard.tsx`, keeping the imports, the props, and the `'use client'` directive:

```tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatEventTime, formatVerifiedDate } from '@/lib/dates';
import { ClashIcon } from './ClashIcon';
import type { AgendaEvent } from '@/lib/types';
import type { Locale } from '@/lib/constants';

export function EventCard({
  event,
  clashes,
}: {
  event: AgendaEvent;
  clashes: AgendaEvent[];
}) {
  const t = useTranslations('agenda');
  const tType = useTranslations('eventType');
  const locale = useLocale() as Locale;
  const name = (s: AgendaEvent['school']) => (locale === 'fr' ? s.name_fr : s.name_en);
  const isExam = event.type === 'entrance_exam';

  return (
    <article className="grid grid-cols-[1fr_auto] gap-x-5 border-b border-[--rule] py-4 sm:grid-cols-[132px_1fr_auto]">
      <div className="col-span-2 mb-1 text-[13.5px] font-medium text-[--ink-2] sm:col-span-1 sm:mb-0 sm:text-[14.5px] sm:text-[--ink]">
        {formatEventTime(event.starts_at, event.ends_at, locale)}
      </div>

      <div className="min-w-0">
        <h3 className="text-[17px] font-medium leading-tight tracking-[-0.01em]">
          {name(event.school)}
        </h3>
        <p className="mt-1 text-[13px] text-[--ink-3]">{event.school.city}</p>
      </div>

      <span
        className={`h-fit shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.05em] ${
          isExam
            ? 'bg-[--exam-wash] text-[--exam]'
            : 'bg-[--paper-sunk] text-[--ink-2]'
        }`}
      >
        {tType(event.type)}
      </span>

      {clashes.length > 0 && (
        <ul className="col-span-2 mt-2 space-y-1.5 sm:col-start-2 sm:col-end-4">
          {clashes.map((clash) => (
            <li
              key={clash.id}
              className="flex items-start gap-2 rounded-lg bg-[--flag-wash] px-3 py-2 text-[13px] leading-snug text-[--flag]"
            >
              <ClashIcon className="mt-0.5 shrink-0" />
              <span>
                <span className="sr-only">{t('clashLabel')}: </span>
                {t(clash.type === 'entrance_exam' ? 'clashWithExam' : 'clashWith', {
                  school: name(clash.school),
                  type: tType(clash.type),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="col-span-2 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[--ink-3] sm:col-start-2 sm:col-end-4">
        <span>
          {t('verifiedOn', {
            date: formatVerifiedDate(event.last_verified_at, locale),
          })}
        </span>
        <span aria-hidden="true">·</span>
        <a
          href={event.source_url}
          className="text-[--ink-2] underline decoration-[--rule-strong] underline-offset-2 hover:decoration-[--ink-2]"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('source')}
        </a>
        {event.registration_required && event.registration_url && (
          <>
            <span aria-hidden="true">·</span>
            <a
              href={event.registration_url}
              className="text-[--ink-2] underline decoration-[--rule-strong] underline-offset-2 hover:decoration-[--ink-2]"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('register')}
            </a>
          </>
        )}
      </div>
    </article>
  );
}
```

The `sr-only` "Scheduling conflict" prefix is what satisfies the constraint that the warning must not depend on colour: a screen reader announces the nature of the message, and so does the sentence itself.

- [ ] **Step 5: Verify against real clashing data**

```bash
pnpm typecheck && pnpm lint && pnpm vitest run && pnpm dev
```

The seeded data has Brébeuf's exam on 26 September. If Marie de France is published by then, that row shows the exam-specific clash sentence. If no clash is currently in the data, temporarily add a second event on 12 September to a local copy of a school file, run `pnpm seed`, confirm both rows show the warning, then revert the file and re-seed.

Confirm on `/fr` that the clash sentence is French.

- [ ] **Step 6: Commit**

```bash
git add src/components/EventCard.tsx src/components/ClashIcon.tsx messages/
git commit -m "feat(ui): compact event row with a first-class clash treatment

A clash where one side is an entrance exam gets its own sentence, because
an exam cannot be moved and an open house can — that distinction is the
most useful thing the site knows. Conveyed by text, not colour alone."
```

---

### Task 4: Filters, empty state, and page shell

**Files:**
- Modify: `src/components/FilterBar.tsx`
- Modify: `src/components/EmptyState.tsx`
- Modify: `src/app/[locale]/page.tsx`

**Interfaces:**
- Consumes: tokens (Task 1). No prop or behaviour changes to any component — this is presentation only.

- [ ] **Step 1: Restyle the filter controls**

Read `src/components/FilterBar.tsx`. Change **only** class names and markup, never the filter state logic or the URL parameter handling. Apply:

- The search input: `rounded-lg bg-[--paper-sunk] border border-transparent px-3 py-2 text-[14.5px] placeholder:text-[--ink-3] focus:bg-[--paper] focus:border-[--rule-strong]`
- Each option, as a pill: `rounded-full border px-3 py-1 text-[13px] transition-colors`
  - unselected: `border-[--rule-strong] text-[--ink-2] hover:border-[--ink-3] hover:text-[--ink]`
  - selected: `bg-[--ink] border-[--ink] text-[--paper]`
- Each group label: `text-[11px] font-semibold uppercase tracking-[0.07em] text-[--ink-3]`

If the controls are `<button>` elements, they must carry `aria-pressed`. If they are checkboxes or radios, keep the native input and style the label — do not replace a native control with a `<button>`, because that loses keyboard and screen-reader behaviour for free.

- [ ] **Step 2: Restyle the empty state**

In `src/components/EmptyState.tsx`, change classes only. **Do not touch the copy** — `emptyTitle`, `emptyBody`, and `emptyFiltered` are deliberate and were reviewed in Plan 1:

```tsx
<div className="mt-10 rounded-xl border border-[--rule] bg-[--paper-sunk] px-6 py-12 text-center">
  <p className="font-[family-name:var(--font-serif)] text-[20px]">{title}</p>
  <p className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-relaxed text-[--ink-2]">{body}</p>
</div>
```

Keep the existing "clear filters" control and its `clearFilters` string exactly as they are.

- [ ] **Step 3: Restyle the page shell**

In `src/app/[locale]/page.tsx`, set the masthead. Keep the existing `site.title` and `site.tagline` strings and the locale switcher:

```tsx
<div className="mx-auto max-w-[1060px] px-6">
  <header className="border-b border-[--rule] pb-6 pt-9">
    <h1 className="max-w-[16ch] font-[family-name:var(--font-serif)] text-[clamp(28px,3.6vw,40px)] font-medium leading-[1.08] tracking-[-0.02em]">
      {t('title')}
    </h1>
    <p className="mt-3 max-w-[52ch] text-[14.5px] text-[--ink-2]">{t('tagline')}</p>
  </header>
  {/* existing filter + agenda regions unchanged */}
</div>
```

Do **not** add an eyebrow or kicker line above the `h1`.

- [ ] **Step 4: Add the one authored motion moment**

Append to `globals.css`, inside `@layer base`:

```css
  @media (prefers-reduced-motion: no-preference) {
    article {
      animation: settle 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes settle {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  }
```

One moment, not many. Do not add hover animations to rows.

- [ ] **Step 5: Verify every state**

```bash
pnpm typecheck && pnpm lint && pnpm vitest run && pnpm dev
```

Walk each state and confirm:

| State | URL | Expect |
|---|---|---|
| Populated | `/en` | Day headings, rows, source links |
| French | `/fr` | French chrome, French dates, French clash text |
| Filtered empty | `/en?gender=girls` | Honest empty state, no past events |
| Keyboard | `/en`, press Tab repeatedly | Visible focus ring on every control |
| Reduced motion | OS setting on, reload | No entrance animation |
| Narrow | 375px viewport | Time stacks above school name, nothing clipped |

- [ ] **Step 6: Run the e2e suite and the design detector**

```bash
pnpm exec playwright test
node ~/.agents/skills/impeccable/scripts/detect.mjs --json src/components src/app
```

Expected: 4 e2e tests pass. The detector returns `[]`. If it reports DEGRADED, note that its findings are an undercount and rely on the manual contrast check from Task 1 Step 5.

- [ ] **Step 7: Commit and deploy**

```bash
git add src/components/FilterBar.tsx src/components/EmptyState.tsx "src/app/[locale]/page.tsx" src/app/globals.css
git commit -m "feat(ui): restyle filters, empty state, and page shell

Presentation only — no filter logic, URL handling, or empty-state copy
changed. Native controls kept native so keyboard and screen-reader
behaviour is not lost to styling."
git push
```

Then confirm the deployed site at `https://mtl-secondary-open-day.vercel.app/en` and `/fr`.

---

## Self-Review

**Spec coverage (section 5):**

| Requirement | Task |
|---|---|
| Calm civic utility, Operate mode | 1, 4 |
| Compact rows grouped by date, not cards | 2, 3 |
| Time left, tabular figures | 1 (base), 3 |
| One loud colour, reserved for clashes | 1 (`--flag`), 3 |
| Entrance exams quieter but weightier | 1 (`--exam`), 3 |
| Serif + editorial grotesque, self-hosted | 1 |
| Clash names the event and flags exams | 3 |
| Themed selection, focus, caret, scrollbar | 1 |
| Full states incl. hover, focus, empty | 4 |
| Honest empty state preserved | 4 (copy untouched) |
| Contrast ≥ 4.5:1 | 1 (measured) |
| Clash not colour-alone | 3 (`sr-only` label + sentence) |
| One authored motion moment | 4 |
| EN/FR parity | 3 (mechanical check) |

**Placeholder scan:** No TBDs. Tasks 4's restyle steps describe class
changes against files whose current contents the implementer must read;
the exact classes are given, and the constraint "logic unchanged" is what
makes that safe.

**Type consistency:** `groupByDay` and `formatDayHeading` are defined in
Task 2 and consumed in Task 2 Step 5 with matching signatures. `EventCard`
keeps its Plan 1 props unchanged, so `AgendaClient` needs no edit beyond
the grouping swap. `ClashIcon` takes only `className`.

**Known risk (now resolved, but still the sharpest trap here):** Tailwind
is **v4**, confirmed against `package.json` on 2026-09-03. The token
classes written throughout Tasks 2–4 use the v3 form `[--token]` and
**must all be transposed to the v4 form `(--token)`** as they are typed.
This is not a style preference: in v4 the bracket form is treated as an
arbitrary value rather than a variable reference, so it silently emits
nothing. There is no build error and no lint error — the page simply
renders with default colours and looks approximately fine at a glance.
Verify in devtools after the first styled commit.
