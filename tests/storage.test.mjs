import assert from 'node:assert/strict';

const mem = {};
let broken = false;
const guard = () => { if (broken) throw new Error('denied'); };
globalThis.localStorage = {
  getItem: k => { guard(); return k in mem ? mem[k] : null; },
  setItem: (k, v) => { guard(); mem[k] = String(v); },
  removeItem: k => { guard(); delete mem[k]; },
};
const St = await import('../js/storage.js');

// Значения по умолчанию
assert.equal(St.loadLang(), 'ru');
const s = St.loadSettings();
assert.equal(s.level, 'strong');
assert.equal(s.rules.hand, 8);

// Сохранение и чтение партии
const S = { phase: 'play', rules: s.rules, eyes: [1, 2], d: { hands: [[], [], [], []] } };
St.saveGameNow(S);
assert.deepEqual(St.loadGame(), S);
assert.equal(JSON.parse(mem['belka-save']).v, St.SAVE_VERSION);

// Испорченное и старое сохранение стирается
mem['belka-save'] = '{not json';
assert.equal(St.loadGame(), null);
assert.equal(mem['belka-save'], undefined);
mem['belka-save'] = JSON.stringify({ v: 0, S });
assert.equal(St.loadGame(), null);
mem['belka-save'] = JSON.stringify({ v: 1, S: { phase: 'play' } });
assert.equal(St.loadGame(), null);

// Флаги
assert.equal(St.getFlag('iosHint'), false);
St.setFlag('iosHint');
assert.equal(St.getFlag('iosHint'), true);

// Хранилище, которое бросает исключения, не роняет игру (storage that throws)
broken = true;
assert.equal(St.loadGame(), null);
St.saveGameNow(S);
assert.equal(St.loadLang(), 'ru');
St.saveLang('kz');
assert.equal(St.getFlag('x'), false);
assert.equal(St.loadSettings().level, 'strong');
console.log('storage tests passed');
