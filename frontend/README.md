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

Live reload on a phone: set `CAP_SERVER_URL=http://<your-lan-ip>:3000` in the repo-root `.env` (copy `.env.example`), keep `pnpm dev --host` running, then `pnpm cap:sync` and run the app from Android Studio / Xcode.

**Environment variables:** there is one `.env` for the whole repo, at the root. Every variable the code reads must be listed in `.env.example`. Vite reads it too (`envDir`), and only `VITE_*` variables are exposed to browser code.

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

The web build calls the API on its own origin (`/api`, D-01); `pnpm dev` and `pnpm serve` proxy `/api` to the gateway (`API_GATEWAY_URL`, default `http://localhost:8000`). The native app is served from `capacitor://localhost` / `https://localhost`, so release builds need `VITE_API_URL=https://your.domain`; the gateway already answers CORS for those origins. Auth is a device token in the `Authorization` header (no cookies), so it works the same on web and native.

## Data and sync (offline-first)

Every store in `src/stores/*.ts` is **this device's copy** of the household, saved to `localStorage` (`src/lib/persist.ts`). Screens read and write the stores directly, so the app works the same offline; `src/lib/sync/` keeps them in step with the backend:

```
src/lib/sync/
├── collections.ts  # registry: which store arrays sync with which service (`arrayCollection(...)`)
├── tracker.ts      # after every local change, diffs the store into ops (changed fields only)
├── outbox.ts       # ops waiting for the server, kept in localStorage (survive reloads, shared by tabs)
├── engine.ts       # the loop: register device → push outbox → pull changes since each cursor
├── live.ts         # server-sent events: "service X changed" → pull from X (≈300 ms phone to phone)
├── households.ts   # invite / join / leave (the only things that need a connection)
├── state.ts        # cursors, linked households, server clock offset
└── api.ts, device.ts
```

- **Nothing in a store knows about the server.** A store only declares what syncs, e.g. `arrayCollection(store, 'shopping', 'items', (s) => s.items)`. Undo, edits and deletes are picked up by the diff.
- **Ops** set some fields of one record at a timestamp; the server keeps the newest value per field (last-write-wins per field, D-09). Ids are made on the device (D-08), so retrying is always safe.
- **Pulls** fetch everything with a higher `seq` than the device's cursor, per service and household. Unsent local edits are laid back on top of what comes down, so a pull never undoes something you just did.
- **Rejected ops** (validation or permission, e.g. editing someone else's expense) are reverted to the server's version and a toast says so.
- **Who you are** is per household (`myId()` in `stores/household.ts`); the device gets a token the first time it's online. Other phones join with an invite code (Household → Phones and devices).
- **Offline**: the service worker serves the app, the stores serve the data, the outbox holds the changes. The banner shows while the server can't be reached; Config → This device shows the sync state.

Demo data is seeded on first launch (with ids unique to the device) and uploaded like anything else. *Config → Reset this device* wipes the device and its link to its households; they carry on for everyone else.

The stores follow the backend contract: money in integer cents (D-06), repeat rules as RRULE strings (D-07, `src/lib/repeat.ts`), records scoped by `householdId`. Mutations return an undo function, which the UI uses for "Undo" toasts instead of confirmation dialogs.

## Design system

- Warm paper/ink palette with one colour per section (home = sky, list = basil, chores = iris, money = saffron, bills = coral; config stays neutral ink). The active section sets `--accent` / `--accent-fg` / `--accent-ink` on `<html>`, and shared components use those. Light-theme values are tuned for WCAG AA.
- Fonts: Bricolage Grotesque (display) + Figtree (body), self-hosted via Fontsource so they work offline.
- Shared UI lives in `src/components/` (`Sheet`, `SwipeRow`, `ui.tsx`). Feedback (haptics, sounds, confetti) lives in `src/lib/feedback.ts` and can be switched off in Config.

## Code layout

Files stay under ~300 lines (hard limit 400). Each screen is a folder whose `index.tsx` is the screen itself, with its editors, rows and forms next to it:

```
src/routes/<screen>/index.tsx   # the screen (lazy-loaded route)
src/routes/<screen>/*.tsx       # its sheets, rows and forms
src/routes/<screen>/helpers.ts  # small screen-only helpers
src/components/ui/              # shared UI, re-exported from ui/index.ts
src/stores/                     # one store per feature
```

Imports use the `@/` alias for `src/` (configured in `tsconfig.json` → `paths` and `vite.config.ts` → `resolve.alias`): `import { t } from '@/i18n'`. Use `./` only for files in the same folder; never `../`.
