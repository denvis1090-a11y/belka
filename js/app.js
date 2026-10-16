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
