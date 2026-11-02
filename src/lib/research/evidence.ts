import { createHash } from 'node:crypto';
import type { SchoolFile } from '../schema';
import { dayKey, eventBounds } from '../dates';
import type { PageFacts } from './page';

/**
 * The facts research looks for. Each is only looked for when the school's
 * record is missing it, so a complete record costs nothing to re-check.
 */
export const FACTS = ['events', 'address', 'language', 'gender', 'tuition', 'description'] as const;
export type Fact = (typeof FACTS)[number];

export function gapsFor(school: SchoolFile): Fact[] {
  const gaps: Fact[] = ['events'];
  // A draft's address, language and student body came from a directory or a
  // guess; the publication bar needs each stated on the school's own pages.
  if (school.status !== 'published') gaps.push('address', 'language', 'gender');
  if (school.tuition_annual_cad == null) gaps.push('tuition');
  if (school.description_fr == null) gaps.push('description');
  return gaps;
}

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, decembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};
const MONTH_NAMES =
  'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|' +
  'january|february|march|april|may|june|july|august|september|october|november|december';
const FR_DATE = new RegExp(`\\b(\\d{1,2})\\s*(?:er)?\\s+(${MONTH_NAMES})\\b(?:\\s+(\\d{4}))?`, 'gi');
const EN_DATE = new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'gi');

const monthOf = (name: string): number =>
  MONTHS[name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()];

export type FoundDate = { month: number; day: number; year: number | null };

/** Calendar dates written out in French or English. A missing year stays null, never guessed. */
export function datesIn(line: string): FoundDate[] {
  const found: FoundDate[] = [];
  for (const m of line.matchAll(FR_DATE)) {
    found.push({ day: Number(m[1]), month: monthOf(m[2]), year: m[3] ? Number(m[3]) : null });
  }
  for (const m of line.matchAll(EN_DATE)) {
    found.push({ day: Number(m[2]), month: monthOf(m[1]), year: m[3] ? Number(m[3]) : null });
  }
  return found.filter((d) => d.month && d.day >= 1 && d.day <= 31);
}

const iso = (d: FoundDate): string | null =>
  d.year === null ? null : `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;

/** Words that name an attendable admissions event. "Admission" and "journée" alone are too broad. */
const EVENT_WORDS =
  /portes?[-\s]ouvertes?|open[-\s]?houses?|examens?|exams?\b|tests?\s+d['’]admission|entrevues?|interviews?|rencontres?\s+d['’]admission|visites?|tours?\b|soir[ée]es?\s+d['’]information|information\s+(?:session|evening|night)|s[ée]ances?\s+d['’]information/i;
/** Narration of an event that already happened. */
const PAST = /\bderni(?:er|[eè]re)\b|s['’]est\s+d[ée]roul|se\s+sont\s+d[ée]roul|\b(?:ont|a|avait)\s+eu\s+lieu|avait\s+lieu|took\s+place/i;
/** Another level than Secondary 1 entry, unless Secondary 1 is named too. */
const OTHER_LEVEL = /\b(?:primaire|maternelle|pr[ée]scolaire|coll[ée]gial|c[ée]gep)\b|\b[2-5]\s?(?:e|ᵉ|ème)\s*(?:,|à|ou|et)/i;
const FIRST_YEAR = /\b1\s?(?:re|ère|ʳᵉ)\b|secondaire\s+1|secondary\s+(?:1|one)\b|grade\s+7/i;
/** Deadlines and replies: you cannot attend them, so they are never events. */
const DEADLINE =
  /date\s+limite|deadline|au\s+plus\s+tard|avant\s+le|jusqu['’]au|p[ée]riode\s+d['’](?:inscription|admission)|d[ée]p[ôo]t\s+des\s+demandes|demandes?\s+d['’]admission|r[ée]ponses|apply\s+by/i;

/** Whether a dated group of lines can describe an attendable Secondary 1 event. */
function isCandidateEvent(group: readonly string[], dateLine: string): boolean {
  const text = group.join(' ');
  if (PAST.test(text)) return false;
  if (OTHER_LEVEL.test(text) && !FIRST_YEAR.test(text)) return false;
  return !(DEADLINE.test(dateLine) && !EVENT_WORDS.test(dateLine));
}
const TIME_ONLY = /\b\d{1,2}\s?h(?:\s?\d{2})?\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?[ap]\.?m\.?(?!\w)/i;

const PATTERNS: Record<'language' | 'gender', (text: string) => boolean> = {
  language: (t) =>
    /langue\s+d['’]enseignement|francophone|anglophone|bilingue|bilingual|english[-\s]language|french[-\s]language|enseignement\s+(?:en|du)\s+(?:fran[çc]ais|anglais)|instruction\s+in\s+(?:english|french)|langue\s+fran[çc]aise/i.test(t),
  gender: (t) => /\bfilles\b|\bgar[çc]ons\b|\bmixte\b|\bgirls\b|\bboys\b|\bco-?ed(?:ucational)?\b|co[ée]ducation/i.test(t),
};

const TUITION_WORD = /scolarit|tuition|frais\s+annuels/i;
const AMOUNT = /\d[\d\s  ,.]*\s?\$|\$\s?\d/;
const LEVEL =
  /secondaire|secondary|high\s+school|grades?\s+(?:\d{1,2})\b|primaire|pr[ée]scolaire|maternelle|kindergarten|elementary/i;
const SECONDARY_ONE = /secondaire|secondary|high\s+school|grades?\s+7\b/i;
/** How far above a fees row its level heading may sit. */
const LEVEL_LOOKBACK = 12;

/**
 * Fees are usually a table: a label row, amount-only rows under it, and the
 * level as a heading above. A hit keeps that shape (level, label, amounts)
 * and is dropped when its level is only another one, so kindergarten and
 * Grade 12 rows never reach the reviewer.
 */
function tuitionEvidence(page: PageFacts, index: number): Evidence[] {
  const { lines } = page;
  const out: Evidence[] = [];
  lines.forEach((line, i) => {
    if (!TUITION_WORD.test(line)) return;
    const groups = sentencesMatching(line, (s) => TUITION_WORD.test(s) && AMOUNT.test(s)).map((s) => [s]);
    if (groups.length === 0 && line.length <= 120) {
      // A label row: its amounts are the short lines just below it, up to the
      // next row; a note line («Date limite…») may sit before the first amount.
      const amounts: string[] = [];
      for (const next of lines.slice(i + 1, i + 4)) {
        const isAmount = next.length <= 60 && AMOUNT.test(next) && !TUITION_WORD.test(next);
        if (isAmount) amounts.push(next);
        else if (amounts.length > 0) break;
      }
      if (amounts.length > 0) groups.push([line, ...amounts]);
    }
    for (const group of groups) {
      const text = group.join(' ');
      if (LEVEL.test(text)) {
        if (!SECONDARY_ONE.test(text)) continue;
      } else {
        // The nearest level heading, with the heading cells just above it: a
        // flattened header row («Grades 7 – 10» / «Grade 11») is one heading.
        const start = Math.max(0, i - LEVEL_LOOKBACK);
        let last = i - 1;
        while (last >= start && !(lines[last].length <= 120 && LEVEL.test(lines[last]))) last--;
        if (last >= start) {
          let first = last;
          while (first - 1 >= start && lines[first - 1].length <= 120 && LEVEL.test(lines[first - 1])) first--;
          const heading = lines.slice(first, last + 1);
          if (!heading.some((l) => SECONDARY_ONE.test(l))) continue;
          group.unshift(...heading);
        }
      }
      out.push({ fact: 'tuition', lines: group, page: index, hash: hashEvidence('tuition', group) });
    }
  });
  return out;
}

const SELF_REFERENCE = /(?<!\p{L})(?:[ée]cole|coll[èe]ge|school|college|[ée]tablissement|institution)(?!\p{L})/iu;
const ABOUT_URL = /[àa]-?propos|about|qui-sommes|mission|histori|notre-/i;
const POSTAL = /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i;
/**
 * A school saying what it is: «X est un établissement…», «we are an independent … institution».
 * Letter lookarounds, not `\b`: `\b` treats «é» as a non-word character, so `\bétablissement` never matches.
 */
const IDENTITY =
  /(?<!\p{L})(?:est|is|are|sommes)\s+(?:un|une|a|an)(?!\p{L}).{0,120}?(?<!\p{L})(?:[ée]tablissement|[ée]cole|coll[èe]ge|school|institution|college|organisme)(?!\p{L})|^(?:un|une)\s+(?:[ée]tablissement|[ée]cole)(?!\p{L})/iu;
/** A site's home page, in any language root. */
const HOME_PATH = /^\/(?:fr|en)?\/?$/;

/** Long paragraphs are cut to the sentences that match, so a hit costs a sentence, not a page section. */
function sentencesMatching(line: string, test: (s: string) => boolean): string[] {
  if (line.length <= 240) return test(line) ? [line] : [];
  return line
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && test(s));
}

export type Evidence = {
  fact: Fact;
  /** Verbatim page text, one or two adjacent lines. */
  lines: string[];
  /** Index into the school's page list. */
  page: number;
  /** Stable id, remembered once reviewed so the same line is never shown twice. */
  hash: string;
};

export type SchoolEvidence = {
  gaps: Fact[];
  items: Evidence[];
  /** Facts settled by a deterministic check; shown as one line, no review needed. */
  settled: string[];
};

const CAP: Record<Fact, number> = { events: 20, address: 3, language: 5, gender: 5, tuition: 4, description: 4 };

export function hashEvidence(fact: Fact, lines: readonly string[]): string {
  return createHash('sha1').update(`${fact}|${lines.join('\n')}`).digest('hex').slice(0, 10);
}

/** Dates of events already on file for this school, draft or published: lines repeating them are not news. */
function knownDays(school: SchoolFile): Set<string> {
  return new Set(school.open_days.map((e) => dayKey(eventBounds(e).starts_at)));
}

const DAY_MS = 86_400_000;
/** A yearless date this recent is the season that just ended, not the next one. */
const JUST_PASSED_DAYS = 120;

function justPassed(d: FoundDate, today: string): boolean {
  const now = Date.parse(today);
  const year = Number(today.slice(0, 4));
  return [year, year - 1].some((y) => {
    const age = now - Date.parse(iso({ ...d, year: y })!);
    return age >= 0 && age <= JUST_PASSED_DAYS * DAY_MS;
  });
}

/**
 * Whether a dated line can still matter: at least one of its dates falls on
 * or after `today` and is not an event already on file, or has no year and
 * did not just pass (the reviewer must judge which year it means).
 */
function isLiveDateLine(line: string, today: string, known: ReadonlySet<string>): boolean {
  const dates = datesIn(line);
  if (dates.length === 0) return false;
  return dates.some((d) => {
    const day = iso(d);
    return day === null ? !justPassed(d, today) : day >= today && !known.has(day);
  });
}

function eventEvidence(pages: readonly PageFacts[], school: SchoolFile, today: string): Evidence[] {
  const known = knownDays(school);
  const out: Evidence[] = [];
  pages.forEach((page, index) => {
    const { lines } = page;
    lines.forEach((line, i) => {
      if (!isLiveDateLine(line, today, known)) return;
      // The event's name is often the heading above its date; a line with its own date is another item.
      const heading = [lines[i - 1], lines[i - 2]].find(
        (l) => l && l.length <= 120 && EVENT_WORDS.test(l) && datesIn(l).length === 0,
      );
      if (!EVENT_WORDS.test(line) && !heading) return;
      const group = heading && !EVENT_WORDS.test(line) ? [heading, line] : [line];
      // Times often sit on the line after the date.
      const next = lines[i + 1];
      if (next && next.length <= 120 && TIME_ONLY.test(next) && datesIn(next).length === 0 && !TIME_ONLY.test(line)) {
        group.push(next);
      }
      if (!isCandidateEvent(group, line)) return;
      out.push({ fact: 'events', lines: group, page: index, hash: hashEvidence('events', group) });
    });
    for (const event of page.jsonLdEvents) {
      const day = event.startDate.slice(0, 10);
      if (day < today || known.has(day)) continue;
      const line = `JSON-LD Event: ${event.name} · ${event.startDate}${event.endDate ? ` – ${event.endDate}` : ''}`;
      out.push({ fact: 'events', lines: [line], page: index, hash: hashEvidence('events', [line]) });
    }
  });
  return out;
}

function factEvidence(fact: Exclude<Fact, 'events'>, pages: readonly PageFacts[], school: SchoolFile): Evidence[] {
  const out: Evidence[] = [];
  pages.forEach((page, index) => {
    if (fact === 'description') {
      // A school saying what it is counts on any page; other summaries only
      // on its home and about pages, since an admission page's summary
      // describes that page, not the school.
      for (const line of page.lines) {
        for (const s of sentencesMatching(line, (t) => t.length >= 60 && IDENTITY.test(t))) {
          out.push({ fact, lines: [s], page: index, hash: hashEvidence(fact, [s]) });
        }
      }
      const home = page.url === school.website_url || HOME_PATH.test(new URL(page.url).pathname);
      if (!home && !ABOUT_URL.test(page.url)) return;
      if (page.description && page.description.length >= 40 && SELF_REFERENCE.test(page.description)) {
        out.push({ fact, lines: [page.description], page: index, hash: hashEvidence(fact, [page.description]) });
      }
      for (const line of page.lines) {
        for (const s of sentencesMatching(line, (t) => t.length >= 80 && SELF_REFERENCE.test(t))) {
          out.push({ fact, lines: [s], page: index, hash: hashEvidence(fact, [s]) });
        }
      }
      return;
    }
    if (fact === 'tuition') {
      out.push(...tuitionEvidence(page, index));
      return;
    }
    const test = fact === 'address' ? (t: string) => POSTAL.test(t) : PATTERNS[fact];
    for (const line of page.lines) {
      for (const s of sentencesMatching(line, test)) {
        out.push({ fact, lines: [s], page: index, hash: hashEvidence(fact, [s]) });
      }
    }
  });
  // The strongest lines fill the cap first: fees rows that name Secondary 1,
  // and a school's own statement of what it is.
  const strong =
    fact === 'tuition'
      ? (item: Evidence) => SECONDARY_ONE.test(item.lines.join(' '))
      : fact === 'description'
        ? (item: Evidence) => IDENTITY.test(item.lines.join(' '))
        : null;
  return strong ? [...out.filter(strong), ...out.filter((item) => !strong(item))] : out;
}

const compactPostal = (text: string): string => text.replace(/\s+/g, '').toUpperCase();

/**
 * The evidence a reviewer needs for this school's open gaps, and nothing
 * else: lines already reviewed, repeated across pages, dated in the past, or
 * about an event already on file are dropped before any model sees them.
 */
export function collectEvidence(
  school: SchoolFile,
  pages: readonly PageFacts[],
  today: string,
  reviewed: ReadonlySet<string> = new Set(),
): SchoolEvidence {
  const gaps = gapsFor(school);
  const settled: string[] = [];
  const items: Evidence[] = [];

  for (const fact of gaps) {
    if (fact === 'address') {
      // Deterministic: the record's postal code printed on the school's own site settles it.
      const postal = compactPostal(school.postal_code);
      const page = pages.findIndex((p) => p.lines.some((l) => compactPostal(l).includes(postal)));
      if (page >= 0) {
        settled.push(`address: postal code ${school.postal_code} appears on [p${page + 1}]`);
        continue;
      }
    }
    const found = fact === 'events' ? eventEvidence(pages, school, today) : factEvidence(fact, pages, school);
    const seen = new Set<string>();
    let kept = 0;
    for (const item of found) {
      if (kept >= CAP[fact]) break;
      // Text only, not page: a banner repeated on every page is one line.
      const key = item.lines.join('\n');
      if (seen.has(key)) continue;
      seen.add(key);
      // A reviewed line keeps its slot: the next-ranked lines for a fact the
      // reviewer already judged are weaker, not news.
      kept++;
      if (!reviewed.has(item.hash)) items.push(item);
    }
  }
  return { gaps, items, settled };
}
