// Рисует иконки приложения без внешних библиотек: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePNG(w, h, rgba){
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++){ raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const C = { railHi:[59,62,96], rail:[35,37,59], feltHi:[24,169,130], feltLo:[11,110,82], stitch:[226,172,74], ivory:[251,250,245], edge:[214,208,192], gold:[217,165,33] };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
// Завиток «қошқар мүйіз»: сужающаяся спираль от верхушки стебля, левый и зеркальный правый
function hornPolyline(k){
  const pts = [], cx = 0.5 - 0.06 * k, cy = 0.5 - 0.02 * k, r0 = 0.06 * k;
  for (let i = 0; i <= 90; i++){ const t = i / 90, a = -t * 1.6 * Math.PI, r = r0 * (1 - 0.55 * t); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
function sample(x, y, k, horn){
  // бортик
  let col = mix(C.railHi, C.rail, Math.hypot(x - 0.5, y - 0.15) / 0.9);
  // сукно: вертикальный «стадион»
  const a = 0.30 * k, b = 0.40 * k;
  const sd = segDist(x, y, 0.5, 0.5 - (b - a), 0.5, 0.5 + (b - a)) - a;
  if (sd < 0) col = mix(C.feltHi, C.feltLo, Math.hypot(x - 0.5, y - 0.45) / (0.6 * k));
  // прострочка пунктиром
  if (sd < -0.026 * k && sd > -0.034 * k && Math.floor((Math.atan2(y - 0.5, x - 0.5) + Math.PI) * 24) % 2 === 0) col = C.stitch;
  // карта со скруглёнными углами
  const hx = 0.17 * k, hy = 0.24 * k, rr = 0.035 * k;
  const qx = Math.abs(x - 0.5) - (hx - rr), qy = Math.abs(y - 0.5) - (hy - rr);
  const cd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
  if (cd < 0.012 * k && cd >= 0 && sd < 0) col = mix(col, [0, 0, 0], 0.25);
  if (cd < 0) col = cd > -0.004 * k ? C.edge : C.ivory;
  // золотой завиток
  if (cd < 0){
    const w = 0.011 * k;
    let dmin = segDist(x, y, 0.5, 0.5 + 0.12 * k, 0.5, 0.5 - 0.02 * k);
    const mx = x < 0.5 ? x : 1 - x;
    for (let i = 1; i < horn.length; i++) dmin = Math.min(dmin, segDist(mx, y, horn[i - 1][0], horn[i - 1][1], horn[i][0], horn[i][1]));
    if (dmin < w) col = C.gold;
  }
  return col;
}
function render(size, k){
  const horn = hornPolyline(k), buf = Buffer.alloc(size * size * 4), S = 3;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++){
    let acc = [0, 0, 0];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++){
      const c = sample((px + (sx + 0.5) / S) / size, (py + (sy + 0.5) / S) / size, k, horn);
      acc = acc.map((v, i) => v + c[i]);
    }
    const o = (py * size + px) * 4;
    buf[o] = acc[0] / (S * S); buf[o + 1] = acc[1] / (S * S); buf[o + 2] = acc[2] / (S * S); buf[o + 3] = 255;
  }
  return encodePNG(size, size, buf);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('make-icons.mjs')){
  const out = new URL('../icons/', import.meta.url);
  mkdirSync(out, { recursive: true });
  writeFileSync(new URL('icon-180.png', out), render(180, 1));
  writeFileSync(new URL('icon-192.png', out), render(192, 1));
  writeFileSync(new URL('icon-512.png', out), render(512, 1));
  // maskable: всё значимое внутри центральных 80%
  writeFileSync(new URL('maskable-512.png', out), render(512, 0.86));
  console.log('icons written');
}
