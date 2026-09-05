import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseListing } from '@/lib/harvest/parse-listing';
import type { ListingEntry } from '@/lib/harvest/types';

let entries: ListingEntry[];

beforeAll(() => {
  const html = readFileSync(
    path.join(process.cwd(), 'tests/fixtures/feep/listing-montreal.html'),
    'utf8',
  );
  entries = parseListing(html);
});

const find = (fragment: string): ListingEntry => {
  const hit = entries.find((e) => e.nameFr.includes(fragment));
  if (!hit) throw new Error(`no entry matching "${fragment}"`);
  return hit;
};

describe('parseListing', () => {
  it('finds a substantial number of schools', () => {
    expect(entries.length).toBeGreaterThan(80);
  });

  it('assigns every entry a non-empty French name and FEEP slug', () => {
    for (const e of entries) {
      expect(e.nameFr.length).toBeGreaterThan(0);
      expect(e.feepSlug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('parses a date and a time range', () => {
    const [ev] = find('Regina Assumpta').events;
    expect(ev.date).toBe('2026-09-12');
    expect(ev.startTime).toBe('09:00');
    expect(ev.endTime).toBe('14:30');
  });

  it('parses a 24-hour-crossing afternoon range correctly', () => {
    const [ev] = find('Français Secondaire Montréal').events;
    expect(ev.date).toBe('2026-10-04');
    expect(ev.startTime).toBe('13:00');
    expect(ev.endTime).toBe('16:00');
  });

  it('parses a non-round end time', () => {
    const [ev] = find('Marie de France').events;
    expect(ev.date).toBe('2026-09-26');
    expect(ev.endTime).toBe('13:15');
  });

  it('returns null date for "Sur rendez-vous"', () => {
    const [ev] = find('Marie-Claire').events;
    expect(ev.date).toBeNull();
    expect(ev.rawDate).toMatch(/rendez-vous/i);
  });

  it('returns null times when only a date is published', () => {
    const entry = find('Dorval');
    const ev = entry.events[0];
    expect(ev.date).toBe('2026-10-03');
    expect(ev.startTime).toBeNull();
  });

  it('assigns the region from the listing grouping', () => {
    expect(find('Regina Assumpta').region).toBe('montreal_island');
  });
});
