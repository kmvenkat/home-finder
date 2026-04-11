import { geocodeAddr } from './googleMaps.js';
import { getFacing } from './streetView.js';

export async function checkHouse(address, qualifyDirs) {
  const trimmed = address?.trim?.() ?? '';
  if (!trimmed) throw new Error('Enter an address.');

  const geo = await geocodeAddr(trimmed);
  if (!geo) throw new Error('Could not geocode that address.');

  const { lat, lng, locType } = geo;
  const facing = await getFacing({ lat, lng, locType, qualifyDirs });

  return { address: trimmed, lat, lng, ...facing };
}
