import { agendaWindowEnd, eventBounds } from './dates';
import { SCHOOL_FILES } from './school-files.generated';
import { validateSchoolFiles, type SchoolFile } from './schema';
import type { AgendaEvent, SchoolListing, SchoolRow } from './types';

function loadSchools(): SchoolFile[] {
  const { ok, errors } = validateSchoolFiles(SCHOOL_FILES);
  if (errors.length > 0) {
    throw new Error(`Invalid school data:\n${errors.join('\n')}`);
  }

  return ok;
}

function toSchoolListing(school: SchoolFile): SchoolListing {
  const confirmed = school.status === 'published';
  const location =
    confirmed && school.location && school.geocode_precision !== 'missing'
      ? { lat: school.location.lat, lng: school.location.lng, precision: school.geocode_precision }
      : null;
  return {
    id: school.slug,
    slug: school.slug,
    name_en: school.name_en,
    name_fr: school.name_fr,
    city: school.city,
    region: school.region,
    sector: school.sector,
    admissions_url: school.admissions_url,
    website_url: school.website_url,
    programs: school.programs,
    last_verified_at: school.last_verified_at,
    confirmed,
    language: confirmed ? school.language : null,
    gender: confirmed ? school.gender : null,
    has_boarding: confirmed ? school.has_boarding : null,
    description_en: confirmed ? (school.description_en ?? null) : null,
    description_fr: confirmed ? (school.description_fr ?? null) : null,
    address: confirmed ? school.address : null,
    location,
    tuition_annual_cad: confirmed ? (school.tuition_annual_cad ?? null) : null,
  };
}

/**
 * Every school on file except archived ones, published or not, so the list
 * can say "nothing observed yet" instead of hiding a school a family asked
 * about. Only facts a published record verified are carried; a draft's
 * language, student body, boarding, description and street address stay unknown.
 */
export function fetchSchoolListings(): SchoolListing[] {
  return loadSchools()
    .filter((school) => school.status !== 'archived')
    .map(toSchoolListing);
}

/** One school on file by slug, or null when there is none or it is archived. */
export function fetchSchool(slug: string): SchoolListing | null {
  const school = loadSchools().find((s) => s.slug === slug && s.status !== 'archived');
  return school ? toSchoolListing(school) : null;
}

function toSchoolRow(school: SchoolFile): SchoolRow {
  return {
    id: school.slug,
    slug: school.slug,
    name_en: school.name_en,
    name_fr: school.name_fr,
    language: school.language,
    gender: school.gender,
    sector: school.sector,
    region: school.region,
    city: school.city,
    address: school.address,
    postal_code: school.postal_code,
    lat: school.location?.lat ?? null,
    lng: school.location?.lng ?? null,
    geocode_precision: school.geocode_precision,
    website_url: school.website_url,
    admissions_url: school.admissions_url,
    tuition_annual_cad: school.tuition_annual_cad ?? null,
    has_boarding: school.has_boarding,
    programs: school.programs,
    description_en: school.description_en ?? null,
    description_fr: school.description_fr ?? null,
    source_url: school.source_url,
    last_verified_at: school.last_verified_at,
    status: school.status,
  };
}

/**
 * Published historical events and upcoming events within the rolling
 * three-calendar-month Montreal window, each with its published school.
 * The result is shipped to the browser once; filtering happens there.
 *
 * Git is the only source of truth: this reads data/schools/*.json, compiled
 * into the bundle through school-files.generated.ts, the same files
 * scripts/check-sources.ts and the data-integrity tests validate. There is no
 * database — every deploy already rebuilds from whatever was last merged, so
 * there is nothing to seed or keep in sync.
 */
export async function fetchAgendaEvents(now = new Date()): Promise<AgendaEvent[]> {
  const windowEndMs = agendaWindowEnd(now).getTime();
  const schools = loadSchools().filter((school) => school.status === 'published');

  const events: AgendaEvent[] = [];
  for (const school of schools) {
    const schoolRow = toSchoolRow(school);

    for (const event of school.open_days) {
      if (event.status !== 'published') continue;
      const { starts_at, ends_at, all_day } = eventBounds(event);
      if (new Date(starts_at).getTime() > windowEndMs) continue;

      events.push({
        id: `${school.slug}|${starts_at}|${event.type}`,
        school_id: school.slug,
        starts_at,
        ends_at,
        all_day,
        type: event.type,
        academic_year: event.academic_year,
        registration_required: event.registration_required,
        registration_url: event.registration_url ?? null,
        notes_en: event.notes_en ?? null,
        notes_fr: event.notes_fr ?? null,
        source_url: event.source_url,
        last_verified_at: event.last_verified_at,
        status: event.status,
        school: schoolRow,
      });
    }
  }

  return events.sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
}

/**
 * School years with published events, plus the year currently recruiting so
 * the default page always has one to show, newest first.
 */
export function schoolYears(events: AgendaEvent[], current: string): string[] {
  const years = new Set(events.map((event) => event.academic_year));
  years.add(current);
  return [...years].sort().reverse();
}
