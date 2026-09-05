import * as cheerio from 'cheerio';
import { AGGREGATOR_HOSTS } from '../check-sources';
import type { ListingEntry, ListingEvent, Region } from './types';

const MONTHS_FR: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10,
  novembre: 11, décembre: 12, decembre: 12,
};

const REGION_BY_ANCHOR: Record<string, Region> = {
  montreal: 'montreal_island',
  laval: 'laval',
  monteregie: 'south_shore',
  laurentides: 'north_shore',
  lanaudiere: 'north_shore',
};

/**
 * Selectors derived by reading `tests/fixtures/feep/listing-montreal.html`.
 * FEEP is a Drupal site: each region is a layout `div` whose `id` is the
 * region anchor, and each school is one `article` rendered by the
 * `node--school--open-house` template.
 */
const REGION_SECTION_SELECTOR = 'div.column-layout[id]';
const SCHOOL_BLOCK_SELECTOR = 'article.school--open-house';
const CARD_SELECTOR = 'div.card-content';
const DATE_BLOCK_SELECTOR = 'div.paragraph-date';
const NOTE_SELECTOR = 'div.school__field-open-house-text';
const FEEP_DETAIL_LINK_SELECTOR = 'a[href*="/ecoles-privees-quebec/"]';

/**
 * A card holds two sections in a flat sequence, marked only by these headings:
 * "Portes ouvertes" then "Processus d’admission". The admission section carries
 * its own dates ("À partir du 1 juillet 2026"), so reading dates from the whole
 * card would publish an admission deadline as an open house.
 */
const OPEN_HOUSE_HEADING = 'Portes ouvertes';
const ADMISSION_HEADING = /^Processus d['’]admission$/;

/** cheerio does not re-export its DOM node types, so name a selection this way. */
type ElementSelection = ReturnType<cheerio.CheerioAPI>;

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** "12 septembre 2026" -> "2026-09-12". Null when unparseable. */
export function parseFrenchDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS_FR[m[2].toLowerCase()];
  if (!month) return null;
  const day = Number(m[1]);
  if (day < 1 || day > 31) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** "9:00 AM à 2:30 PM" -> { startTime: "09:00", endTime: "14:30" }. */
export function parseTimeRange(
  text: string,
): { startTime: string | null; endTime: string | null } {
  const times = [...text.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)].map((m) => {
    let hour = Number(m[1]) % 12;
    if (m[3].toUpperCase() === 'PM') hour += 12;
    return `${String(hour).padStart(2, '0')}:${m[2]}`;
  });
  if (times.length < 2) return { startTime: null, endTime: null };
  return { startTime: times[0], endTime: times[1] };
}

/** True when `href` is an absolute URL to somewhere other than an aggregator. */
function isSchoolOwnUrl(href: string): boolean {
  let host: string;
  try {
    host = new URL(href).hostname.toLowerCase().replace(/\.+$/, '');
  } catch {
    return false;
  }
  if (host === '') return false;
  return !AGGREGATOR_HOSTS.some((a) => host === a || host.endsWith(`.${a}`));
}

export function parseListing(html: string): ListingEntry[] {
  const $ = cheerio.load(html);
  const entries: ListingEntry[] = [];

  $(REGION_SECTION_SELECTOR).each((_, section) => {
    const anchorId = ($(section).attr('id') ?? '').toLowerCase();
    const region = REGION_BY_ANCHOR[anchorId] ?? null;

    $(section)
      .find(SCHOOL_BLOCK_SELECTOR)
      .each((__, block) => {
        const $block = $(block);
        const link = $block.find(FEEP_DETAIL_LINK_SELECTOR).first();
        const href = link.attr('href') ?? '';
        const feepSlug = href.split('/').filter(Boolean).pop() ?? '';
        const nameFr = normalize(link.text());
        if (!feepSlug || !nameFr) return;

        const externalUrl =
          $block
            .find('a[href]')
            .toArray()
            .map((a) => $(a).attr('href') ?? '')
            .find(isSchoolOwnUrl) ?? null;

        entries.push({
          feepSlug,
          nameFr,
          region,
          externalUrl,
          events: parseOpenHouseEvents($, $block),
        });
      });
  });

  return entries;
}

/**
 * The events published under this card's "Portes ouvertes" heading only.
 *
 * Each `div.paragraph-date` is one event. A card with none carries prose
 * instead ("Sur rendez-vous", or "Les portes ouvertes ont eu lieu les 18 et 19
 * septembre 2026"), which is kept verbatim in `rawDate` and never parsed into a
 * date: that prose routinely describes past or conditional events, so reading a
 * date out of it would manufacture an open house that is not happening.
 */
function parseOpenHouseEvents(
  $: cheerio.CheerioAPI,
  $block: ElementSelection,
): ListingEvent[] {
  const contents = $block.find(CARD_SELECTOR).first().contents();

  let headingIndex = -1;
  let admissionIndex = -1;
  contents.each((i, node) => {
    const text = normalize($(node).text());
    if (headingIndex < 0) {
      if (text === OPEN_HOUSE_HEADING) headingIndex = i;
    } else if (admissionIndex < 0 && ADMISSION_HEADING.test(text)) {
      admissionIndex = i;
    }
  });
  // Without the heading we cannot tell which text is open-house data, and
  // guessing is the failure mode this parser exists to avoid.
  if (headingIndex < 0) return [];

  const end = admissionIndex < 0 ? contents.length : admissionIndex;
  const $section = $('<div></div>').append(contents.slice(headingIndex + 1, end).clone());

  const noteFr = normalize($section.find(NOTE_SELECTOR).first().text()) || null;

  const events: ListingEvent[] = [];
  $section.find(DATE_BLOCK_SELECTOR).each((_, dateBlock) => {
    const rawDate = normalize($(dateBlock).text());
    events.push({
      date: parseFrenchDate(rawDate),
      ...parseTimeRange(rawDate),
      rawDate,
      noteFr,
    });
  });
  if (events.length > 0) return events;

  const $prose = $section.clone();
  $prose.find('a').remove();
  const rawDate = normalize($prose.text());
  if (!rawDate) return [];
  return [{ date: null, startTime: null, endTime: null, rawDate, noteFr }];
}
