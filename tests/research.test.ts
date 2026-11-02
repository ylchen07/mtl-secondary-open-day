import { describe, expect, it } from 'vitest';
import { applyAnswers, type Manifest } from '@/lib/research/apply';
import { collectEvidence, datesIn, gapsFor, hashEvidence } from '@/lib/research/evidence';
import { geocodeQueries, pickGeocode } from '@/lib/research/geocode';
import { addLedgerRows } from '@/lib/research/ledger';
import { isAllowed, parseRobots, pickLinks, readSitemap, sitemapsIn } from '@/lib/research/links';
import { htmlToLines } from '@/lib/research/normalize';
import { readPage, type PageFacts } from '@/lib/research/page';
import type { SchoolFile } from '@/lib/schema';

const TODAY = '2026-11-01';

function draft(over: Partial<SchoolFile> = {}): SchoolFile {
  return {
    slug: 'college-test', name_en: 'Collège Test', name_fr: 'Collège Test', language: 'fr', gender: 'mixed',
    sector: 'private', region: 'montreal_island', city: 'Montréal',
    address: '3535, boulevard Rosemont, Montréal, QC H1X 1K7', postal_code: 'H1X 1K7',
    location: null, geocode_precision: 'missing', website_url: 'https://test.qc.ca/',
    admissions_url: 'https://test.qc.ca/admission/', tuition_annual_cad: null, has_boarding: null,
    programs: [], description_en: null, description_fr: null, source_url: 'https://test.qc.ca/',
    last_verified_at: '2026-10-01', status: 'draft', open_days: [], ...over,
  } as SchoolFile;
}

const page = (url: string, lines: string[], extra: Partial<PageFacts> = {}): PageFacts => ({
  url, lines, description: null, jsonLdEvents: [], links: [], ...extra,
});

describe('htmlToLines', () => {
  it('drops navigation chrome and puts each block on its own line', () => {
    const lines = htmlToLines('<body><nav>Menu 12 mars</nav><div>Portes ouvertes</div><div>samedi 17 avril 2027</div><footer>© 2026</footer></body>');
    expect(lines).toEqual(['Portes ouvertes', 'samedi 17 avril 2027']);
  });

  it('strips invisible zero-width padding', () => {
    expect(htmlToLines('<body><p>Portes\u200b ouvertes\u200d\ufeff</p></body>')).toEqual(['Portes ouvertes']);
  });

  it('is stable under whitespace noise', () => {
    expect(htmlToLines('<body><p>Visite   le\n samedi</p></body>')).toEqual(htmlToLines('<body><p>Visite le samedi</p></body>'));
  });
});

describe('readPage', () => {
  it('keeps the meta summary, JSON-LD events and absolute navigation links', () => {
    const facts = readPage(
      `<html><head><meta property="og:description" content="  Collège privé mixte. ">
       <script type="application/ld+json">{"@graph":[{"@type":"Event","name":"Portes ouvertes","startDate":"2027-04-17T11:00:00-04:00"}]}</script>
       <script type="application/ld+json">{not json</script></head>
       <body><nav><a href="/admission/#top">Admission</a><a href="mailto:x@y.z">Mail</a><a href="/admission/">Again</a></nav></body></html>`,
      'https://test.qc.ca/fr/',
    );
    expect(facts.description).toBe('Collège privé mixte.');
    expect(facts.jsonLdEvents).toEqual([{ name: 'Portes ouvertes', startDate: '2027-04-17T11:00:00-04:00', endDate: null }]);
    expect(facts.links).toEqual([{ href: 'https://test.qc.ca/admission/', text: 'Admission' }]);
  });

  it('recovers text a Next.js page streams for a closed accordion, without its references and props', () => {
    const push = (s: string) => `<script>self.__next_f.push([1,${JSON.stringify(s)}])</script>`;
    const html = `<body><p>Frais</p>${push('73:T1fb6,')}${push('Frais de scolarité :')}${push('aa:T233d,')}${push(' 8\u200b 100 $')}${push('Tuition: $8,100')}${push('["$","div",null,{}]')}</body>`;
    expect(readPage(html, 'https://test.qc.ca/').lines).toEqual(['Frais', 'Frais de scolarité :', '8 100 $', 'Tuition: $8,100']);
  });
});

describe('pickLinks', () => {
  const links = [
    { href: 'https://test.qc.ca/nous-joindre/', text: 'Nous joindre' },
    { href: 'https://test.qc.ca/portes-ouvertes/', text: 'Portes ouvertes' },
    { href: 'https://portes.test.qc.ca/inscription', text: 'Inscription' },
    { href: 'https://other.ca/portes-ouvertes/', text: 'Portes ouvertes' },
    { href: 'https://test.qc.ca/calendrier-admission.pdf', text: 'Calendrier admission' },
    { href: 'https://test.qc.ca/sports/', text: 'Sports' },
    { href: 'https://test.qc.ca/droits-de-scolarite/', text: 'Droits de scolarité' },
  ];
  const seen = new Set(['https://test.qc.ca/nous-joindre/']);

  it('ranks admission pages first, keeps subdomains, and returns documents apart', () => {
    const picked = pickLinks(links, 'https://www.test.qc.ca/', seen, 2, ['events']);
    expect(picked.pages).toEqual(['https://test.qc.ca/portes-ouvertes/', 'https://portes.test.qc.ca/inscription']);
    expect(picked.documents).toEqual(['https://test.qc.ca/calendrier-admission.pdf']);
  });

  it('reserves a slot for each open gap before filling by score', () => {
    const picked = pickLinks(links, 'https://www.test.qc.ca/', seen, 2, ['events', 'tuition']);
    expect(picked.pages).toEqual(['https://test.qc.ca/portes-ouvertes/', 'https://test.qc.ca/droits-de-scolarite/']);
  });

  it('ignores links that only serve a fact already on file', () => {
    expect(pickLinks(links, 'https://www.test.qc.ca/', new Set(), 5, ['tuition']).pages).not.toContain('https://test.qc.ca/nous-joindre/');
  });
});

describe('robots.txt', () => {
  it('applies only the rules for every crawler, including shared agent groups', () => {
    const rules = parseRobots('User-agent: Googlebot\nDisallow: /g\n\nUser-agent: Bing\nUser-agent: *\nDisallow: /wp-admin/\nDisallow:\n');
    expect(rules).toEqual(['/wp-admin/']);
    expect(isAllowed('https://test.qc.ca/wp-admin/x', rules)).toBe(false);
    expect(isAllowed('https://test.qc.ca/admission/', rules)).toBe(true);
  });
});

describe('datesIn', () => {
  it('reads French and English dates and never guesses a missing year', () => {
    expect(datesIn('Examen le samedi 1er octobre 2026 et le 28 novembre')).toEqual([
      { day: 1, month: 10, year: 2026 },
      { day: 28, month: 11, year: null },
    ]);
    expect(datesIn('Open house: Saturday, April 17th, 2027')).toEqual([{ day: 17, month: 4, year: 2027 }]);
    expect(datesIn('Frais de scolarité 2026-2027')).toEqual([]);
  });
});

describe('gapsFor', () => {
  it('only looks for what the record is missing', () => {
    expect(gapsFor(draft())).toEqual(['events', 'address', 'language', 'gender', 'tuition', 'description']);
    expect(gapsFor(draft({ status: 'published', tuition_annual_cad: 5000, description_en: 'x', description_fr: 'y' }))).toEqual(['events']);
  });
});

describe('collectEvidence', () => {
  const published = draft({
    status: 'published',
    open_days: [{
      starts_at: '2027-04-17T11:00:00-04:00', ends_at: '2027-04-17T14:00:00-04:00', type: 'open_house',
      academic_year: '2028-2029', registration_required: null, source_url: 'https://test.qc.ca/',
      last_verified_at: TODAY, status: 'published',
    }],
  });
  const lines = [
    'Portes ouvertes 2025 : samedi 12 avril 2025 de 11 h à 14 h',
    'Portes ouvertes : samedi 17 avril 2027',
    'Examen d’admission',
    'Samedi 3 octobre 2027',
    'De 8 h 30 à 12 h',
    'Nos portes ouvertes se sont déroulées le samedi 2 mai dernier.',
    'Examens d’admission au primaire — samedi 16 janvier 2027, de 9h à 11h',
    'La date limite des demandes d’admission est le 13 décembre 2026.',
    'Visite du 28 novembre',
    'Tournoi de soccer le 9 mai 2027',
    'Portes ouvertes le samedi 12 septembre, de 9 h à 13 h',
  ];

  it('keeps only future dates not already on file, joined to their heading and times', () => {
    const items = collectEvidence(published, [page('https://test.qc.ca/po/', lines)], TODAY).items;
    expect(items.map((i) => i.lines)).toEqual([
      ['Examen d’admission', 'Samedi 3 octobre 2027', 'De 8 h 30 à 12 h'],
      ['Visite du 28 novembre'],
    ]);
  });

  it('does not backfill a reviewed fact with weaker lines', () => {
    const many = Array.from({ length: 7 }, (_, i) => `Collège mixte pour filles et garçons, groupe ${i + 1}`);
    const first = collectEvidence(draft(), [page('https://test.qc.ca/', many)], TODAY).items.filter((i) => i.fact === 'gender');
    expect(first).toHaveLength(5);
    const again = collectEvidence(draft(), [page('https://test.qc.ca/', many)], TODAY, new Set(first.map((i) => i.hash)));
    expect(again.items.filter((i) => i.fact === 'gender')).toEqual([]);
  });

  it('never shows a line again once it was reviewed', () => {
    const reviewed = new Set([hashEvidence('events', ['Visite du 28 novembre'])]);
    const items = collectEvidence(published, [page('https://test.qc.ca/po/', lines)], TODAY, reviewed).items;
    expect(items.map((i) => i.lines[0])).toEqual(['Examen d’admission']);
  });

  it('settles the address without review when the postal code is on the site, and dedupes repeated lines', () => {
    const banner = 'Collège privé mixte pour filles et garçons';
    const result = collectEvidence(draft(), [
      page('https://test.qc.ca/', [banner, 'Montréal H1X 1K7']),
      page('https://test.qc.ca/admission/', [banner]),
    ], TODAY);
    expect(result.settled).toEqual(['address: postal code H1X 1K7 appears on [p1]']);
    expect(result.items.filter((i) => i.fact === 'gender').map((i) => i.lines)).toEqual([[banner]]);
    expect(result.items.some((i) => i.fact === 'address')).toBe(false);
  });

  it('cuts a long paragraph down to the sentences that match', () => {
    const paragraph = `${'Notre histoire commence en 1950 avec une petite équipe. '.repeat(4)}La langue d’enseignement est le français. Nous offrons des sports.`;
    const items = collectEvidence(draft(), [page('https://test.qc.ca/', [paragraph])], TODAY).items;
    expect(items.filter((i) => i.fact === 'language').map((i) => i.lines)).toEqual([['La langue d’enseignement est le français.']]);
  });

  it('reads a fees table: label and amount rows under a Secondary 1 heading, other levels dropped', () => {
    const fees = [
      'Kindergarten', 'Tuition: $18,000',
      'Grade 7', 'Tuition & Fees', 'Tuition: $28,830',
      'Préscolaire Primaire Secondaire', 'Droits de scolarité¹', '(services éducatifs) 7 050 $ 4 510 $ 5 335 $',
    ];
    const items = collectEvidence(draft(), [page('https://test.qc.ca/frais/', fees)], TODAY).items;
    expect(items.filter((i) => i.fact === 'tuition').map((i) => i.lines)).toEqual([
      ['Grade 7', 'Tuition: $28,830'],
      ['Préscolaire Primaire Secondaire', 'Droits de scolarité¹', '(services éducatifs) 7 050 $ 4 510 $ 5 335 $'],
    ]);
  });

  it('reads a flattened fees header row as one heading', () => {
    const fees = ['Items', 'Grades 7 – 10', 'Grade 11', 'Tuition', '$10,050', 'Ancillary Fee', '$5,300'];
    const items = collectEvidence(draft(), [page('https://test.qc.ca/fees/', fees)], TODAY).items;
    expect(items.filter((i) => i.fact === 'tuition').map((i) => i.lines)).toEqual([['Grades 7 – 10', 'Grade 11', 'Tuition', '$10,050']]);
  });

  it('takes a school saying what it is from any page, ahead of other summaries', () => {
    const about = page('https://test.qc.ca/a-propos/', ['Le Collège Test est un milieu de vie dynamique et stimulant pour tous les élèves du secondaire.']);
    const admission = page('https://test.qc.ca/admission/', [
      'Le Collège Test est un établissement d’enseignement secondaire privé francophone situé au pied du mont.',
      'Un établissement privé francophone mixte d’enseignement reconnu par le ministère de l’Éducation',
    ]);
    const items = collectEvidence(draft(), [about, admission], TODAY).items.filter((i) => i.fact === 'description');
    expect(items.map((i) => i.lines[0])).toEqual([
      'Le Collège Test est un établissement d’enseignement secondaire privé francophone situé au pied du mont.',
      'Un établissement privé francophone mixte d’enseignement reconnu par le ministère de l’Éducation',
      'Le Collège Test est un milieu de vie dynamique et stimulant pour tous les élèves du secondaire.',
    ]);
  });
});

describe('applyAnswers', () => {
  const manifest: Manifest = { today: TODAY, schools: { 'college-test': { pages: ['https://test.qc.ca/po/'], shown: ['abc'] } } };
  const text = '# https://test.qc.ca/po/\nÉcole secondaire privée pour filles\nPortes ouvertes : samedi 17 avril 2027, de 11 h à 14 h';
  const read = (url: string) => (url === 'https://test.qc.ca/po/' ? text : null);
  const event = {
    type: 'open_house', starts_at: '2027-04-17T11:00:00-04:00', ends_at: '2027-04-17T14:00:00-04:00',
    academic_year: '2028-2029', registration_required: null, notes_en: null, notes_fr: null, status: 'draft',
    quote: 'samedi 17 avril 2027, de 11 h à 14 h', page: 1,
  };

  it('writes cited facts and events with their source and marks the shown lines reviewed', () => {
    const result = applyAnswers([draft()], {
      'college-test': { gender: { value: 'girls', quote: 'privée  pour filles', page: 1 }, events: [event] },
    }, manifest, read, TODAY);
    expect(result.errors).toEqual([]);
    expect(result.updated[0].gender).toBe('girls');
    expect(result.updated[0].last_verified_at).toBe(TODAY);
    expect(result.updated[0].open_days[0]).toMatchObject({ source_url: 'https://test.qc.ca/po/', last_verified_at: TODAY, status: 'draft' });
    expect(result.reviewed).toEqual({ 'college-test': ['abc'] });
  });

  it('rejects the whole school when one quote is not on the cited page', () => {
    const result = applyAnswers([draft()], {
      'college-test': { gender: { value: 'girls', quote: 'pour filles', page: 1 }, language: { value: 'en', quote: 'English instruction', page: 1 } },
    }, manifest, read, TODAY);
    expect(result.updated).toEqual([]);
    expect(result.reviewed).toEqual({});
    expect(result.errors).toEqual(['college-test: language: quote not found on p1: «English instruction»']);
  });

  it('rejects an event already on file and an event the schema refuses', () => {
    const onFile = draft({ open_days: [{ ...event, quote: undefined, page: undefined, source_url: 'https://test.qc.ca/po/', last_verified_at: TODAY } as never] });
    const dup = applyAnswers([onFile], { 'college-test': { events: [event] } }, manifest, read, TODAY);
    expect(dup.errors[0]).toContain('already on file');
    const bad = applyAnswers([draft()], { 'college-test': { events: [{ ...event, ends_at: '2027-04-17T10:00:00-04:00' }] } }, manifest, read, TODAY);
    expect(bad.errors[0]).toContain('starts_at must be before ends_at');
  });

  it("keeps a draft school's events draft", () => {
    const result = applyAnswers([draft()], { 'college-test': { events: [{ ...event, status: 'published' }] } }, manifest, read, TODAY);
    expect(result.errors).toEqual(["college-test: events[0]: a draft school's events stay draft"]);
  });

  it('records an empty answer as reviewed without touching the file', () => {
    const result = applyAnswers([draft()], { 'college-test': {} }, manifest, read, TODAY);
    expect(result.updated).toEqual([]);
    expect(result.reviewed).toEqual({ 'college-test': ['abc'] });
  });
});

describe('geocodeQueries', () => {
  it('always names the city, once', () => {
    expect(geocodeQueries({ address: '12630, boulevard Gouin Est', city: 'Montréal', postal_code: 'H1C 1C1' })).toEqual([
      '12630, boulevard Gouin Est, Montréal H1C 1C1',
      '12630, boulevard Gouin Est, Montréal',
    ]);
    expect(geocodeQueries({ address: '9155, boulevard Gouin Ouest, Montréal, QC H4K 1C3', city: 'Montréal', postal_code: 'H4K 1C3' })[1]).toBe(
      '9155, boulevard Gouin Ouest, Montréal, QC',
    );
  });
});

describe('readSitemap', () => {
  it('follows page sitemaps of an index, skips news and taxonomies, and drops dated posts', () => {
    expect(sitemapsIn('User-agent: *\nSitemap: https://test.qc.ca/sitemap_index.xml\n')).toEqual(['https://test.qc.ca/sitemap_index.xml']);
    const index = '<sitemapindex><sitemap><loc>https://test.qc.ca/page-sitemap.xml</loc></sitemap><sitemap><loc>https://test.qc.ca/post-sitemap.xml</loc></sitemap><sitemap><loc>https://test.qc.ca/wp-sitemap-taxonomies-category-1.xml</loc></sitemap></sitemapindex>';
    expect(readSitemap(index)).toEqual({ pages: [], sitemaps: ['https://test.qc.ca/page-sitemap.xml'] });
    const pages = '<urlset><url><loc>https://test.qc.ca/frais-de-scolarite/</loc></url><url><loc>https://test.qc.ca/2018/03/01/tirage-de-droits-de-scolarite/</loc></url></urlset>';
    expect(readSitemap(pages)).toEqual({ pages: ['https://test.qc.ca/frais-de-scolarite/'], sitemaps: [] });
  });
});

describe('pickGeocode', () => {
  const school = { address: '3535, rue Test', city: 'Montréal', postal_code: 'H1X 1K7' };

  it('refuses results outside Greater Montreal or in another postal area', () => {
    expect(pickGeocode([{ lat: '46.8', lon: '-71.2', address: { postcode: 'H1X 1K7' } }], school)).toEqual({ ok: false, reason: 'result outside Greater Montreal' });
    expect(pickGeocode([{ lat: '45.55', lon: '-73.58', address: { postcode: 'H2X 1A1' } }], school).ok).toBe(false);
  });

  it('is exact only for a numbered building with the full postal code', () => {
    const exact = pickGeocode([{ lat: '45.556789', lon: '-73.58', address: { house_number: '3535', postcode: 'H1X1K7' } }], school);
    expect(exact).toMatchObject({ ok: true, precision: 'exact', location: { lat: 45.55679, lng: -73.58 } });
    expect(pickGeocode([{ lat: '45.55', lon: '-73.58', address: { postcode: 'H1X 2B2' } }], school)).toMatchObject({ ok: true, precision: 'approximate' });
  });

  it('accepts the same building under a postal code OSM got wrong, as approximate', () => {
    const building = { house_number: '3535;3545', road: 'Rue Test', city: 'Montréal', postcode: 'J6V 1B5' };
    expect(pickGeocode([{ lat: '45.55', lon: '-73.58', address: building }], school)).toMatchObject({ ok: true, precision: 'approximate' });
    expect(pickGeocode([{ lat: '45.55', lon: '-73.58', address: { ...building, city: 'Laval' } }], school).ok).toBe(false);
    expect(pickGeocode([{ lat: '45.55', lon: '-73.58', address: { ...building, house_number: '3536' } }], school).ok).toBe(false);
  });
});

describe('addLedgerRows', () => {
  const ledger = [
    '## Event field audit rows (1)', '', '| File | x |', '|---|---|', '| `a.json` | old |', '',
    '## Publication-critical matrix', '', '| Kind | Identity |', '|---|---|', '| event | `a` |', '- note', '',
    '## Mechanical coverage summary',
  ].join('\n');
  const event = {
    type: 'open_house', starts_at: '2027-09-18T10:00:00-04:00', ends_at: '2027-09-18T14:00:00-04:00',
    academic_year: '2028-2029', registration_required: null, source_url: 'https://test.qc.ca/po/',
    last_verified_at: TODAY, status: 'published',
  } as SchoolFile['open_days'][number];

  it('adds an event row, a matrix row for a published event, and bumps the row count', () => {
    const out = addLedgerRows(ledger, [{ slug: 'b', event, quote: 'Samedi | 18 septembre', url: 'https://test.qc.ca/po/' }], TODAY).split('\n');
    expect(out[0]).toBe('## Event field audit rows (2)');
    expect(out[5]).toBe('| `b.json` | `registration_required` | `2027-09-18T10:00:00-04:00 + open_house` | `null` | `null` | `unsupported-negative` | https://test.qc.ca/po/ | Research apply 2026-11-01: «Samedi / 18 septembre» |');
    expect(out[12]).toBe('| event | `b|2027-09-18T10:00:00-04:00|open_house` | PASS | https://test.qc.ca/po/ | Research apply 2026-11-01: «Samedi / 18 septembre» |');
    expect(out[13]).toBe('- note');
  });

  it('adds no matrix row for a draft event', () => {
    const out = addLedgerRows(ledger, [{ slug: 'b', event: { ...event, status: 'draft' }, quote: 'q', url: 'u' }], TODAY);
    expect(out.match(/\| PASS \|/g)).toBeNull();
  });
});
