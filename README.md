# Muxit Driver Registry

The official index of community drivers for Muxit, a hardware orchestration
platform.

Drivers listed here appear in the Muxit **Extensions** panel (Available tab),
allowing one-click install.

## How It Works

- Each driver has a JSON entry file in `drivers/`
- On merge to `main`, CI combines all entries into `registry.json` and deploys
  to GitHub Pages
- The Muxit server fetches `registry.json` to populate the marketplace

## Submitting a Driver

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. The short version:

1. Package your driver as a `.muxdriver` file — use
   `node scripts/muxit-driver.js package` from this repo, or produce the
   ZIP yourself following [`docs/muxdriver-format.md`](docs/muxdriver-format.md)
2. Upload it as a GitHub Release asset on your repository
3. Generate a registry entry with
   `node scripts/muxit-driver.js registry <file.muxdriver>`
4. Fork this repo, add the JSON file to `drivers/`, and open a PR

## Browse the Registry

- Browsable list: <https://muxit-io.github.io/driver-registry/>
- Per-driver page: `https://muxit-io.github.io/driver-registry/drivers/<publisher>-<name>/`
- Raw JSON index: <https://muxit-io.github.io/driver-registry/registry.json>

The browsable pages are generated from the same `drivers/*.json` files as the
registry, so submitting a driver (see [CONTRIBUTING.md](CONTRIBUTING.md))
automatically gives it a page.

## Local Development

Zero-dependency Node.js scripts:

```bash
# Package a driver source tree into a .muxdriver (run from the driver's dir)
node scripts/muxit-driver.js package

# Generate a registry entry JSON from a built .muxdriver
node scripts/muxit-driver.js registry path/to/my-driver-v1.0.0.muxdriver

# Validate all entries in drivers/
node scripts/validate-entry.js

# Build the combined registry.json + static site
node scripts/build-registry.js
# Output: dist/registry.json, dist/index.html, dist/styles.css,
#         dist/app.js, dist/drivers/<slug>/index.html
```

Preview locally with any static server, e.g.:

```bash
python3 -m http.server -d dist 8000
# then open http://localhost:8000/
```

## Structure

```
drivers/           JSON entry files (one per driver)
docs/              Format and schema references
  muxdriver-format.md  .muxdriver package + manifest + entry schema
site/              Static-site source (landing page, stylesheet, per-driver template)
scripts/           Build, validation, and packaging scripts
  muxit-driver.js      Packaging CLI: .muxdriver builder + registry-entry generator
  build-registry.js    Builds registry.json and the static site into dist/
  validate-entry.js    Validates entry fields and uniqueness
.github/workflows/
  validate.yml         Runs on PRs: validates entries
  build-and-deploy.yml Runs on merge: builds + deploys dist/ to GitHub Pages
```
