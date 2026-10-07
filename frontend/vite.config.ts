import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import { VitePWA } from 'vite-plugin-pwa';

// One .env for the whole repo (see .env.example); only VITE_* variables reach the browser bundle.
const envDir = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  // `/api` goes to the API gateway, so the app talks to the backend on its own origin (D-01).
  const env = { ...loadEnv(mode, envDir, ''), ...process.env };
  const proxy = { '/api': { target: env.API_GATEWAY_URL || 'http://localhost:8000' } };

  return {
    envDir,
    resolve: {
      // `@/…` = `src/…` (mirrored in tsconfig.json "paths")
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    plugins: [
      devtools(),
      solidPlugin(),
      tailwindcss(),
      VitePWA({
        // Registered manually in src/lib/bootstrap.ts so the native (Capacitor) build skips it.
        injectRegister: false,
        registerType: 'autoUpdate',
        pwaAssets: { config: true, overrideManifestIcons: true },
        manifest: {
          name: 'Kinhold',
          short_name: 'Kinhold',
          description: 'Shared shopping list, chores, expenses and bills for your household.',
          lang: 'en',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f5f0e8',
          theme_color: '#1d1a16',
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    server: {
      port: 3000,
      proxy,
    },
    preview: {
      proxy,
    },
    build: {
      target: 'esnext',
    },
  };
});
