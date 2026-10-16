// Правила, колода и боты «Белки». Без DOM и таймеров — запускается и в браузере, и в Node.
export const SYM = {C:'♣',S:'♠',H:'♥',D:'♦'};
export const RED = {H:1,D:1};
export const ALL_RANKS = ['7','8','9','10','J','Q','K','A'];
export const PTS = {A:11,'10':10,K:4,Q:3,J:2};
export const ORDER = {'7':1,'8':2,'9':3,Q:4,K:5,'10':6,A:7};
export const JR = {C:4,S:3,H:2,D:1};
export const LABEL = {'7':'7','8':'8','9':'9','10':'10',J:'В',Q:'Д',K:'К',A:'Т'};
export const SEAT = ['bottom','left','top','right'];

export function buildDeck(n){ const rs = n === 7 ? ALL_RANKS.slice(1) : ALL_RANKS; const out = []; for (const s of 'CSHD') for (const r of rs) out.push({s,r}); return out; }
export const DECKS = {8: buildDeck(8), 7: buildDeck(7)};

/* Наборы правил. Названия описывают сами правила: региональные имена добавим, когда будут известны. */
export const PRESETS = {
  classic:{dir:'cw', hand:8, aceRule:true,  eggs:'four',   redeal:true, redealEye:true, spas:true, golaya:true, firstDeal2:true},
  ccw:    {dir:'ccw',hand:8, aceRule:false, eggs:'four',   redeal:true, redealEye:true, spas:true, golaya:true, firstDeal2:true},
  short:  {dir:'cw', hand:7, aceRule:true,  eggs:'double', redeal:true, redealEye:true, spas:true, golaya:true, firstDeal2:true}
};
export const RULE_KEYS = Object.keys(PRESETS.classic);
export function presetOf(r){ for (const k in PRESETS) if (RULE_KEYS.every(x => PRESETS[k][x] === r[x])) return k; return 'custom'; }

/* ================= Движок раздачи (чистые функции над объектом d) ================= */
export const team = p => p % 2;
export const id = c => c.r + c.s;
export const pts = c => PTS[c.r] || 0;
export const pow = c => c.r === 'J' ? 20 + JR[c.s] : ORDER[c.r];
export const stepOf = dir => dir === -1 ? 3 : 1;
export const nextP = (d, p) => (p + stepOf(d.dir)) % 4;
export const eff = (d, c) => (c.r === 'J' || c.s === d.trump) ? 'T' : c.s;
export function score(d, c, L){ const e = eff(d, c); return e === 'T' ? 100 + pow(c) : e === L ? pow(c) : -1; }

export function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
export function sortHand(d, h){
  const so = {C:0,H:1,S:2,D:3};
  return h.sort((a,b)=>{
    const ta = eff(d,a)==='T', tb = eff(d,b)==='T';
    if (ta !== tb) return ta ? -1 : 1;
    if (ta) return pow(b) - pow(a);
    if (a.s !== b.s) return so[a.s] - so[b.s];
    return pow(b) - pow(a);
  });
}

export function makeDeal(rules, dealer, suitOf){
  const deck = shuffle(DECKS[rules.hand].slice());
  const d = { dir: rules.dir === 'ccw' ? -1 : 1, aceRule: rules.aceRule, size: rules.hand,
    hands:[[],[],[],[]], trick:[], ledSuits:[], played:[], taken:[0,0], tricksCount:[0,0],
    voids:[{},{},{},{}], lastWin:null };
  let p = dealer;
  while (deck.length){ p = nextP(d, p); d.hands[p].push(deck.pop()); }
  d.holder = d.hands.findIndex(h => h.some(c => c.r==='J' && c.s==='C'));
  d.trump = suitOf ? suitOf[d.holder] : 'C';
  d.trumpTeam = team(d.holder);
  d.hands.forEach(h => sortHand(d, h));
  d.turn = d.leader = nextP(d, dealer);
  return d;
}

export function legal(d, p){
  const hand = d.hands[p];
  if (!d.trick.length) return hand.slice();
  const L = eff(d, d.trick[0].c);
  const follow = hand.filter(c => eff(d,c) === L);
  if (follow.length) return follow;
  if (!d.aceRule) return hand.slice();
  const ok = hand.filter(c => !(c.r==='A' && eff(d,c)!=='T' && !d.ledSuits.includes(c.s)));
  return ok.length ? ok : hand.slice();
}

export function winnerSoFar(d){
  const L = eff(d, d.trick[0].c);
  let best = d.trick[0];
  for (const e of d.trick) if (score(d,e.c,L) > score(d,best.c,L)) best = e;
  return best;
}

// Кладёт карту; возвращает true, когда взятка собрана из четырёх карт.
export function applyPlay(d, p, c){
  const h = d.hands[p];
  h.splice(h.findIndex(x => x.r===c.r && x.s===c.s), 1);
  if (d.trick.length){ const L = eff(d, d.trick[0].c); if (eff(d,c) !== L) d.voids[p][L] = 1; }
  else { const e = eff(d,c); if (!d.ledSuits.includes(e)) d.ledSuits.push(e); }
  d.trick.push({p, c}); d.played.push(c);
  if (d.trick.length === 4){ d.lastWin = winnerSoFar(d).p; return true; }
  d.turn = nextP(d, p);
  return false;
}
export function collect(d){
  const w = d.lastWin, k = team(w);
  d.taken[k] += d.trick.reduce((a,e)=>a+pts(e.c),0);
  d.tricksCount[k]++;
  d.trick = []; d.turn = d.leader = w; d.lastWin = null;
}
export const handsEmpty = d => d.hands.every(h => !h.length);

export function eligible(d, p){
  const h = d.hands[p];
  const sum = h.reduce((a,c)=>a+pts(c),0);
  if (sum <= 13) return {kind:'low', n:sum};
  const cnt = {};
  h.forEach(c => { if (c.r!=='J') cnt[c.s] = (cnt[c.s]||0) + 1; });
  for (const s in cnt) if (cnt[s] >= 5) return {kind:'suit', suit:s};
  return null;
}

/* ================= Боты ================= */
export function highestLeft(d, s){
  const gone = new Set(d.played.map(id));
  let best = null;
  for (const c of DECKS[d.size]){
    if (eff(d,c) !== s || gone.has(id(c))) continue;
    if (!best || pow(c) > pow(best)) best = c;
  }
  return best;
}
export function unseenFor(d, p){
  const gone = new Set(d.played.map(id)); d.hands[p].forEach(c => gone.add(id(c)));
  return DECKS[d.size].filter(c => !gone.has(id(c)));
}
export function lowestCard(d, cards, hand){
  const isT = c => eff(d,c)==='T';
  const cnt = s => hand ? hand.filter(c => !isT(c) && c.s===s).length : 0;
  return cards.slice().sort((x,y)=> (pts(x)-pts(y)) || (isT(x)-isT(y)) || (cnt(x.s)-cnt(y.s)) || (pow(x)-pow(y)))[0];
}

// Новичок: смотрит только на текущую взятку.
export function chooseEasy(d, p){
  const L = legal(d, p);
  if (L.length === 1) return L[0];
  if (!d.trick.length){
    const top = highestLeft(d, 'T');
    const mineTop = top && L.find(c => id(c)===id(top));
    const myTrumps = L.filter(c => eff(d,c)==='T');
    if (mineTop && team(p)===d.trumpTeam && myTrumps.length >= 2) return mineTop;
    const nonT = L.filter(c => eff(d,c) !== 'T');
    const ace = nonT.find(c => c.r==='A');
    if (ace) return ace;
    if (nonT.length){
      const by = {}; nonT.forEach(c => (by[c.s] = by[c.s] || []).push(c));
      const suit = Object.keys(by).sort((x,y)=>by[y].length-by[x].length)[0];
      return by[suit].slice().sort((x,y)=>pow(x)-pow(y))[0];
    }
    if (mineTop) return mineTop;
    return L.slice().sort((x,y)=>pow(x)-pow(y))[0];
  }
  const Ld = eff(d, d.trick[0].c);
  const w = winnerSoFar(d);
  const last = d.trick.length === 3;
  if (team(w.p) === team(p)){
    const top = highestLeft(d, 'T');
    const strong = last || (eff(d,w.c)==='T' && pow(w.c) >= 23) || (top && id(top)===id(w.c))
                   || (w.c.r==='A' && eff(d,w.c)!=='T' && d.trick.length >= 2);
    if (strong){
      const give = L.filter(c => c.r !== 'J');
      if (give.length) return give.slice().sort((x,y)=>(pts(y)-pts(x)) || (pow(x)-pow(y)))[0];
    }
    return lowestCard(d, L);
  }
  const beats = L.filter(c => score(d,c,Ld) > score(d,w.c,Ld)).sort((x,y)=>score(d,x,Ld)-score(d,y,Ld));
  if (beats.length){
    const cheap = beats[0];
    const trickPts = d.trick.reduce((a,e)=>a+pts(e.c),0);
    if (!last && trickPts === 0 && eff(d,cheap)==='T' && pow(cheap) >= 22) return lowestCard(d, L);
    if (!last && eff(d,cheap) === Ld && Ld !== 'T'){
      const ace = beats.find(c => c.r==='A');
      if (ace && cheap.r === '10') return ace;
    }
    return cheap;
  }
  return lowestCard(d, L);
}

// Опытный: помнит вышедшие карты, кто в какой масти пуст, и проверяет, перебьют ли его после.
export function chooseStrong(d, p){
  const L = legal(d, p);
  if (L.length === 1) return L[0];
  const hand = d.hands[p], unseen = unseenFor(d, p);
  const isT = c => eff(d,c)==='T';
  const partner = (p+2)%4, opps = [(p+1)%4, (p+3)%4];
  const voidIn = (q,s) => !!d.voids[q][s];
  const unseenIn = s => unseen.filter(c => eff(d,c)===s).length;

  if (!d.trick.length){
    const myT = hand.filter(isT);
    const topT = highestLeft(d, 'T');
    const mineTop = topT && hand.find(c => id(c)===id(topT));
    const oppsMayT = unseenIn('T') > 0 && opps.some(q => !voidIn(q,'T'));
    // Выбиваем козыри, если старший у нас
    if (mineTop && oppsMayT && myT.length >= (team(p)===d.trumpTeam ? 2 : 3)) return mineTop;
    // Старшая оставшаяся карта в боковой масти, которую соперники ещё не бьют
    const side = hand.filter(c => !isT(c));
    let best = null, bestScore = -1;
    for (const s of new Set(side.map(c=>c.s))){
      const top = highestLeft(d, s);
      const mine = top && hand.find(c => id(c)===id(top));
      if (!mine || opps.some(q => voidIn(q,s)) || unseenIn(s) < 2) continue;
      const sc = pts(mine)*10 + unseenIn(s);
      if (sc > bestScore){ bestScore = sc; best = mine; }
    }
    if (best) return best;
    // Подкармливаем партнёра под его пустую масть
    for (const s of new Set(side.map(c=>c.s))){
      if (voidIn(partner,s) && !voidIn(partner,'T') && !opps.some(q => voidIn(q,s))){
        const low = side.filter(c => c.s===s).sort((x,y)=>pts(x)-pts(y)||pow(x)-pow(y))[0];
        if (low && pts(low) <= 4) return low;
      }
    }
    if (side.length){
      const cnt = s => side.filter(c => c.s===s).length;
      // Не открываем десятку или короля, над которыми ещё есть старшие
      const exposed = c => (c.r==='10' || c.r==='K') && highestLeft(d, c.s) && id(highestLeft(d, c.s)) !== id(c);
      return side.slice().sort((x,y)=> (exposed(x)-exposed(y)) || (pts(x)-pts(y)) || (cnt(y.s)-cnt(x.s)) || (pow(x)-pow(y)))[0];
    }
    if (mineTop) return mineTop;
    return L.slice().sort((x,y)=>pow(x)-pow(y))[0];
  }

  const Ld = eff(d, d.trick[0].c);
  const w = winnerSoFar(d);
  const after = [];
  for (let q = nextP(d,p), i = d.trick.length + 1; i < 4; i++, q = nextP(d,q)) after.push(q);
  const oppAfter = after.filter(q => team(q) !== team(p));
  const trickPts = d.trick.reduce((a,e)=>a+pts(e.c),0);
  const followLeft = unseenIn(Ld);
  const couldBeat = (q, card) => {
    const base = score(d, card, Ld);
    return unseen.some(c => {
      if (score(d,c,Ld) <= base) return false;
      const e = eff(d,c);
      if (e === Ld) return !voidIn(q, Ld);
      if (e === 'T') return !voidIn(q,'T') && (voidIn(q, Ld) || followLeft < 2);
      return false;
    });
  };
  const safe = card => oppAfter.every(q => !couldBeat(q, card));

  if (team(w.p) === team(p)){
    if (safe(w.c)){
      const give = L.filter(c => c.r !== 'J');
      if (give.length) return give.slice().sort((x,y)=>(pts(y)-pts(x)) || (isT(x)-isT(y)) || (pow(x)-pow(y)))[0];
    }
    return lowestCard(d, L, hand);
  }
  const beats = L.filter(c => score(d,c,Ld) > score(d,w.c,Ld)).sort((x,y)=>score(d,x,Ld)-score(d,y,Ld));
  if (beats.length){
    const safeB = beats.filter(safe);
    if (safeB.length){
      const nonT = safeB.filter(c => !isT(c));
      if (nonT.length) return nonT.sort((x,y)=>pts(y)-pts(x))[0];
      if (trickPts === 0 && safeB[0].r === 'J' && oppAfter.length) return lowestCard(d, L, hand);
      return safeB[0];
    }
    if (trickPts >= 10) return beats[beats.length-1];
    return lowestCard(d, L, hand);
  }
  return lowestCard(d, L, hand);
}

// Мастер: раздаёт неизвестные карты случайно (с учётом пустых мастей) и доигрывает каждый вариант хода.
export function sampleHands(d, p){
  const unseen = unseenFor(d, p);
  const others = [0,1,2,3].filter(q => q !== p);
  const jc = unseen.find(c => c.r==='J' && c.s==='C');
  for (let attempt = 0; attempt < 25; attempt++){
    const relax = attempt === 24;
    const hands = {}, cap = {};
    others.forEach(q => { hands[q] = []; cap[q] = d.hands[q].length; });
    let rest = shuffle(unseen.slice());
    if (jc && cap[d.holder] > 0){ hands[d.holder].push(jc); cap[d.holder]--; rest = rest.filter(c => c !== jc); }
    const elig = c => others.filter(q => cap[q] > 0 && (relax || !d.voids[q][eff(d,c)]));
    rest.sort((a,b) => elig(a).length - elig(b).length);
    let ok = true;
    for (const c of rest){
      const e = elig(c);
      if (!e.length){ ok = false; break; }
      let r = Math.random() * e.reduce((a,q)=>a+cap[q],0), pick = e[e.length-1];
      for (const q of e){ r -= cap[q]; if (r < 0){ pick = q; break; } }
      hands[pick].push(c); cap[pick]--;
    }
    if (ok) return hands;
  }
  return null;
}
export function cloneDeal(d, hands){
  return { dir:d.dir, aceRule:d.aceRule, size:d.size, trump:d.trump, trumpTeam:d.trumpTeam, holder:d.holder,
    hands, trick:d.trick.slice(), ledSuits:d.ledSuits.slice(), played:d.played.slice(),
    taken:d.taken.slice(), tricksCount:d.tricksCount.slice(), voids:d.voids.map(v => ({...v})),
    lastWin:d.lastWin, turn:d.turn, leader:d.leader };
}
export function playout(d, policy){
  while (!handsEmpty(d)){
    const p = d.turn;
    if (applyPlay(d, p, policy(d, p))) collect(d);
  }
}
export function utility(d, k){
  const my = d.taken[k], op = d.taken[1-k];
  let u = (my - op) / 120;
  if (my > 60) u += 1; else if (op > 60) u -= 1;
  if (op < 30) u += 0.5;
  if (my < 30) u -= 0.5;
  if (d.tricksCount[1-k] === 0) u += 2;
  if (d.tricksCount[k] === 0) u -= 2;
  return u;
}
export function chooseBySimulation(d, p, samples, policy){
  const L = legal(d, p);
  if (L.length === 1) return L[0];
  const tot = L.map(() => 0);
  for (let i = 0; i < samples; i++){
    const hs = sampleHands(d, p);
    if (!hs) continue;
    L.forEach((c, j) => {
      const hands = [0,1,2,3].map(q => q === p ? d.hands[p].slice() : hs[q].slice());
      const w = cloneDeal(d, hands);
      if (applyPlay(w, p, c)) collect(w);
      playout(w, policy);
      tot[j] += utility(w, team(p));
    });
  }
  let bi = 0; tot.forEach((v,j) => { if (v > tot[bi]) bi = j; });
  return L[bi];
}
// Ступени проверены партиями ботов друг против друга (classic, раздачи с перестановкой мест):
// «Опытный» берёт ~60% раздач у «Новичка», «Мастер» ещё немного сильнее «Опытного».
export function chooseCard(d, p, level){
  if (level === 'master') return chooseBySimulation(d, p, 40, chooseStrong);
  if (level === 'strong') return chooseBySimulation(d, p, 12, chooseEasy);
  return chooseEasy(d, p);
}
