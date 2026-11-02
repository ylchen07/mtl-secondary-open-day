import { GREATER_MONTREAL_BBOX } from '../constants';
import type { SchoolFile } from '../schema';

/** The fields of a Nominatim `format=jsonv2&addressdetails=1` result this reads. */
export type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: { house_number?: string; road?: string; city?: string; town?: string; village?: string; postcode?: string };
};

export type GeocodePick =
  | { ok: true; location: { lat: number; lng: number }; precision: 'exact' | 'approximate'; label: string }
  | { ok: false; reason: string };

const compact = (postal: string): string => postal.replace(/\s+/g, '').toUpperCase();
const plain = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

type Place = Pick<SchoolFile, 'address' | 'city' | 'postal_code'>;

/**
 * Whether a result is the record's own building: same house number, street
 * and city. OpenStreetMap's postal codes are sometimes wrong (a Montreal
 * building tagged with a Laval code), so this vouches for a result that the
 * postal check refuses.
 */
function sameBuilding(result: NominatimResult, school: Place): boolean {
  const want = school.address.match(/^\s*(\d+)\s*,?\s*([^,]+)/);
  const got = result.address;
  if (!want || !got?.house_number || !got.road) return false;
  const city = got.city ?? got.town ?? got.village ?? '';
  return (
    got.house_number.split(';').some((n) => n.trim() === want[1]) &&
    plain(got.road) === plain(want[2]) &&
    plain(city) === plain(school.city)
  );
}

/**
 * The first result that sits inside Greater Montreal and is the school's
 * own place. A full postal match on a numbered building is `exact`; a match
 * on the forward sortation area (first three characters) only, a street with
 * no house number, or the same building under a postal code OSM disagrees
 * on, is `approximate`. Anything else is refused: a wrong pin is worse than
 * no pin.
 */
export function pickGeocode(results: readonly NominatimResult[], school: Place): GeocodePick {
  const want = compact(school.postal_code);
  const { minLat, maxLat, minLng, maxLng } = GREATER_MONTREAL_BBOX;
  let reason = 'no result';
  for (const r of results) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!(lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng)) {
      reason = 'result outside Greater Montreal';
      continue;
    }
    const got = compact(r.address?.postcode ?? '');
    const postalMatch = got.slice(0, 3) === want.slice(0, 3);
    if (!postalMatch && !sameBuilding(r, school)) {
      reason = `postal code ${r.address?.postcode ?? 'missing'} does not match ${school.postal_code}`;
      continue;
    }
    const exact = got === want && Boolean(r.address?.house_number);
    return {
      ok: true,
      location: { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 },
      precision: exact ? 'exact' : 'approximate',
      label: r.display_name ?? '',
    };
  }
  return { ok: false, reason };
}

/**
 * Queries to try in order. Nominatim often misses a Canadian address that
 * carries its postal code, so the street-and-city form comes second. The
 * city is always named: "12630, boulevard Gouin Est" alone is a street in
 * several towns.
 */
export function geocodeQueries(school: Pick<SchoolFile, 'address' | 'city' | 'postal_code'>): string[] {
  const withoutPostal = school.address.replace(new RegExp(school.postal_code.replace(/\s+/g, '\\s*'), 'i'), '');
  const street = withoutPostal.replace(/[,\s]+$/, '').replace(/\s+/g, ' ').trim();
  const inCity = (text: string) => (text.toLowerCase().includes(school.city.toLowerCase()) ? text : `${text}, ${school.city}`);
  return [...new Set([`${inCity(street)} ${school.postal_code}`, inCity(street)])];
}
