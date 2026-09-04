#!/usr/bin/env node
// Generates the app icons. No image library: the shapes are defined by maths and
// the PNG is assembled by hand with node's built-in zlib. Run after changing the
// mark so the raster icons stay in step with assets/icon.svg.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.resolve(import.meta.dirname, '..', 'assets');
const BG = [0xd6, 0x2e, 0x00];
const FG = [0xff, 0xf6, 0xec];

/* --- shape field, all coordinates normalised to the unit square --- */
const capsule = (x, y, ax, ay, bx, by, w) => {
  const vx = bx - ax, vy = by - ay;
  const tRaw = ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy);
  const t = Math.min(1, Math.max(0, tRaw));
  return Math.hypot(x - (ax + t * vx), y - (ay + t * vy)) <= w / 2;
};

/** A mortar and pestle: bowl, rim, and a pestle leaning out of it. */
function inMark(x, y) {
  const bowl = Math.hypot(x - 0.5, y - 0.545) <= 0.245 && y >= 0.545;
  const hollow = Math.hypot(x - 0.5, y - 0.545) <= 0.155 && y >= 0.545 && y < 0.70;
  const rim = capsule(x, y, 0.215, 0.545, 0.785, 0.545, 0.085);
  const pestle = capsule(x, y, 0.455, 0.60, 0.70, 0.20, 0.085);
  const knob = Math.hypot(x - 0.70, y - 0.20) <= 0.075;
  return (bowl || rim || pestle || knob) && !hollow;
}

function png(size) {
  const S = 4;                       // supersampling factor
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    const row = py * (size * 4 + 1);
    raw[row] = 0;                    // filter byte: none
    for (let px = 0; px < size; px++) {
      let inside = 0, opaque = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = (px + (sx + 0.5) / S) / size;
          const y = (py + (sy + 0.5) / S) / size;
          opaque++; if (inMark(x, y)) inside++;
        }
      }
      const n = S * S;
      const a = opaque / n;
      const f = opaque ? inside / opaque : 0;
      const i = row + 1 + px * 4;
      for (let c = 0; c < 3; c++) raw[i + c] = Math.round(BG[c] * (1 - f) + FG[c] * f);
      raw[i + 3] = Math.round(a * 255);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let TABLE = null;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Spice Bench">
  <rect width="100" height="100" fill="#d62e00"/>
  <g fill="#fff6ec">
    <path d="M25.5 54.5h49a0 0 0 0 1 0 0 24.5 24.5 0 0 1-49 0Z"/>
    <rect x="17" y="50.2" width="66" height="8.5" rx="4.25"/>
    <rect x="41.5" y="16" width="17" height="46" rx="8.5" transform="rotate(31 50 39)"/>
  </g>
</svg>
`;
fs.writeFileSync(path.join(OUT, 'icon.svg'), svg);
for (const size of [180, 192, 512]) {
  fs.writeFileSync(path.join(OUT, `icon-${size}.png`), png(size));
  console.log(`assets/icon-${size}.png`);
}
console.log('assets/icon.svg');
