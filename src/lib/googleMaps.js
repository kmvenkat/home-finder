import { API_BASE } from '../config/constants.js';

let mapsSdkPromise = null;

export async function loadMapsSDK({ onLoaded } = {}) {
  if (document.getElementById('maps-sdk')) {
    onLoaded?.();
    return;
  }

  // If it's already loaded (e.g. hot refresh), just callback.
  if (typeof window.google !== 'undefined' && window.google?.maps) {
    onLoaded?.();
    return;
  }

  if (mapsSdkPromise) {
    await mapsSdkPromise;
    onLoaded?.();
    return;
  }

  window.__initMaps = () => {
    onLoaded?.();
  };

  mapsSdkPromise = (async () => {
    const res = await fetch(`${API_BASE}/api/maps-key`);
    const data = await res.json();
    const key = data?.key;
    if (!key) throw new Error('Missing maps key from backend');

    await new Promise((resolve, reject) => {
      // Wrap the callback so our promise resolves only when Maps is ready.
      window.__initMaps = () => {
        onLoaded?.();
        resolve();
      };

      const s = document.createElement('script');
      s.id = 'maps-sdk';
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        key,
      )}&libraries=places&callback=__initMaps`;
      s.async = true;
      s.onerror = () => reject(new Error('Failed to load Maps SDK'));
      document.head.appendChild(s);
    });
  })();

  await mapsSdkPromise;
}

const acByInput = new WeakMap();

export function initAutocomplete(inputEl, { onPlaceSelected }) {
  if (!inputEl) return null;
  if (inputEl.dataset?.acInit === 'true') {
    return acByInput.get(inputEl) ?? null;
  }

  // eslint-disable-next-line no-undef
  const ac = new google.maps.places.Autocomplete(inputEl, {
    types: ['geocode'],
    componentRestrictions: { country: 'us' },
  });

  ac.addListener('place_changed', () => {
    const p = ac.getPlace();
    if (p?.geometry) onPlaceSelected?.(p);
  });

  inputEl.dataset.acInit = 'true';
  acByInput.set(inputEl, ac);
  return ac;
}

export async function geocodeAddr(address) {
  const res = await fetch(
    `${API_BASE}/api/geocode?address=${encodeURIComponent(address)}`,
  );
  const data = await res.json();
  if (data?.error) return null;
  return { lat: data.lat, lng: data.lng, locType: data.locType };
}

