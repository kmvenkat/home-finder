import {
  CORNER_DIFF,
  GRID_TOL,
  MAX_DIST,
  PROBE_OFF,
  SV_RADIUS,
  API_BASE,
} from '../config/constants.js';
import { bearing, bearingDiff, cardinal, haversine, nearestCardDev } from './geo.js';
import { sleep } from './utils.js';

export async function svMeta({ lat, lng }) {
  const res = await fetch(`${API_BASE}/api/streetview?lat=${lat}&lng=${lng}`);
  return res.json();
}

export async function getFacing({ lat, lng, locType = 'ROOFTOP', qualifyDirs }) {
  const flags = [];
  let score = 100;

  const primary = await svMeta({ lat, lng });
  if (primary.status !== 'OK') {
    return {
      error: 'No Street View coverage',
      facing: null,
      dir: '?',
      confidence: 'LOW',
      score: 0,
      flags,
    };
  }

  const pLat = primary.location.lat;
  const pLng = primary.location.lng;
  const pId = primary.pano_id;

  const dist = haversine(lat, lng, pLat, pLng);
  const facing = bearing(lat, lng, pLat, pLng);
  const dir = cardinal(facing);

  if (dist > MAX_DIST) {
    flags.push(`Pano ${Math.round(dist)}m away`);
    score -= 25;
  }

  const distinct = new Set([pId]);
  for (const [dlat, dlng] of [
    [PROBE_OFF, 0],
    [-PROBE_OFF, 0],
    [0, PROBE_OFF],
    [0, -PROBE_OFF],
  ]) {
    await sleep(40);
    const p = await svMeta({ lat: lat + dlat, lng: lng + dlng });
    if (p.status === 'OK') {
      const pid = p.pano_id;
      if (
        pid &&
        pid !== pId &&
        bearingDiff(bearing(lat, lng, p.location.lat, p.location.lng), facing) > CORNER_DIFF
      ) {
        distinct.add(pid);
      }
    }
  }

  if (distinct.size > 1) {
    flags.push(`${distinct.size} street panoramas — possible corner lot`);
    score -= 35;
  }

  const dev = nearestCardDev(facing);
  if (dev > GRID_TOL) {
    flags.push(`${facing.toFixed(0)}° is ${dev.toFixed(0)}° off cardinal`);
    score -= 20;
  }

  const gp = { ROOFTOP: 0, RANGE_INTERPOLATED: 15, GEOMETRIC_CENTER: 20, APPROXIMATE: 30 }[
    locType
  ] ?? 20;
  if (gp) {
    flags.push(`Geocode: ${locType}`);
    score -= gp;
  }

  score = Math.max(score, 0);
  const confidence = score >= 80 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';
  const qualifies = qualifyDirs instanceof Set ? qualifyDirs.has(dir) : new Set(['N', 'NE', 'E']).has(dir);
  const verdict = qualifies ? 'QUALIFY' : 'NO';

  return {
    facing: Math.round(facing * 10) / 10,
    dir,
    confidence,
    score,
    verdict,
    qualifies,
    flags,
    dist: Math.round(dist * 10) / 10,
  };
}

