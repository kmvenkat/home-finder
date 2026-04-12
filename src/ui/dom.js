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

function formatPrice(val) {
  const n = Number(val);
  if (!n) return '';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n}`;
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

  const minIn = document.getElementById('f-minprice');
  const maxIn = document.getElementById('f-maxprice');
  if (minIn) minIn.value = '';
  if (maxIn) maxIn.value = '';

  const presetBtns = document.querySelectorAll('#price-presets .pill-btn');
  presetBtns.forEach((b) => b.classList.toggle('is-on', b === presetBtns[0]));

  const slider = document.getElementById('radius-slider');
  if (slider) {
    slider.value = '5';
    slider.dispatchEvent(new Event('input'));
  }
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

  initPillPicker('price-presets');

  document.getElementById('price-presets')?.addEventListener('click', (e) => {
    const pillBtn = e.target.closest('.pill-btn');
    if (!pillBtn) return;
    const min = pillBtn.dataset.min;
    const max = pillBtn.dataset.max;
    const minEl = document.getElementById('f-minprice');
    const maxEl = document.getElementById('f-maxprice');
    if (minEl) minEl.value = min ? formatPrice(min) : '';
    if (maxEl) maxEl.value = max ? formatPrice(max) : '';
  });

  ['f-minprice', 'f-maxprice'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      document.querySelectorAll('#price-presets .pill-btn').forEach((b) => b.classList.remove('is-on'));
    });
  });

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
