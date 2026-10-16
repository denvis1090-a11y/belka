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

// 4. Сохранение правильной формы, но с испорченным содержимым, даёт новую партию, а не пустой экран
mem['belka-save'] = 'kept';
const broken = JSON.parse(JSON.stringify(G.getState())); broken.lang = 'xx';
queue.clear();
G.startOrNew(broken);
assert.ok(['play', 'askRedeal', 'botRedeal'].includes(G.getState().phase), 'new game started: ' + G.getState().phase);
assert.ok(['ru', 'kz'].includes(G.getState().lang), 'language falls back');
assert.notEqual(mem['belka-save'], 'kept', 'broken save is cleared or overwritten');
drive();

// 5. Детерминированное восстановление фаз, которые случайные партии могут не встретить
function fromPlay(){
  G.start(null);
  while (G.getState().phase !== 'play'){ if (!act(G.getState())) step(); }
  return JSON.parse(JSON.stringify(G.getState()));
}
{ // askRedeal: открыто окно «Пересдать?», игрок выбирает «Играть»
  const s = fromPlay(); s.phase = 'askRedeal'; s.ask = { kind: 'low', n: 11 };
  queue.clear(); G.start(s);
  assert.equal(G.getState().phase, 'askRedeal');
  const turnBefore = G.getState().d.turn;
  while (step()) {}
  assert.equal(G.getState().phase, 'askRedeal', 'game waits for the human');
  assert.equal(G.getState().d.turn, turnBefore);
  G.keepHand(); assert.equal(G.getState().phase, 'play'); drive();
}
{ // askRedeal: игрок выбирает «Пересдать»
  const s = fromPlay(); s.phase = 'askRedeal'; s.ask = { kind: 'suit', suit: 'H' };
  queue.clear(); G.start(s); G.redeal();
  assert.ok(['play', 'askRedeal', 'botRedeal', 'gameOver'].includes(G.getState().phase)); drive();
}
{ // botRedeal: таймер пересдачи бота запускается заново
  const s = fromPlay(); s.phase = 'botRedeal'; s.msg = 'test';
  const handBefore = JSON.stringify(s.d.hands);
  queue.clear(); G.start(s);
  assert.equal(G.getState().phase, 'botRedeal');
  for (let i = 0; i < 5 && JSON.stringify(G.getState().d.hands) === handBefore; i++) step();
  assert.notEqual(JSON.stringify(G.getState().d.hands), handBefore, 'bot redeal timer fired and dealt new cards');
  drive();
}
{ // gameOver: итог виден, ходов больше нет, новая партия начинается
  const s = fromPlay(); s.phase = 'gameOver'; s.result = { winner: 0, notes: [] }; s.eyes = [12, 3];
  queue.clear(); G.start(s);
  const before = JSON.stringify(G.getState().d.trick) + G.getState().d.turn;
  while (step()) {}
  assert.equal(G.getState().phase, 'gameOver');
  assert.equal(JSON.stringify(G.getState().d.trick) + G.getState().d.turn, before, 'nothing moves after the game is over');
  G.newGame(); assert.deepEqual(G.getState().eyes, [0, 0]); drive();
}
console.log('game tests passed');
