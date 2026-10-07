import { t } from '@/i18n';
import { haptic } from '@/lib/feedback';
import { syncStatus } from '@/lib/sync';
import { bills, urgency } from '@/stores/bills';
import { bucketOf, chores } from '@/stores/chores';
import '@/stores/prefs';
import { A, useLocation } from '@solidjs/router';
import { createEffect, createMemo, createSignal, For, onCleanup, type ParentComponent, Show } from 'solid-js';
import { items } from '@/stores/shopping';
import { HouseholdSwitcher } from './HouseholdSwitcher';
import { Icon, type IconName } from './Icon';
import { Divider, Toaster } from './ui';

/**
 * Each "room" of the app has its own colour, used for the active tab, buttons and highlights:
 * `--accent` for fills, `--accent-fg` for text on those fills, `--accent-ink` for coloured text.
 */
const room = (c: string, fg = 'var(--color-on-accent)', ink = `var(--color-${c})`) => ({ fill: `var(--color-${c})`, fg, ink });
export const ACCENTS = {
  home: room('sky'),
  list: room('basil'),
  chores: room('iris'),
  money: room('saffron', 'var(--color-on-saffron)', 'var(--color-saffron-ink)'),
  bills: room('coral'),
  // Settings stay neutral: ink, not a "room" colour.
  config: room('ink', 'var(--color-paper)', 'var(--color-ink)'),
} as const;
type Accent = (typeof ACCENTS)[keyof typeof ACCENTS];

const tabs: { href: string; icon: IconName; accent: Accent; label: () => string; badge?: () => number }[] = [
  { href: '/', icon: 'home', accent: ACCENTS.home, label: () => t('nav.home') },
  { href: '/list', icon: 'list', accent: ACCENTS.list, label: () => t('nav.shopping'), badge: () => items().filter((i) => !i.checked).length },
  {
    href: '/chores',
    icon: 'chores',
    accent: ACCENTS.chores,
    label: () => t('nav.chores'),
    badge: () => chores().filter((c) => bucketOf(c) === 'today').length,
  },
  { href: '/money', icon: 'money', accent: ACCENTS.money, label: () => t('nav.money') },
  {
    href: '/bills',
    icon: 'bills',
    accent: ACCENTS.bills,
    label: () => t('nav.bills'),
    badge: () => bills().filter((b) => urgency(b) !== 'later').length,
  },
  { href: '/config', icon: 'config', accent: ACCENTS.config, label: () => t('nav.config') },
];

function useOnline() {
  const [online, setOnline] = createSignal(navigator.onLine);
  const update = () => setOnline(navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  onCleanup(() => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  });
  return online;
}

const Badge = (props: { n: number; class?: string }) => (
  <Show when={props.n > 0}>
    <span
      class={`tabular inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-coral px-1 text-[0.65rem] leading-none font-bold text-white ${props.class ?? ''}`}
    >
      {props.n > 99 ? '99+' : props.n}
    </span>
  </Show>
);

/**
 * One layout for every platform:
 * - phones (and the native app): content + floating bottom tab bar, padded for notches/home indicator
 * - tablets/desktop (md+): left sidebar navigation, content centred
 */
export const AppShell: ParentComponent = (props) => {
  const online = useOnline();
  const location = useLocation();
  // Undefined on screens that aren't tabs (e.g. /household): no tab lights up there.
  const active = createMemo(() =>
    tabs.find((tab) => (tab.href === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.href))),
  );
  const accent = () => active()?.accent ?? ACCENTS.config;

  // On <html> rather than this div so sheets and toasts (rendered in portals) get the screen's colour too.
  createEffect(() => {
    const style = document.documentElement.style;
    style.setProperty('--accent', accent().fill);
    style.setProperty('--accent-fg', accent().fg);
    style.setProperty('--accent-ink', accent().ink);
  });

  return (
    <div class="min-h-dvh bg-paper text-ink md:flex">
      {/* Desktop sidebar */}
      <nav aria-label={t('nav.main')} class="hidden shrink-0 pt-safe md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:flex-col md:px-4 md:py-6">
        <div class="mb-6 flex items-center gap-2.5 px-3">
          <img src="/icon.svg" alt="" class="size-9 rounded-xl" />
          <span class="font-display text-2xl font-extrabold tracking-tight">{t('app.name')}</span>
        </div>
        <ul class="flex flex-col gap-1">
          <For each={tabs}>
            {(tab) => (
              <li>
                <A
                  href={tab.href}
                  end={tab.href === '/'}
                  class="group flex items-center gap-3 rounded-2xl px-3 py-2.5 font-semibold text-ink-soft transition-colors hover:bg-card"
                  activeClass="!bg-card !text-ink shadow-sm"
                  style={{ '--tab': tab.accent.fill, '--tab-ink': tab.accent.ink }}
                >
                  <span class="flex size-9 items-center justify-center rounded-xl bg-(--tab)/12 text-(--tab-ink)">
                    <Icon name={tab.icon} class="size-5" stroke={2} />
                  </span>
                  <span class="flex-1">{tab.label()}</span>
                  <Badge n={tab.badge?.() ?? 0} />
                </A>
              </li>
            )}
          </For>
        </ul>

        {/* Household: its own section, pinned to the bottom and set apart from the navigation. */}
        <div class="mt-auto pt-6">
          <Divider label={t('nav.household')} class="mb-3 px-1" />
          <HouseholdSwitcher />
        </div>
      </nav>

      <div class="flex min-w-0 flex-1 flex-col pt-safe">
        {/* No network, or the server can't be reached: the app keeps working and syncs later. */}
        <Show when={!online() || syncStatus() === 'offline'}>
          <div role="status" class="flex items-center justify-center gap-2 bg-saffron/15 px-4 py-2 text-center text-sm font-medium text-ink">
            <Icon name="wifiOff" class="size-4" />
            {t('app.offline')}
          </div>
        </Show>
        <main class="mx-auto w-full max-w-2xl flex-1 px-safe pb-tabbar md:pb-12">
          <div class="px-4 md:px-8">{props.children}</div>
        </main>
      </div>

      {/* Phone tab bar: a floating pill, the active tab expands to show its label. */}
      <nav aria-label={t('nav.main')} class="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <ul class="mx-auto flex max-w-md items-center justify-between gap-1 rounded-[1.75rem] bg-card/90 p-1.5 shadow-[0_12px_40px_-12px_rgb(40_25_10/0.35)] ring-1 ring-line backdrop-blur-xl">
          <For each={tabs}>
            {(tab) => {
              const isActive = () => active() === tab;
              return (
                <li class={isActive() ? 'flex-[1.6]' : 'flex-1'} style={{ transition: 'flex 300ms var(--ease-out-soft)' }}>
                  <A
                    href={tab.href}
                    end={tab.href === '/'}
                    aria-label={tab.badge?.() ? `${tab.label()} (${tab.badge?.()})` : tab.label()}
                    onClick={() => haptic()}
                    class="relative flex h-13 items-center justify-center gap-1.5 rounded-[1.35rem] text-ink-faint transition-colors"
                    style={isActive() ? { background: `color-mix(in oklab, ${tab.accent.fill} 16%, transparent)`, color: tab.accent.ink } : undefined}
                  >
                    <Icon name={tab.icon} class="size-6" stroke={isActive() ? 2.2 : 1.75} />
                    <Show when={isActive()}>
                      <span class="animate-fade text-sm font-bold">{tab.label()}</span>
                    </Show>
                    <Show when={!isActive() && (tab.badge?.() ?? 0) > 0}>
                      <span class="absolute top-2 right-[calc(50%-1.1rem)] size-2.5 rounded-full bg-coral ring-2 ring-card" />
                    </Show>
                  </A>
                </li>
              );
            }}
          </For>
        </ul>
      </nav>

      <Toaster />
    </div>
  );
};
