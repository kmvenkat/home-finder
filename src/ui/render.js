import { fmt$ } from '../lib/utils.js';

let lastSortValue = null;
let lastSearchId = null;

export function resetRenderState() {
  lastSortValue = null;
  lastSearchId = null;
}

function dataKeyForListing(h) {
  const addr = (h?.address ?? '').trim().toLowerCase();
  const zip = (h?.zip ?? '').trim();
  return `${addr}|${zip}`;
}

export function renderCard(h, container, opts = {}) {
  const { radiusMiles } = opts;
  const card = document.createElement('div');
  card.className = `listing-card ${
    h.verdict === 'QUALIFY' ? 'qualify' : h.verdict === 'REVIEW' ? 'review' : 'no'
  }`;

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'card-thumb-wrap';

  const setPlaceholder = () => {
    thumbWrap.innerHTML = `
      <div class="card-thumb-ph" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M4 10.5L12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <path
            d="M10 21.5v-6.2c0-.7.6-1.3 1.3-1.3h1.4c.7 0 1.3.6 1.3 1.3v6.2"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
      </div>
    `;
  };

  if (h.thumbUrl) {
    const img = document.createElement('img');
    img.className = 'card-thumb-img';
    img.loading = 'lazy';
    img.alt = '';
    img.src = h.thumbUrl;
    img.addEventListener('error', () => {
      setPlaceholder();
    });
    thumbWrap.appendChild(img);
  } else {
    setPlaceholder();
  }

  const mapsUrl = `https://maps.google.com/?q=${h.lat},${h.lng}`;
  const svUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${h.lat},${h.lng}`;

  const needleAngle = h.facing ?? 0;
  const needleColor = h.verdict === 'QUALIFY' ? '#b8f54a' : h.verdict === 'REVIEW' ? '#f0c050' : '#5e5c55';
  const rad = (needleAngle - 90) * (Math.PI / 180);
  const nx2 = (14 + 10 * Math.cos(rad)).toFixed(1);
  const ny2 = (14 + 10 * Math.sin(rad)).toFixed(1);

  const verdictTag =
    h.verdict === 'QUALIFY'
      ? `<span class="card-tag qualify">✓ ${h.dir} facing</span>`
      : h.verdict === 'REVIEW'
        ? `<span class="card-tag review">~ ${h.dir} · verify</span>`
        : `<span class="card-tag">✗ ${h.dir} facing</span>`;

  const flagTags = (h.flags || [])
    .slice(0, 2)
    .map((f) => `<span class="card-tag warn">${escapeHtml(f)}</span>`)
    .join('');

  const cityStr = [h.city, h.state, h.zip].filter(Boolean).map(escapeHtml).join(', ');

  const distMiles = Number(h.distMiles);
  const hasDist = Number.isFinite(distMiles);
  const outside =
    hasDist && Number.isFinite(Number(radiusMiles)) && distMiles > Number(radiusMiles);
  const distLabel = hasDist ? `${distMiles.toFixed(1)} mi${outside ? ' †' : ''}` : '';
  const distClass = outside ? 'card-dist card-dist-warn' : 'card-dist';

  // Note: This keeps the original layout, but escapes dynamic strings.
  card.innerHTML = `
    <div class="card-left">
      <div class="card-addr">${escapeHtml(h.address)}</div>
      <div class="card-city">${cityStr}</div>
      <div class="card-specs">
        <span class="card-spec"><strong>${escapeHtml(String(h.beds))}</strong> bd</span>
        <span class="card-spec"><strong>${escapeHtml(String(h.baths))}</strong> ba</span>
        <span class="card-spec"><strong>${escapeHtml(String(h.sqft?.toLocaleString?.() ?? h.sqft))}</strong> sqft</span>
        ${h.yearBuilt ? `<span class="card-spec">built <strong>${escapeHtml(String(h.yearBuilt))}</strong></span>` : ''}
      </div>
      <div class="card-tags">
        ${verdictTag}
        ${flagTags}
      </div>
    </div>
    <div class="card-right">
      <div class="card-right-top">
        <div class="card-right-top-left">
          <div class="card-price">${fmt$(h.price)}</div>
          ${hasDist ? `<div class="${distClass}">${escapeHtml(distLabel)}</div>` : ''}
        </div>
        <div class="card-facing">
          <div class="mini-compass">
            <svg viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
              <line x1="14" y1="14" x2="${nx2}" y2="${ny2}"
                    stroke="${needleColor}" stroke-width="1.8" stroke-linecap="round"/>
              <circle cx="14" cy="14" r="2" fill="${needleColor}"/>
            </svg>
          </div>
          <span class="facing-deg">${escapeHtml(String(h.facing ?? '—'))}°</span>
        </div>
      </div>
      <div class="card-links">
        ${h.url ? `<a class="card-link primary" href="${escapeAttr(h.url)}" target="_blank" rel="noreferrer">Redfin</a>` : ''}
        <a class="card-link" href="${escapeAttr(svUrl)}" target="_blank" rel="noreferrer">StreetView</a>
        <a class="card-link" href="${escapeAttr(mapsUrl)}" target="_blank" rel="noreferrer">Map</a>
      </div>
      <div class="card-conf">${escapeHtml(String(h.confidence))} · ${escapeHtml(String(h.score))}/100</div>
    </div>
  `;

  card.insertBefore(thumbWrap, card.firstChild);

  card.dataset.key = dataKeyForListing(h);
  container.appendChild(card);
}

export function sortAndRender(results, sortValue, opts = {}) {
  const { searchId } = opts;
  const qualifyEl = document.getElementById('listings-qualify');
  const reviewEl = document.getElementById('listings-review');
  const noEl = document.getElementById('listings-no');

  const isStreaming =
    searchId != null &&
    searchId === lastSearchId &&
    sortValue === lastSortValue &&
    sortValue === 'default';

  const sortBucket = (arr) => {
    if (!Array.isArray(arr)) return [];
    if (sortValue === 'default') return arr;

    const copy = [...arr];
    const numOr0 = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    copy.sort((a, b) => {
      if (sortValue === 'price-asc') return numOr0(a.price) - numOr0(b.price);
      if (sortValue === 'price-desc') return numOr0(b.price) - numOr0(a.price);
      if (sortValue === 'dist-asc') return numOr0(a.distMiles) - numOr0(b.distMiles);
      if (sortValue === 'sqft-desc') return numOr0(b.sqft) - numOr0(a.sqft);
      if (sortValue === 'confidence-desc') return numOr0(b.score) - numOr0(a.score);
      if (sortValue === 'year-desc') return numOr0(b.yearBuilt) - numOr0(a.yearBuilt);
      return 0;
    });
    return copy;
  };

  const q = sortBucket(results?.qualify);
  const r = sortBucket(results?.review);
  const n = sortBucket(results?.no);

  if (!isStreaming) {
    if (qualifyEl) qualifyEl.innerHTML = '';
    if (reviewEl) reviewEl.innerHTML = '';
    if (noEl) noEl.innerHTML = '';
  }

  const renderBucket = (arr, el) => {
    if (!el) return;
    if (!isStreaming) {
      arr.forEach((h) => renderCard(h, el, opts));
      return;
    }
    const existing = new Set(
      Array.from(el.querySelectorAll('.listing-card[data-key]'))
        .map((c) => c.dataset.key)
        .filter(Boolean),
    );
    for (const h of arr) {
      const k = dataKeyForListing(h);
      if (!k || existing.has(k)) continue;
      renderCard(h, el, opts);
      existing.add(k);
    }
  };

  renderBucket(q, qualifyEl);
  renderBucket(r, reviewEl);
  renderBucket(n, noEl);

  lastSortValue = sortValue;
  if (searchId != null) lastSearchId = searchId;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(s) {
  // Minimal escaping for href attributes.
  return escapeHtml(s).replaceAll('`', '&#96;');
}

