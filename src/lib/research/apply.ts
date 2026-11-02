import { z } from 'zod';
import { schoolFileSchema, type SchoolFile } from '../schema';
import type { AddedEvent } from './ledger';

/** What the research run handed the reviewer, per school: needed to resolve `page` and mark lines reviewed. */
export type Manifest = {
  today: string;
  schools: Record<string, { pages: string[]; shown: string[] }>;
};

const cited = { quote: z.string().trim().min(8), page: z.number().int().min(1) };

const answerSchema = z
  .object({
    language: z.object({ value: z.enum(['fr', 'en', 'bilingual']), ...cited }).strict(),
    gender: z.object({ value: z.enum(['mixed', 'girls', 'boys']), ...cited }).strict(),
    tuition: z.object({ value: z.number().int().positive(), ...cited }).strict(),
    description: z.object({ en: z.string().trim().min(20), fr: z.string().trim().min(20), ...cited }).strict(),
    // The event's own fields are checked by the school schema once merged.
    events: z.array(z.object(cited).passthrough()),
  })
  .partial()
  .strict();

export const answersSchema = z.record(z.string(), answerSchema);
export type Answers = z.infer<typeof answersSchema>;

/** Whitespace, curly quotes and non-breaking spaces vary between a page and a quote of it. */
const normalise = (text: string): string =>
  text
    .normalize('NFC')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

export type ApplyResult = {
  updated: SchoolFile[];
  /** Evidence hashes each applied school's reviewer has now seen. */
  reviewed: Record<string, string[]>;
  /** Events written, for the audit ledger. */
  addedEvents: AddedEvent[];
  changes: string[];
  errors: string[];
};

/**
 * Merge reviewed answers into school records. A school's answer is applied
 * whole or not at all: any quote that is not in the page it cites, or any
 * result that fails the school schema, rejects that school and leaves its
 * file and its review state untouched.
 */
export function applyAnswers(
  schools: readonly SchoolFile[],
  answers: Answers,
  manifest: Manifest,
  readText: (url: string) => string | null,
  today: string,
): ApplyResult {
  const bySlug = new Map(schools.map((s) => [s.slug, s]));
  const result: ApplyResult = { updated: [], reviewed: {}, addedEvents: [], changes: [], errors: [] };

  for (const [slug, answer] of Object.entries(answers)) {
    const school = bySlug.get(slug);
    const run = manifest.schools[slug];
    if (!school || !run) {
      result.errors.push(`${slug}: not in the last research pack`);
      continue;
    }

    const problems: string[] = [];
    const source = (field: string, c: { quote: string; page: number }): string | null => {
      const url = run.pages[c.page - 1];
      const text = url ? readText(url) : null;
      if (!url || text === null) {
        problems.push(`${field}: page p${c.page} was not fetched`);
        return null;
      }
      if (!normalise(text).includes(normalise(c.quote))) {
        problems.push(`${field}: quote not found on p${c.page}: «${c.quote}»`);
        return null;
      }
      return url;
    };

    const next: SchoolFile = { ...school, open_days: [...school.open_days] };
    const changed: string[] = [];
    const added: AddedEvent[] = [];
    if (answer.language && source('language', answer.language)) {
      next.language = answer.language.value;
      changed.push(`language=${answer.language.value}`);
    }
    if (answer.gender && source('gender', answer.gender)) {
      next.gender = answer.gender.value;
      changed.push(`gender=${answer.gender.value}`);
    }
    if (answer.tuition && source('tuition', answer.tuition)) {
      next.tuition_annual_cad = answer.tuition.value;
      changed.push(`tuition=${answer.tuition.value}`);
    }
    if (answer.description && source('description', answer.description)) {
      next.description_en = answer.description.en;
      next.description_fr = answer.description.fr;
      changed.push('description');
    }
    for (const [i, raw] of (answer.events ?? []).entries()) {
      const url = source(`events[${i}]`, raw);
      if (!url) continue;
      const { quote: _quote, page: _page, ...fields } = raw;
      const start = String(fields.starts_at ?? fields.starts_on);
      if (fields.status === 'published' && school.status !== 'published') {
        problems.push(`events[${i}]: a draft school's events stay draft`);
        continue;
      }
      if (next.open_days.some((e) => ('starts_on' in e ? e.starts_on : e.starts_at) === start && e.type === fields.type)) {
        problems.push(`events[${i}]: a ${String(fields.type)} on ${start} is already on file`);
        continue;
      }
      const event = { ...fields, source_url: url, last_verified_at: today } as SchoolFile['open_days'][number];
      next.open_days.push(event);
      added.push({ slug, event, quote: raw.quote, url });
      changed.push(`event ${start} (${String(fields.status)})`);
    }
    if (changed.length > 0) next.last_verified_at = today;

    const parsed = schoolFileSchema.safeParse(next);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) problems.push(`${issue.path.join('.')}: ${issue.message}`);
    }
    if (problems.length > 0) {
      result.errors.push(...problems.map((p) => `${slug}: ${p}`));
      continue;
    }

    result.reviewed[slug] = run.shown;
    result.addedEvents.push(...added);
    if (changed.length > 0) {
      result.updated.push(parsed.data!);
      result.changes.push(`${slug}: ${changed.join(', ')}`);
    } else {
      result.changes.push(`${slug}: reviewed, nothing usable`);
    }
  }
  return result;
}
