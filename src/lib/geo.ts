import geo from '../../data/geo/greater-montreal.json';
import { MAP_REGIONS, type Box, type MapRegion } from './regions';

// Server only: this module carries the full coastline geometry. Client
// components import ./regions and receive positions as props.

export const MAP_PATHS: Record<MapRegion | 'other', string> = geo.regions;
const [, , MAP_W, MAP_H] = geo.viewBox.split(' ').map(Number);

/** Equirectangular projection into map units, matching scripts/build-map.ts. */
export function project(lat: number, lng: number): { x: number; y: number } {
  const { minLng, maxLat, kx, ky } = geo.projection;
  return { x: (lng - minLng) * kx, y: (maxLat - lat) * ky };
}

/** Where each region's name sits: an inland point clear of the coast. */
const REGION_ANCHORS: Record<MapRegion, { x: number; y: number }> = {
  montreal_island: project(45.505, -73.7),
  laval: project(45.6, -73.76),
  north_shore: project(45.705, -73.93),
  south_shore: project(45.455, -73.4),
};

/** Each region's label position inside `view`, as CSS percentages. */
export function regionLabelPositions(view: Box): Record<MapRegion, { left: string; top: string }> {
  return Object.fromEntries(
    MAP_REGIONS.map((region) => {
      const { x, y } = REGION_ANCHORS[region];
      return [region, { left: `${((x - view.x) / view.w) * 100}%`, top: `${((y - view.y) / view.h) * 100}%` }];
    }),
  ) as Record<MapRegion, { left: string; top: string }>;
}

function pathBox(d: string): Box {
  const n = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < n.length; i += 2) {
    minX = Math.min(minX, n[i]); maxX = Math.max(maxX, n[i]);
    minY = Math.min(minY, n[i + 1]); maxY = Math.max(maxY, n[i + 1]);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * A crop of the map at `aspect` (width / height) that lets one region swell
 * across the frame, its coast leaving the edges, centred on `focus` when the
 * school's position is known. Clamped so the frame never shows past the data.
 */
export function regionCrop(region: MapRegion, aspect: number, focus?: { x: number; y: number }): Box {
  const box = pathBox(MAP_PATHS[region]);
  // The shores run off the data's edge, so their visible land is smaller than their box.
  const w = Math.min(MAP_W, region === 'montreal_island' || region === 'laval' ? box.w * 1.15 : box.w * 0.8);
  const h = Math.min(MAP_H, w / aspect);
  const centre = focus ?? REGION_ANCHORS[region];
  const x = Math.max(0, Math.min(MAP_W - w, centre.x - w / 2));
  const y = Math.max(0, Math.min(MAP_H - h, centre.y - h / 2));
  return { x, y, w, h };
}
