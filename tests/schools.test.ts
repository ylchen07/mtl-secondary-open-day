import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, applyFilters } from '@/lib/filters';
import { listSchools } from '@/lib/schools';
import type { AgendaEvent, SchoolListing, SchoolRow } from '@/lib/types';

const NOW = new Date('2026-10-29T12:00:00Z');

function listing(over: Partial<SchoolListing> = {}): SchoolListing {
  return {
    id: 'a', slug: 'a', name_en: 'Alpha', name_fr: 'Alpha', city: 'Montréal',
    region: 'montreal_island', sector: 'private', admissions_url: 'https://a.qc.ca',
    programs: [], last_verified_at: '2026-10-29', confirmed: true,
    language: 'fr', gender: 'girls', has_boarding: null, ...over,
  };
}

function event(schoolId: string, startsAt: string, over: Partial<AgendaEvent> = {}): AgendaEvent {
  const end = new Date(new Date(startsAt).getTime() + 3 * 3600_000).toISOString();
  return {
    id: `${schoolId}|${startsAt}`, school_id: schoolId, starts_at: startsAt, ends_at: end, all_day: false,
    type: 'open_house', academic_year: '2027-2028', registration_required: null, registration_url: null,
    notes_en: null, notes_fr: null, source_url: 'https://a.qc.ca', last_verified_at: '2026-10-29',
    status: 'published',
    school: { ...listing({ id: schoolId }), language: 'fr', gender: 'girls' } as unknown as SchoolRow,
    ...over,
  };
}

describe('listSchools', () => {
  it('keeps a school with no events, with nothing upcoming', () => {
    const rows = listSchools([listing({ id: 'draft', confirmed: false, language: null, gender: null })], [], EMPTY_FILTERS, NOW, 'en');
    expect(rows).toHaveLength(1);
    expect(rows[0].next).toBeNull();
  });

  it('lists schools with an upcoming event first, soonest first, then the rest by name', () => {
    const schools = [
      listing({ id: 'z', name_en: 'Zeta' }),
      listing({ id: 'b', name_en: 'Beta' }),
      listing({ id: 'late', name_en: 'Aardvark' }),
      listing({ id: 'soon', name_en: 'Yew' }),
      listing({ id: 'past', name_en: 'Alder' }),
    ];
    const events = [
      event('late', '2026-11-20T14:00:00Z'),
      event('soon', '2026-11-04T14:00:00Z'),
      event('soon', '2026-11-30T14:00:00Z'),
      event('past', '2026-09-19T14:00:00Z'),
    ];
    const rows = listSchools(schools, events, EMPTY_FILTERS, NOW, 'en');
    expect(rows.map((r) => r.school.id)).toEqual(['soon', 'late', 'past', 'b', 'z']);
    expect(rows[0].moreUpcoming).toBe(1);
    expect(rows.find((r) => r.school.id === 'past')?.next).toBeNull();
  });

  it('never lets an unconfirmed fact satisfy a filter', () => {
    const schools = [
      listing({ id: 'known', gender: 'girls' }),
      listing({ id: 'guess', confirmed: false, gender: null, language: null }),
    ];
    const rows = listSchools(schools, [], { ...EMPTY_FILTERS, gender: ['girls'] }, NOW, 'en');
    expect(rows.map((r) => r.school.id)).toEqual(['known']);
  });

  it('drops schools without an event of the selected type', () => {
    const schools = [listing({ id: 'exam' }), listing({ id: 'house' }), listing({ id: 'none' })];
    const filters = { ...EMPTY_FILTERS, type: ['entrance_exam'] };
    const events = applyFilters(
      [event('exam', '2026-11-07T14:00:00Z', { type: 'entrance_exam' }), event('house', '2026-11-07T14:00:00Z')],
      filters,
    );
    expect(listSchools(schools, events, filters, NOW, 'en').map((r) => r.school.id)).toEqual(['exam']);
  });
});
