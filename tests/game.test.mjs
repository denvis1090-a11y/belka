import assert from 'node:assert/strict';

// Управляемые таймеры и память вместо localStorage
const queue = new Map(); let tid = 0;
globalThis.setTimeout = f => { queue.set(++tid, f); return tid; };
globalThis.clearTimeout = i => { queue.delete(i); };
const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };

const E = await import('../js/engine.js');
const G = await import('../js/game.js');

function step(){
  const it = queue.entries().next();
  if (it.done) return false;
  queue.delete(it.value[0]); it.value[1]();
  return true;
}
function act(S){
  if (S.phase === 'dealEnd'){ G.nextDeal(); return true; }
  if (S.phase === 'askRedeal'){ G.keepHand(); return true; }
  if (S.phase === 'play' && S.d.turn === 0){ G.humanPlay(E.id(E.legal(S.d, 0)[0])); return true; }
  return false;
}
function drive(onDealEnd){
  for (let i = 0; i < 300000; i++){
    const S = G.getState();
    if (S.phase === 'gameOver') return S;
    if (S.phase === 'dealEnd') onDealEnd?.(S);
    if (act(S)) continue;
    if (!step()) throw new Error('stuck in phase ' + S.phase);
  }
  throw new Error('too many steps');
}

// 1. Полные партии: 120 очков в каждой раздаче, первая раздача ровно 2 глаза, «яйца» (вариант «4 глаза») ровно 4
const { T } = await import('../js/i18n.js');
let notified = 0, eggsPaid = 0; G.onChange(() => notified++);
for (const preset of ['classic', 'ccw', 'short']){
  mem['belka-settings'] = JSON.stringify({ rules: E.PRESETS[preset], level: 'easy' });
  for (let g = 0; g < 60; g++){
    G.start(null);
    drive(S => {
      assert.equal(S.d.taken[0] + S.d.taken[1], 120);
      if (S.dealNo === 1 && S.result.winner !== null) assert.equal(S.result.n, 2);
      if (S.result.notes.includes(T.ru.eggsPaid)){ eggsPaid++; assert.equal(S.result.n, 4); }
    });
  }
}
assert.ok(notified > 0, 'onChange listeners are called');
assert.ok(eggsPaid > 0, '«яйца» были отыграны хотя бы раз');
assert.ok(mem['belka-save'], 'game is saved to storage');

// 2. Восстановление посреди каждой фазы доигрывается до конца
mem['belka-settings'] = JSON.stringify({ rules: E.PRESETS.classic, level: 'easy' });
const seen = new Set();
for (let g = 0; g < 60 && seen.size < 4; g++){
  G.start(null);
  for (let i = 0; i < 2000; i++){
    const S = G.getState();
    if (S.phase === 'gameOver') break;
    if (['play', 'trickEnd', 'botRedeal', 'dealEnd'].includes(S.phase) && !seen.has(S.phase)){
      seen.add(S.phase);
      const copy = JSON.parse(JSON.stringify(S));
      queue.clear();
      G.start(copy);
      assert.equal(G.getState().phase, copy.phase);
      drive();
      break;
    }
    if (act(S)) continue;
    step();
  }
}
assert.ok(seen.has('play') && seen.has('trickEnd') && seen.has('dealEnd'), 'phases covered: ' + [...seen]);

// 3. Пауза останавливает ботов, снятие паузы продолжает
G.start(null);
while (G.getState().phase !== 'play' || G.getState().d.turn === 0){ if (!act(G.getState())) step(); }
const snap = () => JSON.stringify(G.getState().d.trick) + G.getState().d.turn;
G.setPaused(true);
const before = snap();
while (step()) {}                       // остаются только подсказка и отложенное сохранение
assert.equal(snap(), before, 'nothing moves while paused');
G.setPaused(false);
for (let i = 0; i < 5 && snap() === before; i++) step();
assert.notEqual(snap(), before, 'bot moves after unpause');
console.log('game tests passed');
