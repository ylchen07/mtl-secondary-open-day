import { MONTREAL_TZ } from '../constants';
import { schoolFileSchema, type SchoolFile } from '../schema';
import { reconcile, type HarvestDecision } from './reconcile';
import { toDraftSchool, serialise } from './emit';
import { renderReport } from './report';
import type { ListingEntry, SchoolFacts } from './types';

/**
 * The Montreal calendar date for a given instant, as `YYYY-MM-DD`.
 *
 * `new Date().toISOString().slice(0, 10)` is wrong for roughly five hours of
 * every day: UTC has already rolled over to the next calendar date while
 * Montreal (UTC-4/-5) has not. A harvest that runs near local midnight and
 * uses the UTC date would stamp `last_verified_at` one day ahead of the day a
 * human reviewer actually ran it, and would use the wrong `today` for
 * reconcile()'s "is this event in the future" check.
 */
export function todayInMontreal(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MONTREAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

type FileSystemDeps = {
  readdir: (dir: string) => Promise<string[]>;
  readFile: (path: string) => Promise<string>;
};

/**
 * Load every existing school file and fail closed on the first one that is
 * not valid JSON or not schema-valid.
 *
 * This throws rather than warning-and-omitting deliberately: an existing
 * file the loader failed to parse is a file `reconcile()` cannot check
 * against, and reconcile's entire published/archived protection (Task 5,
 * rule 1) depends on knowing every existing school's slug and status.
 * Omitting one from `existing` while continuing the run risks the CLI
 * writing a new draft that then collides with a file it never saw.
 */
export async function loadExistingSchools(
  deps: FileSystemDeps,
  dataDir = 'data/schools',
): Promise<SchoolFile[]> {
  const names = (await deps.readdir(dataDir)).filter((n) => n.endsWith('.json'));
  const out: SchoolFile[] = [];

  for (const name of names) {
    const path = `${dataDir}/${name}`;
    let raw: string;
    try {
      raw = await deps.readFile(path);
    } catch (cause) {
      throw new Error(`${path}: could not read \u2014 ${(cause as Error).message}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (cause) {
      throw new Error(`${path}: invalid JSON \u2014 ${(cause as Error).message}`);
    }

    const parsed = schoolFileSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'} \u2014 ${i.message}`)
        .join('; ');
      throw new Error(`${path}: schema-invalid \u2014 ${issues}`);
    }

    out.push(parsed.data);
  }

  return out;
}

export type HarvestDeps = {
  fetchListing: () => Promise<string>;
  fetchDetail: (url: string) => Promise<string>;
  parseListing: (html: string) => ListingEntry[];
  parseDetail: (html: string) => SchoolFacts;
  existing: SchoolFile[];
  today: string;
  delay: () => Promise<void>;
  writeFile: (path: string, contents: string) => Promise<void>;
  dataDir?: string;
};

export type HarvestResult = {
  /** Slugs actually written to disk this run, in the order they were written. */
  written: string[];
  report: string;
};

const feepDetailUrl = (slug: string): string =>
  `https://www.feep.qc.ca/ecoles-privees-quebec/${slug}`;

/**
 * Fetch, reconcile, and write draft files for one harvest run.
 *
 * `reconcile()`'s `create` decisions are the only ones ever passed to
 * `toDraftSchool()` \u2014 that function trusts its caller completely and does
 * not re-check region, staleness, or existing-file status itself (Task 6).
 * Every other decision kind (`skip`, `conflict`) is left exactly as
 * `reconcile()` produced it and flows straight into the report.
 *
 * A `create` decision can still fail to become a written file for three
 * reasons discovered only after fetching the detail page: the fetch itself
 * can fail, the school can turn out to be primary-only, or the assembled
 * draft can fail schema validation (e.g. a FEEP slug that is not
 * kebab-case). Each of those is converted into its own report-visible entry
 * here \u2014 the report's "Created" count and list must describe files that
 * exist on disk, never decisions that were merely attempted.
 */
export async function runHarvest(deps: HarvestDeps): Promise<HarvestResult> {
  const dataDir = deps.dataDir ?? 'data/schools';
  const listingHtml = await deps.fetchListing();
  const entries = deps.parseListing(listingHtml);
  const decisions = reconcile(entries, deps.existing, deps.today);

  const finalDecisions: HarvestDecision[] = [];
  const flagged: string[] = [];
  const skippedAsPrimary: string[] = [];
  const written: string[] = [];

  for (const decision of decisions) {
    if (decision.kind !== 'create') {
      finalDecisions.push(decision);
      continue;
    }

    const url = feepDetailUrl(decision.slug);
    let facts: SchoolFacts;
    try {
      const html = await deps.fetchDetail(url);
      facts = deps.parseDetail(html);
    } catch (cause) {
      finalDecisions.push({
        kind: 'skip',
        slug: decision.slug,
        reason: `detail fetch failed \u2014 ${(cause as Error).message}`,
      });
      await deps.delay();
      continue;
    }

    if (!facts.isSecondary) {
      skippedAsPrimary.push(decision.slug);
      await deps.delay();
      continue;
    }

    const draft = toDraftSchool(decision.entry, facts, deps.today);
    const parsed = schoolFileSchema.safeParse(draft);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'} \u2014 ${i.message}`)
        .join('; ');
      finalDecisions.push({
        kind: 'skip',
        slug: decision.slug,
        reason: `draft failed schema validation, not written \u2014 ${issues}`,
      });
      await deps.delay();
      continue;
    }

    await deps.writeFile(`${dataDir}/${draft.slug}.json`, serialise(draft));
    written.push(draft.slug);
    finalDecisions.push(decision);
    if (!facts.genderConfident) flagged.push(draft.slug);

    await deps.delay();
  }

  const report = renderReport(finalDecisions, flagged, skippedAsPrimary);
  return { written, report };
}
