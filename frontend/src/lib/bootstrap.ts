import { isNative, isStandalonePwa, platform } from './platform';

/** Platform-specific startup: native shell hooks on iOS/Android, service worker on the web. */
export async function bootstrapPlatform(): Promise<void> {
  const root = document.documentElement;
  // Lets CSS target a platform, e.g. `[data-platform='ios'] .foo { … }`.
  root.dataset.platform = platform;
  if (isStandalonePwa) root.dataset.standalone = '';

  if (isNative) {
    const { App } = await import('@capacitor/app');
    // Android hardware back button: navigate back, or leave the app from the first screen.
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) history.back();
      else App.exitApp();
    });
    return;
  }

  // The native shell already serves assets locally, so the service worker is web-only.
  if (import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({ immediate: true });
  }
}
