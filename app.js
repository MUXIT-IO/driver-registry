/* Driver registry landing page — vanilla JS, no dependencies.
   Fetches ./registry.json, renders a filterable list. Each card links to
   ./drivers/<slug>/, which is a static page generated at build time. */

const TIER_LABELS = { 1: 'JS', 3: 'DLL' };

const GROUPS = [
  { id: 'all',           label: 'All' },
  { id: 'instruments',   label: 'Instruments' },
  { id: 'motion',        label: 'Motion' },
  { id: 'communication', label: 'Communication' },
  { id: 'utilities',     label: 'Utilities' },
];

const state = {
  drivers: [],
  search: '',
  group: 'all',
  sort: 'name',
};

const els = {
  search: document.getElementById('search'),
  sort: document.getElementById('sort'),
  tabs: document.getElementById('tabs'),
  list: document.getElementById('list'),
  updated: document.getElementById('updated'),
};

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugFor(id) {
  return id.replace(/\//g, '-').toLowerCase();
}

function matchesSearch(driver, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [
    driver.name,
    driver.id,
    driver.description,
    driver.author && driver.author.name,
    ...(driver.tags || []),
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q);
}

function filterAndSort() {
  const filtered = state.drivers.filter(d => {
    if (state.group !== 'all' && d.group !== state.group) return false;
    return matchesSearch(d, state.search);
  });

  if (state.sort === 'published') {
    filtered.sort((a, b) => {
      const av = a.published || '';
      const bv = b.published || '';
      return bv.localeCompare(av);
    });
  } else {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }
  return filtered;
}

function renderTabs() {
  const counts = {};
  for (const d of state.drivers) {
    counts[d.group || 'other'] = (counts[d.group || 'other'] || 0) + 1;
  }
  counts.all = state.drivers.length;

  els.tabs.innerHTML = GROUPS.map(g => {
    const count = counts[g.id] || 0;
    const active = g.id === state.group ? ' active' : '';
    return `<button class="dm-tab${active}" data-group="${g.id}" type="button">${g.label}<span class="dm-tab-count">${count}</span></button>`;
  }).join('');

  els.tabs.querySelectorAll('.dm-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.group = btn.dataset.group;
      renderTabs();
      renderList();
    });
  });
}

function renderDriverCard(d) {
  const slug = slugFor(d.id);
  const tier = TIER_LABELS[d.tier];
  const authorName = d.author && d.author.name;

  const meta = [
    d.version ? `<span class="dm-tag dm-tag-version">v${escapeHtml(d.version)}</span>` : '',
    tier ? `<span class="dm-tag dm-tag-tier">${escapeHtml(tier)}</span>` : '',
    d.group ? `<span class="dm-tag dm-tag-group">${escapeHtml(d.group)}</span>` : '',
    authorName ? `<span class="dm-tag">${escapeHtml(authorName)}</span>` : '',
    ...(d.tags || []).slice(0, 3).map(t => `<span class="dm-tag">#${escapeHtml(t)}</span>`),
  ].filter(Boolean).join('');

  const desc = d.description ? `<div class="dm-driver-desc">${escapeHtml(d.description)}</div>` : '';
  const download = d.downloadUrl
    ? `<a class="dm-btn dm-btn-download" href="${escapeHtml(d.downloadUrl)}" onclick="event.stopPropagation()">Download</a>`
    : '';

  return `
    <a class="dm-driver" href="./drivers/${escapeHtml(slug)}/">
      <div class="dm-driver-info">
        <div class="dm-driver-name">${escapeHtml(d.name)}</div>
        <div class="dm-driver-meta">${meta}</div>
        ${desc}
      </div>
      <div class="dm-driver-actions">${download}</div>
    </a>
  `;
}

function renderList() {
  const drivers = filterAndSort();

  if (state.drivers.length === 0) {
    els.list.innerHTML = `
      <div class="dm-empty">
        <p>No drivers in the registry yet.</p>
        <p style="margin-top:8px">Be the first — see <a href="https://github.com/muxit-io/driver-registry/blob/main/CONTRIBUTING.md">CONTRIBUTING.md</a> to submit one.</p>
      </div>
    `;
    return;
  }

  if (drivers.length === 0) {
    els.list.innerHTML = `<div class="dm-empty">No drivers match your filters.</div>`;
    return;
  }

  els.list.innerHTML = drivers.map(renderDriverCard).join('');
}

async function load() {
  try {
    const res = await fetch('./registry.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const registry = await res.json();
    state.drivers = Array.isArray(registry.drivers) ? registry.drivers : [];
    if (registry.updated) {
      els.updated.textContent = new Date(registry.updated).toLocaleString();
    }
  } catch (err) {
    els.list.innerHTML = `<div class="dm-empty">Failed to load registry.json — ${escapeHtml(err.message)}</div>`;
    return;
  }

  renderTabs();
  renderList();
}

els.search.addEventListener('input', e => {
  state.search = e.target.value;
  renderList();
});

els.sort.addEventListener('change', e => {
  state.sort = e.target.value;
  renderList();
});

load();
