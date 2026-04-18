#!/usr/bin/env node
/**
 * muxit-driver — package and publish Muxit drivers.
 *
 * Commands:
 *   package [-C <dir>] [-o <outfile>]   Build a .muxdriver from a source dir.
 *   registry <file.muxdriver>           Generate a driver-registry entry JSON.
 *
 * Zero dependencies. See docs/muxdriver-format.md for the package format
 * and registry entry schema.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const readline = require('readline');

// ── CRC-32 (IEEE) ───────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── Minimal ZIP writer ──────────────────────────────────────────────────────

function dosTime(d = new Date()) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

function buildZip(entries) {
  const { time, date } = dosTime();
  const parts = [];
  const cdParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(body.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);

    parts.push(lfh, nameBuf, body);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(0x031e, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(time, 12);
    cdh.writeUInt16LE(date, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(body.length, 20);
    cdh.writeUInt32LE(data.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);
    cdParts.push(Buffer.concat([cdh, nameBuf]));

    offset += lfh.length + nameBuf.length + body.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of cdParts) { parts.push(c); cdSize += c.length; }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(cdParts.length, 8);
  eocd.writeUInt16LE(cdParts.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);
  parts.push(eocd);

  return Buffer.concat(parts);
}

// ── Minimal ZIP reader (fetch a single entry by name) ───────────────────────

function readZipEntry(buf, wantName) {
  const max = Math.min(buf.length, 22 + 0xffff);
  let eocd = -1;
  for (let i = buf.length - 22; i >= buf.length - max && i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid ZIP (EOCD not found)');
  const entries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  let pos = cdOffset;
  for (let i = 0; i < entries; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('Bad central directory');
    const method = buf.readUInt16LE(pos + 10);
    const csize = buf.readUInt32LE(pos + 20);
    const nlen = buf.readUInt16LE(pos + 28);
    const elen = buf.readUInt16LE(pos + 30);
    const clen = buf.readUInt16LE(pos + 32);
    const lfhOff = buf.readUInt32LE(pos + 42);
    const name = buf.slice(pos + 46, pos + 46 + nlen).toString('utf8');
    pos += 46 + nlen + elen + clen;
    if (name !== wantName) continue;
    if (buf.readUInt32LE(lfhOff) !== 0x04034b50) throw new Error('Bad local header');
    const lfhNameLen = buf.readUInt16LE(lfhOff + 26);
    const lfhExtraLen = buf.readUInt16LE(lfhOff + 28);
    const dataStart = lfhOff + 30 + lfhNameLen + lfhExtraLen;
    const compressed = buf.slice(dataStart, dataStart + csize);
    if (method === 0) return compressed;
    if (method === 8) return zlib.inflateRawSync(compressed);
    throw new Error(`Unsupported compression method ${method}`);
  }
  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function ask(rl, q) { return new Promise(r => rl.question(q, r)); }
function die(msg) { console.error(`Error: ${msg}`); process.exit(1); }

// ── Commands ────────────────────────────────────────────────────────────────

function cmdPackage(args) {
  let dir = process.cwd();
  let out = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-C') dir = path.resolve(args[++i]);
    else if (args[i] === '-o') out = path.resolve(args[++i]);
    else die(`Unknown flag for package: ${args[i]}`);
  }

  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) die(`No manifest.json in ${dir}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const missing = ['id', 'name', 'version', 'entryPoint'].filter(f => !manifest[f]);
  if (missing.length) die(`manifest.json is missing: ${missing.join(', ')}`);

  const ep = manifest.entryPoint;
  if (ep.includes('/') || ep.includes('\\') || ep.includes('..')) {
    die(`manifest.entryPoint must be a bare filename, got "${ep}"`);
  }
  const epPath = path.join(dir, ep);
  if (!fs.existsSync(epPath)) die(`entryPoint not found: ${ep}`);

  const entries = [
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8') },
    { name: ep, data: fs.readFileSync(epPath) },
  ];

  const readmePath = path.join(dir, 'README.md');
  if (fs.existsSync(readmePath)) {
    entries.push({ name: 'README.md', data: fs.readFileSync(readmePath) });
  }

  // Tier 3 (DLL) drivers may carry native dependencies under deps/
  const depsDir = path.join(dir, 'deps');
  if (fs.existsSync(depsDir) && fs.statSync(depsDir).isDirectory()) {
    const collect = (rel) => {
      const full = path.join(depsDir, rel);
      for (const name of fs.readdirSync(full)) {
        const sub = path.join(full, name);
        const relSub = rel ? `${rel}/${name}` : name;
        if (fs.statSync(sub).isDirectory()) collect(relSub);
        else entries.push({ name: `deps/${relSub}`, data: fs.readFileSync(sub) });
      }
    };
    collect('');
  }

  const safeId = String(manifest.id).replace(/\//g, '-');
  const outPath = out || path.join(process.cwd(), `${safeId}-v${manifest.version}.muxdriver`);
  const zip = buildZip(entries);
  fs.writeFileSync(outPath, zip);

  console.log(`Wrote ${outPath}`);
  console.log(`  size:   ${zip.length} bytes`);
  console.log(`  sha256: ${sha256(zip)}`);
  console.log(`  files:  ${entries.map(e => e.name).join(', ')}`);
}

async function cmdRegistry(args) {
  if (args.length !== 1) die('Usage: muxit-driver registry <file.muxdriver>');
  const pkgPath = path.resolve(args[0]);
  if (!fs.existsSync(pkgPath)) die(`File not found: ${pkgPath}`);

  const buf = fs.readFileSync(pkgPath);
  const manifestBuf = readZipEntry(buf, 'manifest.json');
  if (!manifestBuf) die('Package has no manifest.json');
  const manifest = JSON.parse(manifestBuf.toString('utf8'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const downloadUrl = (await ask(rl, 'Download URL (HTTPS, GitHub release asset): ')).trim();
    if (!downloadUrl.startsWith('https://')) die('downloadUrl must use HTTPS');

    const tagsRaw = await ask(rl, 'Tags (comma-separated): ');
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    const license = (await ask(rl, 'License [MIT]: ')).trim() || 'MIT';
    const repo = (await ask(rl, 'Repository URL (optional): ')).trim();
    const github = (await ask(rl, 'Author GitHub username (optional): ')).trim();
    const minMuxitVersion = (await ask(rl, 'Min Muxit version [0.3.0]: ')).trim() || '0.3.0';

    const entry = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description || '',
      author: {
        name: manifest.author?.name || '',
        ...(github ? { github } : {}),
      },
      group: manifest.group || 'utilities',
      tier: manifest.tier || 1,
      tags,
      license,
      ...(repo ? { repository: repo } : {}),
      downloadUrl,
      downloadSize: buf.length,
      sha256: sha256(buf),
      minMuxitVersion,
      published: new Date().toISOString(),
    };

    const safeId = String(manifest.id).replace(/\//g, '-');
    const outPath = path.join(process.cwd(), `${safeId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(entry, null, 2) + '\n');

    console.log(`\nWrote ${outPath}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Fork github.com/muxit-io/driver-registry`);
    console.log(`  2. Copy ${path.basename(outPath)} into the drivers/ directory`);
    console.log(`  3. (optional) node scripts/validate-entry.js   # local validation`);
    console.log(`  4. Open a pull request`);
  } finally {
    rl.close();
  }
}

function usage() {
  console.log(`
muxit-driver — package and publish Muxit drivers.

Usage:
  muxit-driver package [-C <dir>] [-o <outfile>]
      Build a .muxdriver archive from a source directory (default: cwd).
      The directory must contain a manifest.json and the file named by
      manifest.entryPoint. README.md and deps/ are included if present.

  muxit-driver registry <file.muxdriver>
      Inspect a built package and write a driver-registry entry JSON,
      prompting for the download URL and other metadata.

See docs/muxdriver-format.md for the package format and entry schema.
`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'package':  return cmdPackage(rest);
    case 'registry': return cmdRegistry(rest);
    case '-h': case '--help': case undefined: return usage();
    default:
      console.error(`Unknown command: ${cmd}`);
      usage();
      process.exit(1);
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
