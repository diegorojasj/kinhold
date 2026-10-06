import { Capacitor } from '@capacitor/core';

export type Platform = 'web' | 'ios' | 'android';

/** `web` in a browser/installed PWA, `ios`/`android` inside the Capacitor native shell. */
export const platform = Capacitor.getPlatform() as Platform;
export const isNative = Capacitor.isNativePlatform();

/** Installed to the home screen as a PWA (standalone window, no browser chrome). */
export const isStandalonePwa =
  !isNative &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);
