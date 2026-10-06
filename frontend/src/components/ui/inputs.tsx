import { For, Show, splitProps, type Component, type JSX } from 'solid-js';
import { t } from '@/i18n';
import { haptic } from '@/lib/feedback';
import { Choice, ChoiceGroup } from './choice';

/* ── Inputs ─────────────────────────────────────────────────────────── */

/** Pill segmented control (single choice). */
export function Segmented<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <ChoiceGroup label={props.label} class="flex gap-1 rounded-2xl bg-sunk p-1">
      <For each={props.options}>
        {(o) => (
          <Choice
            checked={props.value === o.value}
            onChange={() => props.onChange(o.value)}
            class="flex-1 cursor-pointer rounded-xl px-3 py-2 text-center text-sm font-semibold text-ink-soft transition-all data-checked:bg-card data-checked:text-ink data-checked:shadow-sm"
          >
            {o.label}
          </Choice>
        )}
      </For>
    </ChoiceGroup>
  );
}

export const Toggle: Component<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; icon?: JSX.Element }> = (
  props,
) => (
  <button
    type="button"
    role="switch"
    aria-checked={props.checked}
    class="flex w-full items-center gap-3 py-3 text-left"
    onClick={() => {
      haptic();
      props.onChange(!props.checked);
    }}
  >
    {props.icon}
    <span class="min-w-0 flex-1">
      <span class="block font-semibold">{props.label}</span>
      <Show when={props.hint}>
        <span class="block text-sm text-ink-soft">{props.hint}</span>
      </Show>
    </span>
    <span
      class={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${props.checked ? 'bg-(--accent,var(--color-basil))' : 'bg-line'}`}
    >
      <span
        class={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-200 ${props.checked ? 'translate-x-5' : ''}`}
      />
    </span>
  </button>
);

export const Stepper: Component<{ value: number; min: number; max: number; onChange: (v: number) => void; format: (v: number) => string; label: string }> = (
  props,
) => (
  <fieldset class="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-line bg-card p-1.5">
    <legend class="sr-only">{props.label}</legend>
    <button
      type="button"
      class="icon-btn bg-sunk text-xl font-bold"
      aria-label={`${props.label}: ${t('common.decrease')}`}
      disabled={props.value <= props.min}
      onClick={() => props.onChange(Math.max(props.min, props.value - 1))}
    >
      −
    </button>
    <span class="tabular font-semibold" aria-live="polite">
      {props.format(props.value)}
    </span>
    <button
      type="button"
      class="icon-btn bg-sunk text-xl font-bold"
      aria-label={`${props.label}: ${t('common.increase')}`}
      disabled={props.value >= props.max}
      onClick={() => props.onChange(Math.min(props.max, props.value + 1))}
    >
      +
    </button>
  </fieldset>
);

/** Emoji grid picker (radio group). */
export const EmojiPicker: Component<{ value: string; options: readonly string[]; onChange: (e: string) => void; label: string }> = (props) => (
  <ChoiceGroup label={props.label} class="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
    <For each={props.options}>
      {(e) => (
        <Choice
          checked={props.value === e}
          onChange={() => props.onChange(e)}
          class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-sunk text-2xl transition-transform active:scale-90 data-checked:scale-105 data-checked:bg-(--accent)/20 data-checked:ring-2 data-checked:ring-(--accent)"
        >
          {e}
        </Choice>
      )}
    </For>
  </ChoiceGroup>
);

/** Text field with a label above it. */
export const Field: Component<JSX.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }> = (props) => {
  const [local, rest] = splitProps(props, ['label', 'hint']);
  return (
    <label class="block">
      <span class="label">{local.label}</span>
      <input class="field" {...rest} />
      <Show when={local.hint}>
        <span class="mt-1 block text-sm text-ink-faint">{local.hint}</span>
      </Show>
    </label>
  );
};
