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

  // Ensure defaults on load (N, NE, E) unless markup already has selections.
  const anySelected = btns.some((b) => b.getAttribute('aria-pressed') === 'true' || b.classList.contains('is-on'));
  if (!anySelected) {
    const defaults = new Set(['N', 'NE', 'E']);
    btns.forEach((b) => setOn(b, defaults.has(b.dataset.dir)));
  } else {
    // Normalize class/aria so they stay in sync.
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

export function initTypePicker() {
  document.querySelectorAll('#type-picker .type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('is-on');
    });
  });
}

export function getPropertyTypes() {
  const selected = Array.from(document.querySelectorAll('#type-picker .type-btn.is-on')).map((b) =>
    Number(b.dataset.type),
  );
  return selected.length ? new Set(selected) : null; // null = no filter
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

