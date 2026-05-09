# `.muxdriver` Package and Registry Entry Format

This spec defines two artifacts:

1. The `.muxdriver` package — a signed-ish, self-describing archive of a driver.
2. The registry entry JSON — the file you submit to `drivers/` in this repo.

If you use `scripts/muxit-driver.js`, both are produced for you. This document
is the reference if you want to produce them by hand or with other tooling.

## 1. `.muxdriver` package

A `.muxdriver` file is a plain ZIP archive with a fixed layout.

### Required entries

| Path            | Description |
|-----------------|-------------|
| `manifest.json` | Driver metadata (see §1.1). |
| `<entryPoint>`  | The file named by `manifest.entryPoint`. Must be a bare filename (no subdirectories, no `..`). For JS drivers this is typically `<name>.driver.js`; for DLL drivers it is typically `<name>.dll`. |

### Optional entries

| Path           | Description |
|----------------|-------------|
| `README.md`    | User-facing documentation shown in the marketplace UI. |
| `deps/**`      | Native or managed dependencies required by a DLL driver (Tier 3). The server unpacks `deps/` alongside the main DLL at install time. |
| `CHANGELOG.md` | Version history. Surfaced in the marketplace UI when present. |

### 1.1. `manifest.json` schema

```jsonc
{
  "formatVersion": 1,              // Required. Currently always 1.
  "id": "publisher/driver-name",   // Required. Lowercase, kebab-case, publisher/ prefix.
  "name": "Human Readable Name",   // Required.
  "version": "1.0.0",              // Required. Semver x.y.z.
  "entryPoint": "driver.driver.js",// Required. Bare filename — must exist in the package root.
  "tier": 1,                       // Required. 1 = JavaScript, 3 = .NET DLL.

  "description": "...",            // Optional but strongly encouraged (≥ 40 chars).
  "author": { "name": "Alice" },   // Optional.
  "group": "instruments",          // Optional. One of: instruments, motion, communication, utilities.
  "tags": ["scpi", "oscilloscope"] // Optional. Free-form strings.
}
```

Notes:

- `id` uses `publisher/name`. The publisher segment keeps names namespaced so
  two people can publish a driver called `serial-probe` without collision.
- `tier` drives sandboxing and install policy in the Muxit server. Tier 1 JS
  drivers run in a V8 sandbox; Tier 3 DLLs run with full .NET runtime access
  and require explicit user approval at install time.
- Unknown fields are ignored by the server, so new optional metadata can be
  added to a manifest without breaking older Muxit versions.

### 1.2. Building the ZIP

The archive uses standard ZIP with either stored or deflate compression. No
ZIP64 extensions, encryption, or split archives. Any tool that produces a
conformant ZIP will work (`zip`, PowerShell `Compress-Archive`, `archiver`,
or `scripts/muxit-driver.js`).

A minimum viable Tier 1 package contains exactly two files:

```
my-driver.muxdriver
├── manifest.json
└── my-driver.driver.js
```

## 2. Registry entry JSON

Each file in `drivers/` is a JSON object describing one driver. CI rebuilds
`registry.json` from these on merge to `main` and publishes it to GitHub
Pages, where the Muxit server fetches it to populate the marketplace.

### Required fields

| Field         | Type   | Description |
|---------------|--------|-------------|
| `id`          | string | `publisher/name` — must match the `id` inside the `.muxdriver`. |
| `name`        | string | Display name. |
| `version`     | string | Semver. Must match the package. |
| `downloadUrl` | string | HTTPS URL to the `.muxdriver` release asset. |

### Optional fields

| Field             | Type     | Description |
|-------------------|----------|-------------|
| `description`     | string   | Short description. |
| `author`          | object   | `{ "name": "...", "github": "..." }`. |
| `group`           | string   | `instruments`, `motion`, `communication`, or `utilities`. |
| `tier`            | number   | `1` (JS) or `3` (DLL). |
| `tags`            | string[] | Discovery tags. |
| `license`         | string   | SPDX identifier (e.g., `MIT`). |
| `repository`      | string   | Source code URL. |
| `downloadSize`    | number   | Package size in bytes. |
| `sha256`          | string   | SHA-256 of the `.muxdriver` file. |
| `capabilities`    | string[] | Tier 3 capability audit (auto-detected when published). |
| `minMuxitVersion` | string   | Minimum compatible Muxit server version. |
| `published`       | string   | ISO 8601 timestamp. |
| `readme`          | string   | README content (Markdown). |
| `changelog`       | string   | Changelog content (Markdown). |

### Validation rules

CI runs `scripts/validate-entry.js` on every PR. It enforces:

- All required fields present and non-empty.
- Field types match the table above.
- `id` uses `publisher/name` format and is unique (case-insensitive).
- `group` is one of the allowed values.
- `tier` is `1` or `3`.
- `downloadUrl` uses HTTPS.

### Example

```json
{
  "id": "alice/rigol-ds1054z",
  "name": "Rigol DS1054Z",
  "version": "1.0.0",
  "description": "Driver for the Rigol DS1054Z oscilloscope over LAN/SCPI.",
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

## 3. Security model

- **Tier 1 (JavaScript)** drivers run in a V8 sandbox with no filesystem,
  network, or process access beyond the APIs the server exposes. Safe to
  install from unknown authors.
- **Tier 3 (DLL)** drivers run with full .NET runtime access. Muxit performs
  a capability audit and requires explicit user approval before loading a
  DLL driver.
- `sha256` in the registry entry is compared to the downloaded file at
  install time. A mismatch aborts the install.
