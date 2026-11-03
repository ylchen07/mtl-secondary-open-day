import { describe, expect, it, vi } from 'vitest';
import { loadSchoolFiles, todayInMontreal } from '@/lib/school-files';

describe('todayInMontreal', () => {
  it('reports the Montreal date, not the UTC one, late in the Montreal evening', () => {
    // 2026-03-16T03:30Z is 23:30 on the 15th in Montreal (EDT).
    expect(todayInMontreal(new Date('2026-03-16T03:30:00Z'))).toBe('2026-03-15');
    // 2026-01-01T04:30Z is 23:30 on 31 December in Montreal (EST).
    expect(todayInMontreal(new Date('2026-01-01T04:30:00Z'))).toBe('2025-12-31');
  });
});

describe('loadSchoolFiles', () => {
  it('fails closed on the first file that is not valid JSON or not schema-valid, reading no further', async () => {
    const readdir = vi.fn().mockResolvedValue(['broken.json', 'next.json']);
    const readFile = vi.fn().mockResolvedValueOnce('{ not json').mockResolvedValueOnce('{}');
    await expect(loadSchoolFiles({ readdir, readFile })).rejects.toThrow(/broken\.json: invalid JSON/);
    expect(readFile).toHaveBeenCalledTimes(1);

    const invalid = vi.fn().mockResolvedValue(JSON.stringify({ slug: 'bad-school' }));
    await expect(loadSchoolFiles({ readdir: vi.fn().mockResolvedValue(['bad-school.json']), readFile: invalid })).rejects.toThrow(
      /bad-school\.json: schema-invalid/,
    );
  });
});
