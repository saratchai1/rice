import { THAI_PROVINCE_GEOMETRY } from './thailand-provinces.mjs';

// Equirectangular WGS84 view, centered on the Kingdom of Thailand.
// This is a presentation map rather than a navigation/survey projection.
const VIEW = { lon0: 101.45, lat0: 13.03, scaleX: 30, scaleY: 30.7, x0: 290, y0: 265 };
export const PROVINCE_MAP = new Map(THAI_PROVINCE_GEOMETRY.map(feature => [feature.name, feature]));

export function projectLocation(lon, lat) {
  return { x: VIEW.x0 + (lon - VIEW.lon0) * VIEW.scaleX, y: VIEW.y0 - (lat - VIEW.lat0) * VIEW.scaleY };
}

export function provinceSvgPath(feature) {
  return feature.polygons.map(polygon => polygon.map(ring => ring.map(([lon, lat], i) => {
    const { x, y } = projectLocation(lon, lat);
    return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ') + ' Z').join(' ')).join(' ');
}

function insideRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[j];
    if ((ay > lat) !== (by > lat) && lon < (bx - ax) * (lat - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function pointInsideProvince(lon, lat, feature) {
  if (!feature) return false;
  return feature.polygons.some(polygon => insideRing(lon, lat, polygon[0]) &&
    !polygon.slice(1).some(hole => insideRing(lon, lat, hole)));
}

function provinceBounds(feature) {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const polygon of feature.polygons) for (const ring of polygon) for (const [lon, lat] of ring) {
    west = Math.min(west, lon); east = Math.max(east, lon);
    south = Math.min(south, lat); north = Math.max(north, lat);
  }
  return { west, east, south, north };
}

function distanceToRing(lon, lat, ring) {
  let closest = Infinity;
  const p = projectLocation(lon, lat);
  for (let i = 0; i < ring.length; i++) {
    const a = projectLocation(...ring[i]), b = projectLocation(...ring[(i + 1) % ring.length]);
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    closest = Math.min(closest, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return closest;
}

function edgeClearance(lon, lat, feature) {
  let closest = Infinity;
  for (const polygon of feature.polygons) for (const ring of polygon) {
    closest = Math.min(closest, distanceToRing(lon, lat, ring));
  }
  return closest;
}

const fract = n => n - Math.floor(n);

// Generate fake display positions inside real province polygons, not GPS positions.
// Use deterministic low-discrepancy sampling for repeatable maps and screenshots.
export function sampleDemoPoints(feature, count) {
  if (!feature || !Number.isInteger(count) || count < 0) throw new Error('Invalid province or sample count');
  if (!count) return [];
  const box = provinceBounds(feature);
  const seed = Array.from(feature.name).reduce((h, char) => (h * 31 + char.codePointAt(0)) >>> 0, 7);
  const candidates = [];
  for (let i = 0; i < 1300; i++) {
    const lon = box.west + (box.east - box.west) * fract((i + 1) * 0.61803398875 + fract(seed * 0.0000397));
    const lat = box.south + (box.north - box.south) * fract((i + 1) * 0.75487766625 + fract(seed * 0.0000713));
    if (pointInsideProvince(lon, lat, feature)) {
      candidates.push({ lon, lat, px: projectLocation(lon, lat), clearance: edgeClearance(lon, lat, feature) });
    }
  }
  if (candidates.length < count) throw new Error(`Unable to fit ${count} demo positions in ${feature.name}`);

  const chosen = [];
  for (let siteIndex = 0; siteIndex < count; siteIndex++) {
    let best = null, bestScore = -Infinity;
    for (const candidate of candidates) {
      if (chosen.includes(candidate)) continue;
      const separation = chosen.length ? Math.min(...chosen.map(p => Math.hypot(p.px.x - candidate.px.x, p.px.y - candidate.px.y))) : 20;
      // Prefer interior points, then spread dots to keep the map legible.
      const score = Math.min(candidate.clearance, 6) * 2 + Math.min(separation, 12);
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    chosen.push(best);
  }
  return chosen.map(({ lon, lat }) => ({ lon, lat }));
}

export function generateMapPositions(sites) {
  const byProvince = new Map();
  for (const site of sites) {
    if (!PROVINCE_MAP.has(site.province)) throw new Error(`Unknown province ${site.province}`);
    const group = byProvince.get(site.province) || [];
    group.push(site);
    byProvince.set(site.province, group);
  }
  const positions = new Map();
  for (const [province, group] of byProvince) {
    const samples = sampleDemoPoints(PROVINCE_MAP.get(province), group.length);
    group.forEach((site, i) => positions.set(site.id, { ...samples[i], province }));
  }
  return positions;
}
