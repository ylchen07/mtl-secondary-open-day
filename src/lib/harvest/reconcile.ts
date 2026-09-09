import type { ListingEntry } from './types';
import type { SchoolFile } from '../schema';

export type HarvestDecision =
  | { kind: 'create'; slug: string; entry: ListingEntry }
  | { kind: 'skip'; slug: string; reason: string }
  | { kind: 'conflict'; slug: string; existingSlug: string; reason: string };

/**
 * Collapse a school name to a comparison key: no accents, no case, no
 * punctuation. Used only to *detect* a possible same-school match across
 * FEEP's slug and ours — never to decide identity outright, since two
 * distinct schools ("Sainte-Anne" / "Sainte-Marcelline") must not collapse.
 */
export function normaliseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Decide, per FEEP listing candidate, whether to create a draft, skip it, or
 * flag it for a human to adjudicate.
 *
 * This is deliberately biased toward skip/conflict over create: a missed
 * draft costs a little manual follow-up, but a wrongly-created or
 * wrongly-overwritten file can put a stale or duplicate date in front of a
 * family. Three rules exist specifically to prevent that:
 *   1. A file already `published` (or `archived`) is never touched — a human
 *      verified or retired it, and a machine has no basis to override that.
 *   2. A name that matches an existing school under a *different* slug is
 *      reported as a conflict, never silently written as a new file — FEEP's
 *      slug for a school we already hold can differ from ours.
 *   3. An event with no parseable date, no future date, or no published time
 *      is dropped rather than guessed (ruling R10): FEEP's listing routinely
 *      carries stale (even year-old) dates as if current.
 *
 * `today` is a parameter, not `Date.now()`, so callers (and tests) control
 * time explicitly and this function never becomes a time-bomb.
 */
export function reconcile(
  entries: ListingEntry[],
  existing: SchoolFile[],
  today: string,
): HarvestDecision[] {
  const bySlug = new Map(existing.map((s) => [s.slug, s]));
  const byName = new Map(existing.map((s) => [normaliseName(s.name_fr), s]));

  return entries.map((entry): HarvestDecision => {
    const slug = entry.feepSlug;

    const sameSlug = bySlug.get(slug);
    if (sameSlug && sameSlug.status !== 'draft') {
      const reason =
        sameSlug.status === 'published'
          ? 'already published — a human verified this; never machine-overwrite a published file'
          : 'existing file is archived — a human retired this school; not resurrecting it without review';
      return { kind: 'skip', slug, reason };
    }

    // FEEP also lists schools outside Greater Montreal (Québec, Estrie,
    // Outaouais, ...); `region` is null for those. The schema has no slot for
    // a null region, so creating here would either fail validation or force
    // a wrong region onto the file — skip instead of guessing.
    if (entry.region === null) {
      return { kind: 'skip', slug, reason: 'no Greater Montreal region — out of scope for this site' };
    }

    const sameName = byName.get(normaliseName(entry.nameFr));
    if (sameName && sameName.slug !== slug) {
      return {
        kind: 'conflict',
        slug,
        existingSlug: sameName.slug,
        reason: 'FEEP slug differs from ours for what looks like the same school — adjudicate before writing',
      };
    }

    const dated = entry.events.filter((e) => e.date !== null);
    if (dated.length === 0) {
      return { kind: 'skip', slug, reason: 'no usable event — no parseable date' };
    }

    const future = dated.filter((e) => e.date! >= today);
    if (future.length === 0) {
      return { kind: 'skip', slug, reason: 'all events are in the past — stale FEEP entry' };
    }

    const timed = future.filter((e) => e.startTime !== null && e.endTime !== null);
    if (timed.length === 0) {
      return { kind: 'skip', slug, reason: 'no published time — refusing to guess (R10)' };
    }

    return { kind: 'create', slug, entry: { ...entry, events: timed } };
  });
}
