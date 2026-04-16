let map = null;
let markers = [];
let centerMarker = null;
let radiusCircle = null;
let qualifyPinElements = [];
let activePopup = null;
let popupProjectionOverlay = null;
let onAreaSearch = null;
let mapInitialized = false;
let getResults = null;
let getRenderOpts = null;

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll('`', '&#96;');
}

function priceLabel(h) {
  const p = Number(h.price);
  if (!Number.isFinite(p)) return '?';
  if (p >= 1000000) return `$${(p / 1000000).toFixed(1)}M`;
  return `$${Math.round(p / 1000)}k`;
}

function initGoogleMap() {
  if (mapInitialized) {
    google.maps.event.trigger(map, 'resize');
    return;
  }
  const canvas = document.getElementById('map-canvas');
  if (!canvas || typeof google === 'undefined' || !google.maps) return;

  map = new google.maps.Map(canvas, {
    mapId: 'DEMO_MAP_ID',
    zoom: 11,
    center: { lat: 44.9778, lng: -93.265 },
    disableDefaultUI: true,
    zoomControl: true,
  });

  canvas.style.position = 'relative';

  const popupEl = document.createElement('div');
  popupEl.id = 'map-pin-popup';
  popupEl.style.cssText = `
    position: absolute;
    display: none;
    z-index: 20;
    pointer-events: auto;
  `;
  canvas.appendChild(popupEl);
  popupEl.addEventListener('click', (e) => e.stopPropagation());

  map.addListener('dragend', () => {
    const btn = document.getElementById('search-area-btn');
    if (btn) btn.hidden = false;
  });

  map.addListener('click', () => {
    const popup = document.getElementById('map-pin-popup');
    if (popup) popup.style.display = 'none';
  });

  mapInitialized = true;
}

function resetPinStyles() {
  qualifyPinElements.forEach((el) => {
    if (!el) return;
    el.style.background = '#1e3814';
    el.style.color = '#adc12c';
    el.style.border = '1px solid #adc12c';
    el.style.transform = 'scale(1)';
  });
}

function activateMarker(index, h, markerDiv) {
  resetPinStyles();
  if (markerDiv) {
    markerDiv.style.background = '#adc12c';
    markerDiv.style.color = '#111';
    markerDiv.style.transform = 'scale(1.1)';
  }

  const card = document.querySelector(
    `#map-listing-cards .map-listing-card[data-index="${index}"]`,
  );
  card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.querySelectorAll('#map-listing-cards .map-listing-card').forEach((c) => c.classList.remove('is-active'));
  card?.classList.add('is-active');

  showPinPopup(h, markerDiv);
}

function showPinPopup(h, _markerDiv) {
  const canvas = document.getElementById('map-canvas');
  const popup = document.getElementById('map-pin-popup');
  if (!popup || !canvas || !map || h.lat == null || h.lng == null) return;

  const price = h.price != null ? `$${Number(h.price).toLocaleString()}` : '—';
  const specs = [
    h.beds ? `${h.beds}bd` : null,
    h.baths ? `${h.baths}ba` : null,
    h.sqft ? `${Number(h.sqft).toLocaleString()} sqft` : null,
    h.yearBuilt ? `built ${h.yearBuilt}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const thumbSrc = h.thumbUrl ?? h.thumbnail;
  const thumbHtml = thumbSrc
    ? `<img src="${escapeAttr(String(thumbSrc))}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;flex-shrink:0;" onerror="this.style.display='none'">`
    : `<div style="width:80px;height:80px;background:#292926;border-radius:6px;flex-shrink:0;"></div>`;

  const svUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${h.lat},${h.lng}`;

  popup.innerHTML = `
    <div style="
      background:#1f1f1d;
      border:1px solid #adc12c;
      border-radius:10px;
      padding:10px;
      width:220px;
      box-shadow:0 4px 16px rgba(0,0,0,0.5);
      display:flex;
      gap:10px;
      position:relative;
    ">
      <button type="button" id="map-popup-close" style="
        position:absolute;top:6px;right:8px;
        background:none;border:none;color:#73736e;
        font-size:13px;cursor:pointer;line-height:1;
      ">✕</button>
      ${thumbHtml}
      <div style="flex:1;min-width:0;">
        <div style="
          display:inline-block;font-size:10px;color:#adc12c;
          background:#1e3814;border:1px solid #adc12c;
          border-radius:4px;padding:2px 6px;margin-bottom:4px;
        ">✓ ${escapeHtml(h.dir ?? '?')} facing</div>
        <div style="font-size:13px;font-weight:bold;color:white;margin-bottom:2px;">
          ${escapeHtml(price)}
        </div>
        <div style="font-size:11px;font-weight:500;color:white;margin-bottom:1px;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${escapeHtml(h.address ?? '')}
        </div>
        <div style="font-size:10px;color:#73736e;margin-bottom:4px;">
          ${escapeHtml([h.city, h.state].filter(Boolean).join(', '))}
        </div>
        <div style="font-size:10px;color:#73736e;margin-bottom:6px;">
          ${escapeHtml(specs)}
        </div>
        <div style="display:flex;gap:8px;">
          ${
            h.url
              ? `<a href="${escapeAttr(String(h.url))}" target="_blank" rel="noreferrer"
            style="font-size:11px;color:#adc12c;text-decoration:none;">Redfin</a>`
              : ''
          }
          <a href="${escapeAttr(svUrl)}" target="_blank" rel="noreferrer"
            style="font-size:11px;color:#73736e;text-decoration:none;">StreetView</a>
        </div>
      </div>
    </div>
  `;

  const positionPopup = () => {
    const bounds = map.getBounds();
    const projection = typeof map.getProjection === 'function' ? map.getProjection() : null;
    const canvasRect = canvas.getBoundingClientRect();
    const mapW = canvasRect.width || canvas.offsetWidth;
    const mapH = canvasRect.height || canvas.offsetHeight;
    const popupW = 220;
    const popupH = 120;
    let left;
    let top;

    if (projection && bounds && typeof projection.fromLatLngToPoint === 'function') {
      const topRight = projection.fromLatLngToPoint(bounds.getNorthEast());
      const bottomLeft = projection.fromLatLngToPoint(bounds.getSouthWest());
      const scale = 2 ** map.getZoom();
      const worldPoint = projection.fromLatLngToPoint(
        new google.maps.LatLng(Number(h.lat), Number(h.lng)),
      );
      const x = (worldPoint.x - bottomLeft.x) * scale;
      const y = (worldPoint.y - topRight.y) * scale;
      left = x - popupW / 2;
      top = y - popupH - 20;
    } else {
      if (!popupProjectionOverlay) {
        popupProjectionOverlay = new google.maps.OverlayView();
        popupProjectionOverlay.onAdd = () => {};
        popupProjectionOverlay.draw = () => {};
        popupProjectionOverlay.onRemove = () => {};
        popupProjectionOverlay.setMap(map);
      }
      const proj = popupProjectionOverlay.getProjection();
      if (!proj) return;
      const pt = proj.fromLatLngToContainerPixel(
        new google.maps.LatLng(Number(h.lat), Number(h.lng)),
      );
      if (!pt) return;
      left = pt.x - popupW / 2;
      top = pt.y - popupH - 20;
    }

    left = Math.max(8, Math.min(left, mapW - popupW - 8));
    top = Math.max(8, top);

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.display = 'block';
  };

  positionPopup();
  google.maps.event.addListenerOnce(map, 'idle', positionPopup);

  document.getElementById('map-popup-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.style.display = 'none';
  });

  activePopup = popup;
}

function addQualifyMarkerAdvanced(h, i, priceStr) {
  const markerDiv = document.createElement('div');
  markerDiv.className = 'map-pin';
  markerDiv.textContent = priceStr;
  markerDiv.style.cssText = `
    background: #1e3814; border: 1px solid #adc12c; color: #adc12c;
    border-radius: 14px; padding: 4px 10px; font-size: 11px;
    font-weight: 500; cursor: pointer; white-space: nowrap;
    font-family: monospace; transition: all 0.15s;
  `;

  const Adv = google.maps.marker?.AdvancedMarkerElement;
  const marker = new Adv({
    map,
    position: { lat: h.lat, lng: h.lng },
    content: markerDiv,
    title: h.address,
  });

  const onPinActivate = () => activateMarker(i, h, markerDiv);
  markerDiv.addEventListener('click', (e) => {
    e.stopPropagation();
    onPinActivate();
  });
  marker.addListener?.('gmp-click', onPinActivate);

  markers.push(marker);
  qualifyPinElements[i] = markerDiv;
  h._markerDiv = markerDiv;
}

function addQualifyMarkerClassic(h, i, priceStr) {
  const marker = new google.maps.Marker({
    map,
    position: { lat: h.lat, lng: h.lng },
    label: {
      text: priceStr,
      color: '#adc12c',
      fontSize: '11px',
      fontWeight: '500',
    },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 9,
      fillColor: '#1e3814',
      fillOpacity: 1,
      strokeColor: '#adc12c',
      strokeWeight: 1,
    },
    title: h.address || '',
    optimized: true,
  });

  marker.addListener('click', () => {
    activateMarker(i, h, null);
  });

  markers.push(marker);
  qualifyPinElements[i] = null;
  h._markerDiv = null;
}

function syncMapDirPicker() {
  const mainDirs = new Set(
    Array.from(document.querySelectorAll('#dir-picker .dir-btn.is-on')).map((b) => b.dataset.dir),
  );
  document.querySelectorAll('#map-dir-picker .map-dir-btn').forEach((btn) => {
    btn.classList.toggle('is-on', mainDirs.has(btn.dataset.dir));
  });
}

export function syncMapDirPickerToMain() {
  document.querySelectorAll('#map-dir-picker .map-dir-btn').forEach((mapBtn) => {
    const dir = mapBtn.dataset.dir;
    const mainBtn = document.querySelector(`#dir-picker .dir-btn[data-dir="${dir}"]`);
    if (!mainBtn || !dir) return;
    const on = mapBtn.classList.contains('is-on');
    mainBtn.classList.toggle('is-on', on);
    mainBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function setViewToggleState(isMap) {
  document.getElementById('view-list-btn')?.classList.toggle('is-on', !isMap);
  document.getElementById('view-map-btn')?.classList.toggle('is-on', isMap);
  document.getElementById('map-header-list-btn')?.classList.toggle('is-on', !isMap);
  document.getElementById('map-header-map-btn')?.classList.toggle('is-on', isMap);
}

function hideMapFiltersBar() {
  const bar = document.getElementById('map-filters-bar');
  const moreBtn = document.getElementById('map-more-filters-btn');
  if (bar) bar.hidden = true;
  if (moreBtn) moreBtn.textContent = 'More filters ▾';
}

function syncFiltersToMap() {
  const syncSelect = (mainId, mapId) => {
    const v = document.getElementById(mainId)?.value;
    const el = document.getElementById(mapId);
    if (el && v !== undefined) el.value = v;
  };
  syncSelect('f-minprice', 'map-f-minprice');
  syncSelect('f-maxprice', 'map-f-maxprice');
  syncSelect('f-sqft-min', 'map-f-sqft-min');
  syncSelect('f-sqft-max', 'map-f-sqft-max');

  const bedsVal = document.querySelector('#beds-picker .pill-btn.is-on')?.dataset.val ?? '';
  document.querySelectorAll('#map-beds-picker .map-pill').forEach((b) => {
    b.classList.toggle('is-on', (b.dataset.val ?? '') === bedsVal);
  });

  const bathsVal = document.querySelector('#baths-picker .pill-btn.is-on')?.dataset.val ?? '';
  document.querySelectorAll('#map-baths-picker .map-pill').forEach((b) => {
    b.classList.toggle('is-on', (b.dataset.val ?? '') === bathsVal);
  });

  const activeTypes = new Set(
    Array.from(document.querySelectorAll('#type-picker .pill-btn.is-on')).map((b) => b.dataset.type),
  );
  document.querySelectorAll('#map-type-picker .map-pill').forEach((b) => {
    b.classList.toggle('is-on', activeTypes.has(b.dataset.type));
  });

  const r = document.getElementById('radius-slider')?.value ?? '5';
  const mapSlider = document.getElementById('map-radius-slider');
  if (mapSlider) {
    mapSlider.value = r;
    mapSlider.dispatchEvent(new Event('input'));
  }
}

function enterListView() {
  const mapView = document.getElementById('map-view');
  setViewToggleState(false);
  hideMapFiltersBar();
  if (mapView) mapView.hidden = true;
  const resultsSection = document.getElementById('results-section');
  const panelSearch = document.getElementById('panel-search');
  const hero = document.querySelector('.hero');
  if (resultsSection) resultsSection.style.display = '';
  if (panelSearch) panelSearch.style.display = '';
  if (hero) hero.style.display = '';
  document.body.style.overflow = '';
}

function enterMapView() {
  const mapView = document.getElementById('map-view');
  const resultsSection = document.getElementById('results-section');
  const panelSearch = document.getElementById('panel-search');
  const hero = document.querySelector('.hero');
  if (resultsSection) resultsSection.style.display = 'none';
  if (panelSearch) panelSearch.style.display = 'none';
  if (hero) hero.style.display = 'none';
  document.body.style.overflow = 'hidden';
  setViewToggleState(true);
  if (mapView) {
    mapView.hidden = false;
    mapView.offsetHeight;
    const addrInput = document.getElementById('addr-input');
    const mapSearch = document.getElementById('map-search-input');
    if (mapSearch && addrInput) mapSearch.value = addrInput.value?.trim?.() ?? '';
    syncMapDirPicker();
    syncFiltersToMap();
    requestAnimationFrame(() => {
      initGoogleMap();
      const results =
        (typeof getResults === 'function' ? getResults() : undefined) ?? window.__lastResults;
      if (results) {
        plotResults(results, {
          centerLat: window.__lastSearchCenter?.lat ?? 44.9778,
          centerLng: window.__lastSearchCenter?.lng ?? -93.265,
        });
      }
      setTimeout(() => {
        if (map) {
          google.maps.event.trigger(map, 'resize');
          if (window.__lastSearchCenter) {
            map.setCenter(window.__lastSearchCenter);
          }
        }
      }, 300);
    });
  }
}

export function initMapView({ onSearchArea, getResults: gr, getRenderOpts: gro }) {
  onAreaSearch = onSearchArea;
  getResults = gr;
  getRenderOpts = gro;

  document.querySelectorAll('#view-list-btn, #map-header-list-btn').forEach((btn) => {
    btn.addEventListener('click', () => enterListView());
  });

  document.getElementById('map-logo-btn')?.addEventListener('click', () => {
    document.getElementById('view-list-btn')?.click();
  });

  document.querySelectorAll('#view-map-btn, #map-header-map-btn').forEach((btn) => {
    btn.addEventListener('click', () => enterMapView());
  });

  document.querySelectorAll('#map-dir-picker .map-dir-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('is-on');
    });
  });

  document.getElementById('map-search-btn')?.addEventListener('click', () => {
    const val = document.getElementById('map-search-input')?.value?.trim?.();
    if (val && onAreaSearch) onAreaSearch({ address: val });
  });

  document.getElementById('map-search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('map-search-btn')?.click();
    }
  });

  document.getElementById('map-more-filters-btn')?.addEventListener('click', () => {
    const moreBtn = document.getElementById('map-more-filters-btn');
    const bar = document.getElementById('map-filters-bar');
    if (!moreBtn || !bar) return;
    bar.hidden = !bar.hidden;
    moreBtn.textContent = bar.hidden ? 'More filters ▾' : 'More filters ▴';
  });

  ['map-beds-picker', 'map-baths-picker'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      const btn = e.target.closest('.map-pill');
      if (!btn) return;
      const container = document.getElementById(id);
      if (!container) return;
      container.querySelectorAll('.map-pill').forEach((b) => b.classList.remove('is-on'));
      btn.classList.add('is-on');
    });
  });

  document.getElementById('map-type-picker')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.map-pill');
    if (!btn) return;
    btn.classList.toggle('is-on');
    const container = document.getElementById('map-type-picker');
    if (!container?.querySelector('.map-pill.is-on')) {
      btn.classList.add('is-on');
    }
  });

  document.getElementById('map-radius-slider')?.addEventListener('input', (e) => {
    const v = e.target.value;
    const label = document.getElementById('map-radius-val');
    if (label) label.textContent = `${v} mi`;
  });

  document.getElementById('map-filters-apply')?.addEventListener('click', () => {
    const syncSelect = (mapId, mainId) => {
      const v = document.getElementById(mapId)?.value;
      const main = document.getElementById(mainId);
      if (main && v !== undefined) main.value = v;
    };
    syncSelect('map-f-minprice', 'f-minprice');
    syncSelect('map-f-maxprice', 'f-maxprice');
    syncSelect('map-f-sqft-min', 'f-sqft-min');
    syncSelect('map-f-sqft-max', 'f-sqft-max');

    const syncPill = (mapPickerId, mainPickerId) => {
      const active =
        document.querySelector(`#${mapPickerId} .map-pill.is-on`)?.dataset.val ?? '';
      document.querySelectorAll(`#${mainPickerId} .pill-btn`).forEach((b) => {
        b.classList.toggle('is-on', (b.dataset.val ?? '') === active);
      });
    };
    syncPill('map-beds-picker', 'beds-picker');
    syncPill('map-baths-picker', 'baths-picker');

    const selectedTypes = new Set(
      Array.from(document.querySelectorAll('#map-type-picker .map-pill.is-on')).map((b) => b.dataset.type),
    );
    document.querySelectorAll('#type-picker .pill-btn').forEach((b) => {
      b.classList.toggle('is-on', selectedTypes.has(b.dataset.type));
    });

    const r = document.getElementById('map-radius-slider')?.value;
    const mainSlider = document.getElementById('radius-slider');
    if (mainSlider && r) {
      mainSlider.value = r;
      mainSlider.dispatchEvent(new Event('input'));
    }

    hideMapFiltersBar();

    if (onAreaSearch) {
      const center = window.__lastSearchCenter;
      if (center) onAreaSearch({ lat: center.lat, lng: center.lng });
    }
  });

  document.getElementById('map-filters-reset')?.addEventListener('click', () => {
    ['map-f-minprice', 'map-f-maxprice', 'map-f-sqft-min', 'map-f-sqft-max'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['map-beds-picker', 'map-baths-picker'].forEach((id) => {
      const container = document.getElementById(id);
      container?.querySelectorAll('.map-pill').forEach((b, i) => {
        b.classList.toggle('is-on', i === 0);
      });
    });
    document.querySelector('#map-type-picker .map-pill')?.classList.add('is-on');
    document.querySelectorAll('#map-type-picker .map-pill:not(:first-child)').forEach((b) => {
      b.classList.remove('is-on');
    });
    const slider = document.getElementById('map-radius-slider');
    if (slider) {
      slider.value = '5';
      slider.dispatchEvent(new Event('input'));
    }
  });

  document.getElementById('search-area-btn')?.addEventListener('click', () => {
    if (!map || !onAreaSearch) return;
    const center = map.getCenter();
    if (!center) return;
    onAreaSearch({ lat: center.lat(), lng: center.lng() });
    const btn = document.getElementById('search-area-btn');
    if (btn) btn.hidden = true;
  });
}

export function plotResults(results, opts = {}) {
  const mapView = document.getElementById('map-view');
  if (!mapView || mapView.hidden) return;
  if (typeof google === 'undefined' || !google.maps) return;

  if (!mapInitialized) initGoogleMap();
  if (!mapInitialized || !map) return;

  const { centerLat, centerLng } = opts;
  if (centerLat == null || centerLng == null) return;

  markers.forEach((m) => {
    if (m?.setMap) m.setMap(null);
    else if (m?.map !== undefined) m.map = null;
  });
  markers = [];
  qualifyPinElements = [];

  if (centerMarker) {
    if (centerMarker.setMap) centerMarker.setMap(null);
    else if (centerMarker.map !== undefined) centerMarker.map = null;
    centerMarker = null;
  }

  const qEl = document.getElementById('map-qualify-count');
  const nEl = document.getElementById('map-excluded-count');
  if (qEl) qEl.textContent = `${results?.qualify?.length ?? 0} qualify`;
  if (nEl) nEl.textContent = `${results?.no?.length ?? 0} excluded`;

  const qualifyList = results?.qualify ?? [];
  const bounds = new google.maps.LatLngBounds();
  // Always include the search center so it stays in view
  bounds.extend({ lat: centerLat, lng: centerLng });
  let boundsCount = 1;
  qualifyList.forEach((h) => {
    if (h.lat != null && h.lng != null) {
      bounds.extend({ lat: h.lat, lng: h.lng });
      boundsCount += 1;
    }
  });

  const useAdvanced = typeof google.maps.marker?.AdvancedMarkerElement === 'function';

  qualifyList.forEach((h, i) => {
    const pl = priceLabel(h);
    if (useAdvanced) {
      addQualifyMarkerAdvanced(h, i, pl);
    } else {
      addQualifyMarkerClassic(h, i, pl);
    }
  });

  (results?.no ?? []).forEach((h) => {
    if (useAdvanced) {
      const dotDiv = document.createElement('div');
      dotDiv.style.cssText = `
        width: 8px; height: 8px; background: #333331;
        border: 1px solid #444; border-radius: 50%;
      `;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: h.lat, lng: h.lng },
        content: dotDiv,
      });
      markers.push(marker);
    } else {
      const marker = new google.maps.Marker({
        map,
        position: { lat: h.lat, lng: h.lng },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 4,
          fillColor: '#333331',
          fillOpacity: 1,
          strokeColor: '#444',
          strokeWeight: 1,
        },
        optimized: true,
      });
      markers.push(marker);
    }
  });

  if (useAdvanced) {
    const centerDiv = document.createElement('div');
    centerDiv.style.cssText = `
      width: 16px;
      height: 16px;
      background: #8b5cf6;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 0 3px rgba(139,92,246,0.4), 0 2px 6px rgba(0,0,0,0.5);
    `;
    centerMarker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: centerLat, lng: centerLng },
      content: centerDiv,
      title: 'Search center',
      zIndex: 999,
    });
  } else {
    centerMarker = new google.maps.Marker({
      map,
      position: { lat: centerLat, lng: centerLng },
      title: 'Search center',
      zIndex: 999,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#8b5cf6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });
  }

  if (radiusCircle) {
    radiusCircle.setMap(null);
    radiusCircle = null;
  }

  const radiusMiles = Number(window.__lastSearchRadius ?? 5);
  const radiusMeters = radiusMiles * 1609.34;

  radiusCircle = new google.maps.Circle({
    map,
    center: { lat: centerLat, lng: centerLng },
    radius: radiusMeters,
    strokeColor: '#8b5cf6',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: '#8b5cf6',
    fillOpacity: 0.04,
    clickable: false,
    zIndex: 1,
  });

  if (boundsCount > 0) {
    map.fitBounds(bounds, 60);
  } else {
    map.setCenter({ lat: centerLat, lng: centerLng });
    map.setZoom(11);
  }

  renderListingCards(qualifyList);
}

function renderListingCards(listings) {
  const container = document.getElementById('map-listing-cards');
  if (!container) return;
  container.innerHTML = '';

  const radius = Number(window.__lastSearchRadius);
  const radiusRef = Number.isFinite(radius) ? radius : 5;

  listings.forEach((h, i) => {
    const price = h.price != null ? `$${Number(h.price).toLocaleString()}` : '—';

    const distMiles = Number(h.distMiles);
    const hasDist = Number.isFinite(distMiles);
    const outside = hasDist && distMiles > radiusRef;
    const distLabel = hasDist ? `${distMiles.toFixed(1)} mi${outside ? ' †' : ''}` : '';

    const cityStr = [h.city, h.state, h.zip].filter(Boolean).map(escapeHtml).join(', ');

    const lat = Number(h.lat);
    const lng = Number(h.lng);
    const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`;
    const svUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

    const thumbUrl = h.thumbUrl ?? h.thumbnail;
    const thumbHtml = thumbUrl
      ? `<img class="map-listing-thumb" src="${escapeAttr(String(thumbUrl))}" loading="lazy" alt=""
          onerror="this.style.display='none';var n=this.nextElementSibling;if(n)n.style.display='flex'"><div class="map-listing-thumb map-listing-thumb-fallback" style="display:none" aria-hidden="true"></div>`
      : `<div class="map-listing-thumb map-listing-thumb-fallback" aria-hidden="true"></div>`;

    const card = document.createElement('div');
    card.className = 'map-listing-card';
    card.dataset.index = String(i);
    card.innerHTML = `
    ${thumbHtml}
    <div class="map-listing-body">
      <div class="map-listing-price">${price}</div>
      ${hasDist ? `<div class="map-listing-dist ${outside ? 'warn' : ''}">${escapeHtml(distLabel)}</div>` : ''}
      <div class="map-listing-addr">${escapeHtml(h.address ?? '')}</div>
      <div class="map-listing-city">${cityStr}</div>
      <div class="map-listing-specs">
        <span><strong>${escapeHtml(String(h.beds ?? '—'))}</strong> bd</span>
        <span><strong>${escapeHtml(String(h.baths ?? '—'))}</strong> ba</span>
        <span><strong>${(h.sqft ?? 0).toLocaleString()}</strong> sqft</span>
        ${h.yearBuilt ? `<span>built <strong>${escapeHtml(String(h.yearBuilt))}</strong></span>` : ''}
      </div>
    </div>
    <div class="map-listing-right">
      <span class="map-card-tag qualify">✓ ${escapeHtml(h.dir ?? '?')} facing</span>
      <div class="map-listing-right-divider"></div>
      <div class="map-listing-links">
        ${h.url ? `<a href="${escapeAttr(String(h.url))}" target="_blank" rel="noreferrer" class="map-card-link primary">Redfin</a>` : ''}
        <a href="${escapeAttr(svUrl)}" target="_blank" rel="noreferrer" class="map-card-link">StreetView</a>
        <a href="${escapeAttr(mapsUrl)}" target="_blank" rel="noreferrer" class="map-card-link">Map</a>
      </div>
    </div>
  `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      activateMarker(i, h, h._markerDiv);
      if (map && h.lat != null && h.lng != null) {
        map.panTo({ lat: h.lat, lng: h.lng });
        map.setZoom(15);
      }
    });

    container.appendChild(card);
  });
}

export function setMapProgress(pct, label) {
  const wrap = document.getElementById('map-progress-wrap');
  const bar = document.getElementById('map-progress-bar');
  const lbl = document.getElementById('map-progress-label');
  if (!wrap) return;
  wrap.hidden = false;
  if (bar) bar.style.setProperty('--pct', `${pct}%`);
  if (lbl) lbl.textContent = label ?? '';
}

export function clearMapProgress() {
  const wrap = document.getElementById('map-progress-wrap');
  if (wrap) wrap.hidden = true;
  const bar = document.getElementById('map-progress-bar');
  if (bar) bar.style.setProperty('--pct', '0%');
}

export function resetMapView() {
  markers.forEach((m) => {
    if (m?.setMap) m.setMap(null);
    else if (m?.map !== undefined) m.map = null;
  });
  markers = [];
  qualifyPinElements = [];

  if (centerMarker) {
    if (centerMarker.setMap) centerMarker.setMap(null);
    else if (centerMarker.map !== undefined) centerMarker.map = null;
    centerMarker = null;
  }
  if (radiusCircle) {
    radiusCircle.setMap(null);
    radiusCircle = null;
  }
  const cards = document.getElementById('map-listing-cards');
  if (cards) cards.innerHTML = '';
  const searchBtn = document.getElementById('search-area-btn');
  if (searchBtn) searchBtn.hidden = true;
  const popupEl = document.getElementById('map-pin-popup');
  if (popupEl) popupEl.style.display = 'none';
}
