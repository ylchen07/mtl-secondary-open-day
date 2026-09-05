import type { SchoolFile } from './schema';

/**
 * Hosts that are directories of schools, not schools themselves.
 *
 * Exported so callers extend the check rather than restate the list — two
 * copies that can drift would reintroduce exactly the hole this guard closes.
 */
export const AGGREGATOR_HOSTS: readonly string[] = ['feep.qc.ca'];

/**
 * Why `url` is unacceptable as a published row's source, or null if it is fine.
 *
 * Fails closed: a URL that will not parse counts as a violation, because a
 * safety predicate must never answer "allowed" when it means "I could not tell".
 */
function sourceProblem(url: string): string | null {
  let host: string;
  try {
    // A fully-qualified `feep.qc.ca.` resolves identically but survives URL
    // parsing with its trailing dots, so strip them all before comparing.
    host = new URL(url).hostname.toLowerCase().replace(/\.+$/, '');
  } catch {
    return `has an unparseable source_url (cannot prove it is not an aggregator): ${url}`;
  }

  // `javascript:void(0)`, `mailto:`, `data:` and friends parse cleanly but carry
  // no host, so there is nothing to compare. Same verdict as unparseable: a
  // scraped href of that shape is a defect, never a verified source.
  if (host === '') {
    return `has a source_url with no host (cannot prove it is not an aggregator): ${url}`;
  }

  const aggregator = AGGREGATOR_HOSTS.some((a) => host === a || host.endsWith(`.${a}`));
  return aggregator ? `cites aggregator ${url}` : null;
}

/**
 * One human-readable violation per published row whose `source_url` is not
 * demonstrably the school's own. An empty array means clean.
 *
 * Drafts and archived rows are exempt by design: citing an aggregator is what
 * a draft is for. Fails closed on a `source_url` that will not parse.
 */
export function findAggregatorSources(schools: SchoolFile[]): string[] {
  const violations: string[] = [];

  for (const school of schools) {
    if (school.status === 'published') {
      const problem = sourceProblem(school.source_url);
      if (problem) violations.push(`${school.slug}: published school ${problem}`);
    }

    for (const event of school.open_days) {
      if (event.status !== 'published') continue;
      const problem = sourceProblem(event.source_url);
      if (problem) {
        violations.push(`${school.slug} (${event.starts_at}): published event ${problem}`);
      }
    }
  }

  return violations;
}
