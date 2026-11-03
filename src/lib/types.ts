import type { EventType } from './constants';

export type SchoolRow = {
  id: string;
  slug: string;
  name_en: string;
  name_fr: string;
  /** null until the school's own site states it. */
  language: 'fr' | 'en' | 'bilingual' | null;
  gender: 'mixed' | 'girls' | 'boys' | null;
  sector: 'private' | 'public';
  region: 'montreal_island' | 'west_island' | 'laval' | 'north_shore' | 'south_shore';
  city: string;
  address: string;
  postal_code: string;
  lat: number | null;
  lng: number | null;
  geocode_precision: 'exact' | 'approximate' | 'missing';
  website_url: string;
  admissions_url: string;
  tuition_annual_cad: number | null;
  has_boarding: boolean | null;
  programs: string[];
  description_en: string | null;
  description_fr: string | null;
  source_url: string;
  last_verified_at: string;
};

/**
 * A school on file, as the directory and school page show it. Every fact is
 * confirmed on the school's own site or null; a null fact is shown as
 * unknown and never matches a filter.
 */
export type SchoolListing = Pick<
  SchoolRow,
  | 'id' | 'slug' | 'name_en' | 'name_fr' | 'city' | 'region' | 'sector' | 'admissions_url' | 'website_url'
  | 'programs' | 'last_verified_at' | 'language' | 'gender' | 'has_boarding' | 'description_en' | 'description_fr'
  | 'address' | 'tuition_annual_cad'
> & {
  location: { lat: number; lng: number; precision: 'exact' | 'approximate' } | null;
};

export type OpenDayRow = {
  id: string;
  school_id: string;
  /** Instants; for an all-day event, Montreal midnight to the midnight after its last day. */
  starts_at: string;
  ends_at: string;
  /** Date-only event: the school published days, not clock times. */
  all_day: boolean;
  type: EventType;
  academic_year: string;
  registration_required: boolean | null;
  registration_url: string | null;
  notes_en: string | null;
  notes_fr: string | null;
  source_url: string;
  last_verified_at: string;
};

export type AgendaEvent = OpenDayRow & { school: SchoolRow };
