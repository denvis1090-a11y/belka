// Отрисовка игры и обработка нажатий. Состояние партии живёт в game.js.
import { SYM, RED, LABEL, SEAT, PRESETS, RULE_KEYS, team, id, eff, legal, presetOf } from "./engine.js";
import * as game from "./game.js";
import { t, nm, teamName, reasonText } from "./game.js";

let S = null, flash = null, sweeping = null;
let showRules = false, showSettings = false, draft = null;
const animated = new Set();
const chrome = { canInstall: false, onInstall: null, iosHint: false, onIosHintClose: null, update: false, onUpdate: null };
/* --- Отрисовка --- */
let dealShown = null;

// Раскладка значков на картах 7–10, в процентах от карты; нижняя половина перевёрнута, как на настоящей колоде
const PIPS = (() => {
  const L = 34, M = 50, R = 66;
  const seven = [[L,21],[R,21],[M,35.5],[L,50],[R,50],[L,79],[R,79]];
  return {
    '7': seven,
    '8': seven.concat([[M,64.5]]),
    '9': [[L,21],[R,21],[L,40.5],[R,40.5],[M,50],[L,59.5],[R,59.5],[L,79],[R,79]],
    '10':[[L,21],[R,21],[M,31],[L,40.5],[R,40.5],[L,59.5],[R,59.5],[M,69],[L,79],[R,79]]
  };
})();

// Упрощённые двусторонние фигуры в духе классической колоды: король с короной, дама с тиарой, валет в шапке с пером
function courtSVG(c){
  const main = RED[c.s] ? '#c3202b' : '#1c2a46';
  const acc = RED[c.s] ? '#2f5fae' : '#c3202b';
  const gold = '#d9a521', skin = '#f4dcc0', ink = '#1a1a1a', hair = '#6b4a2b';
  const body = `<path d="M12 42 L16.5 31 Q30 24.5 43.5 31 L48 42 Z" fill="${main}"/>
    <path d="M21.5 30 Q30 35.5 38.5 30 L37.5 33.5 Q30 38.5 22.5 33.5 Z" fill="${gold}"/>
    <path d="M30 34.5 V42" stroke="${acc}" stroke-width="2.2"/>`;
  const head = `<circle cx="30" cy="22" r="5.6" fill="${skin}" stroke="${ink}" stroke-width=".5"/>
    <circle cx="28" cy="21.5" r=".6" fill="${ink}"/><circle cx="32" cy="21.5" r=".6" fill="${ink}"/>`;
  let top;
  if (c.r === 'K') top = `${body}
    <path d="M45 41 L40.5 25" stroke="${gold}" stroke-width="1.5"/><circle cx="40.2" cy="24" r="1.7" fill="${gold}"/>
    ${head}<path d="M25 25 Q30 31.5 35 25 Q30 27.5 25 25 Z" fill="${hair}"/>
    <path d="M23.4 18 L23.8 10.5 L27 14.5 L30 8.5 L33 14.5 L36.2 10.5 L36.6 18 Z" fill="${gold}" stroke="${ink}" stroke-width=".5"/>
    <circle cx="30" cy="15.5" r="1" fill="${acc}"/>`;
  else if (c.r === 'Q') top = `${body}
    <circle cx="16.5" cy="35" r="2.3" fill="${acc}"/><circle cx="16.5" cy="35" r=".9" fill="${gold}"/>
    <path d="M23.5 27 Q21 14 30 14 Q39 14 36.5 27 L34.5 22 Q30 17.5 25.5 22 Z" fill="${hair}"/>
    ${head}<path d="M24 17 Q30 10.5 36 17" stroke="${gold}" stroke-width="1.6" fill="none"/>
    <circle cx="30" cy="12.2" r="1.4" fill="${acc}"/>`;
  else top = `${body}
    <path d="M15 41 L19 24" stroke="${ink}" stroke-width="1"/><path d="M17.6 24.5 L19 19.5 L20.6 24.8 Z" fill="${gold}"/>
    <path d="M24.4 26 Q23.6 21 25 19 L35 19 Q36.4 21 35.6 26 Z" fill="${hair}"/>
    ${head}<path d="M22.6 19 Q24 11.5 31 11.5 Q37.5 11.5 38.2 18.4 Z" fill="${acc}"/>
    <path d="M37 15.5 Q44 8.5 46.5 12.5 Q41.5 12.8 38.2 17.6 Z" fill="${gold}"/>`;
  return `<svg class="court" viewBox="0 0 60 84" aria-hidden="true">
    <rect x="4.5" y="5.5" width="51" height="73" rx="3" fill="none" stroke="${main}" stroke-width=".8" opacity=".55"/>
    <g>${top}</g><g transform="rotate(180 30 42)">${top}</g>
    <path d="M4.5 42 H55.5" stroke="${main}" stroke-width=".6" opacity=".45"/></svg>`;
}

// Небольшой стабильный наклон карты на сукне, свой у каждой карты
const tiltOf = c => ((c.r.charCodeAt(0) * 7 + c.s.charCodeAt(0) * 13) % 13) - 6;

function cardHTML(c, opt = {}){
  const d = S.d;
  const r = RED[c.s] ? ' r' : '';
  const tr = eff(d,c)==='T' ? ' tr' : '';
  const lab = LABEL[c.r], sym = SYM[c.s];
  let mid;
  if (c.r === 'J' || c.r === 'Q' || c.r === 'K') mid = courtSVG(c);
  else if (c.r === 'A') mid = `<span class="ace">${sym}</span>`;
  else mid = PIPS[c.r].map(([x,y]) => `<span class="pip${y>52?' dn':''}" style="left:${x}%;top:${y}%">${sym}</span>`).join('');
  const inner = `<span class="ix">${lab}<s>${sym}</s></span>${mid}<span class="ix b">${lab}<s>${sym}</s></span>${c.r==='J'?'<span class="star" aria-hidden="true">★</span>':''}`;
  const aria = `${lab}${sym}`;
  const style = opt.style ? ` style="${opt.style}"` : '';
  const cls = `card${r}${tr}${opt.cls ? ' ' + opt.cls : ''}`;
  if (opt.button) return `<button class="${cls} ${opt.ok?'ok':'no'}" data-c="${id(c)}" aria-label="${aria}"${style} ${opt.ok?'':'aria-disabled="true"'}>${inner}</button>`;
  return `<div class="${cls}" role="img" aria-label="${aria}"${style}>${inner}</div>`;
}

function sixHTML(lit){
  let s = '<span class="six" aria-hidden="true">';
  for (let i=0;i<6;i++) s += `<i class="${i<lit?'on':''}">${'♥'}</i>`;
  return s + '</span>';
}
// Счёт как в живой игре: две шестёрки на команду, вторая переворачивается, когда открыты все шесть глаз
function teamHTML(k){
  const e = S.eyes[k];
  const second = e >= 6 ? sixHTML(e - 6) : '<span class="six back" aria-hidden="true"></span>';
  return `<div class="score ${k===0?'us':'them'}" title="${e} ${t().eyesWord} ${t().of12}">
    <span class="tname">${teamName(k)}</span>
    <span class="srow"><span class="sixes">${sixHTML(Math.min(e,6))}${second}</span><span class="tnum">${e}<span>/12</span></span></span></div>`;
}

function plateHTML(p){
  const d = S.d, L = t();
  const turn = S.phase==='play' && d.turn===p;
  const chips = [];
  if (S.dealer===p) chips.push(`<span class="dbtn" title="${L.dealer}">D</span>`);
  if (d.holder===p) chips.push(`<span class="tchip${RED[d.trump]?' r':''}" title="${L.trump}">${SYM[d.trump]}</span>`);
  const role = p===2 ? `<small>${L.partner}</small>` : '';
  return `<div class="plate ${team(p)===0?'us':'them'}${turn?' turn':''}">
    <span class="ava" aria-hidden="true">${nm(p).charAt(0)}</span>
    <span class="pname"><span>${nm(p)}</span>${role}</span>${chips.length?`<span class="chips">${chips.join('')}</span>`:''}</div>`;
}

function seatHTML(p){
  const d = S.d;
  if (p === 0){
    const myTurn = S.phase==='play' && d.turn===0;
    const legalSet = myTurn ? new Set(legal(d,0).map(id)) : null;
    const dealing = dealShown !== d;
    const from = {0:['0','80%'],1:['-320%','-140%'],2:['0','-320%'],3:['320%','-140%']}[S.dealer];
    const n = d.hands[0].length, midI = (n-1)/2;
    const cards = d.hands[0].map((c,i) => {
      const off = i - midI;
      const style = `--rot:${(off*3.2).toFixed(1)}deg;--dy:${((off*off - midI*midI)*1.3).toFixed(1)}px;--i:${i};--dx:${from[0]};--dyy:${from[1]}`;
      return cardHTML(c, {button:true, ok: !myTurn || legalSet.has(id(c)), style, cls: dealing ? 'deal' : ''});
    }).join('');
    return `<div class="seat bottom"><div class="hand ${myTurn?'':'idle'}">${cards}</div>${plateHTML(0)}</div>`;
  }
  const n = d.hands[p].length;
  // Партнёр напротив держит веер рубашками к нам, соседи по бокам — стопку со счётчиком карт
  const cards = p === 2
    ? `<div class="fan" aria-label="${n}">${Array.from({length:n}, (_,i) => `<span class="back" style="--i:${i - (n-1)/2 + 3.5}"></span>`).join('')}</div>`
    : (n ? `<span class="stack" aria-label="${n}"><span class="back"></span><span class="back"></span><b>${n}</b></span>` : '');
  return `<div class="seat ${SEAT[p]}">${plateHTML(p)}${cards}</div>`;
}

const ICONS = {
  rules:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.8"/><path d="M12 17.3h.01"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  newGame:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>',
  install:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/></svg>',
  rotate:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/><path d="M2.5 9a8 8 0 0 1 3-5.5"/><path d="M5.5 1.5v2h-2"/></svg>'
};

function trickHTML(){
  const d = S.d;
  if (!d.trick.length) animated.clear();
  const cls = sweeping !== null ? ` sweep to${sweeping}` : '';
  let s = `<div class="trick${cls}">`;
  for (const e of d.trick){
    const fly = !animated.has(id(e.c)); animated.add(id(e.c));
    s += `<div class="slot p${e.p}${d.lastWin===e.p && sweeping===null?' win':''}">${cardHTML(e.c,{cls: fly && sweeping===null ? 'fly' : '', style:`--tilt:${tiltOf(e.c)}deg`})}</div>`;
  }
  return s + '</div>';
}

function settingsHTML(){
  const L = t(), R = draft.rules, pre = presetOf(R);
  const changed = RULE_KEYS.some(k => R[k] !== S.rules[k]);
  const lv = ['easy','strong','master'].map(k => `<button class="lvl" data-lvl="${k}" aria-pressed="${draft.level===k}"><b>${L.levels[k][0]}</b><span>${L.levels[k][1]}</span></button>`).join('');
  const sel = (key, opts, labels) => `<select id="set-${key}">${opts.map(o => `<option value="${o}" ${String(R[key])===String(o)?'selected':''}>${labels[o]}</option>`).join('')}</select>`;
  const chk = (key, disabled) => `<label class="chk ${disabled?'off':''}"><input type="checkbox" id="set-${key}" ${R[key]?'checked':''} ${disabled?'disabled':''}><span>${L.opt[key]}</span></label>`;
  return `<div class="ov"><div class="panel wide" role="dialog" aria-label="${L.settings}"><h2>${L.settings}</h2>
    <h3>${L.level}</h3><div class="levels">${lv}</div>
    <h3>${L.rulesSet}</h3>
    <select id="set-preset" aria-label="${L.rulesSet}">${['classic','ccw','short','custom'].filter(k => k!=='custom' || pre==='custom').map(k => `<option value="${k}" ${k===pre?'selected':''}>${L.presets[k]}</option>`).join('')}</select>
    <div class="opts">
      <label class="fld"><span>${L.dir}</span>${sel('dir',['cw','ccw'],L.dirs)}</label>
      <label class="fld"><span>${L.hand}</span>${sel('hand',[8,7],L.hands)}</label>
      <label class="fld"><span>${L.eggsOpt}</span>${sel('eggs',['four','double'],L.eggsOpts)}</label>
    </div>
    <div class="opts">
      ${chk('aceRule')}${chk('spas')}${chk('firstDeal2')}${chk('golaya')}${chk('redeal')}${chk('redealEye', !R.redeal)}
    </div>
    <p class="note">${L.setNote}</p>
    <div class="row"><button class="btn" data-a="closeSettings">${L.cancel}</button><button class="btn primary" data-a="applySettings">${changed ? L.applyNew : L.save}</button></div>
  </div></div>`;
}

function overlayHTML(){
  const L = t();
  if (showSettings) return settingsHTML();
  if (showRules){
    return `<div class="ov"><div class="panel" role="dialog" aria-label="${L.rulesTitle}"><h2>${L.rulesTitle}</h2>
      <ul>${L.rulesList(S.rules).map(x=>`<li>${x}</li>`).join('')}</ul>
      <div class="row"><button class="btn primary" data-a="closeRules">${L.close}</button></div></div></div>`;
  }
  if (S.phase === 'askRedeal'){
    return `<div class="ov"><div class="panel" role="dialog"><h2>${L.redeal}?</h2><p>${L.askRedeal(reasonText(S.ask))}</p>
      <div class="row"><button class="btn" data-a="play">${L.play}</button><button class="btn primary" data-a="redeal">${L.redeal}</button></div></div></div>`;
  }
  if (S.phase === 'dealEnd' || S.phase === 'gameOver'){
    const r = S.result, over = S.phase === 'gameOver';
    const title = over ? (r.winner===0 ? L.win : L.lose) : L.dealEnd;
    let body = '';
    if (r.a !== undefined){
      body += `<div class="res"><span></span><span class="h">${L.pointsH}</span><span class="h">${L.tricksH}</span>
        <span class="us">${L.us}</span><b class="us">${r.a}</b><span>${r.ta}</span>
        <span class="them">${L.them}</span><b class="them">${r.b}</b><span>${r.tb}</span></div>`;
    }
    const notes = [];
    if (r.golaya) notes.push(`<span class="big">${r.golaya==='win' ? L.golaya : L.golayaPlain}</span>`);
    if (r.winner !== null && r.n) notes.push(`<span class="big">${L.gets(teamName(r.winner), r.n)}</span>`);
    r.notes.forEach(n => notes.push(`<span>${n}</span>`));
    if (over) notes.push(`<span class="big">${L.finalScore(S.eyes[0], S.eyes[1])}</span>`);
    return `<div class="ov"><div class="panel" role="dialog"><h2>${title}</h2>${body}<div class="notes">${notes.join('')}</div>
      <div class="row"><button class="btn primary" data-a="${over?'newGame':'next'}">${over?L.newGame:L.next}</button></div></div></div>`;
  }
  return '';
}

function render(){
  S = game.getState();
  if (!S) return;
  ({ flash, sweeping } = game.getView());
  const L = t(), d = S.d;
  const msg = flash || S.msg;
  const focusId = document.activeElement && document.activeElement.id;
  const trumpLine = `${L.trump} · ${S.dealNo===0 ? L.firstDeal : L.trumpOf(teamName(d.trumpTeam))}`;
  document.documentElement.lang = S.lang === 'kz' ? 'kk' : 'ru';
  document.getElementById('app').innerHTML = `
  <div class="shell">
    <header class="topbar">
      <h1 class="brand">Белка</h1>
      <div class="spacer"></div>
      <div class="lang" role="group" aria-label="Язык / Тіл">
        <button data-a="ru" aria-pressed="${S.lang==='ru'}">РУС</button><button data-a="kz" aria-pressed="${S.lang==='kz'}">ҚАЗ</button>
      </div>
      ${chrome.canInstall ? `<button class="icon" data-a="install" aria-label="${L.install}" title="${L.install}">${ICONS.install}</button>` : ''}
      <button class="icon" data-a="rules" aria-label="${L.rules}" title="${L.rules}">${ICONS.rules}</button>
      <button class="icon" data-a="settings" aria-label="${L.settings}" title="${L.settings}">${ICONS.settings}</button>
      <button class="icon" data-a="newGame" aria-label="${L.newGame}" title="${L.newGame}">${ICONS.newGame}</button>
    </header>
    <div class="status">
      ${teamHTML(0)}
      <div class="plaque" title="${trumpLine}"><span class="tile ${RED[d.trump]?'r':''}">${SYM[d.trump]}</span>
        <span class="txt"><span class="lbl">${trumpLine}</span>
        <span class="pts">${L.pts} <b>${d.taken[0]}</b>:<b>${d.taken[1]}</b> · ${L.tricks} <b>${d.tricksCount[0]}</b>:<b>${d.tricksCount[1]}</b></span></span></div>
      ${teamHTML(1)}
    </div>
    <main class="stage">
      <div class="table"><div class="felt">
        ${seatHTML(2)}${seatHTML(1)}
        <div class="mid">${trickHTML()}</div>
        ${seatHTML(3)}
        <div class="msg${msg ? '' : ' empty'}" role="status">${msg || '&nbsp;'}</div>
      </div></div>
      ${seatHTML(0)}
    </main>
  </div>
  <div class="rotate" role="alert">${ICONS.rotate}<p>${L.rotate}</p></div>
  ${overlayHTML()}
  ${toastHTML()}`;
  dealShown = d;
  if (focusId){ const el = document.getElementById(focusId); if (el) el.focus(); }
}

function toastHTML(){
  const L = t();
  if (chrome.update) return `<div class="toast" role="status"><span>${L.updateReady}</span><button class="btn primary" data-a="update">${L.updateBtn}</button></div>`;
  if (chrome.iosHint) return `<div class="toast" role="status"><span>${L.iosHint}</span><button class="btn" data-a="iosOk">${L.iosOk}</button></div>`;
  return '';
}

export function setChrome(patch){ Object.assign(chrome, patch); render(); }

export function mount(){
  game.onChange(render);
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-c]');
    if (c){ game.humanPlay(c.dataset.c); return; }
    const lv = e.target.closest('[data-lvl]');
    if (lv){ draft.level = lv.dataset.lvl; render(); return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    const st = game.getState();
    switch (a.dataset.a){
      case 'ru': case 'kz': game.setLang(a.dataset.a); break;
      case 'rules': showRules = true; game.setPaused(true); break;
      case 'closeRules': showRules = false; game.setPaused(false); break;
      case 'settings': draft = { rules: { ...st.rules }, level: st.level }; showSettings = true; showRules = false; game.setPaused(true); break;
      case 'closeSettings': showSettings = false; game.setPaused(false); break;
      case 'applySettings': showSettings = false; game.setPaused(false); game.applySettings(draft.rules, draft.level); break;
      case 'newGame': showRules = false; showSettings = false; game.setPaused(false); game.newGame(); break;
      case 'next': game.nextDeal(); break;
      case 'redeal': game.redeal(); break;
      case 'play': game.keepHand(); break;
      case 'install': chrome.onInstall?.(); break;
      case 'iosOk': chrome.onIosHintClose?.(); break;
      case 'update': chrome.onUpdate?.(); break;
    }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (!draft || !el.id || !el.id.startsWith('set-')) return;
    const key = el.id.slice(4);
    if (key === 'preset'){ if (PRESETS[el.value]) draft.rules = { ...PRESETS[el.value] }; }
    else if (el.type === 'checkbox') draft.rules[key] = el.checked;
    else if (key === 'hand') draft.rules.hand = Number(el.value);
    else draft.rules[key] = el.value;
    render();
  });
}
