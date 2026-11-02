import type { SchoolFile } from '../schema';
import { FACTS, type SchoolEvidence } from './evidence';

export type PackEntry = {
  school: SchoolFile;
  evidence: SchoolEvidence;
  /** Fetched pages, in the order evidence `page` indexes them. */
  pages: string[];
  /** Same-site PDFs and documents that looked relevant but were not read. */
  documents: string[];
  /** Pages that could not be read: blocked, failed, or empty. */
  failures: string[];
};

/**
 * How the reviewer answers. Kept short on purpose: it is read once per pack,
 * and every line here is paid for on every run.
 */
const INSTRUCTIONS = `Answer in work/research/answers.json, then run \`pnpm research:apply\`.
Only facts this pack states explicitly; skip anything implied. Every answer carries
"quote" (verbatim text from that page, one line) and "page" (the p-number); apply
rejects a quote it cannot find in the fetched page.
{ "<slug>": {
  "language": { "value": "fr|en|bilingual", "quote": "…", "page": 2 },
  "gender": { "value": "mixed|girls|boys", "quote": "…", "page": 2 },
  "tuition": { "value": 5360, "quote": "…", "page": 3 },
  "description": { "en": "1-2 factual sentences", "fr": "1-2 phrases", "quote": "…", "page": 1 },
  "events": [{ "type": "open_house", "starts_at": "2027-04-17T11:00:00-04:00", "ends_at": "…",
    "academic_year": "2027-2028", "registration_required": null, "notes_en": null,
    "notes_fr": null, "status": "draft", "quote": "…", "page": 1 }] } }
Date-only interviews use "starts_on"/"ends_on" instead. List a slug with {} when it has
nothing usable: its lines are then never shown again.`;

/** Long lines are cut: a reviewer quotes a fragment, and the tail is rarely the fact. */
const clip = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);
const quote = (lines: readonly string[]): string => lines.map((l) => `«${clip(l, 220)}»`).join(' / ');

export function renderPack(entries: readonly PackEntry[], today: string): string {
  // With nothing to review, the pack is one line and the instructions are not paid for.
  const anything = entries.some((e) => e.evidence.items.length > 0);
  const out = [`# Research pack — ${today}`, '', ...(anything ? [INSTRUCTIONS, ''] : [])];
  const quiet: string[] = [];

  for (const { school, evidence, pages, documents, failures } of entries) {
    // Settled facts need no action, so they ride along only with lines to review.
    if (evidence.items.length === 0) {
      quiet.push(school.slug);
      continue;
    }
    out.push(`## ${school.slug} · ${school.name_fr} · ${school.status}`);
    out.push(`gaps: ${evidence.gaps.join(' ')}`);
    for (const note of evidence.settled) out.push(`✓ ${note}`);
    out.push(pages.map((url, i) => `p${i + 1} ${url}`).join(' | '));
    if (documents.length > 0) out.push(`not read: ${documents.join(' ')}`);
    if (failures.length > 0) out.push(`unreadable: ${failures.map((f) => clip(f, 90)).join('; ')}`);
    for (const fact of FACTS) {
      const items = evidence.items.filter((item) => item.fact === fact);
      if (items.length === 0) continue;
      out.push(fact);
      for (const item of items) out.push(`- [p${item.page + 1}] ${quote(item.lines)}`);
    }
    out.push('');
  }

  if (quiet.length > 0) out.push(anything ? '## Nothing new' : 'Nothing new to review.', quiet.join(', '), '');
  return out.join('\n');
}
