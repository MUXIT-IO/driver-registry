# Contributing a Driver to the Registry

## Prerequisites

- A working Muxit driver (JavaScript — Tier 1, or .NET DLL — Tier 3)
- The driver packaged as a `.muxdriver` file
- The package uploaded as a GitHub Release asset on your own repository

If you haven't packaged your driver yet, see **[Packaging](#packaging)** below.
For the authoritative format reference, see
[`docs/muxdriver-format.md`](docs/muxdriver-format.md).

## Packaging

This repo ships a small zero-dependency CLI, `scripts/muxit-driver.js`, that
can build a `.muxdriver` and generate a registry entry. Clone this repo once
and run the script against your driver's source directory.

```bash
git clone https://github.com/muxit-io/driver-registry.git
cd your-driver-source-directory    # must contain manifest.json + entryPoint file

# 1. Build the .muxdriver archive
node /path/to/driver-registry/scripts/muxit-driver.js package
# → writes <publisher>-<name>-v<version>.muxdriver into the current directory

# 2. Upload the .muxdriver as a GitHub Release asset on YOUR repository.

# 3. Generate a registry entry for this registry (prompts for URL, tags, …)
node /path/to/driver-registry/scripts/muxit-driver.js registry \
    <publisher>-<name>-v<version>.muxdriver
# → writes <publisher>-<name>.json
```

Prefer to build the package yourself? The `.muxdriver` file is just a ZIP with
a `manifest.json` at the root plus the file named by `manifest.entryPoint`. The
full format is documented in [`docs/muxdriver-format.md`](docs/muxdriver-format.md).

## Submission Steps

### 1. Fork this repository

Fork `muxit-io/driver-registry` on GitHub.

### 2. Add your entry

Copy the generated JSON file into the `drivers/` directory. Name it with your
driver id, slashes replaced by dashes:

```
drivers/alice-rigol-ds1054z.json
```

### 3. Validate locally (optional)

```bash
node scripts/validate-entry.js
```

### 4. Open a pull request

Submit a PR to `main`. CI will automatically validate your entry.

## Entry Schema (Summary)

See [`docs/muxdriver-format.md`](docs/muxdriver-format.md) for the full schema.
Required: `id`, `name`, `version`, `downloadUrl`. Common optional fields:
`description`, `author`, `group`, `tier`, `tags`, `license`, `repository`,
`downloadSize`, `sha256`, `minMuxitVersion`, `published`.

### Example entry

```json
{
  "id": "alice/rigol-ds1054z",
  "name": "Rigol DS1054Z",
  "version": "1.0.0",
  "description": "Driver for Rigol DS1054Z oscilloscope via LAN/SCPI",
  "author": { "name": "Alice", "github": "alice" },
  "group": "instruments",
  "tier": 1,
  "tags": ["oscilloscope", "rigol", "scpi", "lan"],
  "license": "MIT",
  "repository": "https://github.com/alice/muxit-rigol-ds1054z",
  "downloadUrl": "https://github.com/alice/muxit-rigol-ds1054z/releases/download/v1.0.0/alice-rigol-ds1054z-v1.0.0.muxdriver",
  "downloadSize": 4096,
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "minMuxitVersion": "0.3.0",
  "published": "2026-04-10T00:00:00Z"
}
```

## Validation Rules

CI runs `scripts/validate-entry.js` on every PR. It checks:

- All required fields are present and non-empty strings
- Field types are correct (strings, numbers, arrays)
- `id` uses `publisher/name` format
- `id` is unique across all entries (case-insensitive)
- `group` is one of the allowed values
- `tier` is `1` or `3`
- `downloadUrl` uses HTTPS

## Security

- **JavaScript drivers (Tier 1)** run in a V8 sandbox with no filesystem,
  network, or process access. Safe to install from unknown authors.
- **C# DLL drivers (Tier 3)** run with full .NET runtime access. Muxit shows
  a capability audit and requires explicit user approval before loading DLL
  drivers.
- The `sha256` in your registry entry is compared to the downloaded
  `.muxdriver` at install time — a mismatch aborts the install.
