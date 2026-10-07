import { For, Show, type Component } from 'solid-js';
import { t } from '@/i18n';
import { initials, member, myId } from '@/stores/household';
import { Choice, ChoiceGroup } from './choice';
import { Icon } from '@/components/Icon';

/* ── People ─────────────────────────────────────────────────────────── */

export const Avatar: Component<{ id?: string; size?: 'xs' | 'sm' | 'md' | 'lg'; ring?: boolean; class?: string }> = (props) => {
  const m = () => member(props.id);
  const size = () =>
    ({ xs: 'size-5 text-[0.55rem]', sm: 'size-7 text-[0.7rem]', md: 'size-9 text-sm', lg: 'size-14 text-lg' })[props.size ?? 'md'];
  return (
    <span
      class={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none ${size()} ${props.ring ? 'ring-2 ring-card' : ''} ${props.class ?? ''}`}
      style={{ background: m()?.color ?? '#958b7e' }}
      title={props.id === myId() ? t('common.you') : m()?.name}
      aria-hidden="true"
    >
      {initials(m()?.name ?? '?')}
    </span>
  );
};

export const AvatarStack: Component<{ ids: string[]; size?: 'xs' | 'sm' | 'md' }> = (props) => (
  <span class="flex -space-x-1.5">
    <For each={props.ids}>{(id) => <Avatar id={id} size={props.size ?? 'sm'} ring />}</For>
  </span>
);

/** Pick one member, or several when `multiple`. */
export const MemberPicker: Component<{
  ids: string[];
  selected: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  label: string;
}> = (props) => (
  <ChoiceGroup label={props.label} class="flex flex-wrap gap-2">
    <For each={props.ids}>
      {(id) => {
        const on = () => props.selected.includes(id);
        return (
          <Choice
            type={props.multiple ? 'checkbox' : 'radio'}
            checked={on()}
            class="chip cursor-pointer py-1.5 pl-1.5"
            onChange={() => {
              if (!props.multiple) return props.onChange([id]);
              props.onChange(on() ? props.selected.filter((x) => x !== id) : [...props.selected, id]);
            }}
          >
            <Avatar id={id} size="sm" />
            {id === myId() ? t('common.you') : member(id)?.name}
            <Show when={props.multiple && on()}>
              <Icon name="check" class="size-4" stroke={2.5} />
            </Show>
          </Choice>
        );
      }}
    </For>
  </ChoiceGroup>
);
