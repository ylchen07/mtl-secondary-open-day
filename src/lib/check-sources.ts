import { isSameSite } from './research/links';
import { isWikipediaUrl, type SchoolFile } from './schema';

/**
 * Hosts that are directories of schools, not schools themselves.
 *
 * Exported so callers extend the check rather than restate the list — two
 * copies that can drift would reintroduce exactly the hole this guard closes.
 */
export const AGGREGATOR_HOSTS: readonly string[] = ['feep.qc.ca'];

/**
 * Why `url` is unacceptable as a row's source, or null if it is fine.
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
 * One human-readable violation per row whose `source_url` is not
 * demonstrably the school's own. An empty array means clean. Every school
 * and event on file is shown, so none is exempt. Fails closed on a
 * `source_url` that will not parse.
 */
export function findAggregatorSources(schools: SchoolFile[]): string[] {
  const violations: string[] = [];

  for (const school of schools) {
    const problem = sourceProblem(school.source_url);
    if (problem) violations.push(`${school.slug}: school ${problem}`);

    for (const event of school.open_days) {
      const problem = sourceProblem(event.source_url);
      if (problem) {
        const when = 'starts_on' in event ? event.starts_on : event.starts_at;
        violations.push(`${school.slug} (${when}): event ${problem}`);
      }
    }
  }

  return violations;
}

/**
 * One violation per school whose description cites a page that is neither
 * the school's own site nor Wikipedia. A description is the one field that
 * may come from Wikipedia: it summarises the school, it states no date,
 * fee or admission rule a family acts on.
 */
export function findDescriptionSources(schools: SchoolFile[]): string[] {
  return schools.flatMap((school) => {
    const url = school.description_source_url;
    if (url == null || isSameSite(url, school.website_url)) return [];
    // The fr or en article of the school's matched Wikipedia entry.
    if (school.wikipedia_url != null && isWikipediaUrl(url)) return [];
    return [`${school.slug}: description cites ${url}, neither the school's site nor its Wikipedia article`];
  });
}
