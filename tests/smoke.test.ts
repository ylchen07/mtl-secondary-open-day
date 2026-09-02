import { describe, expect, it } from 'vitest';
import { GREATER_MONTREAL_BBOX } from '@/lib/constants';

describe('test harness', () => {
  it('resolves the @/ alias into src/', () => {
    expect(GREATER_MONTREAL_BBOX.minLat).toBe(45.3);
  });
});
