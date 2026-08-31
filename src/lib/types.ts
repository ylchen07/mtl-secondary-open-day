export type SchoolRow = {
  id: string;
  slug: string;
  name_en: string;
  name_fr: string;
  language: 'fr' | 'en' | 'bilingual';
  gender: 'mixed' | 'girls' | 'boys';
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
  has_boarding: boolean;
  programs: string[];
  description_en: string;
  description_fr: string;
  source_url: string;
  last_verified_at: string;
  status: 'published' | 'draft' | 'archived';
};

export type OpenDayRow = {
  id: string;
  school_id: string;
  starts_at: string;
  ends_at: string;
  type: 'open_house' | 'info_session' | 'entrance_exam' | 'tour' | 'virtual';
  academic_year: string;
  registration_required: boolean;
  registration_url: string | null;
  notes_en: string | null;
  notes_fr: string | null;
  source_url: string;
  last_verified_at: string;
  status: 'published' | 'draft' | 'archived';
};

export type AgendaEvent = OpenDayRow & { school: SchoolRow };
