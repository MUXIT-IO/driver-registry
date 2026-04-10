# Contributing a Driver to the Registry

## Prerequisites

- A working Muxit driver (JS or C#)
- The driver packaged as a `.muxdriver` file
- The package uploaded as a GitHub Release asset

If you haven't packaged your driver yet, use the Muxit Driver Manager:

```bash
cd muxit-development
node drivers.js package     # Package your driver
node drivers.js registry    # Generate the registry entry JSON
```

## Submission Steps

### 1. Generate Your Registry Entry

Run the registry entry tool in the Muxit development repo:

```bash
node drivers.js registry
```

This creates a JSON file with your driver's metadata, download URL, and SHA256 hash.

### 2. Fork This Repository

Fork `muxit-io/driver-registry` on GitHub.

### 3. Add Your Entry

Copy your generated JSON file into the `drivers/` directory. Name it using your driver ID with slashes replaced by dashes:

```
drivers/alice-rigol-ds1054z.json
```

### 4. Validate Locally (Optional)

```bash
node scripts/validate-entry.js
```

### 5. Open a Pull Request

Submit a PR to `main`. CI will automatically validate your entry.

## Entry Schema

Each file in `drivers/` must be a JSON object with these fields:

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier in `publisher/name` format (e.g., `alice/rigol-ds1054z`) |
| `name` | string | Human-readable display name |
| `version` | string | Semantic version (e.g., `1.0.0`) |
| `downloadUrl` | string | HTTPS URL to the `.muxdriver` release asset |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Short description of the driver |
| `author` | object | `{ "name": "...", "github": "..." }` |
| `group` | string | One of: `instruments`, `motion`, `communication`, `utilities` |
| `tier` | number | `1` (JavaScript, sandboxed) or `3` (C# DLL) |
| `tags` | string[] | Search/discovery tags |
| `license` | string | License identifier (e.g., `MIT`) |
| `repository` | string | Source code URL |
| `downloadSize` | number | Package size in bytes |
| `sha256` | string | SHA256 hash of the `.muxdriver` file |
| `capabilities` | string[] | DLL driver capabilities (auto-detected) |
| `minMuxitVersion` | string | Minimum compatible Muxit version |
| `published` | string | ISO 8601 timestamp |
| `readme` | string | README content (Markdown) |
| `changelog` | string | Changelog content (Markdown) |

### Example Entry

```json
{
  "id": "alice/rigol-ds1054z",
  "name": "Rigol DS1054Z",
  "version": "1.0.0",
  "description": "Driver for Rigol DS1054Z oscilloscope via LAN/SCPI",
  "author": {
    "name": "Alice",
    "github": "alice"
  },
  "group": "instruments",
  "tier": 1,
  "tags": ["oscilloscope", "rigol", "scpi", "lan"],
  "license": "MIT",
  "repository": "https://github.com/alice/muxit-rigol-ds1054z",
  "downloadUrl": "https://github.com/alice/muxit-rigol-ds1054z/releases/download/v1.0.0/rigol-ds1054z.muxdriver",
  "downloadSize": 4096,
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "minMuxitVersion": "0.3.0",
  "published": "2026-04-10T00:00:00Z"
}
```

## Validation Rules

The CI pipeline checks:

- All required fields are present and non-empty strings
- Field types are correct (strings, numbers, arrays)
- `id` uses `publisher/name` format
- `id` is unique across all entries (case-insensitive)
- `group` is one of the allowed values
- `tier` is `1` or `3`
- `downloadUrl` uses HTTPS

## Security

- **JavaScript drivers (Tier 1)** run in a V8 sandbox with no filesystem, network, or process access. These are safe to install from unknown authors.
- **C# DLL drivers (Tier 3)** run with full .NET runtime access. Muxit shows a capability audit and requires explicit user approval before loading DLL drivers.
