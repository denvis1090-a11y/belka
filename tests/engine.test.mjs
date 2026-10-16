import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

// Колоды: 32 и 28 карт, в обеих ровно 120 очков
for (const n of [8, 7]) {
  const deck = E.DECKS[n];
  assert.equal(deck.length, n * 4);
  assert.equal(deck.reduce((a, c) => a + E.pts(c), 0), 120);
}

// Вальты всегда козыри, старшинство В♣ > В♠; карта не в масть проигрывает
const d0 = { trump: 'H' };
assert.equal(E.eff(d0, { r: 'J', s: 'S' }), 'T');
assert.equal(E.eff(d0, { r: 'A', s: 'H' }), 'T');
assert.equal(E.eff(d0, { r: 'A', s: 'S' }), 'S');
assert.ok(E.score(d0, { r: 'J', s: 'C' }, 'S') > E.score(d0, { r: 'J', s: 'S' }, 'S'));
assert.ok(E.score(d0, { r: '7', s: 'D' }, 'D') > E.score(d0, { r: 'A', s: 'S' }, 'D'));

// Полные раздачи на всех наборах правил и уровнях ботов
for (const preset of Object.keys(E.PRESETS)) {
  for (const level of ['easy', 'strong', 'master']) {
    const rounds = level === 'master' ? 6 : 40;
    for (let i = 0; i < rounds; i++) {
      const d = E.makeDeal(E.PRESETS[preset], i % 4, i % 2 ? null : { 0: 'C', 1: 'H', 2: 'S', 3: 'D' });
      while (!E.handsEmpty(d)) {
        const p = d.turn;
        const L = E.legal(d, p);
        const c = E.chooseCard(d, p, level);
        assert.ok(L.some(x => E.id(x) === E.id(c)), `bot ${level} played an illegal card`);
        if (E.applyPlay(d, p, c)) E.collect(d);
      }
      assert.equal(d.taken[0] + d.taken[1], 120);
      assert.equal(d.tricksCount[0] + d.tricksCount[1], E.PRESETS[preset].hand);
    }
  }
}
assert.equal(E.presetOf(E.PRESETS.ccw), 'ccw');
assert.equal(E.presetOf({ ...E.PRESETS.classic, spas: false }), 'custom');
console.log('engine tests passed');
