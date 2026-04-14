import { API_BASE, DELAY_MS, MAX_PAGES, PAGE_SIZE } from './config/constants.js';
import { haversine } from './lib/geo.js';
import { checkHouse } from './lib/checkHouse.js';
import { loadMapsSDK, initAutocomplete, geocodeAddr } from './lib/googleMaps.js';
import { fetchRedfin } from './lib/redfin.js';
import { getFacing } from './lib/streetView.js';
import { sleep } from './lib/utils.js';
import {
  byId,
  clearResults,
  getPillValue,
  getQualifyDirs,
  getPropertyTypes,
  initDirPicker,
  initMoreFilters,
  initPillPicker,
  initTypePicker,
  setExcludedVisible,
  setLoading,
  setProgress,
  showError,
  showExcludedToggle,
  showResultsHeader,
  updateCounts,
} from './ui/dom.js';
import { renderCompass } from './ui/compass.js';
import {
  clearMapProgress,
  initMapView,
  plotResults,
  resetMapView,
  setMapProgress,
  syncMapDirPickerToMain,
} from './ui/mapView.js';
import { resetRenderState, sortAndRender } from './ui/render.js';

let excludedVisible = false;
let searchInProgress = false;
let searchCancelled = false;
let allResults = { qualify: [], no: [] };
let lastRenderOpts = {};
let lastSelectedPlace = null;

export function getCurrentResults() {
  return allResults;
}

function getFilters() {
  return {
    beds: getPillValue('beds-picker'),
    baths: getPillValue('baths-picker'),
    sqftMin: document.getElementById('f-sqft-min')?.value ?? '',
    sqftMax: document.getElementById('f-sqft-max')?.value ?? '',
    yearMin: document.getElementById('f-year-min')?.value ?? '',
    yearMax: document.getElementById('f-year-max')?.value ?? '',
    minPrice: document.getElementById('f-minprice')?.value ?? '',
    maxPrice: document.getElementById('f-maxprice')?.value ?? '',
  };
}

function maybePlotMap() {
  const mv = document.getElementById('map-view');
  if (mv && !mv.hidden) {
    plotResults(allResults, lastRenderOpts);
  }
}

function onMapsLoaded() {
  const addrInput = byId('addr-input');
  if (addrInput) {
    initAutocomplete(addrInput, {
      onPlaceSelected: (place) => {
        lastSelectedPlace = place;
      },
    });
  }

  const checkAddr = byId('check-addr-input');
  if (checkAddr) {
    initAutocomplete(checkAddr, {
      onPlaceSelected: () => {},
    });
  }

  const mapSearchInput = byId('map-search-input');
  if (mapSearchInput) {
    initAutocomplete(mapSearchInput, {
      onPlaceSelected: (place) => {
        lastSelectedPlace = place;
        if (place.formatted_address) {
          mapSearchInput.value = place.formatted_address;
        }
        byId('map-search-btn')?.click();
      },
    });
  }

  initMapView({
    onSearchArea: (payload) => {
      if (payload?.address) {
        document.getElementById('view-list-btn')?.click();
        syncMapDirPickerToMain();
        const input = byId('addr-input');
        if (input) input.value = String(payload.address).trim();
        lastSelectedPlace = null;
        runSearch().catch(() => {});
        return;
      }
      const lat = payload?.lat;
      const lng = payload?.lng;
      if (lat == null || lng == null) return;
      const input = byId('addr-input');
      if (input) input.value = `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
      lastSelectedPlace = null;
      runSearch().catch(() => {});
    },
    getResults: getCurrentResults,
    getRenderOpts: () => lastRenderOpts,
  });
}

function setActiveTab(mode) {
  const tabSearch = byId('tab-search');
  const tabCheck = byId('tab-check');
  const panelSearch = byId('panel-search');
  const panelCheck = byId('panel-check');

  const isSearch = mode === 'search';
  if (tabSearch) {
    tabSearch.classList.toggle('active', isSearch);
    tabSearch.setAttribute('aria-selected', isSearch ? 'true' : 'false');
  }
  if (tabCheck) {
    tabCheck.classList.toggle('active', !isSearch);
    tabCheck.setAttribute('aria-selected', !isSearch ? 'true' : 'false');
  }
  if (panelSearch) panelSearch.style.display = isSearch ? '' : 'none';
  if (panelCheck) panelCheck.style.display = isSearch ? 'none' : '';
}

function fullDirectionName(dir) {
  const m = {
    N: 'North',
    NE: 'Northeast',
    E: 'East',
    SE: 'Southeast',
    S: 'South',
    SW: 'Southwest',
    W: 'West',
    NW: 'Northwest',
  };
  return m[dir] || String(dir || '');
}

function flagPrefix(text) {
  const t = String(text || '').toLowerCase();
  if (t.includes('corner') || t.includes('off') || t.includes('unavailable')) return '⚠';
  return '✓';
}

function flagClass(text) {
  return flagPrefix(text) === '⚠' ? 'check-flag-warn' : 'check-flag-ok';
}

async function runCheckHouse() {
  if (typeof window.google === 'undefined') {
    const errEl = byId('check-error');
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'Maps SDK not loaded yet — try again in a moment.';
    }
    return;
  }

  const input = byId('check-addr-input');
  const address = input?.value?.trim?.() ?? '';
  const errEl = byId('check-error');
  const btn = byId('check-btn');
  const resultWrap = byId('check-result');

  if (errEl) {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }

  if (!address) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'Enter an address.';
    }
    return;
  }

  const prevText = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Checking...';
  }

  try {
    const qualifyDirs = getQualifyDirs();
    const res = await checkHouse(address, qualifyDirs);

    if (res?.error) {
      throw new Error(String(res.error));
    }

    const dir = res.dir ?? '?';
    const score = Number.isFinite(Number(res.score)) ? Number(res.score) : 0;

    const dirEl = byId('check-dir-label');
    if (dirEl) dirEl.textContent = dir;

    const faceEl = byId('check-facing-label');
    if (faceEl) faceEl.textContent = `Faces ${fullDirectionName(dir)}`;

    const addrEl = byId('check-addr-result');
    if (addrEl) addrEl.textContent = res.address || address;

    const fill = byId('check-conf-fill');
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, score))}%`;

    const confVal = byId('check-conf-val');
    if (confVal) confVal.textContent = `${score} / 100`;

    const flagsEl = byId('check-flags');
    if (flagsEl) {
      flagsEl.innerHTML = '';
      (res.flags || []).forEach((f) => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.className = flagClass(f);
        span.textContent = `${flagPrefix(f)} `;
        li.appendChild(span);
        li.appendChild(document.createTextNode(String(f)));
        flagsEl.appendChild(li);
      });
    }

    const redfin = byId('check-redfin-link');
    if (redfin) redfin.style.display = 'none';

    const compassHost = byId('check-compass');
    if (compassHost) {
      compassHost.innerHTML = '';
      compassHost.appendChild(renderCompass(dir));
    }

    const thumb = byId('check-sv-thumb');
    if (thumb) {
      thumb.src = `${API_BASE}/api/streetview-image?lat=${res.lat}&lng=${res.lng}&size=440x360`;
    }

    if (resultWrap) resultWrap.style.display = 'block';
  } catch (e) {
    const thumb = byId('check-sv-thumb');
    if (thumb) thumb.removeAttribute('src');
    if (resultWrap) resultWrap.style.display = 'none';
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = e?.message ? String(e.message) : 'Something went wrong.';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevText || 'Check direction';
    }
  }
}

function fmtRemaining(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s} sec`;
  const m = Math.max(1, Math.round(s / 60));
  return `${m} min`;
}

function listingKey(h) {
  const addr = (h?.address ?? '').trim().toLowerCase();
  const zip = (h?.zip ?? '').trim();
  return `${addr}|${zip}`;
}

function mirrorProgressToMap(label, pct, count = '') {
  setMapProgress(pct, count ? `${label} · ${count}` : label);
}

async function runSearch() {
  if (searchInProgress) return;
  searchInProgress = true;

  try {
    searchCancelled = false;
    const cancelPanelBtn = byId('cancel-btn');
    if (cancelPanelBtn) cancelPanelBtn.hidden = false;
    const mapCancelBtn = byId('map-cancel-btn');
    if (mapCancelBtn) mapCancelBtn.hidden = false;

    if (typeof window.google === 'undefined') {
      showError('Maps SDK not loaded yet — try again in a moment.');
      return;
    }

    const addrEl = byId('addr-input');
    const address = addrEl?.value?.trim?.() ?? '';
    if (!address) return;

    if (lastSelectedPlace && byId('addr-input')?.value !== lastSelectedPlace.formatted_address) {
      lastSelectedPlace = null;
    }

    clearResults();
    excludedVisible = false;
    resetRenderState();
    resetMapView();
    const searchId = Date.now();

    setLoading(true);
    setProgress('Geocoding address...', 5);
    mirrorProgressToMap('Geocoding address...', 5);

    let lat;
    let lng;
    let locType;
    if (lastSelectedPlace?.geometry) {
      lat = lastSelectedPlace.geometry.location.lat();
      lng = lastSelectedPlace.geometry.location.lng();
      locType = lastSelectedPlace.geometry.location_type || 'ROOFTOP';
      lastSelectedPlace = null;
    } else {
      const geo = await geocodeAddr(address);
      if (!geo) {
        setLoading(false);
        showError('Could not geocode that address.');
        return;
      }
      ({ lat, lng, locType } = geo);
    }

    const radiusMiles = parseInt(byId('radius-slider')?.value ?? '5', 10);
    window.__lastSearchRadius = radiusMiles;
    const filters = getFilters();
    const qualifyDirs = getQualifyDirs();
    const propertyTypes = getPropertyTypes();
    lastRenderOpts = { centerLat: lat, centerLng: lng, radiusMiles, searchId };
    window.__lastSearchCenter = { lat, lng };

    const qualify = [];
    const review = [];
    const no = [];

    const allListings = [];
    const seen = new Set();
    let start = 0;
    let fetchedCount = 0;
    let rawFetchedCount = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      let pageListings;
      let rawCount = 0;
      try {
        ({ listings: pageListings, rawCount } = await fetchRedfin(
          lat,
          lng,
          radiusMiles,
          filters,
          start,
          propertyTypes,
        ));
      } catch {
        // If first page fails, show error; otherwise continue with what we have.
        if (page === 0) {
          setLoading(false);
          showError(
            'Redfin request failed. This can happen if Redfin blocks the request — try again in a moment.',
          );
          return;
        }
        break;
      }

      fetchedCount += pageListings.length;
      rawFetchedCount += rawCount;
      for (const h of pageListings) {
        const key = listingKey(h);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        allListings.push(h);
      }

      setProgress(`Fetching listings... (${allListings.length} so far)`, 15);
      mirrorProgressToMap(`Fetching listings... (${allListings.length} so far)`, 15);

      // Stop if Redfin returned fewer results than requested (true last page signal).
      if (rawCount < PAGE_SIZE) break;

      start += PAGE_SIZE;
      await sleep(DELAY_MS);
    }

    console.info(
      `[search] fetched ${rawFetchedCount} raw listings, ${fetchedCount} post-filter, kept ${allListings.length} after dedupe`,
    );
    setProgress(
      `Fetched ${rawFetchedCount} raw, ${fetchedCount} post-filter, ${allListings.length} unique`,
      18,
      `${allListings.length} to analyze`,
    );
    mirrorProgressToMap(
      `Fetched ${rawFetchedCount} raw, ${fetchedCount} post-filter, ${allListings.length} unique`,
      18,
      `${allListings.length} to analyze`,
    );

    if (!allListings.length) {
      setLoading(false);
      showError(`No listings found within ${radiusMiles} miles matching your filters.`);
      return;
    }

    setProgress(`Analyzing ${allListings.length} listings...`, 20, `0 / ${allListings.length}`);
    mirrorProgressToMap(`Analyzing ${allListings.length} listings...`, 20, `0 / ${allListings.length}`);

    const sortEl = document.getElementById('sort-select');
    if (sortEl) sortEl.value = 'default';

    for (let i = 0; i < allListings.length; i++) {
      if (searchCancelled) {
        setProgress('Search cancelled', 100);
        mirrorProgressToMap('Search cancelled', 100);
        break;
      }

      const h = allListings[i];
      const remaining = (allListings.length - (i + 1)) * 0.12;
      const pct = 20 + Math.round(((i + 1) / allListings.length) * 78);

      setProgress(
        `Checking facing direction... (~${fmtRemaining(remaining)} remaining)`,
        pct,
        `${i + 1} / ${allListings.length}`,
      );
      mirrorProgressToMap(
        `Checking facing direction... (~${fmtRemaining(remaining)} remaining)`,
        pct,
        `${i + 1} / ${allListings.length}`,
      );

      let facing;
      try {
        facing = await getFacing({
          lat: h.lat,
          lng: h.lng,
          locType,
          qualifyDirs,
        });
      } catch {
        facing = { error: 'Street View unavailable' };
      }

      if (facing?.error) {
        facing = {
          verdict: 'NO',
          confidence: 'LOW',
          score: 0,
          dir: '?',
          flags: ['Street View unavailable'],
        };
      }

      const distMiles = haversine(lat, lng, h.lat, h.lng) / 1609.34;
      const result = { ...h, ...facing, distMiles };

      if (result.verdict === 'QUALIFY') {
        qualify.push(result);
      } else {
        no.push(result);
      }

      allResults = { qualify, no };
      window.__lastResults = allResults;
      sortAndRender(allResults, sortEl?.value ?? 'default', lastRenderOpts);
      maybePlotMap();
      updateCounts({ qualify: qualify.length, no: no.length });

      if (qualify.length + review.length + no.length === 1) {
        showResultsHeader(address);
        if (window.innerWidth > 768) {
          const mapBtn = document.getElementById('view-map-btn');
          if (mapBtn && document.getElementById('map-view')?.hidden !== false) {
            mapBtn.click();
          }
        }
      }
    }

    setLoading(false);
    showExcludedToggle(Boolean(no.length));

    if (!searchCancelled) {
      setProgress('Done', 100);
      mirrorProgressToMap('Done', 100);
      // Auto-switch to map view on desktop after search completes
      if (window.innerWidth > 768) {
        const mapBtn = document.getElementById('view-map-btn');
        if (mapBtn) mapBtn.click();
      }
    }
  } finally {
    clearMapProgress();
    const cancelPanelBtn = byId('cancel-btn');
    if (cancelPanelBtn) cancelPanelBtn.hidden = true;
    const mapCancelBtnEl = byId('map-cancel-btn');
    if (mapCancelBtnEl) mapCancelBtnEl.hidden = true;
    searchInProgress = false;
  }
}

function toggleExcluded() {
  excludedVisible = !excludedVisible;
  setExcludedVisible(excludedVisible);
}

window.addEventListener('DOMContentLoaded', async () => {
  fetch(`${API_BASE}/health`).catch(() => {});

  initDirPicker();
  initPillPicker('beds-picker');
  initPillPicker('baths-picker');
  initTypePicker();
  initMoreFilters();

  byId('tab-search')?.addEventListener('click', () => setActiveTab('search'));
  byId('tab-check')?.addEventListener('click', () => setActiveTab('check'));

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    sortAndRender(allResults, e.target.value, lastRenderOpts);
    maybePlotMap();
  });

  const searchBtn = byId('search-btn');
  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.textContent = 'Loading maps...';
  }
  try {
    await loadMapsSDK({ onLoaded: onMapsLoaded });
  } catch {
    // ignore — user can retry search; maps may still load on refresh
  } finally {
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.textContent = 'Search listings';
    }
  }

  // Wire events
  if (searchBtn) searchBtn.addEventListener('click', () => runSearch().catch(() => {}));

  byId('cancel-btn')?.addEventListener('click', () => {
    searchCancelled = true;
  });
  byId('map-cancel-btn')?.addEventListener('click', () => {
    searchCancelled = true;
  });

  const excludedToggle = byId('excluded-toggle');
  if (excludedToggle) excludedToggle.addEventListener('click', toggleExcluded);

  const addrInput = byId('addr-input');
  if (addrInput)
    addrInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch().catch(() => {});
  });

  const checkBtn = byId('check-btn');
  if (checkBtn) checkBtn.addEventListener('click', () => runCheckHouse().catch(() => {}));

  const checkAddrInput = byId('check-addr-input');
  if (checkAddrInput)
    checkAddrInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runCheckHouse().catch(() => {});
    });
});

