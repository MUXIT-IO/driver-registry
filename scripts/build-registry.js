#!/usr/bin/env node
/**
 * Build the driver registry index.
 *
 * Reads all JSON files from drivers/, validates required fields,
 * combines them into a single registry.json, and writes it to dist/.
 *
 * Usage: node scripts/build-registry.js
 *
 * Zero dependencies — uses only Node.js built-ins.
 */
const fs = require('fs');
const path = require('path');

const DRIVERS_DIR = path.resolve(__dirname, '..', 'drivers');
const OUT_DIR = path.resolve(__dirname, '..', 'dist');
const REQUIRED_FIELDS = ['id', 'name', 'version', 'downloadUrl'];

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

  console.log(`Built registry.json — ${drivers.length} driver(s)`);
  console.log(`Output: ${outPath}`);
}

main();
