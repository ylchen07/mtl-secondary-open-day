import { describe, expect, it } from 'vitest';
import {
  academicYearFor,
  agendaWindowEnd,
  eventBounds,
  formatEventRange,
  formatEventTime,
  groupByDay,
  groupByWeek,
  partitionAgendaEvents,
  weekKey,
} from '@/lib/dates';

describe('eventBounds', () => {
  it('spans whole Montreal days for a date-only window crossing the November DST change', () => {
    expect(eventBounds({ starts_on: '2026-10-30', ends_on: '2026-11-02' })).toEqual({
      starts_at: '2026-10-30T00:00:00-04:00',
      ends_at: '2026-11-03T00:00:00-05:00',
      all_day: true,
    });
  });

  it('keeps a date-only interview upcoming until its last day is over', () => {
    const day = eventBounds({ starts_on: '2026-11-04', ends_on: '2026-11-04' });
    const { upcoming, past } = partitionAgendaEvents([day], new Date('2026-11-05T04:59:00.000Z'));
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(0);
    expect(partitionAgendaEvents([day], new Date('2026-11-05T05:00:01.000Z')).past).toHaveLength(1);
  });
});

describe('academicYearFor', () => {
  it('assigns autumn dates to the following school year and spring dates to the same one', () => {
    expect(academicYearFor('2026-10-29')).toBe('2027-2028');
    expect(academicYearFor('2026-06-30')).toBe('2026-2027');
    expect(academicYearFor('2026-07-01')).toBe('2027-2028');
  });
});

describe('agendaWindowEnd', () => {
  it('ends three calendar months later at the end of the Montreal day across DST', () => {
    expect(agendaWindowEnd(new Date('2026-09-15T14:00:00.000Z')).toISOString()).toBe(
      '2026-12-16T04:59:59.999Z',
    );
  });

  it('uses the last valid day when the target month is shorter', () => {
    expect(agendaWindowEnd(new Date('2027-01-31T15:00:00.000Z')).toISOString()).toBe(
      '2027-05-01T03:59:59.999Z',
    );
  });
});

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
      formatEventRange(
        { starts_at: '2026-09-26T17:00:00.000Z', ends_at: '2026-09-26T20:00:00.000Z', all_day: false },
        'en',
      ),
    ).toBe('1:00 PM – 4:00 PM');
  });

  it('has no clock range for a single date-only day', () => {
    expect(formatEventRange(eventBounds({ starts_on: '2026-11-04', ends_on: '2026-11-04' }), 'en')).toBeNull();
  });

  it('renders the first and last day of a date-only window across DST', () => {
    const window = eventBounds({ starts_on: '2026-10-26', ends_on: '2026-11-06' });
    expect(formatEventRange(window, 'en')).toBe('Oct 26 – Nov 6');
    expect(formatEventRange(window, 'fr')).toBe('26 oct. – 6 nov.');
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
