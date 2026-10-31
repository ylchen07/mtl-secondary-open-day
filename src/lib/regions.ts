import type { SchoolRow } from './types';

/** The land lobes the map draws; West Island schools sit on the island lobe. */
export const MAP_REGIONS = ['montreal_island', 'laval', 'north_shore', 'south_shore'] as const;
export type MapRegion = (typeof MAP_REGIONS)[number];

export type Box = { x: number; y: number; w: number; h: number };

export function mapRegionFor(region: SchoolRow['region']): MapRegion {
  return region === 'west_island' ? 'montreal_island' : region;
}
