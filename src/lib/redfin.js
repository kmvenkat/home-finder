import { mileToLatDeg, mileToLngDeg } from './geo.js';
import { API_BASE, PAGE_SIZE } from '../config/constants.js';

function meetsFilters(h, filters, propertyTypes) {
  if (filters.beds !== '' && filters.beds != null && h.beds < Number(filters.beds)) return false;
  if (filters.baths !== '' && filters.baths != null && h.baths < Number(filters.baths)) return false;
  if (filters.sqftMin !== '' && filters.sqftMin != null && h.sqft > 0 && h.sqft < Number(filters.sqftMin))
    return false;
  if (filters.sqftMax !== '' && filters.sqftMax != null && h.sqft > 0 && h.sqft > Number(filters.sqftMax))
    return false;
  if (filters.yearMin !== '' && filters.yearMin != null) {
    const yb = Number(h.yearBuilt);
    if (!Number.isFinite(yb) || yb < Number(filters.yearMin)) return false;
  }
  if (filters.yearMax !== '' && filters.yearMax != null) {
    const yb = Number(h.yearBuilt);
    if (!Number.isFinite(yb) || yb > Number(filters.yearMax)) return false;
  }
  if (filters.minPrice && h.price < Number(filters.minPrice)) return false;
  if (filters.maxPrice && h.price > Number(filters.maxPrice)) return false;
  if (propertyTypes && !propertyTypes.has(h.propertyType)) return false;
  return true;
}

export async function fetchRedfin(lat, lng, radiusMiles, filters, start = 0, propertyTypes = null) {
  const dLat = mileToLatDeg(radiusMiles);
  const dLng = mileToLngDeg(radiusMiles, lat);

  const params = new URLSearchParams({
    al: 1,
    uipt: '1',
    sf: '1,2,3,5,6,7',
    num_homes: PAGE_SIZE,
    start: String(start),
    v: 8,
    max_lat: (lat + dLat).toFixed(6),
    min_lat: (lat - dLat).toFixed(6),
    max_long: (lng + dLng).toFixed(6),
    min_long: (lng - dLng).toFixed(6),
  });
  if (filters.beds) params.set('min_beds', filters.beds);
  if (filters.baths) params.set('min_baths', filters.baths);
  if (filters.sqftMin) params.set('min_sqft', filters.sqftMin);
  if (filters.minPrice) params.set('min_price', filters.minPrice);
  if (filters.maxPrice) params.set('max_price', filters.maxPrice);

  const res = await fetch(`${API_BASE}/api/redfin?${params}`);
  const json = await res.json();

  const listings = (json.payload?.homes || [])
    .map((h) => {
      const rawCity = h.city?.value || h.location?.value || '';
      const mls = h.mlsId?.value || '';
      const src = h.dataSourceId;
      return {
        address: h.streetLine?.value || '',
        city: isNaN(rawCity) || rawCity.trim() === '' ? rawCity : '',
        state: h.state?.value || '',
        zip: h.zip?.value || '',
        price: h.price?.value || 0,
        beds: h.beds || 0,
        baths: h.baths || 0,
        sqft: h.sqFt?.value || 0,
        propertyType: h.propertyType ?? null,
        lat: h.latLong?.value?.latitude,
        lng: h.latLong?.value?.longitude,
        url: h.url ? 'https://www.redfin.com' + h.url : null,
        yearBuilt: h.yearBuilt?.value || '',
        mlsId: mls,
        dataSourceId: h.dataSourceId || null,
        thumbUrl:
          mls && src
            ? `https://ssl.cdn-redfin.com/photo/${src}/bigphoto/${mls.slice(-3)}/${mls}_0.jpg`
            : null,
      };
    })
    .filter((h) => h.lat && h.lng)
    .filter((h) => meetsFilters(h, filters, propertyTypes));

  return {
    listings,
    rawCount: json.payload?.homes?.length ?? 0,
  };
}

