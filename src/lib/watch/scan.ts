import type { SchoolFile } from '../schema';
import { htmlToLines } from './normalize';
import { addedLines, isDateLine, removedCount } from './extract';

/** Below this many characters a page is almost certainly JS-rendered or an error shell. */
const MIN_CONTENT_CHARS = 200;

export type FetchResult = { ok: true; html: string } | { ok: false; reason: string };

export type ScanDeps = {
  fetchPage: (url: string) => Promise<FetchResult>;
  /** Committed baseline for a school, or null if never scanned. */
  readSnapshot: (slug: string) => Promise<string | null>;
  /** First-ever sighting: becomes the committed baseline directly. */
  writeBaseline: (slug: string, text: string) => Promise<void>;
  /**
   * A changed page waits here, NOT in the baseline, until `update:apply`
   * promotes it. That keeps the scan idempotent: re-running it before the
   * model has looked regenerates the same queue instead of silently
   * swallowing the change.
   */
  writePending: (slug: string, text: string) => Promise<void>;
  clearPending: (slug: string) => Promise<void>;
  delay: () => Promise<void>;
};

export type ScanEntry =
  | { slug: string; url: string; status: 'baseline' | 'unchanged' }
  | {
      slug: string;
      url: string;
      status: 'changed';
      added: number;
      removed: number;
      /** Added lines that mention a date or a time: all the model will read. */
      dateLines: string[];
    }
  | { slug: string; url: string | null; status: 'failed'; reason: string };

export type ScanResult = { entries: ScanEntry[] };

const toText = (lines: readonly string[]): string => `${lines.join('\n')}\n`;

export async function runScan(schools: readonly SchoolFile[], deps: ScanDeps): Promise<ScanResult> {
  const entries: ScanEntry[] = [];
  let first = true;

  for (const school of schools) {
    const { slug } = school;
    const url = school.admissions_url;
    if (!url) {
      entries.push({ slug, url: null, status: 'failed', reason: 'no admissions_url to watch' });
      continue;
    }

    // Pause between requests on every path, but not before the first one.
    if (!first) await deps.delay();
    first = false;

    const page = await deps.fetchPage(url);
    if (!page.ok) {
      entries.push({ slug, url, status: 'failed', reason: page.reason });
      continue;
    }

    const lines = htmlToLines(page.html);
    if (lines.join('\n').length < MIN_CONTENT_CHARS) {
      // Fail closed: never baseline or diff against an empty shell, or the
      // next good fetch would look like a page that "added" everything.
      entries.push({
        slug,
        url,
        status: 'failed',
        reason: 'thin content (blocked or JS-rendered page?)',
      });
      continue;
    }

    const previous = await deps.readSnapshot(slug);
    if (previous === null) {
      await deps.writeBaseline(slug, toText(lines));
      entries.push({ slug, url, status: 'baseline' });
      continue;
    }

    const prevLines = previous.split('\n').filter((l) => l !== '');
    const added = addedLines(prevLines, lines);
    if (added.length === 0) {
      await deps.clearPending(slug);
      entries.push({ slug, url, status: 'unchanged' });
      continue;
    }

    await deps.writePending(slug, toText(lines));
    entries.push({
      slug,
      url,
      status: 'changed',
      added: added.length,
      removed: removedCount(prevLines, lines),
      dateLines: added.filter(isDateLine),
    });
  }

  return { entries };
}

/**
 * The only file the model reads. Pages that changed without mentioning a
 * date or time cost nothing: they get one line, not their content.
 */
export function renderQueue(
  result: ScanResult,
  schools: readonly SchoolFile[],
  today: string,
): string {
  const bySlug = new Map(schools.map((s) => [s.slug, s]));
  const changed = result.entries.filter((e) => e.status === 'changed');
  const withDates = changed.filter((e) => e.dateLines.length > 0);
  const quiet = changed.filter((e) => e.dateLines.length === 0);

  const out: string[] = [`# Update queue — ${today}`, ''];

  if (withDates.length === 0) {
    out.push('Nothing to review: no watched page gained a date or time.', '');
  }

  for (const e of withDates) {
    const school = bySlug.get(e.slug);
    out.push(`## ${e.slug} — ${school?.name_fr ?? e.slug}`);
    out.push(`URL: ${e.url}`);
    if (school) {
      const known = school.open_days.map(
        (d) => `${'starts_on' in d ? `${d.starts_on}..${d.ends_on}` : d.starts_at} (${d.status})`,
      );
      out.push(`School status: ${school.status}; last verified: ${school.last_verified_at}`);
      out.push(`Events already on file: ${known.length > 0 ? known.join(', ') : 'none'}`);
    }
    out.push(`Page diff: +${e.added} / -${e.removed} lines. New date/time lines:`);
    for (const line of e.dateLines) out.push(`- ${line}`);
    out.push('');
  }

  if (quiet.length > 0) {
    out.push(
      '## Changed, no date or time added',
      quiet.map((e) => e.slug).join(', '),
      '',
    );
  }
  return out.join('\n');
}

/** Terminal summary: counts first, then only the lines a human must act on. */
export function renderSummary(result: ScanResult): string {
  const count = (s: ScanEntry['status']): number =>
    result.entries.filter((e) => e.status === s).length;
  const lines = [
    `Scanned ${result.entries.length}: ${count('unchanged')} unchanged, ` +
      `${count('changed')} changed, ${count('baseline')} baselined, ${count('failed')} failed.`,
  ];
  for (const e of result.entries) {
    if (e.status === 'failed') lines.push(`  FAILED ${e.slug}: ${e.reason}`);
  }
  return lines.join('\n');
}
