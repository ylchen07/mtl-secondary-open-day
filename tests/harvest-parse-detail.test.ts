import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseDetail, parsePostalLine, inferGender } from '@/lib/harvest/parse-detail';

const fixture = (name: string): string =>
  readFileSync(path.join(process.cwd(), 'tests/fixtures/feep', name), 'utf8');

describe('parsePostalLine', () => {
  it('splits "Montréal (Quebec) H3W 1W4"', () => {
    expect(parsePostalLine('Montréal (Quebec) H3W 1W4')).toEqual({
      city: 'Montréal',
      postalCode: 'H3W 1W4',
    });
  });

  it('handles a postal code with no internal space', () => {
    expect(parsePostalLine('Laval (Quebec) H7N4Y3')).toEqual({
      city: 'Laval',
      postalCode: 'H7N 4Y3',
    });
  });

  it('returns nulls for an unrecognisable line', () => {
    expect(parsePostalLine('Canada')).toEqual({ city: null, postalCode: null });
  });
});

describe('inferGender', () => {
  it('detects girls-only from French prose', () => {
    expect(inferGender('école pour filles')).toEqual({ genderGuess: 'girls', genderConfident: true });
  });

  it('detects boys-only', () => {
    expect(inferGender('collège pour garçons')).toEqual({ genderGuess: 'boys', genderConfident: true });
  });

  it('detects co-ed from "mixte"', () => {
    expect(inferGender('établissement mixte')).toEqual({ genderGuess: 'mixed', genderConfident: true });
  });

  it('falls back to mixed but UNCONFIDENT when prose is silent', () => {
    expect(inferGender('un collège privé subventionné')).toEqual({
      genderGuess: 'mixed',
      genderConfident: false,
    });
  });
});

describe('parseDetail', () => {
  it('extracts address, city and postal code for a secondary school', () => {
    const facts = parseDetail(fixture('detail-marie-de-france.html'));
    expect(facts.address).toBe('4635, chemin Queen Mary');
    expect(facts.city).toBe('Montréal');
    expect(facts.postalCode).toBe('H3W 1W3');
  });

  it('marks a secondary school as secondary', () => {
    expect(parseDetail(fixture('detail-marie-de-france.html')).isSecondary).toBe(true);
  });

  it('marks a primary-only school as NOT secondary', () => {
    expect(parseDetail(fixture('detail-primary-only.html')).isSecondary).toBe(false);
  });

  it('reads language of instruction as French', () => {
    expect(parseDetail(fixture('detail-marie-de-france.html')).language).toBe('fr');
  });

  it('extracts address for a primary-only school', () => {
    const facts = parseDetail(fixture('detail-primary-only.html'));
    expect(facts.address).toBe('100, boulevard Bouchard');
    expect(facts.city).toBe('Dorval');
    expect(facts.postalCode).toBe('H9S 1A7');
  });

  it('defaults to unconfident mixed when gender prose is absent', () => {
    const facts = parseDetail(fixture('detail-marie-de-france.html'));
    expect(facts.genderGuess).toBe('mixed');
    expect(facts.genderConfident).toBe(false);
  });
});
