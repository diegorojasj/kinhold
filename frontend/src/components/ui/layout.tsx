import { Show, type Component, type JSX, type ParentComponent } from 'solid-js';
import { haptic } from '@/lib/feedback';
import { Icon } from '@/components/Icon';

/* ── Progress ───────────────────────────────────────────────────────── */

/** Circular progress (0–1) with optional content in the middle. */
export const ProgressRing: ParentComponent<{ value: number; size?: number; stroke?: number; color?: string; label?: string }> = (props) => {
  const size = () => props.size ?? 56;
  const stroke = () => props.stroke ?? 6;
  const r = () => (size() - stroke()) / 2;
  const c = () => 2 * Math.PI * r();
  const v = () => Math.min(1, Math.max(0, Number.isFinite(props.value) ? props.value : 0));
  return (
    <div
      class="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: `${size()}px`, height: `${size()}px` }}
      role="progressbar"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v() * 100)}
    >
      <svg class="absolute inset-0 -rotate-90" viewBox={`0 0 ${size()} ${size()}`} aria-hidden="true">
        <circle cx={size() / 2} cy={size() / 2} r={r()} fill="none" stroke="var(--color-sunk)" stroke-width={stroke()} />
        <circle
          cx={size() / 2}
          cy={size() / 2}
          r={r()}
          fill="none"
          stroke={props.color ?? 'var(--accent)'}
          stroke-width={stroke()}
          stroke-linecap="round"
          stroke-dasharray={String(c())}
          stroke-dashoffset={String(c() * (1 - v()))}
          style={{ transition: 'stroke-dashoffset 600ms var(--ease-out-soft)' }}
        />
      </svg>
      <span class="relative">{props.children}</span>
    </div>
  );
};

/* ── Layout helpers ─────────────────────────────────────────────────── */

export const EmptyState: ParentComponent<{ emoji: string; title: string; text?: string }> = (props) => (
  <div class="flex animate-rise flex-col items-center px-6 py-14 text-center">
    <div class="mb-4 flex size-24 items-center justify-center rounded-full bg-(--accent)/10 text-5xl">{props.emoji}</div>
    <p class="font-display text-xl font-bold tracking-tight">{props.title}</p>
    <Show when={props.text}>
      <p class="mt-1.5 max-w-xs text-ink-soft">{props.text}</p>
    </Show>
    <Show when={props.children}>
      <div class="mt-5">{props.children}</div>
    </Show>
  </div>
);

export const SectionTitle: ParentComponent<{ count?: number; right?: JSX.Element; tone?: 'alert' }> = (props) => (
  <div class="mt-7 mb-2.5 flex items-center justify-between gap-3 px-1 first:mt-2">
    <h2 class={`eyebrow flex items-center gap-2 ${props.tone === 'alert' ? '!text-coral' : ''}`}>
      {props.children}
      <Show when={props.count !== undefined}>
        <span class="rounded-full bg-sunk px-2 py-0.5 text-[0.65rem] tracking-normal text-ink-soft">{props.count}</span>
      </Show>
    </h2>
    {props.right}
  </div>
);

/** Floating "+" button, above the tab bar on phones. Adds a spacer so it never covers the last row. */
export const Fab: Component<{ label: string; onClick: () => void }> = (props) => (
  <>
  <div aria-hidden="true" class="h-20" />
  <button
    type="button"
    class="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-above-tabbar z-20 inline-flex h-14 items-center gap-2 rounded-full bg-(--accent) pr-6 pl-5 font-semibold text-(--accent-fg) shadow-[0_10px_30px_-8px_var(--accent)] transition-transform active:scale-95 md:right-10 md:bottom-10"
    onClick={() => {
      haptic();
      props.onClick();
    }}
  >
    <Icon name="plus" class="size-6" stroke={2.25} />
    <span>{props.label}</span>
  </button>
  </>
);

/** Thin rule that separates groups; with a label it reads as a section heading ("HOUSEHOLD ────"). */
export const Divider: Component<{ label?: string; class?: string }> = (props) => (
  <div class={`flex items-center gap-3 ${props.class ?? ''}`}>
    <Show when={props.label}>
      <span class="eyebrow shrink-0">{props.label}</span>
    </Show>
    <hr class="min-w-0 flex-1 border-line" />
  </div>
);
