// Generates solid-color placeholder PNGs for example/assets/. Run with: bun scripts/gen-example-assets.ts
// Replaces real branding for testing only — output is committed so the example runs out of the box.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (crcTable[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

// Solid-color RGB PNG (color type 2). Zlib compresses the repeating filter+RGB rows to a tiny IDAT.
function makePng(w: number, h: number, r: number, g: number, b: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  const row = Buffer.alloc(1 + w * 3);
  row[0] = 0; // filter: None
  for (let x = 0; x < w; x++) {
    row[1 + x * 3] = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.alloc(row.length * h);
  for (let y = 0; y < h; y++) row.copy(raw, y * row.length);

  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = resolve(import.meta.dir, '../example/assets');
mkdirSync(dir, { recursive: true });

const targets = [
  { name: 'icon.png', w: 1024, h: 1024, rgb: [255, 255, 255] as const },
  { name: 'adaptive-icon.png', w: 1024, h: 1024, rgb: [255, 255, 255] as const },
  { name: 'splash.png', w: 1080, h: 2400, rgb: [26, 26, 26] as const },
  { name: 'splash-icon.png', w: 512, h: 512, rgb: [255, 255, 255] as const },
];

for (const t of targets) {
  const png = makePng(t.w, t.h, t.rgb[0], t.rgb[1], t.rgb[2]);
  writeFileSync(resolve(dir, t.name), png);
  console.log(`wrote ${t.name} (${t.w}×${t.h}, ${png.length} bytes)`);
}
