#!/usr/bin/env node
/**
 * Validate driver entry JSON files in drivers/.
 *
 * Checks required fields, field types, value constraints, and ID uniqueness.
 * Exits non-zero if any validation errors are found.
 *
 * Usage: node scripts/validate-entry.js
 *
 * Zero dependencies — uses only Node.js built-ins.
 */
const fs = require('fs');
const path = require('path');

const DRIVERS_DIR = path.resolve(__dirname, '..', 'drivers');

const REQUIRED_FIELDS = ['id', 'name', 'version', 'downloadUrl'];
const VALID_GROUPS = ['instruments', 'motion', 'communication', 'utilities'];
const VALID_TIERS = [1, 3];

const FIELD_TYPES = {
  id: 'string',
  name: 'string',
  version: 'string',
  description: 'string',
  group: 'string',
  tier: 'number',
  repository: 'string',
  license: 'string',
  downloadUrl: 'string',
  downloadSize: 'number',
  sha256: 'string',
  minMuxitVersion: 'string',
  published: 'string',
  readme: 'string',
  changelog: 'string',
};

const ARRAY_FIELDS = ['tags', 'capabilities'];

function validateEntry(file, entry) {
  const errors = [];

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!entry[field] || typeof entry[field] !== 'string' || !entry[field].trim()) {
      errors.push(`missing or empty required field "${field}"`);
    }
  }

  // Field types
  for (const [field, expectedType] of Object.entries(FIELD_TYPES)) {
    if (entry[field] !== undefined && entry[field] !== null) {
      if (typeof entry[field] !== expectedType) {
        errors.push(`"${field}" must be a ${expectedType}, got ${typeof entry[field]}`);
      }
    }
  }

  // Array fields
  for (const field of ARRAY_FIELDS) {
    if (entry[field] !== undefined && entry[field] !== null) {
      if (!Array.isArray(entry[field])) {
        errors.push(`"${field}" must be an array`);
      } else if (!entry[field].every(v => typeof v === 'string')) {
        errors.push(`"${field}" must be an array of strings`);
      }
    }
  }

  // Author object
  if (entry.author !== undefined && entry.author !== null) {
    if (typeof entry.author !== 'object' || Array.isArray(entry.author)) {
      errors.push(`"author" must be an object with { name, github? }`);
    } else {
      if (entry.author.name !== undefined && typeof entry.author.name !== 'string') {
        errors.push(`"author.name" must be a string`);
      }
      if (entry.author.github !== undefined && typeof entry.author.github !== 'string') {
        errors.push(`"author.github" must be a string`);
      }
    }
  }

  // Group constraint
  if (entry.group !== undefined && !VALID_GROUPS.includes(entry.group)) {
    errors.push(`"group" must be one of: ${VALID_GROUPS.join(', ')} (got "${entry.group}")`);
  }

  // Tier constraint
  if (entry.tier !== undefined && !VALID_TIERS.includes(entry.tier)) {
    errors.push(`"tier" must be 1 (JS) or 3 (DLL) (got ${entry.tier})`);
  }

  // ID format: should be publisher/name
  if (entry.id && typeof entry.id === 'string' && !entry.id.includes('/')) {
    errors.push(`"id" should use publisher/name format (e.g., "alice/my-driver")`);
  }

  // Path traversal in ID
  if (entry.id && typeof entry.id === 'string' && entry.id.includes('..')) {
    errors.push(`"id" must not contain path traversal (..)`);
  }

  // downloadUrl should be HTTPS
  if (entry.downloadUrl && typeof entry.downloadUrl === 'string' && !entry.downloadUrl.startsWith('https://')) {
    errors.push(`"downloadUrl" must use HTTPS`);
  }

  return errors;
}

function main() {
  const files = fs.readdirSync(DRIVERS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.log('No driver entries found — nothing to validate.');
    return;
  }

  let hasErrors = false;
  const seenIds = new Map(); // normalized ID → filename

  for (const file of files) {
    const filePath = path.join(DRIVERS_DIR, file);
    let entry;

    try {
      entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`FAIL  ${file}: invalid JSON — ${err.message}`);
      hasErrors = true;
      continue;
    }

    const errors = validateEntry(file, entry);

    // Check ID uniqueness
    if (entry.id && typeof entry.id === 'string') {
      const normalizedId = entry.id.toLowerCase();
      if (seenIds.has(normalizedId)) {
        errors.push(`duplicate id "${entry.id}" (also in ${seenIds.get(normalizedId)})`);
      }
      seenIds.set(normalizedId, file);
    }

    if (errors.length > 0) {
      console.error(`FAIL  ${file}:`);
      for (const err of errors) {
        console.error(`        - ${err}`);
      }
      hasErrors = true;
    } else {
      console.log(`OK    ${file}`);
    }
  }

  console.log(`\nValidated ${files.length} file(s).`);

  if (hasErrors) {
    console.error('\nValidation failed.');
    process.exit(1);
  }

  console.log('All entries valid.');
}

main();
