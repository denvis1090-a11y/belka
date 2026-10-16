import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
for (const a of assets) if (a !== './') assert.ok(existsSync(new URL('../' + a.slice(2), import.meta.url)), a + ' exists');
for (const f of readdirSync(new URL('../js/', import.meta.url))) assert.ok(assets.includes('./js/' + f), 'js/' + f + ' is cached');
assert.match(sw, /const VERSION = '\d+\.\d+\.\d+';/);
console.log('sw tests passed');
