# Muxit Driver Registry

The official index of community drivers for [Muxit](https://github.com/muxit-io/muxit-development), a hardware orchestration platform.

Drivers listed here appear in the Muxit **Extensions** panel (Available tab), allowing one-click install.

## How It Works

- Each driver has a JSON entry file in `drivers/`
- On merge to `main`, CI combines all entries into `registry.json` and deploys to GitHub Pages
- The Muxit server fetches `registry.json` to populate the marketplace

## Submitting a Driver

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. The short version:

1. Package your driver as a `.muxdriver` file (using `node drivers.js package` in the Muxit repo)
2. Upload it as a GitHub Release asset on your repository
3. Generate a registry entry (using `node drivers.js registry` in the Muxit repo)
4. Fork this repo, add the JSON file to `drivers/`, and open a PR

## Registry URL

```
https://muxit-io.github.io/driver-registry/registry.json
```

## Local Development

Both scripts are zero-dependency Node.js:

```bash
# Validate all driver entries
node scripts/validate-entry.js

# Build the combined registry.json
node scripts/build-registry.js
# Output: dist/registry.json
```

## Structure

```
drivers/           JSON entry files (one per driver)
scripts/           Build and validation scripts
  build-registry.js    Combines drivers/*.json into registry.json
  validate-entry.js    Validates entry fields and uniqueness
.github/workflows/
  validate.yml         Runs on PRs: validates entries
  build-and-deploy.yml Runs on merge: builds + deploys to GitHub Pages
```
