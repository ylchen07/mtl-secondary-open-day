import type { EventType } from './constants';

export type SchoolRow = {
  id: string;
  slug: string;
  name_en: string;
  name_fr: string;
  language: 'fr' | 'en' | 'bilingual';
  gender: 'mixed' | 'girls' | 'boys';
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
  status: 'published' | 'draft' | 'archived';
};

/**
 * A school on file, as the school list shows it. Language, student body and
 * boarding are only confirmed on a published record; on a draft they hold the
 * curator's best guess, so they are null here rather than shown as fact.
 */
export type SchoolListing = Pick<
  SchoolRow,
  'id' | 'slug' | 'name_en' | 'name_fr' | 'city' | 'region' | 'sector' | 'admissions_url' | 'programs' | 'last_verified_at'
> & {
  confirmed: boolean;
  language: SchoolRow['language'] | null;
  gender: SchoolRow['gender'] | null;
  has_boarding: boolean | null;
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
  status: 'published' | 'draft' | 'archived';
};

export type AgendaEvent = OpenDayRow & { school: SchoolRow };
