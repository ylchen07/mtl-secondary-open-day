import { describe, expect, it } from 'vitest';
import { fetchAgendaEvents } from '@/lib/queries';
import { agendaWindowEnd } from '@/lib/dates';

// Integration-style: reads the real data/schools/*.json files, the same way
// the app does. There is no database to mock — git is the source of truth.

describe('fetchAgendaEvents', () => {
  it('returns only published events belonging to published schools', async () => {
    const events = await fetchAgendaEvents();

    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.status).toBe('published');
      expect(event.school.status).toBe('published');
    }
  });

  it('excludes events starting after the rolling three-month window', async () => {
    const now = new Date('2026-09-20T12:00:00.000Z');
    const windowEndMs = agendaWindowEnd(now).getTime();
    const events = await fetchAgendaEvents(now);

    for (const event of events) {
      expect(new Date(event.starts_at).getTime()).toBeLessThanOrEqual(windowEndMs);
    }
  });

  it('sorts events chronologically by instant, not by ISO string', async () => {
    const events = await fetchAgendaEvents();
    const times = events.map((e) => new Date(e.starts_at).getTime());
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  it('gives every event a stable, unique id and matching school_id', async () => {
    const events = await fetchAgendaEvents();
    const ids = events.map((e) => e.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const event of events) {
      expect(event.id).toBe(`${event.school_id}|${event.starts_at}|${event.type}`);
      expect(event.school.id).toBe(event.school_id);
      expect(event.school.slug).toBe(event.school_id);
    }
  });

  it('maps a null location to null lat/lng on the school row', async () => {
    const events = await fetchAgendaEvents();
    for (const event of events) {
      if (event.school.geocode_precision === 'missing') {
        expect(event.school.lat).toBeNull();
        expect(event.school.lng).toBeNull();
      } else {
        expect(event.school.lat).not.toBeNull();
        expect(event.school.lng).not.toBeNull();
      }
    }
  });
});
