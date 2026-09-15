import type { ListingEntry, ListingEvent, SchoolFacts } from './types';
import type { SchoolFile } from '../schema';

const ZONE = 'America/Toronto';

/**
 * Offset for a given Montreal local date-time, as `"-04:00"` (EDT) or
 * `"-05:00"` (EST). Derived from the IANA zone for the specific date rather
 * than hardcoded, because Montreal's UTC offset changes twice a year —
 * hardcoding the summer offset would make every event harvested after the
 * November DST changeover silently one hour wrong.
 */
export function montrealOffset(date: string, time: string): string {
  const utcGuess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    timeZoneName: 'longOffset',
  }).formatToParts(utcGuess);
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-05:00';
  const m = raw.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : '-05:00';
}

/** A plain local date-time, converted to an ISO string with an explicit offset. */
function localIso(date: string, time: string): string {
  return `${date}T${time}:00${montrealOffset(date, time)}`;
}

/**
 * Academic year a given open-house date feeds. FEEP open houses in the
 * second half of a calendar year (July onward) recruit for the intake that
 * starts the *following* September; open houses earlier in the year recruit
 * for the intake starting that same September.
 *
 * The July 1 boundary itself — not just the general one-year-ahead shape —
 * is confirmed against two real, checked-in FEEP entries that sit on the
 * *other* side of it from the three already-published files (which are all
 * September events and never exercised this boundary): Collège Reine-Marie's
 * open house on 17 avril 2027, which FEEP itself labels "Année scolaire
 * 2027-2028", and Académie Centennial's on 25 avril 2026, labelled "Année
 * scolaire 2026-2027" (both in `tests/fixtures/feep/listing-montreal.html`).
 * Both are April (`m=4 < 7`), so both take the `start = y` branch — and both
 * match FEEP's own stated academic year exactly.
 */
export function academicYearFor(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 7 ? y + 1 : y;
  return `${start}-${start + 1}`;
}

/**
 * Narrow a `ListingEvent` to the fields `reconcile()` guarantees are present
 * on every event of a `create` decision (date, start, and end time all
 * non-null). A runtime check rather than a `!` assertion, so a future caller
 * that skips `reconcile()` fails loudly instead of emitting `"nullT00:00..."`.
 */
function requireTimedEvent(e: ListingEvent): { date: string; startTime: string; endTime: string } {
  if (e.date === null || e.startTime === null || e.endTime === null) {
    throw new Error(
      `toDraftSchool received an untimed event ("${e.rawDate}") — reconcile() should have filtered this out before a 'create' decision was formed`,
    );
  }
  return { date: e.date, startTime: e.startTime, endTime: e.endTime };
}

/**
 * Build a schema-valid draft `SchoolFile` from a reconciled `create` entry.
 * Every field a human has not yet verified (location, tuition, programs,
 * descriptions, boarding, registration requirement) is left null/empty rather
 * than guessed — this file exists to be reviewed and edited, not published
 * as-is.
 *
 * `source_url` is always the FEEP detail page: that page, not the school's
 * own site, is what was actually parsed for this date and time. `website_url`
 * / `admissions_url` prefer the school's own site (`entry.externalUrl`) when
 * FEEP published one, and fall back to the same FEEP page otherwise — FEEP is
 * a real page a reviewer can open, just not one this project will ever cite
 * as a verified source. A `draft` file is exempt from the CI guard that bans
 * `feep.qc.ca` in a published row's `source_url`; this fallback must never
 * survive past a human replacing it before publishing.
 */
export function toDraftSchool(
  entry: ListingEntry,
  facts: SchoolFacts,
  today: string,
): SchoolFile {
  const feepUrl = `https://www.feep.qc.ca/ecoles-privees-quebec/${entry.feepSlug}`;
  const site = entry.externalUrl ?? feepUrl;
  // `entry.region` is typed `Region | null` because FEEP lists out-of-scope
  // schools too, but `reconcile()` already filters those to `skip` before a
  // `create` decision can exist — this fallback is unreachable defense, not
  // a real region decision.
  const region = entry.region ?? 'montreal_island';

  return {
    slug: entry.feepSlug,
    name_en: entry.nameFr,
    name_fr: entry.nameFr,
    language: facts.language ?? 'fr',
    gender: facts.genderGuess,
    region,
    city: facts.city ?? 'Montréal',
    address: facts.address ?? 'UNVERIFIED — transcribe from the school\u2019s own page',
    postal_code: facts.postalCode ?? 'H0H 0H0',
    location: null,
    geocode_precision: 'missing',
    website_url: site,
    admissions_url: site,
    tuition_annual_cad: null,
    has_boarding: null,
    programs: [],
    description_en: null,
    description_fr: null,
    source_url: feepUrl,
    last_verified_at: today,
    status: 'draft',
    open_days: entry.events.map((rawEvent) => {
      const e = requireTimedEvent(rawEvent);
      return {
        starts_at: localIso(e.date, e.startTime),
        ends_at: localIso(e.date, e.endTime),
        type: 'open_house' as const,
        academic_year: academicYearFor(e.date),
        registration_required: null,
        registration_url: null,
        notes_en: null,
        notes_fr: rawEvent.noteFr,
        source_url: feepUrl,
        last_verified_at: today,
        status: 'draft' as const,
      };
    }),
  };
}

/**
 * Key order a human reviewer expects when opening a diff, and — more
 * importantly — the same order on every run against unchanged input, so
 * re-running the harvester against a school it already drafted is a byte-for-
 * byte no-op instead of diff noise.
 */
const KEY_ORDER: (keyof SchoolFile)[] = [
  'slug', 'name_en', 'name_fr', 'language', 'gender', 'region', 'city',
  'address', 'postal_code', 'location', 'geocode_precision', 'website_url',
  'admissions_url', 'tuition_annual_cad', 'has_boarding', 'programs',
  'description_en', 'description_fr', 'source_url', 'last_verified_at',
  'status', 'open_days',
];

/** Serialise a `SchoolFile` with a stable key order and a trailing newline. */
export function serialise(school: SchoolFile): string {
  const ordered: Record<string, unknown> = {};
  for (const key of KEY_ORDER) ordered[key] = school[key];
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
