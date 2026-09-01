import { describe, expect, it } from 'vitest';
import { formatEventTime, groupByWeek, weekKey } from '@/lib/dates';

describe('weekKey', () => {
  it('returns the Monday of the event week in Montreal time', () => {
    // 2026-09-26 is a Saturday; its Monday is 2026-09-21
    expect(weekKey('2026-09-26T17:00:00.000Z')).toBe('2026-09-21');
  });

  it('assigns a late-Sunday-UTC event to the correct Montreal week', () => {
    // 2026-09-21T02:00Z is Sunday 22:00 in Montreal — still the week of Sep 14
    expect(weekKey('2026-09-21T02:00:00.000Z')).toBe('2026-09-14');
  });
});

describe('formatEventTime', () => {
  it('renders in Montreal time regardless of the runtime timezone', () => {
    const out = formatEventTime(
      '2026-09-26T17:00:00.000Z',
      '2026-09-26T20:00:00.000Z',
      'en',
    );
    expect(out).toContain('1:00');
    expect(out).toContain('4:00');
  });
});

describe('groupByWeek', () => {
  it('groups events into weeks in chronological order', () => {
    const groups = groupByWeek([
      { starts_at: '2026-09-26T17:00:00.000Z' },
      { starts_at: '2026-10-03T17:00:00.000Z' },
      { starts_at: '2026-09-27T17:00:00.000Z' },
    ]);
    expect(groups.map((g) => g.weekStart)).toEqual(['2026-09-21', '2026-09-28']);
    expect(groups[0].events).toHaveLength(2);
    expect(groups[1].events).toHaveLength(1);
  });
});
