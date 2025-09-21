// Node 18+. Usage:
//   node tools/build-index.mjs
// Produces: catalog/manifest.json and catalog/chunk-XXX.json files next to index.html

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import readline from 'node:readline';

const OUT_DIR = path.resolve('catalog');
const CSV_URL = process.env.MET_CSV_URL || 'https://raw.githubusercontent.com/metmuseum/openaccess/master/MetObjects.csv';
const TMP_DIR = path.resolve('.cache');
const TMP_CSV = path.join(TMP_DIR, 'MetObjects.csv');
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE || 50000);
fs.mkdirSync(TMP_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

function downloadCSV(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`CSV download failed: ${res.statusCode}`));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

function parseCSVLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i=0;i<line.length;i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
    else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else { cur += c; }
  }
  out.push(cur); return out;
}

function toInt(x) { const n = parseInt(x, 10); return Number.isFinite(n) ? n : undefined; }
function toBool(x) { return String(x).toLowerCase() === 'true'; }

function pick(row, headers) {
  const idx = Object.fromEntries(headers.map((h,i)=>[h,i]));
  const g = (h) => row[idx[h]];
  const tags = g('Tags') ? g('Tags').split('|').map(s=>s.trim()).filter(Boolean) : undefined;
  return {
    objectID: toInt(g('Object ID')),
    title: g('Title') || undefined,
    artistDisplayName: g('Artist Display Name') || undefined,
    culture: g('Culture') || undefined,
    objectDate: g('Object Date') || undefined,
    objectBeginDate: toInt(g('Object Begin Date')),
    objectEndDate: toInt(g('Object End Date')),
    department: g('Department') || undefined,
    medium: g('Medium') || undefined,
    geoLocation: [g('Country'), g('City'), g('Geography Type')].filter(Boolean).join(' | ') || undefined,
    isPublicDomain: toBool(g('Is Public Domain')),
    isOnView: toBool(g('Is On View')),
    isHighlight: toBool(g('Is Highlight')),
    primaryImage: g('Primary Image') || undefined,
    primaryImageSmall: g('Primary Image Small') || undefined,
    objectURL: g('Link Resource') || undefined,
    tags,
  };
}

async function build() {
  if (!fs.existsSync(TMP_CSV)) {
    console.log('Downloading CSV...');
    await downloadCSV(CSV_URL, TMP_CSV);
  } else {
    console.log('Reusing cached CSV at', TMP_CSV);
  }

  const rl = readline.createInterface({ input: fs.createReadStream(TMP_CSV, 'utf8'), crlfDelay: Infinity });
  let headers = null; let rows = []; let chunkIndex = 0; const chunks = []; let totalCount = 0;
  for await (const line of rl) {
    if (!headers) { headers = parseCSVLine(line); continue; }
    const cells = parseCSVLine(line);
    const o = pick(cells, headers);
    if (!o.objectID) continue;
    rows.push(o); totalCount++;
    if (rows.length >= CHUNK_SIZE) {
      const fname = `chunk-${String(chunkIndex).padStart(3,'0')}.json`;
      fs.writeFileSync(path.join(OUT_DIR, fname), JSON.stringify(rows));
      chunks.push(fname);
      console.log('Wrote', fname, rows.length, 'rows');
      rows = []; chunkIndex++;
    }
  }
  if (rows.length) {
    const fname = `chunk-${String(chunkIndex).padStart(3,'0')}.json`;
    fs.writeFileSync(path.join(OUT_DIR, fname), JSON.stringify(rows));
    chunks.push(fname);
    console.log('Wrote', fname, rows.length, 'rows');
  }

  const manifest = { version: 1, generatedAt: new Date().toISOString(), total: totalCount, chunkSize: CHUNK_SIZE, chunks };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Manifest written with', totalCount, 'rows across', chunks.length, 'chunks');
}

build().catch(e=>{ console.error(e); process.exit(1); });
