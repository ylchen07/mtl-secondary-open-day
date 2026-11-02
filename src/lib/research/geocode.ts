import { GREATER_MONTREAL_BBOX } from '../constants';
import type { SchoolFile } from '../schema';

/** The fields of a Nominatim `format=jsonv2&addressdetails=1` result this reads. */
export type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: { house_number?: string; postcode?: string };
};

export type GeocodePick =
  | { ok: true; location: { lat: number; lng: number }; precision: 'exact' | 'approximate'; label: string }
  | { ok: false; reason: string };

const compact = (postal: string): string => postal.replace(/\s+/g, '').toUpperCase();

/**
 * The first result that sits inside Greater Montreal and carries the
 * school's own postal code. A full match on a numbered building is `exact`;
 * a match on the forward sortation area (first three characters) only, or a
 * street with no house number, is `approximate`. Anything else is refused:
 * a wrong pin is worse than no pin.
 */
export function pickGeocode(results: readonly NominatimResult[], school: Pick<SchoolFile, 'postal_code'>): GeocodePick {
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
    if (got.slice(0, 3) !== want.slice(0, 3)) {
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
 * carries its postal code, so the street-and-city form comes second.
 */
export function geocodeQueries(school: Pick<SchoolFile, 'address' | 'postal_code'>): string[] {
  const withoutPostal = school.address.replace(new RegExp(school.postal_code.replace(/\s+/g, '\\s*'), 'i'), '');
  const street = withoutPostal.replace(/[,\s]+$/, '').replace(/\s+/g, ' ').trim();
  return [...new Set([school.address, street])];
}
