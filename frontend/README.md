# Kinhold frontend

SolidJS + Vite + Tailwind. **One codebase** runs as:

| Target | How | Notes |
|---|---|---|
| Web (desktop & mobile browsers) | `pnpm dev` / `pnpm build` | Responsive: bottom tab bar on phones, sidebar from `md` (768px) up |
| Installable PWA | same build (`vite-plugin-pwa`) | Manifest, icons and an auto-updating service worker are generated at build time |
| Native iOS / Android | [Capacitor](https://capacitorjs.com) wraps `dist/` | Service worker is skipped; Android back button handled in `src/lib/bootstrap.ts` |

## Scripts

```bash
pnpm install
pnpm dev              # http://localhost:3000
pnpm build            # type-check + production build to dist/
pnpm serve            # preview the production build (PWA works here)

# Native (one-time: generates the android/ and ios/ projects)
pnpm cap:add:android  # needs Android Studio
pnpm cap:add:ios      # needs macOS + Xcode

pnpm cap:sync         # build web + copy into native projects (run after each change)
pnpm cap:open:android
pnpm cap:open:ios
```

Live reload on a phone: `CAP_SERVER_URL=http://<your-lan-ip>:3000 pnpm cap:sync`, keep `pnpm dev --host` running, then run the app from Android Studio / Xcode.

## Translations (i18n)

Uses [`@solid-primitives/i18n`](https://primitives.solidjs.community/package/i18n): the official Solid primitive, under 1 KB, fully typed and fine-grained reactive (switching language re-renders only the text nodes, not components).

```
src/i18n/
├── index.ts          # locale state, detection, t(), Intl formatters
├── plural.ts         # CLDR plurals via Intl.PluralRules
└── locales/
    ├── en.ts         # base dictionary (source of truth for keys)
    └── es.ts         # typed as RawDictionary → missing/extra keys fail type-check
```

**Usage**

```tsx
import { t, formatMoney, formatDate } from '../i18n';

t('shopping.title')                               // plain string
t('money.youOwe', { amount: formatMoney(2350, 'EUR') })  // template: 'You owe {{ amount }}'
t('chores.dueCount', 3)                           // function entry → plural rules
formatDate(new Date())                            // localized via Intl
```

**Language selection:** saved choice → first supported device language (`navigator.languages`, which also works inside the native app) → English. The choice is stored in `localStorage`, and `<html lang>` is kept in sync.

**Add a language** (e.g. Portuguese):
1. Create `src/i18n/locales/pt.ts` exporting `dict: RawDictionary` (copy `es.ts`).
2. Add `pt: 'Português'` to `locales` and a loader in `loaders` in `src/i18n/index.ts`.

Only English is in the main bundle; every other language is a separate chunk loaded on demand.

## Platform helpers

`src/lib/platform.ts` exports `platform` (`'web' | 'ios' | 'android'`), `isNative` and `isStandalonePwa`. `<html>` also gets a `data-platform` attribute for CSS tweaks per platform.

Safe-area utilities (`pt-safe`, `pb-safe`, `px-safe`, `pb-tabbar`) in `src/index.css` keep content clear of notches and the home indicator.

## Native app + backend

The web build uses same-domain session cookies (decision D-01). Inside the native app the page is served from `capacitor://localhost` / `https://localhost`, so API calls must go to the full server URL and the backend needs CORS + `SameSite=None; Secure` cookies (or token auth) for those origins. Sort this out before shipping the native build.

## Data (until the API exists)

Every screen has full create / edit / delete, but data lives **on the device**: `src/stores/*.ts` are Solid stores persisted to `localStorage` (`src/lib/persist.ts`) and seeded with demo data. Two tabs on the same device stay in sync through the `storage` event, which stands in for the SSE live updates. *Config → Reset demo data* wipes it.

The stores already follow the backend contract, so swapping them for API calls is mechanical: client-generated ids (D-08), money in integer cents (D-06), repeat rules as RRULE strings (D-07, `src/lib/repeat.ts`), and records scoped by `householdId`. Mutations return an undo function, which the UI uses for "Undo" toasts instead of confirmation dialogs.

## Design system

- Warm paper/ink palette with one colour per section (home = sky, list = basil, chores = iris, money = saffron, bills = coral; config stays neutral ink). The active section sets `--accent` / `--accent-fg` / `--accent-ink` on `<html>`, and shared components use those. Light-theme values are tuned for WCAG AA.
- Fonts: Bricolage Grotesque (display) + Figtree (body), self-hosted via Fontsource so they work offline.
- Shared UI lives in `src/components/` (`Sheet`, `SwipeRow`, `ui.tsx`). Feedback (haptics, sounds, confetti) lives in `src/lib/feedback.ts` and can be switched off in Config.
