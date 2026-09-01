import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import fr from '../messages/fr.json';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('message catalogs', () => {
  it('en and fr define exactly the same keys', () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  it('no message is left empty', () => {
    for (const catalog of [en, fr]) {
      const empties = keys(catalog).filter((path) => {
        const value = path
          .split('.')
          .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], catalog);
        return typeof value === 'string' && value.trim() === '';
      });
      expect(empties).toEqual([]);
    }
  });
});
