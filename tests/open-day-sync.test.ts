import { describe, expect, it } from 'vitest';
import {
  buildSlugBySchoolId,
  computeStaleOpenDayIds,
  resolveRemoteOpenDayIdentities,
  type LocalOpenDayIdentity,
  type RemoteOpenDayIdentity,
} from '@/lib/open-day-sync';

describe('computeStaleOpenDayIds', () => {
  it('does not flag a remote row whose UTC instant matches a local offset string', () => {
    const remote: RemoteOpenDayIdentity[] = [
      {
        id: 'event-1',
        schoolSlug: 'lower-canada-college',
        startsAt: '2026-09-19T13:00:00.000Z',
        type: 'open_house',
      },
    ];
    const desired: LocalOpenDayIdentity[] = [
      {
        schoolSlug: 'lower-canada-college',
        startsAt: '2026-09-19T09:00:00-04:00',
        type: 'open_house',
      },
    ];

    expect(computeStaleOpenDayIds(remote, desired)).toEqual([]);
  });

  it('flags the extra remote row for deletion when the local school now has zero events', () => {
    const remote: RemoteOpenDayIdentity[] = [
      {
        id: 'villa-maria-event',
        schoolSlug: 'villa-maria',
        startsAt: '2026-09-12T14:00:00.000Z',
        type: 'open_house',
      },
    ];
    const desired: LocalOpenDayIdentity[] = [];

    expect(computeStaleOpenDayIds(remote, desired)).toEqual(['villa-maria-event']);
  });

  it('deletes one removed event while keeping another event for the same school', () => {
    const remote: RemoteOpenDayIdentity[] = [
      {
        id: 'kept-event',
        schoolSlug: 'selwyn-house',
        startsAt: '2026-10-01T13:00:00.000Z',
        type: 'open_house',
      },
      {
        id: 'removed-event',
        schoolSlug: 'selwyn-house',
        startsAt: '2026-11-01T13:00:00.000Z',
        type: 'info_session',
      },
    ];
    const desired: LocalOpenDayIdentity[] = [
      {
        schoolSlug: 'selwyn-house',
        startsAt: '2026-10-01T09:00:00-04:00',
        type: 'open_house',
      },
    ];

    expect(computeStaleOpenDayIds(remote, desired)).toEqual(['removed-event']);
  });

  it('deletes an event belonging to a school no longer represented in git', () => {
    const remote: RemoteOpenDayIdentity[] = [
      {
        id: 'ghost-school-event',
        schoolSlug: 'closed-academy',
        startsAt: '2026-09-01T13:00:00.000Z',
        type: 'tour',
      },
    ];
    const desired: LocalOpenDayIdentity[] = [
      {
        schoolSlug: 'lower-canada-college',
        startsAt: '2026-09-19T09:00:00-04:00',
        type: 'open_house',
      },
    ];

    expect(computeStaleOpenDayIds(remote, desired)).toEqual(['ghost-school-event']);
  });

  it('does not flag a remote row whose starts_at cannot be parsed to an instant (fails closed)', () => {
    const remote: RemoteOpenDayIdentity[] = [
      {
        id: 'unparseable-event',
        schoolSlug: 'villa-maria',
        startsAt: 'not-a-real-timestamp',
        type: 'open_house',
      },
    ];
    const desired: LocalOpenDayIdentity[] = [];

    expect(computeStaleOpenDayIds(remote, desired)).toEqual([]);
  });
});

describe('resolveRemoteOpenDayIdentities', () => {
  it('resolves raw rows keyed by school_id into identities keyed by slug, ignoring extra columns like status', () => {
    const slugBySchoolId = new Map([['school-uuid-1', 'lower-canada-college']]);
    const rawRows: unknown[] = [
      {
        id: 'event-1',
        school_id: 'school-uuid-1',
        starts_at: '2026-09-19T13:00:00.000Z',
        type: 'open_house',
        status: 'archived',
      },
    ];

    expect(resolveRemoteOpenDayIdentities(rawRows, slugBySchoolId)).toEqual([
      {
        id: 'event-1',
        schoolSlug: 'lower-canada-college',
        startsAt: '2026-09-19T13:00:00.000Z',
        type: 'open_house',
      },
    ]);
  });

  it('a status change alone does not cause the row to be flagged as stale', () => {
    const slugBySchoolId = new Map([['school-uuid-1', 'lower-canada-college']]);
    const rawRows: unknown[] = [
      {
        id: 'event-1',
        school_id: 'school-uuid-1',
        starts_at: '2026-09-19T13:00:00.000Z',
        type: 'open_house',
        status: 'published',
      },
    ];
    const desired: LocalOpenDayIdentity[] = [
      {
        schoolSlug: 'lower-canada-college',
        startsAt: '2026-09-19T09:00:00-04:00',
        type: 'open_house',
      },
    ];

    const remote = resolveRemoteOpenDayIdentities(rawRows, slugBySchoolId);
    expect(computeStaleOpenDayIds(remote, desired)).toEqual([]);
  });

  it('drops a row with an unresolvable school_id rather than guessing its identity', () => {
    const slugBySchoolId = new Map([['school-uuid-1', 'lower-canada-college']]);
    const rawRows: unknown[] = [
      {
        id: 'orphan-event',
        school_id: 'school-uuid-unknown',
        starts_at: '2026-09-19T13:00:00.000Z',
        type: 'open_house',
      },
    ];

    expect(resolveRemoteOpenDayIdentities(rawRows, slugBySchoolId)).toEqual([]);
  });

  it('drops a row with a malformed shape (missing fields, unknown type) rather than guessing its identity', () => {
    const slugBySchoolId = new Map([['school-uuid-1', 'lower-canada-college']]);
    const rawRows: unknown[] = [
      { id: 'missing-fields' },
      {
        id: 'bad-type-event',
        school_id: 'school-uuid-1',
        starts_at: '2026-09-19T13:00:00.000Z',
        type: 'not-a-real-type',
      },
      null,
      'not-an-object',
    ];

    expect(resolveRemoteOpenDayIdentities(rawRows, slugBySchoolId)).toEqual([]);
  });
});

describe('buildSlugBySchoolId', () => {
  it('builds a slug lookup from valid school rows', () => {
    const rows: unknown[] = [
      { id: 'school-uuid-1', slug: 'lower-canada-college' },
      { id: 'school-uuid-2', slug: 'villa-maria' },
    ];

    const map = buildSlugBySchoolId(rows);
    expect(map.get('school-uuid-1')).toBe('lower-canada-college');
    expect(map.get('school-uuid-2')).toBe('villa-maria');
    expect(map.size).toBe(2);
  });

  it('drops malformed rows rather than guessing', () => {
    const rows: unknown[] = [{ id: 'school-uuid-1' }, { slug: 'no-id' }, null];

    expect(buildSlugBySchoolId(rows).size).toBe(0);
  });
});
