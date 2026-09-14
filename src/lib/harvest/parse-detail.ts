import * as cheerio from 'cheerio';
import type { SchoolFacts } from './types';
import type { SchoolFile } from '../schema';

const POSTAL = /([A-Z]\d[A-Z])\s*(\d[A-Z]\d)/i;

/**
 * Parse a postal line like "Montréal (Quebec) H3W 1W4" into city and postal code.
 * Normalizes postal codes to include the standard internal space.
 */
export function parsePostalLine(line: string): {
  city: string | null;
  postalCode: string | null;
} {
  const m = line.match(POSTAL);
  if (!m) return { city: null, postalCode: null };
  const city = line.slice(0, m.index).replace(/\(.*?\)/g, '').trim();
  return {
    city: city.length > 0 ? city : null,
    postalCode: `${m[1].toUpperCase()} ${m[2].toUpperCase()}`,
  };
}

/**
 * Infer gender from prose. FEEP has no structured gender field anywhere, only
 * natural-language descriptions. Returns a confidence flag alongside the guess.
 * 
 * An unconfident 'mixed' result means "nobody has checked", NOT "this school
 * is co-ed". Task 8's human reviewer must verify all unconfident results.
 */
export function inferGender(prose: string): {
  genderGuess: SchoolFile['gender'];
  genderConfident: boolean;
} {
  const t = prose.toLowerCase();
  if (/\bfilles\b|\bgirls\b/.test(t) && !/\bgarçons\b|\bboys\b/.test(t)) {
    return { genderGuess: 'girls', genderConfident: true };
  }
  if (/\bgarçons\b|\bboys\b/.test(t) && !/\bfilles\b|\bgirls\b/.test(t)) {
    return { genderGuess: 'boys', genderConfident: true };
  }
  if (/\bmixte\b|\bco-?ed\b|\bcoéducation\b/.test(t)) {
    return { genderGuess: 'mixed', genderConfident: true };
  }
  return { genderGuess: 'mixed', genderConfident: false };
}

/**
 * Parse a FEEP school detail page into SchoolFacts.
 * 
 * Selectors derived from fixtures `detail-marie-de-france.html` and
 * `detail-primary-only.html`. FEEP is Drupal; each data field lives in a
 * stable CSS class wrapper, not a positional selector.
 * 
 * **Critical judgements:**
 * - `isSecondary`: true only when "Secondaire" appears in the teaching levels.
 *   A wrong `false` silently deletes a real school from the harvest.
 * - `genderConfident`: false when prose is silent. A confident-but-wrong guess
 *   is worse than an unconfident one, because it bypasses human review.
 */
export function parseDetail(html: string): SchoolFacts {
  const $ = cheerio.load(html);

  // Address: FEEP uses structured address markup with semantic classes
  const address = $('.school__field-address .address-line1').first().text().trim() || null;
  const city = $('.school__field-address .locality').first().text().trim() || null;
  const postalRaw = $('.school__field-address .postal-code').first().text().trim();
  const postalCode = postalRaw && POSTAL.test(postalRaw)
    ? parsePostalLine(postalRaw).postalCode
    : null;

  // Teaching levels: each level is a separate field__item
  const levels = $('.school__field-teaching-level .field__item')
    .toArray()
    .map((el) => $(el).text().trim().toLowerCase())
    .join(' ');
  const isSecondary = /secondaire/.test(levels);

  // Language: field__item under the teaching language field
  // A school teaching French with an English-immersion stream lists both.
  // Define "bilingual" as: both languages present as distinct field items.
  const langItems = $('div.field__label:contains("Langue d\'enseignement")')
    .parent()
    .find('.field__item')
    .toArray()
    .map((el) => $(el).text().trim().toLowerCase());
  
  let language: SchoolFile['language'] | null = null;
  const hasFr = langItems.some((t) => /français|french/.test(t));
  const hasEn = langItems.some((t) => /anglais|english/.test(t));
  if (hasFr && hasEn) {
    language = 'bilingual';
  } else if (hasFr) {
    language = 'fr';
  } else if (hasEn) {
    language = 'en';
  }

  // Gender: infer from the full body text
  const body = $('body').text();

  return { address, city, postalCode, language, isSecondary, ...inferGender(body) };
}
