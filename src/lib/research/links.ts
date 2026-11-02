import type { PageLink } from './page';

/**
 * Which pages of a school site are worth fetching, most valuable first. The
 * crawl reads a handful of pages per school instead of the whole site: dates
 * live on admission pages, the street address on the contact page, language
 * and student body on the about page.
 */
const LINK_RULES: { pattern: RegExp; weight: number }[] = [
  { pattern: /portes?[-\s]?ouvertes?|open[-\s]?house|journ[ée]es?[-\s]portes/i, weight: 5 },
  { pattern: /examen|exam\b|test[-\s]d|entrevue|interview/i, weight: 4 },
  { pattern: /admission|inscri|apply|enrol/i, weight: 3 },
  { pattern: /nous[-\s]joindre|contact|coordonn/i, weight: 2 },
  { pattern: /[àa][-\s]propos|about|qui[-\s]sommes|mission|notre[-\s](?:école|college|collège)|histori/i, weight: 2 },
  { pattern: /frais|droits[-\s]de[-\s]scolarit|tuition|fees/i, weight: 1 },
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

function score(link: PageLink): number {
  const haystack = `${decodeURIComponent(new URL(link.href).pathname)} ${link.text}`;
  return LINK_RULES.reduce((sum, rule) => sum + (rule.pattern.test(haystack) ? rule.weight : 0), 0);
}

/**
 * The best `limit` unseen same-site HTML links. Documents are returned
 * separately: they are listed for a human, never fetched, because a PDF
 * calendar is costly to read and rarely the only place a date appears.
 */
export function pickLinks(
  links: readonly PageLink[],
  siteUrl: string,
  seen: ReadonlySet<string>,
  limit: number,
): { pages: string[]; documents: string[] } {
  const ranked: { href: string; score: number }[] = [];
  const documents: string[] = [];
  for (const link of links) {
    if (seen.has(link.href) || !isSameSite(link.href, siteUrl) || MEDIA.test(new URL(link.href).pathname)) continue;
    const value = score(link);
    if (value === 0) continue;
    if (DOCUMENT.test(new URL(link.href).pathname)) {
      if (value >= 3) documents.push(link.href);
      continue;
    }
    ranked.push({ href: link.href, score: value });
  }
  ranked.sort((a, b) => b.score - a.score);
  return { pages: ranked.slice(0, limit).map((r) => r.href), documents: [...new Set(documents)] };
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
