import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateSchoolFiles } from '@/lib/schema';

const DATA_DIR = join(process.cwd(), 'data', 'schools');

function loadAll() {
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = join(DATA_DIR, f);
      return { path, json: JSON.parse(readFileSync(path, 'utf8')) as unknown };
    });
}

describe('data/schools', () => {
  it('contains at least one school', () => {
    expect(loadAll().length).toBeGreaterThan(0);
  });

  it('every file passes validation', () => {
    const { errors } = validateSchoolFiles(loadAll());
    expect(errors).toEqual([]);
  });

  it('every published school has at least one event', () => {
    const { ok } = validateSchoolFiles(loadAll());
    const barren = ok
      .filter((s) => s.status === 'published' && s.open_days.length === 0)
      .map((s) => s.slug);
    expect(barren).toEqual([]);
  });
});
