import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { agendaWindowEnd, eventBounds } from './dates';
import { validateSchoolFiles, type SchoolFile } from './schema';
import type { AgendaEvent, SchoolListing, SchoolRow } from './types';

const DATA_DIR = join(process.cwd(), 'data', 'schools');

function loadSchools(): SchoolFile[] {
  const files = readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const path = join(DATA_DIR, name);
      return { path, json: JSON.parse(readFileSync(path, 'utf8')) as unknown };
    });

  const { ok, errors } = validateSchoolFiles(files);
  if (errors.length > 0) {
    throw new Error(`Invalid school data:\n${errors.join('\n')}`);
  }

  return ok;
}

/**
 * Every school on file except archived ones, published or not, so the list
 * can say "nothing observed yet" instead of hiding a school a family asked
 * about. Only facts a published record verified are carried; a draft's
 * language, student body and boarding stay unknown.
 */
export function fetchSchoolListings(): SchoolListing[] {
  return loadSchools()
    .filter((school) => school.status !== 'archived')
    .map((school) => {
      const confirmed = school.status === 'published';
      return {
        id: school.slug,
        slug: school.slug,
        name_en: school.name_en,
        name_fr: school.name_fr,
        city: school.city,
        region: school.region,
        sector: school.sector,
        admissions_url: school.admissions_url,
        programs: school.programs,
        last_verified_at: school.last_verified_at,
        confirmed,
        language: confirmed ? school.language : null,
        gender: confirmed ? school.gender : null,
        has_boarding: confirmed ? school.has_boarding : null,
      };
    });
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
 * Git is the only source of truth: this reads data/schools/*.json directly,
 * the same files scripts/check-sources.ts and the data-integrity tests
 * validate. There is no database — every deploy already rebuilds from
 * whatever was last merged, so there is nothing to seed or keep in sync.
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
