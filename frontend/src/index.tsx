/* @refresh reload */
import './index.css';
import { render } from 'solid-js/web';
import 'solid-devtools';

import App from './App';
import { initI18n } from './i18n';
import { bootstrapPlatform } from './lib/bootstrap';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?');
}

// Load the user's language before the first paint to avoid a flash of English.
// Not a top-level await: lazy chunks import shared code from this entry chunk, which would deadlock.
void initI18n().then(() => render(() => <App />, root));
bootstrapPlatform().catch((err) => console.error('Platform bootstrap failed', err));
