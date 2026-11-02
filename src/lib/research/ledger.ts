import { eventBounds } from '../dates';
import type { SchoolFile } from '../schema';

/** An event `research:apply` added, with the quote and page that justified it. */
export type AddedEvent = {
  slug: string;
  event: SchoolFile['open_days'][number];
  quote: string;
  url: string;
};

const EVENT_TABLE = '## Event field audit rows';
const MATRIX_TABLE = '## Publication-critical matrix';

/** Insert rows after the last row of the first table under `heading`, bumping a "(N)" count in the heading. */
function appendToTable(lines: string[], heading: string, rows: readonly string[]): void {
  if (rows.length === 0) return;
  const start = lines.findIndex((l) => l.startsWith(heading));
  if (start < 0) throw new Error(`audit ledger has no "${heading}" section`);
  let last = -1;
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) {
    if (lines[i].startsWith('|')) last = i;
    else if (last >= 0) break;
  }
  if (last < 0) throw new Error(`audit ledger section "${heading}" has no table`);
  lines.splice(last + 1, 0, ...rows);
  lines[start] = lines[start].replace(/\((\d+)\)/, (_, n: string) => `(${Number(n) + rows.length})`);
}

const literal = (value: boolean | null): string => (value === null ? 'null' : String(value));

/**
 * The nullable-evidence audit (docs/data-audits/2026-09-15-…) must cover
 * every event on file, and its publication matrix every published event;
 * tests/data-integrity.test.ts enforces both. Apply records each event it
 * adds there, with the quote that justified it, so the ledger never drifts.
 */
export function addLedgerRows(markdown: string, added: readonly AddedEvent[], today: string): string {
  const lines = markdown.split('\n');
  const cite = (quote: string) => `Research apply ${today}: «${quote.replace(/\|/g, '/')}»`;
  const eventRows = added.map(({ slug, event, quote, url }) => {
    const value = literal(event.registration_required);
    const disposition = event.registration_required === null ? 'unsupported-negative' : 'supported';
    const identity = `${eventBounds(event).starts_at} + ${event.type}`;
    return `| \`${slug}.json\` | \`registration_required\` | \`${identity}\` | \`${value}\` | \`${value}\` | \`${disposition}\` | ${url} | ${cite(quote)} |`;
  });
  const matrixRows = added
    .filter(({ event }) => event.status === 'published')
    .map(({ slug, event, quote, url }) => `| event | \`${slug}|${eventBounds(event).starts_at}|${event.type}\` | PASS | ${url} | ${cite(quote)} |`);
  appendToTable(lines, EVENT_TABLE, eventRows);
  appendToTable(lines, MATRIX_TABLE, matrixRows);
  return lines.join('\n');
}
