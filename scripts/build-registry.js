#!/usr/bin/env node
/**
 * Build the driver registry index and static site.
 *
 * Reads all JSON files from drivers/, validates required fields, combines
 * them into dist/registry.json, copies site/ assets to dist/, and renders
 * a static detail page for each driver at dist/drivers/<slug>/index.html.
 *
 * Usage: node scripts/build-registry.js
 *
 * Zero dependencies — uses only Node.js built-ins.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRIVERS_DIR = path.join(ROOT, 'drivers');
const SITE_DIR = path.join(ROOT, 'site');
const OUT_DIR = path.join(ROOT, 'dist');
const REQUIRED_FIELDS = ['id', 'name', 'version', 'downloadUrl'];
const TIER_LABELS = { 1: 'JS', 3: 'DLL' };

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

function formatBytes(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function renderTemplate(template, values) {
  return template.replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g, (_, raw, plain) => {
    if (raw != null) return values[raw] != null ? values[raw] : '';
    return escapeHtml(values[plain] != null ? values[plain] : '');
  });
}

function renderDriverPage(template, entry) {
  const slug = slugFor(entry.id);
  const tierLabel = TIER_LABELS[entry.tier];
  const authorName = entry.author && entry.author.name;
  const authorGithub = entry.author && entry.author.github;

  const metaDescription = entry.description
    ? entry.description
    : `${entry.name} — Muxit driver, version ${entry.version}.`;

  const tierBadge = tierLabel
    ? `<span class="dm-tag dm-tag-tier">${escapeHtml(tierLabel)}</span>`
    : '';

  const groupBadge = entry.group
    ? `<span class="dm-tag dm-tag-group">${escapeHtml(entry.group)}</span>`
    : '';

  let authorBadge = '';
  if (authorName) {
    const label = `by ${authorName}`;
    authorBadge = authorGithub
      ? `<a class="dm-tag" href="https://github.com/${escapeHtml(authorGithub)}">${escapeHtml(label)}</a>`
      : `<span class="dm-tag">${escapeHtml(label)}</span>`;
  }

  const licenseBadge = entry.license
    ? `<span class="dm-tag">${escapeHtml(entry.license)}</span>`
    : '';

  const descriptionBlock = entry.description
    ? `<p class="detail-description">${escapeHtml(entry.description)}</p>`
    : '';

  const repositoryButton = entry.repository
    ? `<a class="dm-btn dm-btn-secondary" href="${escapeHtml(entry.repository)}">View repository</a>`
    : '';

  const metadataRows = [];
  if (entry.group)           metadataRows.push(['Group', escapeHtml(entry.group)]);
  if (tierLabel)             metadataRows.push(['Tier', `${escapeHtml(tierLabel)} (${entry.tier === 1 ? 'JavaScript, sandboxed' : 'C# DLL'})`]);
  if (entry.license)         metadataRows.push(['License', escapeHtml(entry.license)]);
  if (entry.published)       metadataRows.push(['Published', escapeHtml(formatDate(entry.published))]);
  if (entry.minMuxitVersion) metadataRows.push(['Minimum Muxit version', escapeHtml(entry.minMuxitVersion)]);
  if (entry.downloadSize)    metadataRows.push(['Download size', escapeHtml(formatBytes(entry.downloadSize))]);
  if (entry.sha256)          metadataRows.push(['SHA-256', `<code>${escapeHtml(entry.sha256)}</code>`]);
  if (entry.repository)      metadataRows.push(['Repository', `<a href="${escapeHtml(entry.repository)}">${escapeHtml(entry.repository)}</a>`]);
  if (Array.isArray(entry.capabilities) && entry.capabilities.length) {
    metadataRows.push(['Capabilities', entry.capabilities.map(c => `<code>${escapeHtml(c)}</code>`).join(' ')]);
  }
  const metadataRowsHtml = metadataRows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('\n        ');

  const tagsSection = Array.isArray(entry.tags) && entry.tags.length
    ? `<section class="detail-section">
      <h2>Tags</h2>
      <div class="tag-list">
        ${entry.tags.map(t => `<span class="dm-tag">#${escapeHtml(t)}</span>`).join(' ')}
      </div>
    </section>`
    : '';

  const readmeSection = entry.readme
    ? `<section class="detail-section">
      <h2>README</h2>
      <div class="markdown-block">${escapeHtml(entry.readme)}</div>
    </section>`
    : '';

  const changelogSection = entry.changelog
    ? `<section class="detail-section">
      <h2>Changelog</h2>
      <div class="markdown-block">${escapeHtml(entry.changelog)}</div>
    </section>`
    : '';

  return renderTemplate(template, {
    name: entry.name,
    id: entry.id,
    version: entry.version,
    downloadUrl: entry.downloadUrl,
    slug,
    metaDescription,
    tierBadge,
    groupBadge,
    authorBadge,
    licenseBadge,
    descriptionBlock,
    repositoryButton,
    metadataRows: metadataRowsHtml,
    tagsSection,
    readmeSection,
    changelogSection,
  });
}

function copySiteAssets() {
  for (const name of ['index.html', 'styles.css', 'app.js']) {
    fs.copyFileSync(path.join(SITE_DIR, name), path.join(OUT_DIR, name));
  }
}

function writeDriverPages(drivers) {
  const template = fs.readFileSync(path.join(SITE_DIR, 'driver-template.html'), 'utf8');
  const outDir = path.join(OUT_DIR, 'drivers');
  fs.mkdirSync(outDir, { recursive: true });
  for (const entry of drivers) {
    const slug = slugFor(entry.id);
    const pageDir = path.join(outDir, slug);
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, 'index.html'), renderDriverPage(template, entry));
  }
}

function main() {
  const files = fs.readdirSync(DRIVERS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  const drivers = [];
  const errors = [];
  const seenIds = new Set();

  for (const file of files) {
    const filePath = path.join(DRIVERS_DIR, file);
    let entry;

    try {
      entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      errors.push(`${file}: invalid JSON — ${err.message}`);
      continue;
    }

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (!entry[field] || typeof entry[field] !== 'string' || !entry[field].trim()) {
        errors.push(`${file}: missing or empty required field "${field}"`);
      }
    }

    // Check for duplicate IDs
    if (entry.id) {
      const normalizedId = entry.id.toLowerCase();
      if (seenIds.has(normalizedId)) {
        errors.push(`${file}: duplicate driver id "${entry.id}"`);
      }
      seenIds.add(normalizedId);
    }

    if (errors.length > 0) continue;
    drivers.push(entry);
  }

  if (errors.length > 0) {
    console.error('Build failed with errors:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  const registry = {
    version: 1,
    updated: new Date().toISOString(),
    drivers,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'registry.json');
  fs.writeFileSync(outPath, JSON.stringify(registry, null, 2) + '\n');

  copySiteAssets();
  writeDriverPages(drivers);

  console.log(`Built registry.json — ${drivers.length} driver(s)`);
  console.log(`Output: ${OUT_DIR}`);
}

main();
