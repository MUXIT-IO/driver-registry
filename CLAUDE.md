# CLAUDE.md — AI Assistant Instructions for driver-registry

## What This Repo Is

This is the **Muxit Driver Registry** — a GitHub Pages-hosted JSON index of
community drivers for Muxit, a hardware orchestration platform.

The Muxit server fetches `registry.json` from this repo's GitHub Pages
deployment to populate the driver marketplace (Extensions panel → Available
tab).

This repository is **public**. Anything added here — docs, code, commit
messages — is visible to external contributors. Do not reference internal
Muxit repositories or file paths from inside this repo.

## How It Works

1. Community members submit drivers by adding a JSON entry file to `drivers/`
2. A PR validation workflow checks the entry for correctness
3. On merge to `main`, a build workflow combines all `drivers/*.json` into
   `registry.json` and deploys to GitHub Pages

## Repository Structure

```
driver-registry/
  registry.json                  ← Seed file (CI rebuilds and deploys the real one)
  drivers/                       ← One JSON file per driver entry
    publisher-name.json          ← e.g., alice-rigol-ds1054z.json
  docs/
    muxdriver-format.md          ← .muxdriver + manifest + entry schema reference
  scripts/
    muxit-driver.js              ← Zero-dep CLI: package + registry-entry generator
    build-registry.js            ← Combines drivers/*.json → registry.json (zero deps)
    validate-entry.js            ← Validates driver entries (zero deps)
  .github/workflows/
    validate.yml                 ← Runs on PRs: validates new/changed entries
    build-and-deploy.yml         ← Runs on merge to main: rebuilds + deploys to gh-pages
```

## Key Commands

```bash
node scripts/muxit-driver.js package           # Build a .muxdriver from a source tree
node scripts/muxit-driver.js registry <file>   # Generate a drivers/*.json entry
node scripts/build-registry.js                 # Build registry.json → dist/registry.json
node scripts/validate-entry.js                 # Validate all entries in drivers/
```

All scripts are zero-dependency Node.js (no `npm install` needed).

## Driver Entry Schema

Each file in `drivers/` is a JSON object. Required fields: `id`, `name`,
`version`, `downloadUrl`. See `docs/muxdriver-format.md` and
`CONTRIBUTING.md` for the full schema.

## Related Tools

- **Package format + entry schema**: `docs/muxdriver-format.md`
- **Packaging CLI**: `scripts/muxit-driver.js` (zero-dep; builds `.muxdriver`
  archives and generates registry entries)
- **Contributor guide**: `CONTRIBUTING.md`
