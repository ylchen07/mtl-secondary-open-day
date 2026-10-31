import { MAP_PATHS, project } from '@/lib/geo';
import { MAP_REGIONS, type Box, type MapRegion } from '@/lib/regions';

/**
 * Greater Montreal drawn from committed OpenStreetMap geometry: flat land
 * lobes on the page ground, which reads as water. No tiles, no requests.
 * With `highlight`, that region keeps its colour and the others drain to pale land.
 */
export function RegionMap({
  view,
  label,
  highlight,
  pin,
  className,
}: {
  view: Box;
  label: string;
  highlight?: MapRegion;
  pin?: { lat: number; lng: number } | null;
  className?: string;
}) {
  const point = pin ? project(pin.lat, pin.lng) : null;
  const r = view.w * 0.011;

  return (
    <svg
      className={className ? `region-map ${className}` : 'region-map'}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label}
    >
      <path className="land" data-region="other" d={MAP_PATHS.other} />
      {MAP_REGIONS.map((region) => (
        <path
          key={region}
          className="land"
          data-region={region}
          data-drained={highlight && highlight !== region ? '' : undefined}
          d={MAP_PATHS[region]}
        />
      ))}
      {point && (
        <g className="map-pin">
          <circle cx={point.x} cy={point.y} r={r * 1.9} className="map-pin-halo" />
          <circle cx={point.x} cy={point.y} r={r} className="map-pin-dot" />
        </g>
      )}
    </svg>
  );
}
