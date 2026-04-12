export function byId(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[dom] Missing element #${id}`);
    return null;
  }
  return el;
}

export function initDirPicker() {
  const root = byId('dir-picker');
  if (!root) return;

  const btns = Array.from(root.querySelectorAll('[data-dir]'));
  if (!btns.length) return;

  const setOn = (btn, on) => {
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  };

  const anySelected = btns.some((b) => b.getAttribute('aria-pressed') === 'true' || b.classList.contains('is-on'));
  if (!anySelected) {
    const defaults = new Set(['N', 'NE', 'E']);
    btns.forEach((b) => setOn(b, defaults.has(b.dataset.dir)));
  } else {
    btns.forEach((b) => setOn(b, b.getAttribute('aria-pressed') === 'true' || b.classList.contains('is-on')));
  }

  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const on = !(btn.getAttribute('aria-pressed') === 'true');
      setOn(btn, on);
    });
  });
}

export function getQualifyDirs() {
  const root = byId('dir-picker');
  if (!root) return new Set(['N', 'NE', 'E']);

  const btns = Array.from(root.querySelectorAll('[data-dir]'));
  const picked = btns
    .filter((b) => b.getAttribute('aria-pressed') === 'true' || b.classList.contains('is-on'))
    .map((b) => b.dataset.dir)
    .filter(Boolean);

  return new Set(picked);
}

export function initPillPicker(containerId, { single = true } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const anyBtn = container.querySelector('.pill-btn[data-val=""]');

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn || !container.contains(btn)) return;

    if (single) {
      container.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('is-on'));
      btn.classList.add('is-on');
      return;
    }

    if (anyBtn) {
      if (btn === anyBtn || btn.dataset.val === '') {
        container.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('is-on'));
        btn.classList.add('is-on');
        return;
      }
      anyBtn.classList.remove('is-on');
    }

    btn.classList.toggle('is-on');
    if (anyBtn && !container.querySelector('.pill-btn.is-on')) {
      anyBtn.classList.add('is-on');
    }
  });
}

export function getPillValue(containerId) {
  const el = document.querySelector(`#${containerId} .pill-btn.is-on`);
  return el?.dataset.val ?? '';
}

export function initTypePicker() {
  initPillPicker('type-picker', { single: false });
}

export function setRadiusLabel(miles) {
  const el = document.getElementById('radius-val');
  if (!el) return;
  el.textContent = `${miles} mile${miles > 1 ? 's' : ''}`;
}

const PRICE_STEPS = [
  0, 50000, 100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 700000, 800000,
  900000, 1000000, 1250000, 1500000, 2000000, 5000000, Infinity,
];

const PRICE_LABELS = [
  'Any',
  '$50k',
  '$100k',
  '$150k',
  '$200k',
  '$250k',
  '$300k',
  '$350k',
  '$400k',
  '$450k',
  '$500k',
  '$600k',
  '$700k',
  '$800k',
  '$900k',
  '$1M',
  '$1.25M',
  '$1.5M',
  '$2M',
  '$5M',
  'No max',
];

function formatPriceInput(n) {
  if (n == null || !Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function parsePriceDigits(str) {
  const d = String(str || '').replace(/[^0-9]/g, '');
  if (!d) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

function amountToMinIndex(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  for (let i = 19; i >= 1; i--) {
    if (PRICE_STEPS[i] <= n) return i;
  }
  return 1;
}

function amountToMaxIndex(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 20;
  if (n >= PRICE_STEPS[19]) return 19;
  for (let j = 19; j >= 1; j--) {
    if (PRICE_STEPS[j] <= n) return j;
  }
  return 1;
}

function refreshPriceSliderZIndex(minIdx, maxIdx) {
  const minEl = document.getElementById('price-min-slider');
  const maxEl = document.getElementById('price-max-slider');
  if (!minEl || !maxEl) return;
  if (minIdx >= maxIdx) {
    minEl.style.zIndex = '4';
    maxEl.style.zIndex = '3';
  } else {
    minEl.style.zIndex = minIdx > maxIdx - 1 ? '4' : '2';
    maxEl.style.zIndex = minIdx > maxIdx - 1 ? '2' : '4';
  }
}

function resetFilters() {
  document.querySelectorAll('#beds-picker .pill-btn, #baths-picker .pill-btn').forEach((b) => {
    b.classList.toggle('is-on', b.dataset.val === '');
  });
  document.querySelectorAll('#type-picker .pill-btn').forEach((btn) => {
    btn.classList.toggle('is-on', btn.dataset.type === '6');
  });

  ['f-sqft-min', 'f-sqft-max', 'f-year-min', 'f-year-max'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.selectedIndex = 0;
  });

  const minSl = document.getElementById('price-min-slider');
  const maxSl = document.getElementById('price-max-slider');
  if (minSl) minSl.value = '0';
  if (maxSl) maxSl.value = '20';
  const minIn = document.getElementById('f-minprice');
  const maxIn = document.getElementById('f-maxprice');
  if (minIn) minIn.value = '';
  if (maxIn) maxIn.value = '';

  syncPriceUIFromSliders();

  const slider = document.getElementById('radius-slider');
  if (slider) {
    slider.value = '5';
    slider.dispatchEvent(new Event('input'));
  }
}

function syncPriceUIFromSliders() {
  const minEl = document.getElementById('price-min-slider');
  const maxEl = document.getElementById('price-max-slider');
  const fill = document.getElementById('price-track-fill');
  const minLabel = document.getElementById('price-min-label');
  const maxLabel = document.getElementById('price-max-label');
  const minIn = document.getElementById('f-minprice');
  const maxIn = document.getElementById('f-maxprice');
  if (!minEl || !maxEl) return;

  let minIdx = Math.max(0, Math.min(20, Number(minEl.value)));
  let maxIdx = Math.max(0, Math.min(20, Number(maxEl.value)));
  if (minIdx > maxIdx) {
    maxIdx = minIdx;
    maxEl.value = String(maxIdx);
  }

  if (minLabel) minLabel.textContent = PRICE_LABELS[minIdx] ?? 'Any';
  if (maxLabel) maxLabel.textContent = PRICE_LABELS[maxIdx] ?? 'Any';

  if (fill) {
    const leftPct = (minIdx / 20) * 100;
    const widthPct = ((maxIdx - minIdx) / 20) * 100;
    fill.style.left = `${leftPct}%`;
    fill.style.width = `${widthPct}%`;
  }

  if (minIn) minIn.value = minIdx > 0 ? formatPriceInput(PRICE_STEPS[minIdx]) : '';
  if (maxIn) maxIn.value = maxIdx < 20 && maxIdx > 0 ? formatPriceInput(PRICE_STEPS[maxIdx]) : '';

  refreshPriceSliderZIndex(minIdx, maxIdx);
}

function applyParsedPriceInputs() {
  const minIn = document.getElementById('f-minprice');
  const maxIn = document.getElementById('f-maxprice');
  const minEl = document.getElementById('price-min-slider');
  const maxEl = document.getElementById('price-max-slider');
  if (!minEl || !maxEl) return;

  const minAmt = parsePriceDigits(minIn?.value);
  const maxAmt = parsePriceDigits(maxIn?.value);

  let minIdx = minAmt == null ? 0 : amountToMinIndex(minAmt);
  let maxIdx = maxAmt == null ? 20 : amountToMaxIndex(maxAmt);
  if (minIdx > maxIdx) {
    if (minAmt != null && maxAmt != null) maxIdx = minIdx;
    else if (minAmt != null) maxIdx = 20;
    else minIdx = 0;
  }

  minEl.value = String(minIdx);
  maxEl.value = String(maxIdx);
  syncPriceUIFromSliders();
}

export function initMoreFilters() {
  const btn = document.getElementById('more-filters-btn');
  const panel = document.getElementById('more-filters-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    btn.classList.toggle('is-open', !isOpen);
  });

  document.getElementById('reset-filters-btn')?.addEventListener('click', resetFilters);

  document.getElementById('apply-filters-btn')?.addEventListener('click', () => {
    panel.hidden = true;
    btn.classList.remove('is-open');
  });

  const minSl = document.getElementById('price-min-slider');
  const maxSl = document.getElementById('price-max-slider');
  if (minSl && maxSl) {
    minSl.addEventListener('input', () => {
      let vMin = Number(minSl.value);
      let vMax = Number(maxSl.value);
      if (vMin > vMax) {
        maxSl.value = String(vMin);
        vMax = vMin;
      }
      syncPriceUIFromSliders();
    });
    maxSl.addEventListener('input', () => {
      let vMin = Number(minSl.value);
      let vMax = Number(maxSl.value);
      if (vMax < vMin) {
        minSl.value = String(vMax);
        vMin = vMax;
      }
      syncPriceUIFromSliders();
    });
  }

  const minIn = document.getElementById('f-minprice');
  const maxIn = document.getElementById('f-maxprice');
  const onTextPrice = () => applyParsedPriceInputs();
  minIn?.addEventListener('change', onTextPrice);
  maxIn?.addEventListener('change', onTextPrice);
  minIn?.addEventListener('blur', onTextPrice);
  maxIn?.addEventListener('blur', onTextPrice);

  syncPriceUIFromSliders();

  const slider = document.getElementById('radius-slider');
  if (slider) {
    setRadiusLabel(parseInt(slider.value, 10));
    slider.addEventListener('input', () => {
      setRadiusLabel(parseInt(slider.value, 10));
    });
  }
}

export function getPropertyTypes() {
  const selected = Array.from(document.querySelectorAll('#type-picker .pill-btn.is-on'))
    .filter((b) => b.dataset.type !== undefined && b.dataset.type !== '')
    .map((b) => Number(b.dataset.type));
  return selected.length ? new Set(selected) : null;
}

export function getSortValue() {
  return byId('sort-select')?.value ?? 'default';
}

export function setLoading(on) {
  const searchBtn = byId('search-btn');
  if (searchBtn) searchBtn.disabled = on;

  const progressWrap = byId('progress-wrap');
  if (progressWrap) progressWrap.classList.toggle('active', on);

  const errorMsg = byId('error-msg');
  if (errorMsg) errorMsg.style.display = 'none';
}

export function setProgress(label, pct, count = '') {
  const progressLabel = byId('progress-label');
  if (progressLabel) progressLabel.textContent = label;

  const progressFill = byId('progress-fill');
  if (progressFill) progressFill.style.width = pct + '%';

  const progressCount = byId('progress-count');
  if (progressCount) progressCount.textContent = count;
}

export function showError(msg) {
  const el = byId('error-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

export function clearResults() {
  ['listings-qualify', 'listings-review', 'listings-no'].forEach((id) => {
    const el = byId(id);
    if (el) el.innerHTML = '';
  });

  const resultsHeader = byId('results-header');
  if (resultsHeader) resultsHeader.classList.remove('show');

  const excludedToggle = byId('excluded-toggle');
  if (excludedToggle) excludedToggle.classList.remove('show');

  const listingsNo = byId('listings-no');
  if (listingsNo) listingsNo.style.display = 'none';

  if (excludedToggle) excludedToggle.setAttribute('aria-expanded', 'false');
}

export function showResultsHeader(address) {
  const resultsTitle = byId('results-title');
  if (resultsTitle) resultsTitle.textContent = address;

  const resultsHeader = byId('results-header');
  if (resultsHeader) resultsHeader.classList.add('show');
}

export function updateCounts({ qualify, review, no }) {
  const q = byId('count-qualify');
  if (q) q.textContent = `${qualify} qualify`;

  const r = byId('count-review');
  if (r) r.textContent = `${review} review`;

  const n = byId('count-no');
  if (n) n.textContent = `${no} excluded`;
}

export function showExcludedToggle(show) {
  const el = byId('excluded-toggle');
  if (el) el.classList.toggle('show', show);
}

export function setExcludedVisible(visible) {
  const listingsNo = byId('listings-no');
  if (listingsNo) listingsNo.style.display = visible ? 'grid' : 'none';

  const excludedLabel = byId('excluded-label');
  if (excludedLabel)
    excludedLabel.textContent = visible ? 'Hide excluded listings' : 'Show excluded listings';

  const toggleArrow = byId('toggle-arrow');
  if (toggleArrow)
    toggleArrow.setAttribute('d', visible ? 'M3 7.5L6 4.5L9 7.5' : 'M3 4.5L6 7.5L9 4.5');

  const excludedToggle = byId('excluded-toggle');
  if (excludedToggle) excludedToggle.setAttribute('aria-expanded', visible ? 'true' : 'false');
}
