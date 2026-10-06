import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates favicon, apple-touch-icon and the manifest PNG icons from one SVG at build time.
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
});
