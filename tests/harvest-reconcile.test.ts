import { describe, it, expect } from 'vitest';
import { reconcile, normaliseName } from '@/lib/harvest/reconcile';
import type { ListingEntry, ListingEvent } from '@/lib/harvest/types';
import type { SchoolFile } from '@/lib/schema';

const TODAY = '2026-09-03';

const event = (over: Partial<ListingEvent> = {}): ListingEvent => ({
  date: '2026-10-10',
  startTime: '10:00',
  endTime: '15:00',
  rawDate: '10 octobre 2026',
  noteFr: null,
  ...over,
});

const entry = (over: Partial<ListingEntry> = {}): ListingEntry => ({
  feepSlug: 'new-school',
  nameFr: 'Nouvelle École',
  region: 'montreal_island',
  externalUrl: 'https://new.qc.ca',
  events: [event()],
  ...over,
});

const existing = (
  slug: string,
  nameFr: string,
  status: 'published' | 'draft' | 'archived',
): SchoolFile => ({ slug, name_fr: nameFr, name_en: nameFr, status }) as SchoolFile;

describe('normaliseName', () => {
  it('strips accents, case, and punctuation', () => {
    expect(normaliseName('Collège Jean-de-Brébeuf')).toBe(normaliseName('college jean de brebeuf'));
  });

  it('does not collapse genuinely different schools', () => {
    expect(normaliseName('Collège Sainte-Anne')).not.toBe(normaliseName('Collège Sainte-Marcelline'));
  });
});

describe('reconcile', () => {
  it('creates a school it has never seen', () => {
    const out = reconcile([entry()], [], TODAY);
    expect(out).toEqual([{ kind: 'create', slug: 'new-school', entry: entry() }]);
  });

  it('SKIPS a school whose file is already published', () => {
    const out = reconcile(
      [entry({ feepSlug: 'villa-maria', nameFr: 'Villa Maria' })],
      [existing('villa-maria', 'Villa Maria', 'published')],
      TODAY,
    );
    expect(out).toEqual([
      {
        kind: 'skip',
        slug: 'villa-maria',
        reason:
          'already published — a human verified this; never machine-overwrite a published file',
      },
    ]);
  });

  it('SKIPS a school whose file is archived, without resurrecting it', () => {
    const out = reconcile(
      [entry({ feepSlug: 'closed-school', nameFr: 'École Fermée' })],
      [existing('closed-school', 'École Fermée', 'archived')],
      TODAY,
    );
    expect(out).toEqual([
      {
        kind: 'skip',
        slug: 'closed-school',
        reason:
          'existing file is archived — a human retired this school; not resurrecting it without review',
      },
    ]);
  });

  it('flags a CONFLICT when FEEP uses a different slug for a school we already hold', () => {
    const out = reconcile(
      [entry({ feepSlug: 'college-jean-de-brebeuf-montreal', nameFr: 'Collège Jean-de-Brébeuf' })],
      [existing('college-jean-de-brebeuf', 'Collège Jean-de-Brébeuf', 'published')],
      TODAY,
    );
    expect(out).toEqual([
      {
        kind: 'conflict',
        slug: 'college-jean-de-brebeuf-montreal',
        existingSlug: 'college-jean-de-brebeuf',
        reason:
          'FEEP slug differs from ours for what looks like the same school — adjudicate before writing',
      },
    ]);
  });

  it('re-creates a school whose existing file is still a draft', () => {
    const out = reconcile([entry()], [existing('new-school', 'Nouvelle École', 'draft')], TODAY);
    expect(out[0].kind).toBe('create');
  });

  it('skips an entry with no future dated event', () => {
    const out = reconcile(
      [entry({ events: [event({ date: null, startTime: null, endTime: null, rawDate: 'Sur rendez-vous' })] })],
      [],
      TODAY,
    );
    expect(out).toEqual([
      { kind: 'skip', slug: 'new-school', reason: 'no usable event — no parseable date' },
    ]);
  });

  it('skips an entry whose only event is in the past', () => {
    const out = reconcile(
      [entry({ events: [event({ date: '2024-10-05', rawDate: '5 octobre 2024' })] })],
      [],
      TODAY,
    );
    expect(out).toEqual([
      { kind: 'skip', slug: 'new-school', reason: 'all events are in the past — stale FEEP entry' },
    ]);
  });

  it('skips an event that has a date but no time (R10)', () => {
    const out = reconcile(
      [
        entry({
          events: [event({ date: '2026-10-24', startTime: null, endTime: null, rawDate: '24 octobre 2026' })],
        }),
      ],
      [],
      TODAY,
    );
    expect(out).toEqual([
      { kind: 'skip', slug: 'new-school', reason: 'no published time — refusing to guess (R10)' },
    ]);
  });

  it('skips a FEEP entry outside Greater Montreal (region: null)', () => {
    const out = reconcile([entry({ region: null, feepSlug: 'college-de-quebec' })], [], TODAY);
    expect(out).toEqual([
      {
        kind: 'skip',
        slug: 'college-de-quebec',
        reason: 'no Greater Montreal region — out of scope for this site',
      },
    ]);
  });

  it('preserves every qualifying event on a multi-event entry, not just the first', () => {
    // Modeled on Azrieli / Lower Canada College: several dates, all future and timed.
    const first = event({ date: '2026-10-10', startTime: '09:00', endTime: '11:00', rawDate: 'a' });
    const second = event({ date: '2026-11-14', startTime: '13:00', endTime: '16:00', rawDate: 'b' });
    const out = reconcile([entry({ events: [first, second] })], [], TODAY);
    expect(out[0].kind).toBe('create');
    if (out[0].kind === 'create') {
      expect(out[0].entry.events).toEqual([first, second]);
    }
  });

  it('keeps two same-day events at different times as distinct entries', () => {
    // Modeled on Lower Canada College: two sessions on the same date.
    const morning = event({ date: '2026-10-17', startTime: '09:00', endTime: '11:00', rawDate: 'am' });
    const afternoon = event({ date: '2026-10-17', startTime: '13:00', endTime: '15:00', rawDate: 'pm' });
    const out = reconcile([entry({ events: [morning, afternoon] })], [], TODAY);
    expect(out[0].kind).toBe('create');
    if (out[0].kind === 'create') {
      expect(out[0].entry.events).toEqual([morning, afternoon]);
      expect(out[0].entry.events).toHaveLength(2);
    }
  });

  it('drops only the disqualified events from a mixed multi-event entry, keeping the rest', () => {
    const past = event({ date: '2024-01-01', rawDate: 'past' });
    const untimed = event({ date: '2026-12-01', startTime: null, endTime: null, rawDate: 'untimed' });
    const good = event({ date: '2026-12-15', startTime: '18:00', endTime: '20:00', rawDate: 'good' });
    const out = reconcile([entry({ events: [past, untimed, good] })], [], TODAY);
    expect(out[0].kind).toBe('create');
    if (out[0].kind === 'create') {
      expect(out[0].entry.events).toEqual([good]);
    }
  });

  it('SKIPS every entry after the first that shares a feepSlug within the same call', () => {
    // A region-boundary school FEEP double-lists, or a markup bug: both entries
    // independently qualify as `create`, but they target the same filename.
    const firstListing = entry({ feepSlug: 'dup-school', nameFr: 'École Un' });
    const secondListing = entry({ feepSlug: 'dup-school', nameFr: 'École Deux' });
    const out = reconcile([firstListing, secondListing], [], TODAY);
    expect(out).toEqual([
      { kind: 'create', slug: 'dup-school', entry: firstListing },
      {
        kind: 'skip',
        slug: 'dup-school',
        reason:
          'duplicate FEEP slug "dup-school" within this harvest run — an earlier entry already claims this filename',
      },
    ]);
  });
});
