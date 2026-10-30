const MONTHS =
  'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|' +
  'january|february|march|april|may|june|july|august|september|october|november|december';

/** "17 avril", "1er octobre", "April 17", "Oct" is intentionally not matched (too noisy). */
const DATE = new RegExp(
  `\\b\\d{1,2}\\s*(?:er)?\\s+(?:${MONTHS})\\b|\\b(?:${MONTHS})\\s+\\d{1,2}\\b`,
  'i',
);

/** "9 h 30", "9h", "13 h 00", "9:30", "9 a.m.", "2pm". */
const TIME = /\b\d{1,2}\s?h(?:\s?\d{2})?\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?(?:[ap]\.?m\.?)(?!\w)/i;

/** Does a line look like it announces a date or a time of day? */
export function isDateLine(line: string): boolean {
  return DATE.test(line) || TIME.test(line);
}

/**
 * Lines present in `next` but not in `prev`, in page order.
 *
 * Set-based on purpose: a reordered section is not news, and a page that
 * merely moved a paragraph must not wake the model.
 */
export function addedLines(prev: readonly string[], next: readonly string[]): string[] {
  const seen = new Set(prev);
  return next.filter((line) => !seen.has(line));
}

/** Count of lines that disappeared, for the report only. */
export function removedCount(prev: readonly string[], next: readonly string[]): number {
  return addedLines(next, prev).length;
}
