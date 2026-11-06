import type { SchoolFile } from '../schema';
import { isSameSite } from './links';

/** What research needs from a Wikidata item to tell whether it is the school. */
export type WikidataItem = {
  id: string;
  /** Official websites (P856). */
  websites: string[];
  /** Coordinates (P625). */
  coord: { lat: number; lng: number } | null;
  /** Instance of (P31) classes. */
  classes: string[];
  titles: { fr: string | null; en: string | null };
};

/** Raw `wbgetentities` entity, only the parts read here. */
type RawEntity = {
  id: string;
  claims?: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]>;
  sitelinks?: Record<string, { title: string }>;
};

export function readWikidataItem(entity: RawEntity): WikidataItem {
  const values = (p: string) => (entity.claims?.[p] ?? []).flatMap((c) => (c.mainsnak.datavalue ? [c.mainsnak.datavalue.value] : []));
  const coord = values('P625')[0] as { latitude: number; longitude: number } | undefined;
  return {
    id: entity.id,
    websites: values('P856').filter((v): v is string => typeof v === 'string'),
    coord: coord ? { lat: coord.latitude, lng: coord.longitude } : null,
    classes: values('P31').flatMap((v) => (typeof v === 'object' && v && 'id' in v ? [String(v.id)] : [])),
    titles: { fr: entity.sitelinks?.frwiki?.title ?? null, en: entity.sitelinks?.enwiki?.title ?? null },
  };
}

/** Within this distance, an article's coordinates are the school's building. */
const NEAR_KM = 1.5;
/** Words every school name shares; a title must carry the others. */
const COMMON_WORDS = new Set(['college', 'ecole', 'secondaire', 'school', 'high', 'academy', 'academie', 'campus', 'montreal', 'inc']);

const words = (text: string): string[] =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !COMMON_WORDS.has(w));

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (a.lat - b.lat) * 111.2;
  const dLng = (a.lng - b.lng) * 111.2 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/**
 * Wikidata classes a school is filed under: school, primary, secondary, high
 * and private school, educational and academic institution. A metro station
 * named after the school, or the defunct Loyola College that shared its
 * website, is none of these.
 */
const SCHOOL_CLASSES = new Set(['Q3914', 'Q9842', 'Q159334', 'Q9826', 'Q423208', 'Q2385804', 'Q4671277']);
const isSchool = (item: WikidataItem): boolean => item.classes.some((c) => SCHOOL_CLASSES.has(c));

/**
 * The Wikidata item that is this school, or null. A search hit is only a
 * candidate: it is the school when Wikidata files it as a school and gives
 * the school's own website, or when its coordinates are the school's
 * building and its article title carries every distinctive word of the
 * school's name. An unclassified item passes on its website alone. A
 * same-named school elsewhere, a station, a person or a town never passes.
 */
export function pickWikidataItem(school: Pick<SchoolFile, 'name_fr' | 'name_en' | 'website_url' | 'location'>, items: readonly WikidataItem[]): WikidataItem | null {
  const own = items.find(
    (item) => (isSchool(item) || item.classes.length === 0) && item.websites.some((url) => isSameSite(url, school.website_url)),
  );
  if (own) return own;
  const location = school.location;
  if (!location) return null;
  const names = [school.name_fr, school.name_en].map(words).filter((w) => w.length > 0);
  return (
    items.find((item) => {
      if (!isSchool(item) || !item.coord || kmBetween(item.coord, location) > NEAR_KM) return false;
      const titles = [item.titles.fr, item.titles.en].filter((t): t is string => t != null).map((t) => new Set(words(t)));
      return names.some((name) => titles.some((title) => name.every((w) => title.has(w))));
    }) ?? null
  );
}

export const articleUrl = (lang: 'fr' | 'en', title: string): string =>
  `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

/** The language and title of a Wikipedia article URL. */
export function articleOf(url: string): { lang: 'fr' | 'en'; title: string } {
  const { hostname, pathname } = new URL(url);
  return { lang: hostname.startsWith('fr.') ? 'fr' : 'en', title: decodeURIComponent(pathname.slice('/wiki/'.length)).replace(/_/g, ' ') };
}

/** The lead's first sentences: what a reviewer writes a description from. */
export function leadSentences(intro: string, max: number): string[] {
  return intro
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+(?=\p{Lu})/u))
    .map((s) => s.trim())
    .filter((s) => s.length >= 20)
    .slice(0, max);
}

/**
 * An article's infobox as `key: value` lines, markup stripped: what a
 * reviewer quotes for a language or a student body the lead leaves out.
 */
export function infoboxLines(wikitext: string): string[] {
  let text = wikitext.replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>|<!--[\s\S]*?-->/g, '');
  // Inner templates first, so a citation inside a value does not cut it short.
  for (let before = ''; before !== text; ) {
    before = text;
    text = text.replace(/\{\{(?:lang|langue)\|[^|{}]*\|([^{}]*)\}\}/gi, '$1').replace(/\{\{(?!\s*infobox)[^{}]*\}\}/gi, '');
  }
  // A row is `| key = value`; some infoboxes put several on one line.
  const pairs = [...text.matchAll(/^\s*\|(.+)$/gm)].flatMap(([, line]) =>
    line.split(/\|(?=\s*[\p{L}_ ]+\s*=)/u).flatMap((part) => {
      const at = part.indexOf('=');
      return at > 0 ? [[part.slice(0, at), part.slice(at + 1)]] : [];
    }),
  );
  return pairs
    .map(([key, value]) => [
      key.trim().toLowerCase(),
      value
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
        .replace(/<br\s*\/?>/gi, ', ')
        .replace(/<[^>]+>|'''?/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    ])
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${key}: ${value}`);
}

export type WikiFact = 'language' | 'gender' | 'boarding';

/** Infobox keys that state a fact outright, in either Wikipedia. */
const INFOBOX_KEY: Record<WikiFact, RegExp> = {
  language: /^(?:language|langues?|langue d['’]enseignement)$/,
  gender: /^(?:gender|genre|sexe|mixité)$/,
  boarding: /^(?:boarding|pensionnat|internat)$/,
};
/** Wording that states a fact in a lead sentence or another infobox row (a «type» row saying «mixte»). */
const WORDING: Record<WikiFact, RegExp> = {
  language: /francophone|anglophone|bilingu|(?:french|english)[-\s]language|de langue (?:française|anglaise)|langue d['’]enseignement/i,
  gender: /\bmixte\b|co-?ed(?:ucational)?|\bfilles\b|\bgar[çc]ons\b|\bgirls?\b|\bboys\b/i,
  // «internat», not «international».
  boarding: /boarding|pensionnaires|\binternats?\b|\bday school\b/i,
};

/** The lead sentences and infobox rows that can answer `fact`. */
export function wikiFactLines(fact: WikiFact, lead: readonly string[], infobox: readonly string[]): string[] {
  const rows = infobox.filter((line) => INFOBOX_KEY[fact].test(line.slice(0, line.indexOf(':'))) || WORDING[fact].test(line));
  return [...rows, ...lead.filter((s) => WORDING[fact].test(s))];
}
