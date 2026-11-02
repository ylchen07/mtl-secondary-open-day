import * as cheerio from 'cheerio';
import { htmlToLines } from './normalize';

export type PageLink = { href: string; text: string };

/** A structured event a page declares in JSON-LD; read without any model. */
export type JsonLdEvent = { name: string; startDate: string; endDate: string | null };

/**
 * Everything the research step keeps from one fetched page. The raw HTML is
 * dropped here: it is typically 20-50x larger than its visible text and none
 * of the markup is evidence.
 */
export type PageFacts = {
  url: string;
  lines: string[];
  /** `<meta name=description>` or `og:description`: the school's own summary. */
  description: string | null;
  jsonLdEvents: JsonLdEvent[];
  /** Absolute http(s) links, fragment removed, navigation included. */
  links: PageLink[];
};

const squash = (text: string): string => text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim();

/**
 * A Next.js App Router page streams its content as `self.__next_f.push([1,"…"])`
 * chunks, and text inside a closed accordion or tab exists only there (a
 * school's fees table, say). Plain-text chunks are kept, in order; component
 * references and serialised props are not.
 */
function streamedText(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    let text: string;
    try {
      text = squash(JSON.parse(m[1]) as string);
    } catch {
      continue;
    }
    if (text === '' || /^[0-9a-f]+:[A-Z]?[0-9a-f]*,?$/.test(text) || /[[\]{}<>]/.test(text) || text.startsWith('$')) continue;
    if (text !== out[out.length - 1]) out.push(text);
  }
  return out;
}

function collectEvents(node: unknown, out: JsonLdEvent[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectEvents(item, out);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  const type = record['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === 'string' && /Event$/.test(t)) && typeof record.startDate === 'string') {
    out.push({
      name: typeof record.name === 'string' ? squash(record.name) : '',
      startDate: record.startDate,
      endDate: typeof record.endDate === 'string' ? record.endDate : null,
    });
  }
  if (record['@graph']) collectEvents(record['@graph'], out);
}

export function readPage(html: string, url: string): PageFacts {
  const $ = cheerio.load(html);

  const description =
    squash($('meta[name="description"]').attr('content') ?? '') ||
    squash($('meta[property="og:description"]').attr('content') ?? '') ||
    null;

  const jsonLdEvents: JsonLdEvent[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collectEvents(JSON.parse($(el).text()), jsonLdEvents);
    } catch {
      // A malformed block is the site's bug, not evidence; skip it.
    }
  });

  const links: PageLink[] = [];
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    let target: URL;
    try {
      target = new URL($(el).attr('href') ?? '', url);
    } catch {
      return;
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return;
    target.hash = '';
    const href = target.toString();
    if (seen.has(href)) return;
    seen.add(href);
    links.push({ href, text: squash($(el).text()) });
  });

  return { url, lines: [...htmlToLines(html), ...streamedText(html)], description, jsonLdEvents, links };
}
