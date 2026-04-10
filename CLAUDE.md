# CLAUDE.md — AI Assistant Instructions for driver-registry

## What This Repo Is

This is the **Muxit Driver Registry** — a GitHub Pages-hosted JSON index of community drivers for [Muxit](https://github.com/muxit-io/muxit-development), a hardware orchestration platform.

The Muxit server fetches `registry.json` from this repo's GitHub Pages deployment to populate the driver marketplace (Extensions panel → Available tab).

## How It Works

1. Community members submit drivers by adding a JSON entry file to `drivers/`
2. A PR validation workflow checks the entry for correctness
3. On merge to `main`, a build workflow combines all `drivers/*.json` into `registry.json` and deploys to GitHub Pages

## Repository Structure

```
driver-registry/
  registry.json                  ← Seed file (CI rebuilds and deploys the real one)
  drivers/                       ← One JSON file per driver entry
    publisher-name.json          ← e.g., alice-rigol-ds1054z.json
  scripts/
    build-registry.js            ← Combines drivers/*.json → registry.json (zero deps)
    validate-entry.js            ← Validates driver entries (zero deps)
  .github/workflows/
    validate.yml                 ← Runs on PRs: validates new/changed entries
    build-and-deploy.yml         ← Runs on merge to main: rebuilds + deploys to gh-pages
```

## Key Commands

```bash
node scripts/build-registry.js              # Build registry.json → dist/registry.json
node scripts/validate-entry.js              # Validate all entries in drivers/
```

Both scripts are zero-dependency Node.js (no npm install needed).

## Driver Entry Schema

Each file in `drivers/` is a JSON object. Required fields: `id`, `name`, `version`, `downloadUrl`. See `CONTRIBUTING.md` for the full schema.

## Related Code

- **Consumer**: `muxit-development/MuxitServer/Drivers/DriverMarketplace.cs` fetches `registry.json`
- **Producer**: `muxit-development/lib/driver-manager/registry-entry.js` generates entry JSON files
- **Docs**: `muxit-development/docs-site/guides/driver-marketplace.md` describes the submission workflow
