import { describe, it, expect } from 'vitest';
import { htmlToLines } from '@/lib/watch/normalize';
import { addedLines, isDateLine, removedCount } from '@/lib/watch/extract';
import { renderQueue, renderSummary, runScan, type ScanDeps } from '@/lib/watch/scan';
import type { SchoolFile } from '@/lib/schema';

const PAD = '<p>' + 'Bienvenue au collège, une école secondaire privée. '.repeat(6) + '</p>';
const page = (body: string): string => `<html><body><nav>Menu 12 mars</nav>${PAD}${body}<footer>© 2026</footer></body></html>`;

const school = (slug: string, admissions_url: string | null = `https://${slug}.example/admission`) =>
  ({
    slug,
    name_en: slug,
    name_fr: slug,
    admissions_url,
    status: 'draft',
    last_verified_at: '2026-09-12',
    open_days: [{ starts_at: '2027-04-17T11:00:00-04:00', status: 'draft' }],
  }) as unknown as SchoolFile;

describe('htmlToLines', () => {
  it('drops navigation chrome and puts each block on its own line', () => {
    const lines = htmlToLines(page('<div>Portes ouvertes</div><div>samedi 17 avril 2027</div>'));
    expect(lines).toContain('Portes ouvertes');
    expect(lines).toContain('samedi 17 avril 2027');
    expect(lines.join('\n')).not.toContain('Menu');
    expect(lines.join('\n')).not.toContain('©');
  });

  it('is stable under whitespace noise', () => {
    const a = htmlToLines('<body><p>Visite   le\n samedi</p></body>');
    const b = htmlToLines('<body><p>Visite le samedi</p></body>');
    expect(a).toEqual(b);
  });
});

describe('isDateLine', () => {
  it.each([
    'Journée Portes ouvertes Samedi 17 avril 2027 – 11 h à 14 h',
    'Le 1er octobre',
    'Saturday, April 17',
    'De 9 h 30 à 12 h',
    'Doors open 9:30',
    '10 a.m. to 2 p.m.',
  ])('matches %s', (line) => expect(isDateLine(line)).toBe(true));

  it.each(['Notre mission', 'Contactez-nous', 'Frais de scolarité 2026-2027', 'Appelez le 514 555 1234'])(
    'ignores %s',
    (line) => expect(isDateLine(line)).toBe(false),
  );
});

describe('addedLines / removedCount', () => {
  it('ignores reordering and reports only genuinely new lines', () => {
    expect(addedLines(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual([]);
    expect(addedLines(['a', 'b'], ['a', 'x', 'b', 'y'])).toEqual(['x', 'y']);
    expect(removedCount(['a', 'b', 'c'], ['a'])).toBe(2);
  });
});

type Spy = ScanDeps & { baselines: string[]; pending: string[]; cleared: string[] };

function makeDeps(
  pages: Record<string, string | null>,
  snapshots: Record<string, string>,
): Spy {
  const spy: Spy = {
    baselines: [],
    pending: [],
    cleared: [],
    fetchPage: async (url) => {
      const html = pages[url];
      return html == null ? { ok: false, reason: 'HTTP 403' } : { ok: true, html };
    },
    readSnapshot: async (slug) => snapshots[slug] ?? null,
    writeBaseline: async (slug) => void spy.baselines.push(slug),
    writePending: async (slug) => void spy.pending.push(slug),
    clearPending: async (slug) => void spy.cleared.push(slug),
    delay: async () => {},
  };
  return spy;
}

const snapshotOf = (html: string): string => htmlToLines(html).join('\n') + '\n';

describe('runScan', () => {
  it('baselines a first sighting without reporting a change', async () => {
    const s = school('a');
    const deps = makeDeps({ [s.admissions_url!]: page('<p>Rien</p>') }, {});
    const { entries } = await runScan([s], deps);
    expect(entries[0].status).toBe('baseline');
    expect(deps.baselines).toEqual(['a']);
    expect(deps.pending).toEqual([]);
  });

  it('reports an unchanged page and clears any stale pending file', async () => {
    const s = school('a');
    const html = page('<p>Rien</p>');
    const deps = makeDeps({ [s.admissions_url!]: html }, { a: snapshotOf(html) });
    const { entries } = await runScan([s], deps);
    expect(entries[0].status).toBe('unchanged');
    expect(deps.cleared).toEqual(['a']);
  });

  it('keeps the baseline untouched and parks a changed page as pending', async () => {
    const s = school('a');
    const deps = makeDeps(
      { [s.admissions_url!]: page('<p>Portes ouvertes le 24 octobre, 9 h à 12 h</p>') },
      { a: snapshotOf(page('<p>Rien</p>')) },
    );
    const { entries } = await runScan([s], deps);
    const e = entries[0];
    expect(e.status).toBe('changed');
    if (e.status === 'changed') expect(e.dateLines).toEqual(['Portes ouvertes le 24 octobre, 9 h à 12 h']);
    expect(deps.pending).toEqual(['a']);
    expect(deps.baselines).toEqual([]);
  });

  it('fails closed on HTTP errors, thin pages and missing URLs', async () => {
    const blocked = school('blocked');
    const thin = school('thin');
    const none = school('none', null);
    const deps = makeDeps({ [thin.admissions_url!]: '<html><body>ok</body></html>' }, {});
    const { entries } = await runScan([blocked, thin, none], deps);
    expect(entries.map((e) => e.status)).toEqual(['failed', 'failed', 'failed']);
    expect(entries[0]).toMatchObject({ reason: 'HTTP 403' });
    expect(entries[1]).toMatchObject({ reason: expect.stringContaining('thin') });
    expect(deps.baselines).toEqual([]);
  });
});

describe('renderQueue', () => {
  it('lists date lines and known events for changes, only slugs for quiet changes', async () => {
    const a = school('a');
    const b = school('b');
    const deps = makeDeps(
      {
        [a.admissions_url!]: page('<p>Portes ouvertes le 24 octobre, 9 h à 12 h</p>'),
        [b.admissions_url!]: page('<p>Nouvelle politique de confidentialité</p>'),
      },
      { a: snapshotOf(page('')), b: snapshotOf(page('')) },
    );
    const result = await runScan([a, b], deps);
    const queue = renderQueue(result, [a, b], '2026-10-12');
    expect(queue).toContain('## a — a');
    expect(queue).toContain('- Portes ouvertes le 24 octobre, 9 h à 12 h');
    expect(queue).toContain('2027-04-17T11:00:00-04:00 (draft)');
    expect(queue).toContain('## Changed, no date or time added\nb');
    expect(queue).not.toContain('politique');
  });

  it('says so plainly when there is nothing to review', async () => {
    const queue = renderQueue({ entries: [] }, [], '2026-10-12');
    expect(queue).toContain('Nothing to review');
  });
});

describe('renderSummary', () => {
  it('prints counts and each failure reason', () => {
    const out = renderSummary({
      entries: [
        { slug: 'a', url: 'u', status: 'unchanged' },
        { slug: 'b', url: 'u', status: 'failed', reason: 'HTTP 403' },
      ],
    });
    expect(out).toContain('Scanned 2: 1 unchanged, 0 changed, 0 baselined, 1 failed.');
    expect(out).toContain('FAILED b: HTTP 403');
  });
});
