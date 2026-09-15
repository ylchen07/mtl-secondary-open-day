# Nullable Evidence and Draft Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Represent unknown boarding and registration facts safely, audit the complete dataset, and publish all otherwise complete events without inventing negative claims.

**Architecture:** Git JSON remains authoritative. Zod and TypeScript gain nullable evidence fields, a forward-only Supabase migration makes the projection columns nullable, and the UI treats unknown registration as a link to official details while retaining the existing positive-only boarding filter. A complete official-source audit updates every school/event disposition before candidate promotion.

**Tech Stack:** Next.js 16.3.3, React 19.2.8, TypeScript 6, Zod 3, Supabase/Postgres, next-intl, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-15-nullable-evidence-and-draft-promotion.md`

## Global Constraints

- Never infer `false` from official-source silence.
- School-owned sources are required for published facts; FEEP, aggregators, snippets, directories, and social media are leads only.
- Exact event year/date/start/end, Secondary 1 relevance, school identity/location/language/gender, and official source URL remain mandatory.
- `has_boarding: null` and `registration_required: null` do not block publication.
- Git is authoritative; Supabase is a rebuildable projection.
- Do not apply the production migration, seed, push, merge, deploy, or revalidate without explicit authorization.
- Use pnpm, strict TypeScript, and no `any`, `@ts-ignore`, or guessed values.
- Published past events remain visible but inactive.

---

### Task 1: Encode Nullable Evidence and Registration Invariants

**Files:**
- Modify: `src/lib/schema.ts`
- Modify: `src/lib/types.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produces: `SchoolFile.has_boarding: boolean | null`.
- Produces: `OpenDayInput.registration_required: boolean | null`.
- Enforces: true requires a registration URL; false/null forbid a registration URL.

- [ ] **Step 1: Add failing schema tests**

Add cases equivalent to:

```ts
it('accepts unknown boarding and registration evidence', () => {
  const result = schoolFileSchema.safeParse({
    ...validSchool,
    has_boarding: null,
    open_days: [{
      ...validSchool.open_days[0],
      registration_required: null,
      registration_url: null,
    }],
  });
  expect(result.success).toBe(true);
});

it.each([
  [true, null],
  [false, 'https://school.example/register'],
  [null, 'https://school.example/register'],
])('rejects registration invariant %s / %s', (required, url) => {
  const result = schoolFileSchema.safeParse({
    ...validSchool,
    open_days: [{
      ...validSchool.open_days[0],
      registration_required: required,
      registration_url: url,
    }],
  });
  expect(result.success).toBe(false);
});
```

Also add passing cases for `(true, HTTPS URL)`, `(false, null)`, and `(null, null)`.

- [ ] **Step 2: Run the focused test and confirm red**

Run:

```bash
pnpm test -- tests/schema.test.ts
```

Expected: null cases fail because both fields are Boolean-only and invalid combinations are accepted.

- [ ] **Step 3: Implement nullable schemas and invariants**

Change both fields to nullable Booleans and add an `openDaySchema.superRefine` or equivalent explicit refinement:

```ts
if (event.registration_required === true && event.registration_url == null) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['registration_url'], message: 'is required when registration is required' });
}
if (event.registration_required !== true && event.registration_url != null) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['registration_url'], message: 'must be empty unless registration is required' });
}
```

Update runtime types:

```ts
has_boarding: boolean | null;
registration_required: boolean | null;
```

- [ ] **Step 4: Run focused tests and typecheck**

```bash
pnpm test -- tests/schema.test.ts
pnpm typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts src/lib/types.ts tests/schema.test.ts
git commit -m "feat(data): support unknown evidence values"
```

---

### Task 2: Preserve Null Through Projection and Add the Database Migration

**Files:**
- Create: `supabase/migrations/20260915120000_nullable_evidence_fields.sql`
- Modify: `src/lib/seed-mapping.ts` only if tests expose coercion
- Test: `tests/seed-mapping.test.ts`

**Interfaces:**
- Consumes: nullable `SchoolFile` fields from Task 1.
- Produces: Supabase rows that preserve `null` exactly.
- Produces: forward-only SQL migration dropping defaults and `NOT NULL` constraints.

- [ ] **Step 1: Add failing null-preservation tests**

```ts
it('preserves unknown boarding in the school row', () => {
  expect(toSchoolRow({ ...file, has_boarding: null }).has_boarding).toBeNull();
});

it('preserves unknown registration in event rows', () => {
  const input = {
    ...file,
    open_days: [{ ...file.open_days[0], registration_required: null, registration_url: null }],
  };
  expect(toOpenDayRows(input, 'school-uuid')[0].registration_required).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and confirm its state**

```bash
pnpm test -- tests/seed-mapping.test.ts
```

Expected: fail at compile/schema boundaries before implementation, or pass if existing direct mapping already preserves null. Record that result; do not add unnecessary mapping code.

- [ ] **Step 3: Add the migration**

Create:

```sql
alter table schools
  alter column has_boarding drop not null,
  alter column has_boarding drop default;

alter table open_days
  alter column registration_required drop not null,
  alter column registration_required drop default;
```

Do not edit the original migration.

- [ ] **Step 4: Run focused tests and inspect SQL**

```bash
pnpm test -- tests/seed-mapping.test.ts
rg -n "drop not null|drop default" supabase/migrations/20260915120000_nullable_evidence_fields.sql
```

Expected: null-preservation tests pass and both columns have both alterations.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seed-mapping.ts tests/seed-mapping.test.ts supabase/migrations/20260915120000_nullable_evidence_fields.sql
git commit -m "feat(db): allow unknown evidence fields"
```

---

### Task 3: Keep Filters Correct for Unknown Boarding

**Files:**
- Modify: `src/lib/filters.ts` only if explicit equality is absent
- Test: `tests/filters.test.ts`

**Interfaces:**
- Consumes: `AgendaEvent.school.has_boarding: boolean | null`.
- Guarantees: no boarding facet includes all values; boarding facet matches only `true`.

- [ ] **Step 1: Add null-specific filter tests**

Create a third fixture event with `school.has_boarding = null` and assert:

```ts
expect(applyFilters(eventsWithUnknown, EMPTY_FILTERS)).toHaveLength(3);
expect(applyFilters(eventsWithUnknown, { ...EMPTY_FILTERS, boarding: true }))
  .toEqual([verifiedBoardingEvent]);
```

- [ ] **Step 2: Run the focused test**

```bash
pnpm test -- tests/filters.test.ts
```

Expected: pass if the existing positive-only predicate is already correct; otherwise fail and expose the coercion.

- [ ] **Step 3: Make the predicate explicit if needed**

Use:

```ts
if (filters.boarding && event.school.has_boarding !== true) return false;
```

Do not add an unknown facet.

- [ ] **Step 4: Run focused tests and typecheck**

```bash
pnpm test -- tests/filters.test.ts
pnpm typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/filters.ts tests/filters.test.ts
git commit -m "test(filters): define unknown boarding behavior"
```

---

### Task 4: Render Unknown Registration Safely and Bilingually

**Files:**
- Modify: `src/components/EventCard.tsx`
- Modify: `messages/en.json`
- Modify: `messages/fr.json`
- Test: `tests/messages.test.ts`
- Create: `tests/event-card.test.tsx` if the test environment supports React rendering; otherwise extract and test a pure registration-action selector in `src/lib/registration.ts` and `tests/registration.test.ts`.

**Interfaces:**
- Consumes: `registration_required: boolean | null`, `registration_url`, `source_url`, and `past`.
- Produces: `register`, `check-details`, or no action.

- [ ] **Step 1: Add failing action-policy tests**

Test this truth table:

| Past | Required | Expected |
|---|---|---|
| false | true | registration URL / Register |
| false | false | no action |
| false | null | source URL / Check registration details |
| true | true/false/null | no action |

If extracting a pure helper, use:

```ts
registrationAction(event, past):
  | { kind: 'register'; href: string }
  | { kind: 'check'; href: string }
  | null
```

Also assert both translation files contain `checkRegistrationDetails`.

- [ ] **Step 2: Run focused tests and confirm red**

```bash
pnpm test -- tests/messages.test.ts tests/event-card.test.tsx tests/registration.test.ts
```

Run only files that exist. Expected: missing key/helper/render behavior fails.

- [ ] **Step 3: Implement the action policy and copy**

Add:

```json
// messages/en.json
"checkRegistrationDetails": "Check registration details"

// messages/fr.json
"checkRegistrationDetails": "Vérifier les modalités d’inscription"
```

Render the existing Register action only for explicit `true`. For `null`, render a visually consistent external link to `event.source_url`. Suppress both for past events.

- [ ] **Step 4: Run focused tests, typecheck, and lint**

```bash
pnpm test -- tests/messages.test.ts tests/event-card.test.tsx tests/registration.test.ts
pnpm typecheck
pnpm lint
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/EventCard.tsx src/lib/registration.ts messages/en.json messages/fr.json tests/messages.test.ts tests/event-card.test.tsx tests/registration.test.ts
git commit -m "feat(agenda): link unknown registration to official details"
```

Stage only files that exist.

---

### Task 5: Make Harvested Unknowns Honest by Default

**Files:**
- Modify: `src/lib/harvest/emit.ts`
- Modify: `src/lib/harvest/orchestrate.ts` only if its fixture/type expectations require it
- Test: `tests/harvest-emit.test.ts`
- Test: `tests/harvest-orchestrate.test.ts`

**Interfaces:**
- Produces: new draft schools with `has_boarding: null`.
- Produces: new draft events with `registration_required: null` and `registration_url: null` unless official parsing establishes otherwise.

- [ ] **Step 1: Change harvest expectations to null**

In output assertions, require:

```ts
expect(output.has_boarding).toBeNull();
expect(output.open_days[0].registration_required).toBeNull();
expect(output.open_days[0].registration_url).toBeNull();
```

- [ ] **Step 2: Run harvest tests and confirm red**

```bash
pnpm test -- tests/harvest-emit.test.ts tests/harvest-orchestrate.test.ts
```

Expected: current hard-coded false defaults fail.

- [ ] **Step 3: Replace unsupported false defaults with null**

Change only generated unknown defaults. Preserve reconciled official facts and stable emission ordering.

- [ ] **Step 4: Run the complete harvest test group**

```bash
pnpm test -- tests/harvest-emit.test.ts tests/harvest-orchestrate.test.ts tests/harvest-reconcile.test.ts tests/harvest-report.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/harvest/emit.ts src/lib/harvest/orchestrate.ts tests/harvest-emit.test.ts tests/harvest-orchestrate.test.ts
git commit -m "fix(harvest): emit unknown evidence as null"
```

---

### Task 6: Audit the Complete Corpus and Record Evidence Dispositions

**Files:**
- Modify: `data/schools/*.json` as supported by the audit
- Create: `docs/data-audits/2026-09-15-nullable-evidence-audit.md`
- Modify: `tests/data-integrity.test.ts`
- Modify: `tests/check-sources.test.ts` only when evidence guard behavior changes

**Interfaces:**
- Consumes: official school-owned evidence for all 41 school files and 33 events.
- Produces: supported Boolean or null dispositions and a durable audit report.
- Guarantees: no published record is grandfathered.

- [ ] **Step 1: Add corpus integrity tests for nullable semantics**

Add tests that load all JSON and assert:

```ts
for (const school of schools) {
  expect([true, false, null]).toContain(school.has_boarding);
  for (const event of school.open_days) {
    expect([true, false, null]).toContain(event.registration_required);
    if (event.registration_required === true) expect(event.registration_url).toMatch(/^https:\/\//);
    else expect(event.registration_url ?? null).toBeNull();
  }
}
```

Continue to validate every file through `schoolFileSchema`.

- [ ] **Step 2: Run integrity and source tests before data edits**

```bash
pnpm test -- tests/data-integrity.test.ts tests/check-sources.test.ts
pnpm check:sources
```

Expected: invariant tests identify current unsupported URL/value combinations after nullable conversion, if any.

- [ ] **Step 3: Build the evidence ledger**

For each school and event, record in `docs/data-audits/2026-09-15-nullable-evidence-audit.md`:

```md
| File | Field | Before | After | Disposition | Official source | Evidence |
```

Allowed dispositions are exactly `supported`, `unsupported-negative`, `unsupported-positive`, and `contradicted`.

Research must use current school-owned pages. Record exact URLs and concise supporting wording. If a source does not explicitly establish a Boolean, set the field to null.

- [ ] **Step 4: Apply the audit to all JSON files**

Update all 41 `has_boarding` values and all 33 `registration_required` values according to the ledger. Enforce the registration URL invariant. Update `last_verified_at` only for records completely reviewed on the real review date.

Do not change statuses in this step; promotion is separately reviewable in Task 7.

- [ ] **Step 5: Reconcile audit coverage mechanically**

Run a one-off Node check that compares the 74 audited field rows in the ledger against the 41 school plus 33 event identities and reports zero missing and zero duplicate dispositions. Save the reusable assertion in `tests/data-integrity.test.ts` if practical.

Expected summary:

```text
schools audited: 41/41
events audited: 33/33
missing: 0
duplicates: 0
```

- [ ] **Step 6: Validate the audited corpus**

```bash
pnpm test -- tests/schema.test.ts tests/data-integrity.test.ts tests/check-sources.test.ts
pnpm check:sources
```

Expected: all files validate and all published source guards pass.

- [ ] **Step 7: Commit**

```bash
git add data/schools docs/data-audits/2026-09-15-nullable-evidence-audit.md tests/data-integrity.test.ts tests/check-sources.test.ts
git commit -m "data: audit boarding and registration evidence"
```

---

### Task 7: Re-evaluate and Promote Complete In-window Events

**Files:**
- Modify: qualifying `data/schools/*.json`
- Modify: `docs/data-audits/2026-09-15-nullable-evidence-audit.md`
- Test: `tests/data-integrity.test.ts`

**Interfaces:**
- Consumes: audited corpus from Task 6 and publication standard from the spec.
- Produces: published statuses only for fully supported schools/events.

- [ ] **Step 1: Create a candidate checklist from all in-window drafts**

For each candidate, record pass/fail for:

```text
identity | address/region | language | gender | exact date/year | exact start/end |
type | Secondary 1 relevance | official event source | verification date
```

Boarding and registration may be null and must not appear as blockers.

- [ ] **Step 2: Independently verify the strongest candidates**

Re-check The Study, Villa Sainte-Marcelline, Collège Notre-Dame, Collège Trinité, Collège Durocher Saint-Lambert, and both Collège Charles-Lemoyne campuses against current official pages. Resolve campus and event-location differences explicitly.

- [ ] **Step 3: Change statuses only for passing records**

For each passing candidate:

```json
"status": "published"
```

must be set on both the school and qualifying event. Do not publish unrelated draft events in the same school unless they independently pass.

For every remaining draft, add one or more precise non-nullable blockers to the audit report.

- [ ] **Step 4: Add or update expected-count assertions**

Update integrity tests to assert the exact reviewed counts of published schools/events and verify that every published event belongs to a published school.

- [ ] **Step 5: Run data validation**

```bash
pnpm test -- tests/data-integrity.test.ts tests/check-sources.test.ts
pnpm check:sources
```

Expected: pass with the new exact publication counts.

- [ ] **Step 6: Commit**

```bash
git add data/schools docs/data-audits/2026-09-15-nullable-evidence-audit.md tests/data-integrity.test.ts
git commit -m "data: publish newly verified admission events"
```

---

### Task 8: Full Verification and Browser Acceptance

**Files:**
- Modify: only defects revealed by verification

**Interfaces:**
- Validates the integrated feature without touching production Supabase.

- [ ] **Step 1: Run the full automated suite**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm check:sources
pnpm build
git diff --check
```

Expected: all commands pass.

- [ ] **Step 2: Run a local browser acceptance pass**

Start the production build locally without a production seed. Verify EN and FR:

- expected event count from the audited local fixture/test projection;
- unknown registration action text and official source destination;
- true registration action still uses `registration_url`;
- false registration has no action;
- past events have no registration action;
- boarding filter excludes null and false;
- mobile filters, keyboard navigation, source links, and empty states remain usable.

- [ ] **Step 3: Reconcile the final git corpus mechanically**

Report exact totals:

```text
schools: total / published / draft / archived
events: total / published / draft / archived
boarding: true / false / null
registration: true / false / null
```

Confirm every total matches the audit ledger.

- [ ] **Step 4: Review the complete diff**

```bash
git diff origin/main...HEAD --stat
git diff origin/main...HEAD --check
git status --short
```

Check for accidental credentials, unsupported sources, future verification dates, and unrelated changes.

- [ ] **Step 5: Commit verification fixes if any**

```bash
git add <only-files-fixed-during-verification>
git commit -m "fix: address nullable evidence verification findings"
```

Skip the commit if no files changed.

---

### Task 9: PR Review and Post-merge Owner Seed Handoff

**Files:**
- Modify: `README.md` if the nullable migration/seed order is not already documented
- Create: PR body through GitHub CLI only after owner authorization

**Interfaces:**
- Produces: reviewable PR with no production mutation.
- Produces: exact owner-run post-merge procedure.

- [ ] **Step 1: Document the release order**

Ensure README states:

```text
merge → pull clean main → apply Supabase migration → verify nullable columns → pnpm seed → reconcile DB → verify EN/FR
```

Warn that preview and production share Supabase.

- [ ] **Step 2: Request authorization to push and open the PR**

Do not push before approval.

- [ ] **Step 3: Push and open the PR after authorization**

Include in the PR body:

- schema and UI semantics;
- full corpus audit totals;
- promoted and still-blocked records;
- migration required before seed;
- automated/browser evidence;
- explicit statement that production Supabase was not changed.

- [ ] **Step 4: After owner merges, teach the safe procedure before execution**

Provide these commands with explanations:

```bash
git switch main
git pull --ff-only origin main
git status --short
pnpm test
```

Then guide the owner through applying `supabase/migrations/20260915120000_nullable_evidence_fields.sql` using the project’s established Supabase mechanism. Verify both columns are nullable before continuing.

- [ ] **Step 5: Teach and supervise the guarded seed**

After migration verification:

```bash
pnpm seed
```

Explain expected output: validated school count, upserted school/event counts, exact stale-row count, and revalidation result. If it fails, do not retry blindly.

- [ ] **Step 6: Reconcile production after the seed**

Using read-only queries, compare git and Supabase identities/statuses/counts, verify null preservation, and inspect EN/FR production pages. Confirm newly promoted events and registration actions.

- [ ] **Step 7: Record final release evidence**

Report migration status, seed output, reconciliation totals, production URLs, and residual blockers. No further database write is needed when reconciliation passes.
