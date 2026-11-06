/**
 * Token-lean school research. Scripts do the reading; a model reviews only
 * the few quotable lines each school's open gaps need.
 *
 *   pnpm research [--only a,b] [--all] [--no-render]   fetch sites, write work/research/pack.md
 *   pnpm research:wiki [--only a,b] [--all]             match Wikipedia articles, pack their leads for descriptions
 *   pnpm research:apply                                 merge work/research/answers.json
 *   pnpm research:geocode [--only a,b] [--dry-run]      place schools on the map from their address
 *
 * See README "Keeping the data fresh".
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Browser } from '@playwright/test';
import { extractText, getDocumentProxy } from 'unpdf';
import { AGGREGATOR_HOSTS } from '../src/lib/check-sources';
import { GREATER_MONTREAL_BBOX } from '../src/lib/constants';
import { loadSchoolFiles, serialise, todayInMontreal } from '../src/lib/school-files';
import { answersSchema, applyAnswers, type Manifest } from '../src/lib/research/apply';
import { collectEvidence, gapsFor, hashEvidence, type Evidence, type Fact } from '../src/lib/research/evidence';
import { geocodeQueries, pickGeocode, type GeocodePick, type NominatimResult } from '../src/lib/research/geocode';
import { articleOf, articleUrl, infoboxLines, leadSentences, pickWikidataItem, readWikidataItem, wikiFactLines, type WikidataItem, type WikiFact } from '../src/lib/research/wikipedia';
import { addLedgerRows } from '../src/lib/research/ledger';
import { isAllowed, isSameSite, parseRobots, pickLinks, readSitemap, sitemapsIn } from '../src/lib/research/links';
import { renderPack, type PackEntry } from '../src/lib/research/pack';
import { readPage, type PageFacts, type PageLink } from '../src/lib/research/page';
import { isWikipediaUrl, type SchoolFile } from '../src/lib/schema';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data', 'schools');
const REVIEWED_PATH = path.join(ROOT, 'data', 'research', 'reviewed.json');
const WORK = path.join(ROOT, 'work', 'research');
const PAGES_DIR = path.join(WORK, 'pages');
const MANIFEST_PATH = path.join(WORK, 'manifest.json');
const PACK_PATH = path.join(WORK, 'pack.md');
const ANSWERS_PATH = path.join(WORK, 'answers.json');
const METRICS_PATH = path.join(WORK, 'metrics.json');
const LEDGER_PATH = path.join(ROOT, 'docs', 'data-audits', '2026-09-15-nullable-evidence-audit.md');

const UA = 'Mozilla/5.0 (compatible; mtl-secondary-open-day/1.0; +https://github.com/ylchen07/mtl-secondary-open-day)';
const TIMEOUT_MS = 20_000;
/** Pause between two requests to the same school site. */
const REQUEST_DELAY_MS = 400;
/** Different schools are different hosts, so a few can be read at once. */
const PARALLEL_SCHOOLS = 4;
/** Pages per school: seeds plus the best links found on them, over two hops. */
const MAX_PAGES = 10;
/** Fees grids and admission guides are often PDFs; a school's best two are read. */
const MAX_DOCUMENTS = 2;
/** A larger PDF is a yearbook; an image-heavy projet éducatif still fits (Saint-Sacrement's is 9.5 MB). */
const MAX_DOCUMENT_BYTES = 15_000_000;
/** Sitemap files read per school: an index and a few of its children. */
const MAX_SITEMAPS = 4;
/** Below this, a page is a JS shell or an error page: try a real browser. */
const MIN_TEXT_CHARS = 200;
/** Nominatim's usage policy: at most one request per second. */
const GEOCODE_DELAY_MS = 1_100;
/** Wikimedia asks API clients to keep requests serial and unhurried. */
const WIKI_DELAY_MS = 200;
/** Lead sentences per article language offered for a description. */
const LEAD_SENTENCES = 4;

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith('--') ? args[0] : 'scan';
const flag = (name: string): boolean => args.includes(`--${name}`);
const only = (() => {
  const i = args.indexOf('--only');
  return i >= 0 ? new Set(args[i + 1]?.split(',')) : null;
})();

const pageFile = (url: string) => path.join(PAGES_DIR, `${createHash('sha1').update(url).digest('hex').slice(0, 16)}.txt`);
/** The ~4 characters per token rule of thumb; used for relative comparisons only. */
const tokens = (chars: number) => Math.round(chars / 4);

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw cause;
  }
}

async function loadSchools(): Promise<SchoolFile[]> {
  const all = await loadSchoolFiles({ readdir, readFile: (p) => readFile(p, 'utf8') }, DATA_DIR);
  return all.filter((s) => !only || only.has(s.slug));
}

// ---------------------------------------------------------------- fetching

let browser: Promise<Browser> | null = null;
type Robots = { disallow: string[]; sitemaps: string[] };
const robots = new Map<string, Promise<Robots>>();

function robotsFor(origin: string): Promise<Robots> {
  let rules = robots.get(origin);
  if (!rules) {
    rules = fetch(`${origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      .then((res) => (res.ok ? res.text() : ''))
      .then(
        (text) => ({ disallow: parseRobots(text), sitemaps: sitemapsIn(text) }),
        () => ({ disallow: [], sitemaps: [] }),
      );
    robots.set(origin, rules);
  }
  return rules;
}

/** Every standing page a site's sitemap lists, as links with no anchor text. */
async function sitemapLinks(site: string): Promise<PageLink[]> {
  const origin = new URL(site).origin;
  const { disallow, sitemaps } = await robotsFor(origin);
  const queue = sitemaps.length > 0 ? [...sitemaps] : [`${origin}/sitemap.xml`];
  const pages: string[] = [];
  for (let i = 0, read = 0; i < queue.length && read < MAX_SITEMAPS; i++) {
    if (!isAllowed(queue[i], disallow)) continue;
    read++;
    await sleep(REQUEST_DELAY_MS);
    const xml = await fetch(queue[i], { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      .then((res) => (res.ok ? res.text() : ''))
      .catch(() => '');
    const found = readSitemap(xml);
    pages.push(...found.pages);
    queue.push(...found.sitemaps);
  }
  return pages.map((href) => ({ href, text: '' }));
}

type Fetched = { ok: true; page: PageFacts; rawChars: number; rendered: boolean } | { ok: false; reason: string };

async function render(url: string): Promise<string | null> {
  if (flag('no-render')) return null;
  browser ??= import('@playwright/test').then(({ chromium }) => chromium.launch());
  const context = await (await browser).newContext({ userAgent: UA });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT_MS });
    return await page.content();
  } catch {
    return null;
  } finally {
    await context.close();
  }
}

/** A PDF's text, one line per text run end, read like a page that has no links. */
async function readPdf(bytes: ArrayBuffer, url: string): Promise<PageFacts> {
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: false });
  const lines = text
    .flatMap((p) => p.split('\n'))
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
  return { url, lines, description: null, jsonLdEvents: [], links: [] };
}

async function fetchPage(url: string): Promise<Fetched> {
  if (!isAllowed(url, (await robotsFor(new URL(url).origin)).disallow)) return { ok: false, reason: 'disallowed by robots.txt' };
  let reason: string;
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && type.includes('pdf')) {
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength > MAX_DOCUMENT_BYTES) return { ok: false, reason: 'PDF too large' };
      const page = await readPdf(bytes, url).catch(() => null);
      return page ? { ok: true, page, rawChars: bytes.byteLength, rendered: false } : { ok: false, reason: 'unreadable PDF' };
    }
    if (res.ok && !type.includes('html')) return { ok: false, reason: `not HTML (${type || 'no type'})` };
    if (res.ok) {
      const html = await res.text();
      const page = readPage(html, url);
      if (page.lines.join(' ').length >= MIN_TEXT_CHARS) return { ok: true, page, rawChars: html.length, rendered: false };
      reason = 'thin page';
    } else {
      reason = `HTTP ${res.status}`;
    }
  } catch (cause) {
    reason = cause instanceof Error ? cause.message : String(cause);
  }
  // A JS-rendered or bot-shy site still has the facts once a browser runs it.
  const html = await render(url);
  const page = html ? readPage(html, url) : null;
  if (html && page && page.lines.join(' ').length >= MIN_TEXT_CHARS) {
    return { ok: true, page, rawChars: html.length, rendered: true };
  }
  return { ok: false, reason };
}

/** What apply checks quotes against: the page's summary, its visible text and any JSON-LD events. */
function cachedText(page: PageFacts): string {
  const jsonLd = page.jsonLdEvents.map(
    (e) => `JSON-LD Event: ${e.name} · ${e.startDate}${e.endDate ? ` – ${e.endDate}` : ''}`,
  );
  return [`# ${page.url}`, ...(page.description ? [page.description] : []), ...page.lines, ...jsonLd].join('\n');
}

const isAggregator = (url: string) => {
  const host = new URL(url).hostname.toLowerCase();
  return AGGREGATOR_HOSTS.some((a) => host === a || host.endsWith(`.${a}`));
};

type SchoolRun = { entry: PackEntry; rawChars: number; textChars: number; rendered: number };

async function researchSchool(school: SchoolFile, today: string, reviewed: ReadonlySet<string>): Promise<SchoolRun> {
  const site = school.website_url;
  const gaps = gapsFor(school);
  // The home page carries the school's own summary even when the record points at a deeper page.
  const seeds = [...new Set([school.admissions_url, school.source_url, site, `${new URL(site).origin}/`])].filter(
    (url) => !isAggregator(url) && (isSameSite(url, site) || url === school.admissions_url),
  );
  const pages: PageFacts[] = [];
  const failures: string[] = [];
  const seen = new Set<string>();
  let documents: string[] = [];
  let rawChars = 0;
  let rendered = 0;

  const visit = async (url: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    if (seen.size > 1) await sleep(REQUEST_DELAY_MS);
    const result = await fetchPage(url);
    if (!result.ok) {
      failures.push(`${url} (${result.reason})`);
      return;
    }
    rawChars += result.rawChars;
    if (result.rendered) rendered++;
    pages.push(result.page);
    await writeFile(pageFile(url), cachedText(result.page), 'utf8');
  };

  for (const url of seeds) await visit(url);
  // Menus often hide the fees or about page; the sitemap lists it.
  const listed = await sitemapLinks(site);
  // Two hops: the fees page is often linked from the admission page, not the home page.
  for (let hop = 0; hop < 2 && pages.length < MAX_PAGES; hop++) {
    const links = [...pages.flatMap((p) => p.links), ...listed];
    const picked = pickLinks(links, site, seen, MAX_PAGES - pages.length, gaps);
    documents = [...new Set([...documents, ...picked.documents])];
    if (picked.pages.length === 0) break;
    for (const url of picked.pages) await visit(url);
  }
  for (const url of documents.filter((d) => /\.pdf$/i.test(new URL(d).pathname)).slice(0, MAX_DOCUMENTS)) {
    await visit(url);
  }

  const evidence = collectEvidence(school, pages, today, reviewed);
  return {
    // Documents left unread stay listed for a human.
    entry: { school, evidence, pages: pages.map((p) => p.url), documents: documents.filter((d) => !seen.has(d)), failures },
    rawChars,
    textChars: pages.reduce((sum, p) => sum + p.lines.join('\n').length, 0),
    rendered,
  };
}

async function scan(): Promise<void> {
  const today = todayInMontreal(new Date());
  await mkdir(PAGES_DIR, { recursive: true });
  const schools = await loadSchools();
  const reviewedBySlug = flag('all') ? {} : await readJson<Record<string, string[]>>(REVIEWED_PATH, {});
  console.log(`Researching ${schools.length} school(s), ${PARALLEL_SCHOOLS} at a time…`);

  const runs: SchoolRun[] = new Array(schools.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: PARALLEL_SCHOOLS }, async () => {
      while (next < schools.length) {
        const i = next++;
        runs[i] = await researchSchool(schools[i], today, new Set(reviewedBySlug[schools[i].slug] ?? []));
        process.stdout.write('.');
      }
    }),
  );
  console.log('');
  if (browser) await (await browser).close();

  const entries = runs.map((r) => r.entry);
  const pack = renderPack(entries, today);
  const manifest: Manifest = {
    today,
    schools: Object.fromEntries(
      entries.map((e) => [e.school.slug, { pages: e.pages, shown: e.evidence.items.map((i) => i.hash) }]),
    ),
  };
  const sum = (pick: (r: SchoolRun) => number) => runs.reduce((s, r) => s + pick(r), 0);
  const metrics = {
    today,
    schools: runs.length,
    pages: sum((r) => r.entry.pages.length),
    rendered: sum((r) => r.rendered),
    unreadable: sum((r) => r.entry.failures.length),
    rawHtmlChars: sum((r) => r.rawChars),
    pageTextChars: sum((r) => r.textChars),
    packChars: pack.length,
    linesForReview: sum((r) => r.entry.evidence.items.length),
  };

  await writeFile(PACK_PATH, pack, 'utf8');
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(METRICS_PATH, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');

  console.log(
    `Read ${metrics.pages} pages (${metrics.rendered} via browser, ${metrics.unreadable} unreadable).\n` +
      `Raw HTML ≈${tokens(metrics.rawHtmlChars).toLocaleString()} tokens → page text ≈${tokens(metrics.pageTextChars).toLocaleString()} → ` +
      `pack ≈${tokens(metrics.packChars).toLocaleString()} (${metrics.linesForReview} lines to review).\n` +
      `Pack written to ${path.relative(ROOT, PACK_PATH)}`,
  );
}

// ---------------------------------------------------------------- apply

async function apply(): Promise<void> {
  const today = todayInMontreal(new Date());
  const manifest = await readJson<Manifest | null>(MANIFEST_PATH, null);
  if (!manifest) throw new Error('No research run found: run `pnpm research` first.');
  const answers = answersSchema.parse(await readJson<unknown>(ANSWERS_PATH, {}));
  const texts = new Map<string, string>();
  for (const { pages } of Object.values(manifest.schools)) {
    for (const url of pages) {
      const text = await readFile(pageFile(url), 'utf8').catch(() => null);
      if (text !== null) texts.set(url, text);
    }
  }

  const result = applyAnswers(await loadSchools(), answers, manifest, (url) => texts.get(url) ?? null, today);
  for (const school of result.updated) {
    await writeFile(path.join(DATA_DIR, `${school.slug}.json`), serialise(school), 'utf8');
  }
  if (result.addedEvents.length > 0) {
    await writeFile(LEDGER_PATH, addLedgerRows(await readFile(LEDGER_PATH, 'utf8'), result.addedEvents, today), 'utf8');
  }
  const reviewed = await readJson<Record<string, string[]>>(REVIEWED_PATH, {});
  for (const [slug, hashes] of Object.entries(result.reviewed)) {
    reviewed[slug] = [...new Set([...(reviewed[slug] ?? []), ...hashes])].sort();
  }
  await mkdir(path.dirname(REVIEWED_PATH), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(reviewed).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(REVIEWED_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

  for (const line of result.changes) console.log(`  ${line}`);
  for (const line of result.errors) console.error(`  REJECTED ${line}`);
  console.log(`Applied ${result.updated.length} school(s); ${result.errors.length} rejection(s).`);
  if (result.errors.length > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------- geocode

async function nominatim(query: string): Promise<NominatimResult[]> {
  const { minLat, maxLat, minLng, maxLng } = GREATER_MONTREAL_BBOX;
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'ca',
    limit: '5',
    viewbox: `${minLng},${maxLat},${maxLng},${minLat}`,
    bounded: '1',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'user-agent': UA, 'accept-language': 'fr' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  return (await res.json()) as NominatimResult[];
}

async function geocode(): Promise<void> {
  const schools = (await loadSchools()).filter((s) => s.location == null);
  console.log(`Geocoding ${schools.length} school(s) without a location (OpenStreetMap Nominatim)…`);
  let placed = 0;
  let first = true;
  for (const school of schools) {
    let pick: GeocodePick = { ok: false, reason: 'no query' };
    for (const query of geocodeQueries(school)) {
      if (!first) await sleep(GEOCODE_DELAY_MS);
      first = false;
      pick = pickGeocode(await nominatim(query), school);
      if (pick.ok) break;
    }
    if (!pick.ok) {
      console.log(`  SKIP  ${school.slug}: ${pick.reason}`);
      continue;
    }
    placed++;
    console.log(`  ${pick.precision === 'exact' ? 'EXACT ' : 'APPROX'} ${school.slug}: ${pick.location.lat}, ${pick.location.lng}`);
    if (flag('dry-run')) continue;
    const next: SchoolFile = { ...school, location: pick.location, geocode_precision: pick.precision };
    await writeFile(path.join(DATA_DIR, `${school.slug}.json`), serialise(next), 'utf8');
  }
  console.log(`Placed ${placed} of ${schools.length}${flag('dry-run') ? ' (dry run, nothing written)' : ''}.`);
}

// ---------------------------------------------------------------- wikipedia

async function wikiApi<T>(host: string, params: Record<string, string>): Promise<T> {
  await sleep(WIKI_DELAY_MS);
  const res = await fetch(`https://${host}/w/api.php?${new URLSearchParams({ ...params, format: 'json', formatversion: '2' })}`, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${host} HTTP ${res.status}`);
  return (await res.json()) as T;
}

type PagesReply = { query?: { pages?: { title: string; missing?: boolean; extract?: string; pageprops?: { wikibase_item?: string } }[] } };

async function wikidataItems(ids: string[]): Promise<WikidataItem[]> {
  if (ids.length === 0) return [];
  const reply = await wikiApi<{ entities: Record<string, Parameters<typeof readWikidataItem>[0]> }>('www.wikidata.org', {
    action: 'wbgetentities',
    ids: ids.join('|'),
    props: 'claims|sitelinks',
  });
  return Object.values(reply.entities).map(readWikidataItem);
}

/** Search both Wikipedias for the school by name, alone and with its city; keep only the item that is provably the school. */
async function findArticle(school: SchoolFile): Promise<string | null> {
  const ids = new Set<string>();
  for (const [lang, name] of [['fr', school.name_fr], ['en', school.name_en]] as const) {
    const host = `${lang}.wikipedia.org`;
    const titles = new Set<string>();
    for (const query of [name, `${name} ${school.city}`]) {
      const found = await wikiApi<{ query: { search: { title: string }[] } }>(host, { action: 'query', list: 'search', srsearch: query, srlimit: '5' });
      for (const hit of found.query.search) titles.add(hit.title);
    }
    if (titles.size === 0) continue;
    const props = await wikiApi<PagesReply>(host, { action: 'query', prop: 'pageprops', ppprop: 'wikibase_item', redirects: '1', titles: [...titles].join('|') });
    for (const page of props.query?.pages ?? []) if (page.pageprops?.wikibase_item) ids.add(page.pageprops.wikibase_item);
  }
  const item = pickWikidataItem(school, await wikidataItems([...ids]));
  if (!item) return null;
  return item.titles.fr ? articleUrl('fr', item.titles.fr) : item.titles.en ? articleUrl('en', item.titles.en) : null;
}

/** The school's article in both languages: each one's lead as plain text and its infobox rows. */
async function readArticles(wikipediaUrl: string): Promise<{ url: string; intro: string; infobox: string[] }[]> {
  const { lang, title } = articleOf(wikipediaUrl);
  const props = await wikiApi<PagesReply>(`${lang}.wikipedia.org`, { action: 'query', prop: 'pageprops', ppprop: 'wikibase_item', redirects: '1', titles: title });
  const id = props.query?.pages?.[0]?.pageprops?.wikibase_item;
  const [item] = id ? await wikidataItems([id]) : [];
  const titles = item ? item.titles : { fr: lang === 'fr' ? title : null, en: lang === 'en' ? title : null };
  const out: { url: string; intro: string; infobox: string[] }[] = [];
  for (const l of ['fr', 'en'] as const) {
    const t = titles[l];
    if (!t) continue;
    const host = `${l}.wikipedia.org`;
    const reply = await wikiApi<PagesReply>(host, { action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', redirects: '1', titles: t });
    const intro = reply.query?.pages?.[0]?.extract?.trim();
    if (!intro) continue;
    const source = await wikiApi<{ parse?: { wikitext?: string } }>(host, { action: 'parse', page: t, prop: 'wikitext', section: '0', redirects: '1' });
    out.push({ url: articleUrl(l, t), intro, infobox: infoboxLines(source.parse?.wikitext ?? '') });
  }
  return out;
}

/**
 * Match each school to its Wikipedia article (written to the record: a
 * website or building match settles it, as a postal code settles an
 * address), then pack, for the facts the record lacks, what the article
 * says: its lead for a description (unless the description already comes
 * from Wikipedia), and the lead sentences and infobox rows that state the
 * language, student body or boarding. Answers go through
 * `pnpm research:apply` like any other pack.
 */
async function wiki(): Promise<void> {
  const today = todayInMontreal(new Date());
  const reviewedBySlug = flag('all') ? {} : await readJson<Record<string, string[]>>(REVIEWED_PATH, {});
  await mkdir(PAGES_DIR, { recursive: true });
  const entries: PackEntry[] = [];
  let matched = 0;
  for (const loaded of await loadSchools()) {
    let school = loaded;
    if (!school.wikipedia_url) {
      const url = await findArticle(school);
      if (!url) {
        console.log(`  NONE   ${school.slug}`);
        continue;
      }
      matched++;
      school = { ...school, wikipedia_url: url };
      await writeFile(path.join(DATA_DIR, `${school.slug}.json`), serialise(school), 'utf8');
      console.log(`  MATCH  ${school.slug}: ${url}`);
    }
    const articles = await readArticles(school.wikipedia_url as string);
    const reviewed = new Set(reviewedBySlug[school.slug] ?? []);
    const descriptionSource = school.fact_sources?.description;
    const wantDescription = descriptionSource == null || !isWikipediaUrl(descriptionSource);
    const wanted: [Fact & WikiFact, boolean][] = [
      ['language', school.language == null],
      ['gender', school.gender == null],
      ['boarding', school.has_boarding == null],
    ];
    const items: Evidence[] = [];
    const offer = (fact: Fact, line: string, page: number) => {
      const hash = hashEvidence(fact, [line]);
      if (!reviewed.has(hash) && !items.some((i) => i.hash === hash)) items.push({ fact, lines: [line], page, hash });
    };
    for (const [page, { url, intro, infobox }] of articles.entries()) {
      await writeFile(pageFile(url), [`# ${url}`, intro, ...infobox].join('\n'), 'utf8');
      const lead = leadSentences(intro, Number.POSITIVE_INFINITY);
      if (wantDescription) for (const s of lead.slice(0, LEAD_SENTENCES)) offer('description', s, page);
      for (const [fact, open] of wanted) if (open) for (const line of wikiFactLines(fact, lead, infobox)) offer(fact, line, page);
    }
    const gaps = [...new Set(items.map((i) => i.fact))];
    entries.push({ school, evidence: { gaps, items }, pages: articles.map((a) => a.url), documents: [], failures: [] });
  }

  const pack = renderPack(entries, today);
  const manifest: Manifest = {
    today,
    schools: Object.fromEntries(entries.map((e) => [e.school.slug, { pages: e.pages, shown: e.evidence.items.map((i) => i.hash) }])),
  };
  await writeFile(PACK_PATH, pack, 'utf8');
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const lines = entries.reduce((n, e) => n + e.evidence.items.length, 0);
  console.log(
    `${entries.length} school(s) with a Wikipedia article (${matched} newly matched); ` +
      `pack ≈${tokens(pack.length).toLocaleString()} tokens (${lines} lines to review).\nPack written to ${path.relative(ROOT, PACK_PATH)}`,
  );
}

const commands: Record<string, () => Promise<void>> = { scan, apply, geocode, wiki };
const run = commands[command];
if (!run) {
  console.error(`Unknown command "${command}". Use scan, wiki, apply or geocode.`);
  process.exitCode = 1;
} else {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
