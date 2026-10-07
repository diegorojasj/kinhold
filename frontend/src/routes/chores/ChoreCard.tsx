import { type Component, createSignal, Match, Show, Switch } from 'solid-js';
import { Icon } from '@/components/Icon';
import { SwipeRow } from '@/components/SwipeRow';
import { Avatar } from '@/components/ui';
import { formatDay, t } from '@/i18n';
import { diffDays, today } from '@/lib/dates';
import { haptic } from '@/lib/feedback';
import { assigneeOf, canResolve, type Chore, resolvedToday } from '@/stores/chores';
import { myId } from '@/stores/household';

import { whoseTurn } from './helpers';

/** How long the button shows its filled tick before the chore moves on. */
const TICK_MS = 260;

/* ── Card ───────────────────────────────────────────────────────────── */

export const ChoreCard: Component<{ chore: Chore; onOpen: () => void; onDone: (el: HTMLElement) => void; onSkip: () => void }> = (props) => {
  let check!: HTMLButtonElement;
  const [ticking, setTicking] = createSignal(false);
  const days = () => diffDays(today(), props.chore.nextDue);
  const who = () => assigneeOf(props.chore);
  const mine = () => who() === myId();
  const due = () => days() <= 0;
  // Already finished (or skipped) today and now waiting for its next date.
  const handled = () => (due() ? undefined : resolvedToday(props.chore));

  // One tap: the button fills at once, then the chore is recorded. Extra taps meanwhile are ignored.
  const tick = () => {
    if (ticking()) return;
    setTicking(true);
    haptic();
    setTimeout(() => {
      props.onDone(check);
      setTicking(false);
    }, TICK_MS);
  };

  return (
    <SwipeRow
      class="rounded-3xl"
      // Only chores that are due can be ticked from the list; finishing early goes through the detail sheet.
      start={due() ? { icon: 'check', label: t('chores.done'), color: 'var(--color-basil)', run: () => props.onDone(check) } : undefined}
      end={canResolve(props.chore) ? { icon: 'skip', label: t('chores.skip'), color: 'var(--color-ink-faint)', run: props.onSkip } : undefined}
    >
      <div
        class={`card flex items-center gap-3 p-3 pr-3.5 transition-all duration-200 ${mine() && due() ? 'ring-2 ring-(--accent)/40' : ''} ${ticking() ? 'scale-[0.98] opacity-80' : ''}`}
      >
        <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={props.onOpen}>
          <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-(--accent)/10 text-2xl">{props.chore.emoji}</span>
          <span class="min-w-0 flex-1">
            <span class={`block truncate font-semibold transition-colors ${ticking() ? 'text-ink-faint line-through' : ''}`}>{props.chore.title}</span>
            <span class="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
              <Avatar id={who()} size="xs" />
              <span class="truncate">{whoseTurn(who())}</span>
              <Show when={props.chore.assigneeMode === 'rotate'}>
                <Icon name="rotate" class="size-3.5 shrink-0 text-ink-faint" />
              </Show>
            </span>
            <span class={`mt-0.5 block text-xs font-semibold ${days() < 0 ? 'text-coral' : days() === 0 ? 'text-(--accent-ink)' : 'text-ink-faint'}`}>
              {days() < 0 ? t('chores.overdue', -days()) : handled() ? t('chores.nextOnDate', { date: formatDay(props.chore.nextDue, today()) }) : formatDay(props.chore.nextDue, today())}
            </span>
          </span>
        </button>
        <Switch
          fallback={
            <button type="button" class="icon-btn text-ink-faint" aria-label={t('chores.openNamed', { name: props.chore.title })} onClick={props.onOpen}>
              <Icon name="chevron" class="size-5" />
            </button>
          }
        >
          <Match when={due()}>
            <button
              ref={check}
              type="button"
              aria-label={t('chores.markDone', { name: props.chore.title })}
              class={`flex h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 font-bold transition-all duration-200 active:scale-95 ${
                ticking()
                  ? 'border-basil bg-basil text-on-accent'
                  : 'border-(--accent)/45 text-(--accent-ink) hover:bg-(--accent)/10'
              }`}
              onClick={tick}
            >
              <Icon name="check" class={`size-5 transition-transform duration-200 ${ticking() ? 'scale-125' : ''}`} stroke={2.75} />
              <span class="text-sm">{t('chores.markDoneShort')}</span>
            </button>
          </Match>
          <Match when={handled()}>
            {(e) => (
              <button
                type="button"
                class={`flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold ${e().action === 'done' ? 'bg-basil/15 text-basil' : 'bg-sunk text-ink-faint'}`}
                aria-label={t('chores.openNamed', { name: props.chore.title })}
                onClick={props.onOpen}
              >
                <Icon name={e().action === 'done' ? 'check' : 'skip'} class="size-4" stroke={2.75} />
                {e().action === 'done' ? t('chores.doneBadge') : t('chores.skippedBadge')}
              </button>
            )}
          </Match>
        </Switch>
      </div>
    </SwipeRow>
  );
};
