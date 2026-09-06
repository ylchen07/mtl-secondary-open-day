import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseListing, isSchoolOwnUrl } from '@/lib/harvest/parse-listing';
import type { ListingEntry } from '@/lib/harvest/types';

let entries: ListingEntry[];

beforeAll(() => {
  const html = readFileSync(
    path.join(process.cwd(), 'tests/fixtures/feep/listing-montreal.html'),
    'utf8',
  );
  entries = parseListing(html);
});

/**
 * Look up exactly one entry by name fragment.
 *
 * Throws on AMBIGUITY as well as absence. FEEP lists sibling campuses under
 * near-identical names — "Dorval" alone matches both the préscolaire-primaire
 * and the secondaire campus of Collège Sainte-Anne, which publish different
 * dates. A first-match helper would silently bind an assertion to whichever
 * campus FEEP happened to render first, so a reordering upstream would change
 * what the test means rather than fail. Ambiguity is a test defect here, not a
 * lookup detail.
 */
const find = (fragment: string): ListingEntry => {
  const hits = entries.filter((e) => e.nameFr.includes(fragment));
  if (hits.length === 0) throw new Error(`no entry matching "${fragment}"`);
  if (hits.length > 1) {
    throw new Error(
      `ambiguous fragment "${fragment}" matched ${hits.length} entries: ${hits
        .map((h) => h.nameFr)
        .join(' | ')}`,
    );
  }
  return hits[0];
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
    const entry = find('préscolaire-primaire Dorval');
    const ev = entry.events[0];
    expect(ev.date).toBe('2026-10-03');
    expect(ev.startTime).toBeNull();
  });

  it('assigns the region from the listing grouping', () => {
    expect(find('Regina Assumpta').region).toBe('montreal_island');
  });

  it('skips Calendly booking link and picks the school homepage for Vision Terrebonne', () => {
    const entry = find('Trilingue Vision Terrebonne');
    expect(entry.externalUrl).toBe('https://ecolevision.com/medias/documents/TER_ProcedureAdmission-Primaire.pdf');
  });

  it('skips Google Sites link and picks the school homepage for Externat Saint-Coeur de Marie', () => {
    const entry = find('Saint-Coeur de Marie');
    expect(entry.externalUrl).toBe('https://externat-scm.ca/admissions/');
  });

  it('skips Google Forms link and picks the school homepage for Séminaire Saint-François', () => {
    const entry = find('Séminaire Saint-François');
    expect(entry.externalUrl).toBe('https://www.ss-f.com/admission/processus-d-admission');
  });

  it('rejects blocklisted hosts as non-homepage URLs', () => {
    expect(isSchoolOwnUrl('https://calendly.com/booking')).toBe(false);
    expect(isSchoolOwnUrl('https://docs.google.com/forms/d/abc')).toBe(false);
    expect(isSchoolOwnUrl('https://sites.google.com/site/page')).toBe(false);
    expect(isSchoolOwnUrl('https://facebook.com/page')).toBe(false);
    expect(isSchoolOwnUrl('https://www.instagram.com/page')).toBe(false);
  });
});
