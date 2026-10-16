import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const htmlRules = [...css.matchAll(/(?:^|\n)html\{([^}]*)\}/g)].map(m => m[1]).join(';');

// Двойное касание по сукну или зазорам между картами не должно масштабировать страницу (iOS Safari)
assert.match(htmlRules, /touch-action:manipulation/, 'html has touch-action:manipulation');
// Отступы от выреза камеры и полоски «Домой» задаёт сама страница
assert.match(htmlRules, /padding-top:env\(safe-area-inset-top/);
assert.match(htmlRules, /padding-bottom:env\(safe-area-inset-bottom/);
assert.match(css, /\*,\*::before,\*::after\{box-sizing:inherit\}/, 'border-box reset is present');
console.log('css tests passed');
