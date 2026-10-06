import { type Component, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { SwipeRow } from '@/components/SwipeRow';
import { Avatar } from '@/components/ui';
import { formatDay, t } from '@/i18n';
import { diffDays, today } from '@/lib/dates';
import { assigneeOf, type Chore } from '@/stores/chores';
import { ME } from '@/stores/household';

import { whoseTurn } from './helpers';

/* ── Card ───────────────────────────────────────────────────────────── */

export const ChoreCard: Component<{ chore: Chore; onOpen: () => void; onDone: (el: HTMLElement) => void; onSkip: () => void }> = (props) => {
  let check!: HTMLButtonElement;
  const days = () => diffDays(today(), props.chore.nextDue);
  const who = () => assigneeOf(props.chore);
  const mine = () => who() === ME;
  const due = () => days() <= 0;

  return (
    <SwipeRow
      class="rounded-3xl"
      // Only chores that are due can be ticked from the list; finishing early goes through the detail sheet.
      start={due() ? { icon: 'check', label: t('chores.done'), color: 'var(--color-basil)', run: () => props.onDone(check) } : undefined}
      end={{ icon: 'skip', label: t('chores.skip'), color: 'var(--color-ink-faint)', run: props.onSkip }}
    >
      <div class={`card flex items-center gap-3 p-3 pr-3.5 ${mine() && days() <= 0 ? 'ring-2 ring-(--accent)/40' : ''}`}>
        <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={props.onOpen}>
          <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-(--accent)/10 text-2xl">{props.chore.emoji}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{props.chore.title}</span>
            <span class="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
              <Avatar id={who()} size="xs" />
              <span class="truncate">{whoseTurn(who())}</span>
              <Show when={props.chore.assigneeMode === 'rotate'}>
                <Icon name="rotate" class="size-3.5 shrink-0 text-ink-faint" />
              </Show>
            </span>
            <span class={`mt-0.5 block text-xs font-semibold ${days() < 0 ? 'text-coral' : days() === 0 ? 'text-(--accent-ink)' : 'text-ink-faint'}`}>
              {days() < 0 ? t('chores.overdue', -days()) : formatDay(props.chore.nextDue, today())}
            </span>
          </span>
        </button>
        <Show
          when={due()}
          fallback={
            <button type="button" class="icon-btn text-ink-faint" aria-label={t('chores.openNamed', { name: props.chore.title })} onClick={props.onOpen}>
              <Icon name="chevron" class="size-5" />
            </button>
          }
        >
          <button
            ref={check}
            type="button"
            aria-label={t('chores.markDone', { name: props.chore.title })}
            class="group flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-(--accent)/40 text-(--accent-ink) transition-all hover:bg-(--accent)/10 active:scale-90 active:bg-(--accent) active:text-(--accent-fg)"
            onClick={() => props.onDone(check)}
          >
            <Icon name="check" class="size-6 transition-transform group-active:scale-125" stroke={2.5} />
          </button>
        </Show>
      </div>
    </SwipeRow>
  );
};
