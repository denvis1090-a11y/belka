import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const m = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url)));
assert.equal(m.short_name, 'Белка');
assert.equal(m.start_url, './');
assert.equal(m.scope, './');
assert.equal(m.display, 'standalone');
assert.equal(m.orientation, 'portrait');
assert.equal(m.theme_color, '#0c0e12');
assert.ok(m.icons.some(i => i.sizes === '192x192'));
assert.ok(m.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'));

function pngSize(path){
  const b = readFileSync(new URL('../' + path, import.meta.url));
  assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], path + ' is a PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
for (const icon of m.icons){
  assert.ok(existsSync(new URL('../' + icon.src, import.meta.url)), icon.src + ' exists');
  const [w, h] = pngSize(icon.src);
  assert.equal(`${w}x${h}`, icon.sizes);
}
assert.deepEqual(pngSize('icons/icon-180.png'), [180, 180]);
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
assert.match(html, /rel="apple-touch-icon" href="icons\/icon-180\.png"/);
console.log('manifest tests passed');
