import { type Component, For, type ParentComponent, Show } from 'solid-js';
import { Icon, type IconName } from '@/components/Icon';
import { t } from '@/i18n';
import { Dynamic } from 'solid-js/web';
import { MEMBER_COLORS } from '@/stores/household';
import { Choice, ChoiceGroup } from '@/components/ui';

/* ── Helpers ────────────────────────────────────────────────────────── */

export const Card: ParentComponent<{ title: string; action?: { label: string; run: () => void } }> = (props) => (
  <section class="mt-7">
    <div class="mb-2.5 flex items-center justify-between px-1">
      <h2 class="eyebrow">{props.title}</h2>
      <Show when={props.action}>
        {(a) => (
          <button type="button" class="-my-2 -mr-3 min-h-11 px-3 text-sm font-bold text-(--accent-ink)" onClick={a().run}>
            {a().label}
          </button>
        )}
      </Show>
    </div>
    <div class="card px-5 py-2">{props.children}</div>
  </section>
);

/** Settings row: a button when it does something, otherwise plain (e.g. "current household"). */
export const Row: ParentComponent<{ icon?: IconName; onClick?: () => void; label: string; hint?: string }> = (props) => (
  <Dynamic
    component={props.onClick ? 'button' : 'div'}
    type={props.onClick ? 'button' : undefined}
    class="flex w-full items-center gap-3 py-3.5 text-left"
    onClick={props.onClick}
  >
    <Show when={props.icon}>
      {(icon) => (
        <span class="flex size-9 items-center justify-center rounded-xl bg-(--accent)/12 text-(--accent-ink)">
          <Icon name={icon()} class="size-5" />
        </span>
      )}
    </Show>
    <span class="min-w-0 flex-1">
      <span class="block font-semibold">{props.label}</span>
      <Show when={props.hint}>
        <span class="block truncate text-sm text-ink-soft">{props.hint}</span>
      </Show>
    </span>
    {props.children ?? <Icon name="chevron" class="size-5 text-ink-faint" />}
  </Dynamic>
);

export const ColorPicker: Component<{ value: string; onChange: (c: string) => void }> = (props) => (
  <ChoiceGroup label={t('config.color')} class="flex flex-wrap gap-2.5">
    <For each={MEMBER_COLORS}>
      {(c) => (
        <Choice
          checked={props.value === c}
          onChange={() => props.onChange(c)}
          label={t('config.colorN', { n: MEMBER_COLORS.indexOf(c) + 1 })}
          class="flex size-11 cursor-pointer items-center justify-center rounded-full text-white transition-transform active:scale-90 data-checked:scale-110 data-checked:ring-4 data-checked:ring-offset-2 data-checked:ring-offset-paper"
          style={{ background: c, '--tw-ring-color': `${c}66` }}
        >
          <Show when={props.value === c}>
            <Icon name="check" class="size-5" stroke={3} />
          </Show>
        </Choice>
      )}
    </For>
  </ChoiceGroup>
);
