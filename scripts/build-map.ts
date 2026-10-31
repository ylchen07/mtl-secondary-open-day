import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  area,
  bboxClip,
  bboxPolygon,
  booleanPointInPolygon,
  difference,
  featureCollection,
  length,
  lineString,
  multiPolygon,
  polygon,
  simplify,
  union,
} from '@turf/turf';
import type { BBox, Feature, MultiPolygon, Polygon, Position } from 'geojson';
import osmtogeojson from 'osmtogeojson';
import { GREATER_MONTREAL_BBOX } from '../src/lib/constants';

// Builds data/geo/greater-montreal.json: land of the GREATER_MONTREAL_BBOX
// split into the school regions, as SVG paths in a ~1000-unit viewBox. The
// app draws the map from this file alone — no tiles, no runtime requests.
//
// The Overpass response is cached under node_modules/.cache, so reruns are
// offline and byte-for-byte deterministic. `pnpm map:build --refresh`
// re-fetches the current OpenStreetMap data.

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, 'data', 'geo', 'greater-montreal.json');
const CACHE_PATH = path.join(ROOT, 'node_modules', '.cache', 'build-map', 'overpass.json');
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const UA = 'mtl-secondary-open-day map build (one-off geometry fetch)';

const { minLat, maxLat, minLng, maxLng } = GREATER_MONTREAL_BBOX;
const FRAME: BBox = [minLng, minLat, maxLng, maxLat];
// Fetch and cut a little beyond the frame so no polygon edge lands on it.
const PAD = 0.03;
const FETCH: BBox = [minLng - PAD, minLat - PAD, maxLng + PAD, maxLat + PAD];

const VIEW_WIDTH = 1000;
// In viewBox units (1 unit ≈ 60 m).
const SIMPLIFY_TOLERANCE = 0.6;
const MIN_WATER_KM2 = 0.05;
// Mean width of a water body, ≈ 2·area / outer perimeter. Streams narrower
// than this would only cut hairline slits into the land.
const MIN_WATER_WIDTH_M = 150;
const MIN_HOLE_KM2 = 2;
const MIN_PIECE_KM2 = 0.15;

const REGIONS = ['montreal_island', 'laval', 'north_shore', 'south_shore', 'other'] as const;
type Region = (typeof REGIONS)[number];

// [lng, lat] points known to sit on land of each region. A land piece that
// contains one belongs to that region; everything else is `other`.
const ANCHORS: Record<Exclude<Region, 'other'>, Position[]> = {
  montreal_island: [
    [-73.5673, 45.5017], // downtown
    [-73.8935, 45.4955], // Île Bizard
  ],
  laval: [[-73.7124, 45.6066]],
  north_shore: [
    [-73.6331, 45.693], // Terrebonne
    [-73.905, 45.565], // Saint-Eustache
    [-73.8, 45.636], // Rosemère
    [-73.45, 45.742], // Repentigny
    [-73.97, 45.505], // Pointe-Calumet
  ],
  south_shore: [
    [-73.5181, 45.5312], // Longueuil
    [-73.4659, 45.4584], // Brossard
    [-73.44, 45.59], // Boucherville
    [-73.43, 45.68], // Varennes
    [-73.515, 45.385], // Candiac
    [-73.69, 45.405], // Kahnawake
    [-73.75, 45.36], // Châteauguay
    [-73.87, 45.315], // Beauharnois
  ],
};

const QUERY = (() => {
  const b = `${FETCH[1]},${FETCH[0]},${FETCH[3]},${FETCH[2]}`;
  return `[out:json][timeout:300];
(
  way["natural"="water"](${b});
  relation["natural"="water"](${b});
  way["waterway"="riverbank"](${b});
  relation["waterway"="riverbank"](${b});
);
out geom;`;
})();

type OverpassResponse = { osm3s: { timestamp_osm_base: string }; elements: unknown[] };

async function loadOverpass(refresh: boolean): Promise<OverpassResponse> {
  if (!refresh) {
    try {
      return JSON.parse(await readFile(CACHE_PATH, 'utf8')) as OverpassResponse;
    } catch {
      // No cache yet — fall through to a fetch.
    }
  }
  console.log('Fetching water polygons from Overpass (this takes a minute or two)…');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: QUERY }),
    signal: AbortSignal.timeout(400_000),
  });
  if (!res.ok) throw new Error(`Overpass: HTTP ${res.status} ${await res.text()}`);
  const text = await res.text();
  const json = JSON.parse(text) as OverpassResponse;
  if (!Array.isArray(json.elements) || json.elements.length === 0) {
    throw new Error('Overpass returned no elements — refusing to build an all-land map.');
  }
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, text);
  return json;
}

const km2 = (f: Feature<Polygon | MultiPolygon> | Polygon | MultiPolygon) => area(f) / 1e6;

function polygonsOf(f: Feature<Polygon | MultiPolygon> | null): Position[][][] {
  if (!f) return [];
  return f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
}

function waterUnion(raw: OverpassResponse): Feature<Polygon | MultiPolygon> {
  const water: Feature<Polygon | MultiPolygon>[] = [];
  for (const f of osmtogeojson(raw).features) {
    const g = f.geometry;
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue;
    // Canals (Lachine, the Seaway, Beauharnois) would split the island and
    // the south shore into strips; the map reads better with them as land.
    if (f.properties?.water === 'canal' || f.properties?.waterway === 'canal') continue;
    const outlines = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map((rings) => lineString(rings[0]));
    const perimeterM = outlines.reduce((sum, line) => sum + length(line), 0) * 1000;
    if ((2 * area(g)) / perimeterM < MIN_WATER_WIDTH_M) continue;
    const clipped = bboxClip(g, FETCH);
    if (clipped.geometry.type !== 'Polygon' && clipped.geometry.type !== 'MultiPolygon') continue;
    for (const clippedRings of polygonsOf(clipped as Feature<Polygon | MultiPolygon>)) {
      // Clipping can leave degenerate rings (an outer ring that fell outside).
      const rings = clippedRings.filter((ring) => ring.length >= 4);
      if (rings.length === 0 || rings[0] !== clippedRings[0]) continue;
      const piece = polygon(rings);
      if (km2(piece) >= MIN_WATER_KM2) water.push(piece);
    }
  }
  const merged = union(featureCollection(water));
  if (!merged) throw new Error('Water union came out empty.');
  return merged;
}

function landPieces(water: Feature<Polygon | MultiPolygon>): Position[][][] {
  const land = difference(featureCollection([bboxPolygon(FETCH), water]));
  return polygonsOf(land)
    .map((rings) => [rings[0], ...rings.slice(1).filter((hole) => km2(polygon([hole])) >= MIN_HOLE_KM2)])
    .filter((rings) => km2(polygon(rings)) >= MIN_PIECE_KM2);
}

function classify(pieces: Position[][][]): Record<Region, Position[][][]> {
  const out = Object.fromEntries(REGIONS.map((r) => [r, [] as Position[][][]])) as Record<Region, Position[][][]>;
  const found = new Set<string>();
  for (const rings of pieces) {
    const piece = polygon(rings);
    const hits = (Object.entries(ANCHORS) as [Exclude<Region, 'other'>, Position[]][]).flatMap(([name, points]) =>
      points.filter((p) => booleanPointInPolygon(p, piece)).map((p) => ({ name, p })),
    );
    const names = [...new Set(hits.map((h) => h.name))];
    // A piece reaching two regions' anchors means the water between them
    // went missing — fail rather than paint one region across both.
    if (names.length > 1) throw new Error(`One land piece holds anchors of ${names.join(' and ')}.`);
    for (const h of hits) found.add(h.p.join(','));
    out[names[0] ?? 'other'].push(rings);
  }
  const missing = Object.values(ANCHORS)
    .flat()
    .filter((p) => !found.has(p.join(',')));
  if (missing.length > 0) {
    throw new Error(`Anchors fell in water or a dropped piece: ${missing.map((p) => `[${p}]`).join(' ')}`);
  }
  return out;
}

const midLat = (minLat + maxLat) / 2;
const kx = VIEW_WIDTH / (maxLng - minLng);
const ky = kx / Math.cos((midLat * Math.PI) / 180);
// kx is per degree of longitude; ky per degree of latitude. Same ground scale
// on both axes at midLat (equirectangular).
const projection = { minLng, maxLat, kx: round(kx, 4), ky: round(ky, 4) };
const viewHeight = Math.round((maxLat - minLat) * projection.ky);

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// Clip to the frame, project, simplify, round — then serialize as one path.
function toPath(pieces: Position[][][]): string {
  if (pieces.length === 0) return '';
  const clipped = bboxClip(multiPolygon(pieces), FRAME);
  const projected = polygonsOf(clipped as Feature<Polygon | MultiPolygon>).map((rings) =>
    rings.map((ring) => ring.map(([lng, lat]) => [(lng - minLng) * projection.kx, (maxLat - lat) * projection.ky])),
  );
  if (projected.length === 0) return '';
  const simple = simplify(multiPolygon(projected), { tolerance: SIMPLIFY_TOLERANCE, highQuality: true });
  const parts: string[] = [];
  for (const rings of simple.geometry.coordinates) {
    for (const ring of rings) {
      const pts: string[] = [];
      for (const [x, y] of ring.slice(0, -1)) {
        const p = `${round(x, 1)} ${round(y, 1)}`;
        if (pts[pts.length - 1] !== p) pts.push(p);
      }
      if (pts.length >= 3 && Math.abs(ringArea(ring)) >= 1) parts.push(`M${pts.join(' ')}Z`);
    }
  }
  return parts.join('');
}

function ringArea(ring: Position[]) {
  let a = 0;
  for (let i = 1; i < ring.length; i++) a += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
  return a / 2;
}

async function main() {
  const raw = await loadOverpass(process.argv.includes('--refresh'));
  const regions = classify(landPieces(waterUnion(raw)));

  const out = {
    source: `OpenStreetMap contributors (ODbL), fetched ${raw.osm3s.timestamp_osm_base.slice(0, 10)}`,
    viewBox: `0 0 ${VIEW_WIDTH} ${viewHeight}`,
    projection,
    regions: Object.fromEntries(REGIONS.map((r) => [r, toPath(regions[r])])) as Record<Region, string>,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  const json = `${JSON.stringify(out, null, 2)}\n`;
  await writeFile(OUT_PATH, json);
  console.log(`Wrote ${path.relative(ROOT, OUT_PATH)} (${(json.length / 1024).toFixed(1)} KB)`);
  for (const r of REGIONS) console.log(`  ${r}: ${regions[r].length} piece(s), ${out.regions[r].length} chars`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
