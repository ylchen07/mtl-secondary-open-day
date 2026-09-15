import { describe, expect, it } from 'vitest';
import {
  formatEventRange,
  formatEventTime,
  groupByDay,
  groupByWeek,
  partitionAgendaEvents,
  weekKey,
} from '@/lib/dates';

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

describe('partitionAgendaEvents', () => {
  it('keeps ended events in a separate historical bucket', () => {
    const result = partitionAgendaEvents(
      [
        { starts_at: '2026-09-15T14:00:00.000Z', ends_at: '2026-09-15T16:00:00.000Z' },
        { starts_at: '2026-09-10T14:00:00.000Z', ends_at: '2026-09-10T16:00:00.000Z' },
      ],
      new Date('2026-09-14T12:00:00.000Z'),
    );
    expect(result.upcoming).toHaveLength(1);
    expect(result.past).toHaveLength(1);
    expect(result.past[0].ends_at).toBe('2026-09-10T16:00:00.000Z');
  });
});

describe('formatEventRange', () => {
  it('renders only the Montreal time range for an agenda row', () => {
    expect(
      formatEventRange('2026-09-26T17:00:00.000Z', '2026-09-26T20:00:00.000Z', 'en'),
    ).toBe('1:00 PM – 4:00 PM');
  });
});

describe('groupByDay', () => {
  it('groups events by Montreal calendar day in chronological order', () => {
    const groups = groupByDay([
      { starts_at: '2026-10-03T17:00:00.000Z' },
      { starts_at: '2026-09-26T17:00:00.000Z' },
      { starts_at: '2026-09-26T15:00:00.000Z' },
      { starts_at: '2026-09-27T02:00:00.000Z' },
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-09-26', '2026-10-03']);
    expect(groups[0].events).toHaveLength(3);
    expect(groups[0].events.map((event) => event.starts_at)).toEqual([
      '2026-09-26T15:00:00.000Z',
      '2026-09-26T17:00:00.000Z',
      '2026-09-27T02:00:00.000Z',
    ]);
  });

  it('does not let a late UTC timestamp move an event into the next Montreal day', () => {
    const groups = groupByDay([{ starts_at: '2026-09-27T02:00:00.000Z' }]);
    expect(groups[0].day).toBe('2026-09-26');
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
