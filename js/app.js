// Запуск приложения: восстановление партии, интерфейс, сохранение при сворачивании.
import * as game from './game.js';
import * as ui from './ui.js';
import * as store from './storage.js';

ui.mount();
game.start(store.loadGame());

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
