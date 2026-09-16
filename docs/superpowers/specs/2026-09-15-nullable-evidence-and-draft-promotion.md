# Nullable Evidence Fields and Draft Promotion Design

**Date:** 2026-09-15
**Status:** Approved for implementation planning

## Problem

The repository currently models `has_boarding` and `registration_required` as required Booleans. That forces every record to claim either `true` or `false`, even when an official school source is silent. The editorial policy correctly prohibits inferring a negative fact from silence, so otherwise useful, well-supported events remain drafts solely because the schema cannot represent “unknown.”

The corpus currently contains 41 schools and 33 events:

- `has_boarding`: 1 `true`, 40 `false`, 0 unknown.
- `registration_required`: 19 `true`, 14 `false`, 0 unknown.

All existing values must be audited; the schema change must not automatically reinterpret current values as verified.

## Goals

1. Represent unknown boarding and registration facts without inventing negative claims.
2. Keep official-source verification strict for publication-critical school and event facts.
3. Audit the complete git corpus, preserving only Boolean values supported by school-owned sources.
4. Re-evaluate in-window draft events and publish every record that becomes complete under the revised evidence model.
5. Keep git as the authoritative data source and Supabase as a rebuildable runtime projection.
6. Preserve bilingual rendering, filters, historical-event behavior, rolling-window behavior, accessibility, and URL state.

## Non-goals

- Do not infer `false` from a missing boarding page, missing registration form, or general day-school behavior.
- Do not weaken requirements for school identity, address, region, language, gender/student body, exact event date and time, event type, Secondary 1 relevance, or school-owned source URLs.
- Do not publish events with estimated end times, uncertain years, campus conflicts, or unsupported audience relevance.
- Do not add an admin interface or make Supabase authoritative.
- Do not seed production Supabase before the feature branch is reviewed and merged.
- Do not add an “Unknown” filter facet.

## Evidence Semantics

### Boarding

`has_boarding` becomes `boolean | null` in JSON, TypeScript, and Postgres.

- `true`: a current school-owned source explicitly confirms a boarding, residence, or housing option.
- `false`: a current school-owned source explicitly confirms day-only attendance or explicitly states that boarding/residence is unavailable.
- `null`: official sources are silent, ambiguous, inaccessible, or only imply a day-school model.

`null` does not block publication. It must never render as “No boarding.”

### Event registration

`registration_required` becomes `boolean | null` in JSON, TypeScript, and Postgres.

- `true`: a current school-owned event page explicitly instructs visitors to register, reserve, or book. A registration destination must also be available. The destination may be a school-owned form or a third-party form reached directly from the official event page.
- `false`: a current school-owned event page explicitly says no registration, no appointment, walk-ins, “sans rendez-vous,” “présentez-vous,” or equivalent.
- `null`: the event is confirmed, but official wording does not establish whether registration is required.

`null` does not block publication. It must not render as “Registration not required.”

For upcoming events:

- `true`: show the existing registration action using `registration_url`.
- `false`: show no registration action.
- `null`: show a bilingual “Check registration details” action using the school-owned event `source_url`.

Past events remain inactive and show no registration action regardless of value.

### Registration URL invariant

- `registration_required === true` requires a non-null HTTPS `registration_url`.
- `registration_required === false` requires `registration_url` to be null or absent.
- `registration_required === null` requires `registration_url` to be null or absent; the UI uses `source_url` for the check-details action.

This avoids displaying an unclassified form as if attendance were mandatory.

## Publication Standard

A school and event may be published when current school-owned evidence supports:

### School requirements

- official English and French display names, including a shared proper name when no localized name exists;
- language of instruction;
- whole-school gender/student-body classification;
- city, street address, postal code, and Greater Montreal region;
- official website and admissions destinations;
- school source URL and verification date.

Boarding may be unknown.

### Event requirements

- exact calendar year, date, start time, and end time;
- event type;
- relevance to incoming Secondary 1 students, including an explicit equivalent such as Grade 7 or 6e;
- official event source URL;
- verification date.

Registration may be unknown.

The following remain disqualifying:

- inferred or padded end times;
- an event whose year is not explicit;
- event venue/campus ambiguity that could mislead families;
- generic secondary-school context without reasonable evidence that incoming Secondary 1 families are included;
- an aggregator, FEEP, search snippet, directory, or social post as the publication source;
- unresolved contradictions among official sources.

## Complete Corpus Audit

Every one of the 41 school files and 33 event records must be reviewed. Each nullable field receives one evidence disposition:

1. **Supported:** retain `true` or `false`.
2. **Unsupported negative:** replace `false` with `null`.
3. **Unsupported positive:** replace `true` with `null` unless a current official source verifies it.
4. **Contradicted:** correct to the officially supported value.

The audit also checks publication-critical fields. It may correct supported facts or demote a published record if its required evidence no longer satisfies the standard. No published record is grandfathered.

`last_verified_at` is updated only when the complete record is actually reviewed against live sources. It must use the real review date and may not be future-dated.

The audit report must list:

- retained Boolean values and their official evidence;
- values changed to `null`;
- corrected contradictions;
- promoted records;
- records still unpublished and their precise non-nullable blockers.

## Candidate Promotion

After the corpus audit, all draft events inside the rolling three-calendar-month window are re-evaluated. Records are promoted when every publication requirement is met except fields explicitly permitted to be `null` by this design.

Priority candidates include The Study, Villa Sainte-Marcelline, Collège Notre-Dame, Collège Trinité, Collège Durocher Saint-Lambert, and the two Collège Charles-Lemoyne campuses. Priority does not grant weaker evidence treatment.

If an event remains draft, the blocker must concern a publication-critical field—not merely unknown boarding or registration.

## Schema and Types

### Zod

`src/lib/schema.ts` accepts nullable values:

```ts
has_boarding: z.boolean().nullable(),
registration_required: z.boolean().nullable(),
```

The event schema enforces the registration URL invariant described above.

### TypeScript

`src/lib/types.ts` exposes:

```ts
has_boarding: boolean | null;
registration_required: boolean | null;
```

Seed mapping preserves `null`; it must never coerce nullish values to `false`.

### Postgres

A new forward-only migration changes both existing columns:

```sql
alter table schools
  alter column has_boarding drop not null,
  alter column has_boarding drop default;

alter table open_days
  alter column registration_required drop not null,
  alter column registration_required drop default;
```

The migration preserves existing rows. The audited git seed supplies the corrected nullable values afterward.

The migration must be applied before any seed containing `null`. Production migration and seed happen only after merge and explicit owner action.

## Runtime Query and Filters

The Supabase query continues to select both fields without coercion.

The boarding filter remains “Boarding available” and matches only:

```ts
school.has_boarding === true
```

Unfiltered results include `true`, `false`, and `null`. Unknown records never satisfy the boarding facet. No public “unknown” filter is added.

No registration filter is introduced.

## UI and Copy

`EventCard` uses explicit comparisons rather than truthiness where semantics matter:

- upcoming + `registration_required === true` + URL: existing Register action;
- upcoming + `registration_required === null`: “Check registration details” linking to `source_url`;
- upcoming + `registration_required === false`: no registration action;
- past: no registration action.

Add bilingual messages:

- EN: `Check registration details`
- FR: `Vérifier les modalités d’inscription`

The action must meet existing contrast, focus, keyboard, external-link, and accessible-name conventions.

## Harvest Behavior

Harvest output must use `null`, not `false`, for boarding and registration when a source has not established a value. Harvested records remain drafts until manual official-source reconciliation satisfies publication requirements.

This prevents the ingestion pipeline from recreating unsupported negative claims after the audit.

## Seed and Deployment Sequence

Git remains authoritative. The release order is:

1. Implement and validate on a feature branch.
2. Review and merge the PR.
3. Apply the nullable Supabase migration.
4. Confirm the columns accept null and existing rows remain intact.
5. Run the guarded `pnpm seed` from a clean, updated `main`.
6. Reconcile Supabase counts and statuses against git.
7. Confirm production EN/FR rendering, filters, registration actions, past-event inactivity, and promoted records.

Because preview and production share Supabase, pre-merge production migration or seeding is prohibited.

## Error Handling and Safety

- Validation failures stop before database writes.
- The existing upsert-before-delete order and corpus-wide deletion guard remain unchanged.
- Migration failure stops before seed.
- Seed failure is not retried blindly; inspect remote state first.
- If revalidation fails after successful writes, inspect the database before rerunning any seed.
- Service-role credentials remain server/script-only.

## Testing and Acceptance

### Automated tests

- Zod accepts `null` for both fields.
- Zod enforces all three registration/URL combinations.
- Type and seed-mapping tests preserve null.
- Filter tests prove unknown boarding is included when unfiltered and excluded by “Boarding available.”
- Event-card tests cover true, false, null, and past registration behavior in EN/FR.
- Harvest tests prove unknown facts emit null.
- Data-integrity and source checks cover the audited corpus.
- Existing clash, historical partition, rolling-window, URL-state, and bilingual tests continue to pass.

### Repository validation

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm check:sources
pnpm build

git diff --check
```

### Post-merge production acceptance

- Migration is present in Supabase migration history.
- Supabase school/event counts and statuses exactly match git.
- Null values remain null after seeding.
- EN and FR production pages render the expected published count.
- Newly promoted events appear with correct date/time and source links.
- Unknown registration shows the check-details action only for upcoming events.
- Past events have no registration action.
- The boarding filter returns only explicitly verified boarding schools.

## Success Criteria

The change succeeds when:

1. The data model represents unknown boarding and registration without false claims.
2. All 41 schools and 33 events have been audited under the same evidence standard.
3. No draft remains unpublished solely because boarding or registration is unknown.
4. Every promoted event retains official evidence for all publication-critical facts.
5. Git, Supabase, and production are synchronized only after merge through the guarded release sequence.
