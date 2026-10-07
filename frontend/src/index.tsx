/* @refresh reload */
import './index.css';
import { render } from 'solid-js/web';
import 'solid-devtools';

import App from './App';
import { initI18n, t } from './i18n';
import { bootstrapPlatform } from './lib/bootstrap';
import { setRejectionHandler, startSync } from './lib/sync';
import { toast } from './stores/toast';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?');
}

// Load the user's language before the first paint to avoid a flash of English.
// Not a top-level await: lazy chunks import shared code from this entry chunk, which would deadlock.
void initI18n().then(() => {
  render(() => <App />, root);
  // The stores (loaded by App) are this device's copy of the household; this keeps them in sync with the
  // server: offline changes go up when there's a connection, other members' changes come down live.
  startSync();
});

let lastRejection = 0;
setRejectionHandler(() => {
  if (Date.now() - lastRejection < 3000) return;
  lastRejection = Date.now();
  toast({ emoji: '⚠️', message: t('sync.rejected') });
});
bootstrapPlatform().catch((err) => console.error('Platform bootstrap failed', err));
