import { z } from 'zod';
import type { OpenDayRow } from './types';

const EVENT_TYPES = ['open_house', 'info_session', 'entrance_exam', 'tour', 'virtual'] as const;

/** The event identity the seed script wants to exist, read straight from a school's git file. */
export type LocalOpenDayIdentity = {
  schoolSlug: string;
  startsAt: string;
  type: OpenDayRow['type'];
};

/** An `open_days` row's identity, resolved to school slug rather than the database id. */
export type RemoteOpenDayIdentity = {
  id: string;
  schoolSlug: string;
  startsAt: string;
  type: OpenDayRow['type'];
};

const remoteOpenDayRowSchema = z.object({
  id: z.string().min(1),
  school_id: z.string().min(1),
  starts_at: z.string().min(1),
  type: z.enum(EVENT_TYPES),
});

const schoolIdentityRowSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
});

/**
 * Builds a `school_id -> slug` lookup from a fresh read of every current
 * school row (not just the ones just upserted), so an `open_days` row
 * belonging to a school whose git file was deleted entirely is still
 * resolvable — that school isn't archived until the seed script's later
 * archive step. Rows that don't match the schools table shape are dropped
 * rather than guessed.
 */
export function buildSlugBySchoolId(rows: readonly unknown[]): Map<string, string> {
  const slugBySchoolId = new Map<string, string>();
  for (const raw of rows) {
    const parsed = schoolIdentityRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    slugBySchoolId.set(parsed.data.id, parsed.data.slug);
  }
  return slugBySchoolId;
}

/**
 * Resolves raw `open_days` rows (as returned by Supabase, keyed by
 * `school_id`) into identities keyed by school slug. Columns that aren't
 * part of identity (e.g. `status`) are intentionally ignored here — upsert
 * already reconciles them, so a status-only change must never look stale.
 *
 * A row is dropped — never guessed — when its shape doesn't match the
 * database schema, or when its `school_id` has no matching slug (an
 * orphaned foreign key). Callers must treat a dropped row as "keep": this
 * output feeds a delete decision, so the safe failure mode is inaction.
 */
export function resolveRemoteOpenDayIdentities(
  rows: readonly unknown[],
  slugBySchoolId: ReadonlyMap<string, string>,
): RemoteOpenDayIdentity[] {
  const identities: RemoteOpenDayIdentity[] = [];
  for (const raw of rows) {
    const parsed = remoteOpenDayRowSchema.safeParse(raw);
    if (!parsed.success) continue;

    const schoolSlug = slugBySchoolId.get(parsed.data.school_id);
    if (schoolSlug === undefined) continue;

    identities.push({
      id: parsed.data.id,
      schoolSlug,
      startsAt: parsed.data.starts_at,
      type: parsed.data.type,
    });
  }
  return identities;
}

/** Parses a timestamp to its canonical UTC instant, or `null` if it doesn't parse. */
function canonicalInstant(value: string): string | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function identityKey(schoolSlug: string, canonicalStartsAt: string, type: string): string {
  return `${schoolSlug}\u0000${canonicalStartsAt}\u0000${type}`;
}

/**
 * Compares resolved remote event identities against the locally desired
 * event set and returns the exact remote row ids that are no longer
 * represented in git — safe to delete when resynchronizing the `open_days`
 * projection after the desired rows have already been upserted.
 *
 * Identity matches the database's `unique (school_id, starts_at, type)`
 * constraint, substituting school slug for the database id so schools no
 * longer upserted this run are still comparable, and canonicalizing
 * `starts_at` to its UTC instant so a local explicit-offset string and a
 * Supabase UTC string compare equal.
 *
 * A remote identity whose `starts_at` doesn't parse to a valid instant is
 * unresolvable and is kept — fails closed — rather than deleted, since
 * guessing wrong here is destructive and irreversible.
 */
export function computeStaleOpenDayIds(
  remote: readonly RemoteOpenDayIdentity[],
  desired: readonly LocalOpenDayIdentity[],
): string[] {
  const desiredKeys = new Set<string>();
  for (const event of desired) {
    const canonical = canonicalInstant(event.startsAt);
    if (canonical === null) continue;
    desiredKeys.add(identityKey(event.schoolSlug, canonical, event.type));
  }

  const staleIds: string[] = [];
  for (const row of remote) {
    const canonical = canonicalInstant(row.startsAt);
    if (canonical === null) continue;

    const key = identityKey(row.schoolSlug, canonical, row.type);
    if (!desiredKeys.has(key)) staleIds.push(row.id);
  }
  return staleIds;
}
