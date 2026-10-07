import { type Component, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { SwipeRow } from '@/components/SwipeRow';
import { Avatar, Choice } from '@/components/ui';
import { t } from '@/i18n';
import { myId, member } from '@/stores/household';
import { itemEmoji, type ShoppingItem } from '@/stores/shopping';

/* ── One row ────────────────────────────────────────────────────────── */

export const ItemRow: Component<{
  item: ShoppingItem;
  fresh: boolean;
  flash: boolean;
  onToggle: (el: HTMLElement) => void;
  onEdit: () => void;
  onDelete: () => void;
}> = (props) => {
  let box!: HTMLLabelElement;
  return (
    <SwipeRow
      start={{
        icon: props.item.checked ? 'undo' : 'check',
        label: props.item.checked ? t('shopping.untick') : t('shopping.tick'),
        color: 'var(--color-basil)',
        run: () => props.onToggle(box),
      }}
      end={{ icon: 'trash', label: t('common.delete'), color: 'var(--color-coral)', run: props.onDelete }}
    >
      {/* The whole row is the tick target (easy one-handed in the shop); editing has its own button. */}
      <div
        class={`flex items-center gap-1 bg-card pr-2 transition-colors ${props.fresh ? 'animate-rise' : ''} ${props.flash ? 'bg-saffron/15' : ''}`}
      >
        <Choice
          ref={(el) => (box = el)}
          type="checkbox"
          quiet
          checked={props.item.checked}
          onChange={() => props.onToggle(box)}
          class="flex min-h-15 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-4 text-left"
        >
          <span
            aria-hidden="true"
            class={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${props.item.checked ? 'border-(--accent) bg-(--accent) text-(--accent-fg)' : 'border-line'
              }`}
          >
            <Show when={props.item.checked}>
              <Icon name="check" class="size-4.5 animate-pop" stroke={3} />
            </Show>
          </span>
          <span aria-hidden="true" class={`shrink-0 text-2xl leading-none transition-[opacity,filter] ${props.item.checked ? 'opacity-40 grayscale' : ''}`}>
            {itemEmoji(props.item.name, props.item.category)}
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span
                class={`truncate text-[1.05rem] font-semibold transition-colors ${props.item.checked ? 'text-ink-faint line-through decoration-2' : ''}`}
              >
                {props.item.name}
              </span>
              <Show when={props.item.qty}>
                <span class="tabular shrink-0 rounded-lg bg-(--accent)/12 px-1.5 py-0.5 text-xs font-bold text-(--accent-ink)">
                  {/^\d+([.,]\d+)?$/.test(props.item.qty) ? `×${props.item.qty}` : props.item.qty}
                </span>
              </Show>
            </span>
            <Show when={props.item.note}>
              <span class="block truncate text-sm text-ink-soft">{props.item.note}</span>
            </Show>
          </span>
          <Show when={props.item.addedBy !== myId()}>
            <Avatar id={props.item.addedBy} size="xs" />
            <span class="sr-only">{t('shopping.addedBy', { name: member(props.item.addedBy)?.name ?? '' })}</span>
          </Show>
        </Choice>
        <button type="button" class="icon-btn text-ink-faint" aria-label={t('shopping.editNamed', { name: props.item.name })} onClick={props.onEdit}>
          <Icon name="dots" class="size-5" />
        </button>
      </div>
    </SwipeRow>
  );
};
