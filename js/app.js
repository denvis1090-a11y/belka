// Запуск приложения: восстановление партии, интерфейс, сохранение при сворачивании.
import * as game from './game.js';
import * as ui from './ui.js';
import * as store from './storage.js';

ui.mount();
game.startOrNew(store.loadGame());

// На iPhone выгрузка из памяти не даёт событий, поэтому сохраняем при каждом сворачивании
const flush = () => store.saveGameNow(game.getState());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
window.addEventListener('pagehide', flush);

// Офлайн-кеш и уведомление о новой версии
if ('serviceWorker' in navigator && location.protocol !== 'file:'){
  let updating = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const offer = worker => ui.setChrome({ update: true, onUpdate: () => { updating = true; flush(); worker.postMessage('SKIP_WAITING'); } });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => { /* без офлайн-кеша игра всё равно работает */ });
}

// Android и компьютерный Chrome: своя кнопка «Установить» вместо системной плашки
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  ui.setChrome({ canInstall: true, onInstall: async () => {
    const p = deferredPrompt; deferredPrompt = null;
    ui.setChrome({ canInstall: false });
    if (p){ p.prompt(); try { await p.userChoice; } catch { /* пользователь закрыл окно */ } }
  } });
});
window.addEventListener('appinstalled', () => { deferredPrompt = null; ui.setChrome({ canInstall: false }); });

// iPhone и iPad: системной кнопки нет, поэтому один раз подсказываем «Поделиться → На экран "Домой"»
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (isIOS && !standalone && !store.getFlag('iosHint')){
  setTimeout(() => ui.setChrome({ iosHint: true, onIosHintClose: () => { store.setFlag('iosHint'); ui.setChrome({ iosHint: false }); } }), 20000);
}
