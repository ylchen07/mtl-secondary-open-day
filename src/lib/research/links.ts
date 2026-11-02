import type { Fact } from './evidence';
import type { PageLink } from './page';

/**
 * Which pages of a school site are worth fetching, most valuable first. The
 * crawl reads a handful of pages per school instead of the whole site: dates
 * live on admission pages, the street address on the contact page, language
 * and student body on the about page, tuition on a fees page. A rule counts
 * only while one of its facts is still a gap for the school.
 */
const LINK_RULES: { facts: readonly Fact[]; pattern: RegExp; weight: number }[] = [
  { facts: ['events'], pattern: /portes?[-\s]?ouvertes?|open[-\s]?house|journ[ée]es?[-\s]portes/i, weight: 5 },
  { facts: ['events'], pattern: /examen|exam\b|test[-\s]d|entrevue|interview/i, weight: 4 },
  { facts: ['events'], pattern: /admission|inscri|apply|enrol/i, weight: 3 },
  { facts: ['address'], pattern: /nous[-\s]joindre|contact|coordonn/i, weight: 2 },
  {
    facts: ['description', 'language', 'gender'],
    pattern: /[àa][-\s]propos|about|qui[-\s]sommes|mission|notre[-\s](?:école|college|collège)|histori/i,
    weight: 2,
  },
  { facts: ['tuition'], pattern: /frais|droits[-\s]de[-\s]scolarit|scolarit[ée]|tuition|fees|co[uû]ts?\b/i, weight: 3 },
];

const DOCUMENT = /\.(pdf|docx?|xlsx?|pptx?)$/i;
const MEDIA = /\.(jpe?g|png|gif|webp|svg|mp4|zip)$/i;

const bareHost = (host: string): string => host.toLowerCase().replace(/^www\./, '');

/** The school's own site: the same host or one of its subdomains (portesouvertes.csjv.ca). */
export function isSameSite(href: string, siteUrl: string): boolean {
  try {
    const host = bareHost(new URL(href).hostname);
    const site = bareHost(new URL(siteUrl).hostname);
    return host === site || host.endsWith(`.${site}`) || site.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

function score(link: PageLink, gaps: ReadonlySet<Fact>): { value: number; facts: Set<Fact> } {
  const haystack = `${decodeURIComponent(new URL(link.href).pathname)} ${link.text}`;
  const facts = new Set<Fact>();
  let value = 0;
  for (const rule of LINK_RULES) {
    const open = rule.facts.filter((f) => gaps.has(f));
    if (open.length === 0 || !rule.pattern.test(haystack)) continue;
    value += rule.weight;
    for (const f of open) facts.add(f);
  }
  return { value, facts };
}

type Ranked = { href: string; value: number; facts: Set<Fact> };

/**
 * The best `limit` unseen same-site HTML links for the school's open gaps.
 * Each gap first reserves its own best link, so a strong open-house link
 * cannot crowd out the one fees page; the rest go by score. Documents are
 * ranked the same way and returned separately: the caller reads only a few.
 */
export function pickLinks(
  links: readonly PageLink[],
  siteUrl: string,
  seen: ReadonlySet<string>,
  limit: number,
  gaps: readonly Fact[],
): { pages: string[]; documents: string[] } {
  const open = new Set(gaps);
  const pages = new Map<string, Ranked>();
  const documents = new Map<string, Ranked>();
  for (const link of links) {
    if (seen.has(link.href) || !isSameSite(link.href, siteUrl) || MEDIA.test(new URL(link.href).pathname)) continue;
    const { value, facts } = score(link, open);
    if (value === 0) continue;
    const into = DOCUMENT.test(new URL(link.href).pathname) ? documents : pages;
    // The same href under several anchors keeps its best reading.
    if ((into.get(link.href)?.value ?? 0) < value) into.set(link.href, { href: link.href, value, facts });
  }
  const byValue = (map: Map<string, Ranked>) => [...map.values()].sort((a, b) => b.value - a.value);
  const ranked = byValue(pages);
  const picked = new Set<string>();
  for (const gap of gaps) {
    if (picked.size >= limit) break;
    const best = ranked.find((r) => r.facts.has(gap) && !picked.has(r.href));
    if (best) picked.add(best.href);
  }
  for (const r of ranked) {
    if (picked.size >= limit) break;
    picked.add(r.href);
  }
  return { pages: [...picked], documents: byValue(documents).map((r) => r.href) };
}

/** `Disallow` prefixes that apply to every crawler (`User-agent: *`). */
export function parseRobots(text: string): string[] {
  const disallow: string[] = [];
  let applies = false;
  let inAgents = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const match = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (/^user-agent$/i.test(key)) {
      // Consecutive User-agent lines share one group.
      applies = (inAgents && applies) || value.trim() === '*';
      inAgents = true;
      continue;
    }
    inAgents = false;
    if (applies && /^disallow$/i.test(key) && value.trim() !== '') disallow.push(value.trim());
  }
  return disallow;
}

export function isAllowed(href: string, disallow: readonly string[]): boolean {
  const { pathname, search } = new URL(href);
  const path = `${pathname}${search}`;
  return !disallow.some((prefix) => path.startsWith(prefix.replace(/\*$/, '')));
}

/** `Sitemap:` URLs a robots.txt declares; they apply to every crawler. */
export function sitemapsIn(robotsText: string): string[] {
  return [...robotsText.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]);
}

/** Child sitemaps of news, media and taxonomies: none lists a fees or about page. */
const NOISE_SITEMAP = /posts?-post|post-sitemap|news|actualit|nouvelle|event|evenement|product|attachment|tag|categor|author|users?-|taxonom/i;
/** A dated path is a news post, not a standing page. */
const DATED_PATH = /\/\d{4}\/\d{2}\//;

/**
 * The standing pages a sitemap lists, or, for a sitemap index, the child
 * sitemaps worth reading. Menus often hide the fees page; the sitemap does not.
 */
export function readSitemap(xml: string): { pages: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  if (/<sitemapindex[\s>]/.test(xml)) return { pages: [], sitemaps: locs.filter((u) => !NOISE_SITEMAP.test(u)) };
  return { pages: locs.filter((u) => !DATED_PATH.test(u)), sitemaps: [] };
}
