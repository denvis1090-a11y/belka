// Безопасная работа с localStorage: любые ошибки хранилища молча пропускаются.
import { PRESETS, RULE_KEYS } from './engine.js';

export const SAVE_VERSION = 1;
const KEY_SETTINGS = 'belka-settings', KEY_LANG = 'belka-lang', KEY_SAVE = 'belka-save';

const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const del = k => { try { localStorage.removeItem(k); } catch { /* недоступно */ } };

export function loadSettings(){
  let saved = {};
  try { saved = JSON.parse(get(KEY_SETTINGS) || '{}') || {}; } catch { saved = {}; }
  const rules = { ...PRESETS.classic };
  if (saved.rules) for (const k of RULE_KEYS) if (typeof saved.rules[k] === typeof rules[k]) rules[k] = saved.rules[k];
  if (rules.hand !== 7) rules.hand = 8;
  const level = ['easy', 'strong', 'master'].includes(saved.level) ? saved.level : 'strong';
  return { rules, level };
}
export function saveSettings(rules, level){ put(KEY_SETTINGS, JSON.stringify({ rules, level })); }
export function loadLang(){ return get(KEY_LANG) === 'kz' ? 'kz' : 'ru'; }
export function saveLang(l){ put(KEY_LANG, l); }

export function isValidSave(o){
  const S = o && o.S;
  return !!S && o.v === SAVE_VERSION && typeof S.phase === 'string' && ['ru', 'kz'].includes(S.lang) && !!S.rules && Array.isArray(S.eyes)
    && !!S.d && Array.isArray(S.d.hands) && S.d.hands.length === 4;
}
export function loadGame(){
  const raw = get(KEY_SAVE);
  if (!raw) return null;
  let o;
  try { o = JSON.parse(raw); } catch { del(KEY_SAVE); return null; }
  if (!isValidSave(o)) { del(KEY_SAVE); return null; }
  return o.S;
}
let saveTimer = null;
export function saveGameNow(S){
  clearTimeout(saveTimer);
  if (!S) return;
  put(KEY_SAVE, JSON.stringify({ v: SAVE_VERSION, savedAt: Date.now(), S }));
}
export function saveGameSoon(S){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveGameNow(S), 300);
}
export function clearGame(){ del(KEY_SAVE); }
export function getFlag(name){ return get('belka-flag-' + name) === '1'; }
export function setFlag(name){ put('belka-flag-' + name, '1'); }
