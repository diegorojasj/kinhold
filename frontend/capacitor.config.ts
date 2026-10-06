import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CapacitorConfig } from '@capacitor/cli';

// Shared settings live in the repo-root .env (documented in .env.example). Capacitor commands run from
// frontend/, so that's one level up. Variables already set in the shell take precedence.
const rootEnv = resolve(process.cwd(), '..', '.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Only DEV, native live reload: URL of the Vite dev server on your LAN. Keep it empty for release
// builds, otherwise the app would load from that dev server instead of the bundled dist/.
const liveReloadUrl = process.env.CAP_SERVER_URL || undefined;

// Wraps the same Vite build (dist/) as native iOS and Android apps.
const config: CapacitorConfig = {
  appId: 'app.kinhold',
  appName: 'Kinhold',
  webDir: 'dist',
  server: {
    // Live reload on a device: set CAP_SERVER_URL=http://<your-lan-ip>:3000 in .env, then pnpm cap:run:android
    url: liveReloadUrl,
    cleartext: Boolean(liveReloadUrl),
  },
};

export default config;
