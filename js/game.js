// Ход партии: фазы, таймеры ботов, подсчёт глаз. Отрисовку делает ui.js через onChange.
import { SYM, RULE_KEYS, team, pts, eff, id, nextP, stepOf, makeDeal, legal, applyPlay, collect, handsEmpty, eligible, chooseCard } from './engine.js';
import { T } from './i18n.js';
import * as store from './storage.js';

let S = null, timer = null, flashTimer = null;
const view = { flash: null, sweeping: null, paused: false };
const listeners = new Set();

export const getState = () => S;
export const getView = () => view;
export function onChange(cb){ listeners.add(cb); return () => listeners.delete(cb); }
function notify(){ for (const cb of listeners) cb(); if (S) store.saveGameSoon(S); }

export const t = () => T[S.lang];
export const nm = p => t().names[p];
export const teamName = k => k === 0 ? t().us : t().them;
export function reasonText(r){ return r.kind === 'low' ? t().reasonLow(r.n) : t().reasonSuit; }

export function start(saved){
  clearTimeout(timer);
  view.flash = null; view.sweeping = null;
  if (saved){ S = saved; advance(); }
  else newGame();
}

export function newGame(){
  const lang = S ? S.lang : store.loadLang();
  const { rules, level } = store.loadSettings();
  S = { lang, rules, level, eyes:[0,0], dealNo:0, suitOf:null, eggs:false, redeals:0,
        dealer: Math.floor(Math.random()*4), phase:'idle', d:null, msg:'' };
  startDeal();
}

function startDeal(){
  S.d = makeDeal(S.rules, S.dealer, S.suitOf);
  S.result = null;
  const d = S.d;
  if (S.rules.redeal){
    for (let k = 0, p = nextP(d, S.dealer); k < 4; k++, p = nextP(d, p)){
      if (p === 0) continue;
      const r = eligible(d, p);
      if (r && (r.kind==='low' || r.suit !== d.trump)){
        S.phase = 'botRedeal'; S.msg = t().botRedeal(nm(p), reasonText(r)); advance(); return;
      }
    }
    const mine = eligible(d, 0);
    if (mine){ S.phase = 'askRedeal'; S.ask = mine; advance(); return; }
  }
  beginPlay();
}

function doRedeal(){
  S.redeals++;
  let note = '';
  if (S.redeals >= 3){
    S.redeals = 0;
    if (S.rules.redealEye){
      const k = team(S.dealer);
      S.eyes[k] += 1; note = t().threeRedeals;
      if (S.eyes[k] >= 12){ S.phase='gameOver'; S.result={winner:k, notes:[note]}; advance(); return; }
    }
  }
  startDeal();
  if (note) setFlash(note);
}

function beginPlay(){
  S.redeals = 0;
  const d = S.d;
  if (!S.suitOf){
    const h = d.holder;
    // ♣ — держателю, ♠ — партнёру, ♥ — следующему по ходу, ♦ — предыдущему
    S.suitOf = {}; S.suitOf[h]='C'; S.suitOf[(h+2)%4]='S'; S.suitOf[nextP(d,h)]='H'; S.suitOf[(h + 4 - stepOf(d.dir)) % 4]='D';
    setFlash(t().firstTrump);
  } else {
    setFlash(t().announce(nm(d.holder), SYM[d.trump]));
  }
  S.phase = 'play';
  advance();
}
export { doRedeal as redeal, beginPlay as keepHand };

function play(p, c){
  if (applyPlay(S.d, p, c)){
    S.phase = 'trickEnd';
    S.msg = t().takes(nm(S.d.lastWin), S.d.trick.reduce((a,e)=>a+pts(e.c),0));
  }
  advance();
}

function collectTrick(){
  collect(S.d); view.sweeping = null;
  if (handsEmpty(S.d)){ endDeal(); return; }
  S.phase = 'play';
  advance();
}

function endDeal(){
  const d = S.d, R = S.rules;
  const [a,b] = d.taken; const notes = [];
  const res = {a, b, ta:d.tricksCount[0], tb:d.tricksCount[1], winner:null, n:0, notes};
  if (a === 60 && b === 60){
    S.eggs = true; notes.push(t().eggs, R.eggs==='four' ? t().eggsNextFour : t().eggsNextDouble);
  } else {
    const W = a > 60 ? 0 : 1, Lo = 1 - W;
    const eggsBefore = S.eggs; S.eggs = false;
    let n;
    // «Яйца» (вариант «4 глаза») и первая раздача стоят ровно 4 и 2 глаза: без спаса и козырной надбавки
    if (eggsBefore && R.eggs === 'four'){ n = 4; notes.push(t().eggsPaid); }
    else if (S.dealNo === 0 && R.firstDeal2){ n = 2; notes.push(t().firstDealN); }
    else {
      n = W === d.trumpTeam ? 1 : 2; notes.push(W === d.trumpTeam ? t().ownTrump : t().foreignTrump);
      if (R.spas && d.taken[Lo] < 30){ n++; notes.push(t().spas); }
      if (eggsBefore && R.eggs === 'double'){ n *= 2; notes.push(t().eggsDoubled); }
    }
    res.winner = W; res.n = n;
    S.eyes[W] += n;
    if (d.tricksCount[Lo] === 0) res.golaya = R.golaya ? 'win' : 'plain';
    if (res.golaya === 'win' || S.eyes[W] >= 12){ S.dealNo++; S.result = res; S.phase = 'gameOver'; advance(); return; }
  }
  S.dealNo++; S.result = res; S.phase = 'dealEnd';
  advance();
}

export function nextDeal(){ S.dealer = (S.dealer + stepOf(S.rules.dir==='ccw' ? -1 : 1)) % 4; startDeal(); }

export function humanPlay(cid){
  if (S.phase !== 'play' || S.d.turn !== 0) return;
  const d = S.d;
  const c = d.hands[0].find(x => id(x)===cid); if (!c) return;
  if (!legal(d, 0).some(x => id(x)===cid)){
    const needSuit = d.trick.length && d.hands[0].some(x => eff(d,x)===eff(d,d.trick[0].c));
    setFlash(needSuit ? t().mustFollow : t().noAce); notify(); return;
  }
  play(0, c);
}
function botMove(){ const p = S.d.turn; play(p, chooseCard(S.d, p, S.level)); }

function setFlash(m){
  view.flash = m; clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { view.flash = null; if (!view.paused) notify(); }, 2600);
}

export function setPaused(v){ view.paused = !!v; advance(); }
export function setLang(l){ S.lang = l; store.saveLang(l); advance(); }
export function applySettings(rules, level){
  const changed = RULE_KEYS.some(k => rules[k] !== S.rules[k]);
  store.saveSettings(rules, level);
  S.level = level;
  if (changed) newGame(); else advance();
}

function advance(){
  clearTimeout(timer);
  if (S.phase === 'play') S.msg = S.d.turn === 0 ? t().yourTurn : t().moving(nm(S.d.turn));
  if (!view.paused){
    if (S.phase === 'botRedeal') timer = setTimeout(doRedeal, 1500);
    else if (S.phase === 'play' && S.d.turn !== 0) timer = setTimeout(botMove, S.level === 'master' ? 450 : 700);
    else if (S.phase === 'trickEnd') timer = setTimeout(() => {
      // карты взятки уезжают к тому, кто её забрал, затем взятка засчитывается
      view.sweeping = S.d.lastWin; notify();
      timer = setTimeout(collectTrick, 380);
    }, 850);
  }
  notify();
}
