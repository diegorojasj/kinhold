import { createEffect, createRoot, createSignal } from 'solid-js';
import { persistedStore } from '@/lib/persist';

export type ThemePref = 'system' | 'light' | 'dark';

/** Per-device preferences (not shared with the household). */
export const prefs = persistedStore('prefs', () => ({
  theme: 'system' as ThemePref,
  haptics: true,
  sounds: true,
  notifications: false,
}));

const media = window.matchMedia('(prefers-color-scheme: dark)');

/** Resolved theme, kept in sync with the OS when the preference is "system". */
export const resolvedTheme = createRoot(() => {
  const [systemDark, setSystemDark] = createSignal(media.matches);
  media.addEventListener('change', (e) => setSystemDark(e.matches));
  const resolved = () => (prefs.state.theme === 'system' ? (systemDark() ? 'dark' : 'light') : prefs.state.theme);

  createEffect(() => {
    const theme = resolved();
    document.documentElement.dataset.theme = theme;
    // Status bar / browser chrome follows the paper colour of the active theme.
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = theme === 'dark' ? '#141210' : '#f5f0e8';
      meta.removeAttribute('media');
    }
  });
  return resolved;
});
