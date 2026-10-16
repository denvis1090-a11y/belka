// Вставляется в страницу (fetch + eval) и возвращает строку: размеры и найденные перекрытия или OK.
(() => {
  // В скрытой вкладке время анимаций стоит; доводим их до конца, чтобы мерить итоговое положение
  document.getAnimations().forEach(x => { try { x.finish(); } catch { /* бесконечная анимация */ } });
  const vis = e => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const box = s => { const e = [...document.querySelectorAll(s)].find(vis); return e ? e.getBoundingClientRect() : null; };
  const boxes = s => [...document.querySelectorAll(s)].filter(vis).map(e => e.getBoundingClientRect());
  const ov = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  const W = innerWidth, H = innerHeight, out = [];
  const B = { top: box('.seat.top'), left: box('.seat.left'), right: box('.seat.right'), trick: box('.trick'), msg: box('.msg'),
    hand: box('.hand'), me: box('.seat.bottom .plate'), bar: box('.topbar'), felt: box('.felt'), table: box('.table') };
  const pairs = [['top','trick'],['left','trick'],['right','trick'],['msg','trick'],['msg','hand'],['top','left'],['top','right'],['hand','left'],['hand','right'],['hand','trick'],['me','hand']];
  for (const [a,b] of pairs) if (ov(B[a], B[b])) out.push(`overlap ${a}/${b}`);
  boxes('.score').forEach((s,i) => { ['top','left','right','trick','hand'].forEach(k => { if (ov(s, B[k])) out.push(`overlap score${i}/${k}`); }); });
  for (const k of ['top','left','right','trick','msg']) { const r = B[k], f = B.felt; if (r && f && (r.left < f.left - 1 || r.right > f.right + 1 || r.top < f.top - 1 || r.bottom > f.bottom + 1)) out.push(`${k} outside felt`); }
  for (const k in B) { const r = B[k]; if (r && (r.left < -1 || r.right > W + 1 || r.bottom > H + 1 || r.top < -1)) out.push(`${k} off-screen`); }
  boxes('.hand .card').forEach((r,i) => { if (r.left < -1 || r.right > W + 1 || r.bottom > H + 1) out.push(`card${i} off-screen`); });
  [...document.querySelectorAll('.seat.left .pname span,.seat.right .pname span')].forEach(e => { if (e.scrollWidth > e.clientWidth) out.push(`name cut: ${e.textContent}`); });
  if (document.documentElement.scrollWidth > W + 1) out.push('page scrolls sideways');
  return `${W}x${H} bar=${B.bar ? Math.round(B.bar.height) : '-'} felt=${B.felt ? Math.round(B.felt.width)+'x'+Math.round(B.felt.height) : '-'} :: ${out.length ? out.join('; ') : 'OK'}`;
})()
