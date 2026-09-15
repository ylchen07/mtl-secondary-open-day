import { describe, expect, it } from 'vitest';
import { registrationAction } from '@/lib/registration';
import type { AgendaEvent } from '@/lib/types';

function event(overrides: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: 'event-1',
    school_id: 'school-1',
    starts_at: '2026-09-24T22:00:00.000Z',
    ends_at: '2026-09-25T01:00:00.000Z',
    type: 'open_house',
    academic_year: '2027-2028',
    registration_required: false,
    registration_url: null,
    notes_en: null,
    notes_fr: null,
    source_url: 'https://school.example/open-house',
    last_verified_at: '2026-09-15',
    status: 'published',
    school: {
      id: 'school-1',
      slug: 'school-1',
      name_en: 'School 1',
      name_fr: 'École 1',
      language: 'fr',
      gender: 'mixed',
      region: 'montreal_island',
      city: 'Montréal',
      address: '123 rue Test',
      postal_code: 'H1H 1H1',
      lat: null,
      lng: null,
      geocode_precision: 'missing',
      website_url: 'https://school.example',
      admissions_url: 'https://school.example/admissions',
      tuition_annual_cad: null,
      has_boarding: null,
      programs: [],
      description_en: null,
      description_fr: null,
      source_url: 'https://school.example',
      last_verified_at: '2026-09-15',
      status: 'published',
    },
    ...overrides,
  };
}

describe('registrationAction', () => {
  it('returns register action when registration is required for upcoming events', () => {
    const action = registrationAction(
      event({
        registration_required: true,
        registration_url: 'https://school.example/register',
      }),
      false,
    );

    expect(action).toEqual({ kind: 'register', href: 'https://school.example/register' });
  });

  it('returns no action when registration is not required', () => {
    const action = registrationAction(event({ registration_required: false }), false);
    expect(action).toBeNull();
  });

  it('returns check-details action when requirement is unknown for upcoming events', () => {
    const action = registrationAction(event({ registration_required: null }), false);
    expect(action).toEqual({ kind: 'check', href: 'https://school.example/open-house' });
  });

  it('returns no action for past events regardless of registration requirement', () => {
    expect(registrationAction(event({ registration_required: true, registration_url: 'https://school.example/register' }), true)).toBeNull();
    expect(registrationAction(event({ registration_required: false }), true)).toBeNull();
    expect(registrationAction(event({ registration_required: null }), true)).toBeNull();
  });
});
