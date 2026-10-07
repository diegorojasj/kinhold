import { type Component, createMemo, For, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui';
import { formatDay, formatShortDate, t } from '@/i18n';
import { addDays, diffDays, today } from '@/lib/dates';
import { describeRule } from '@/lib/describe';
import { upcoming } from '@/lib/repeat';
import { assigneeOf, canResolve, type Chore, choreEvents, resolvedToday } from '@/stores/chores';
import { member } from '@/stores/household';

import { whoseTurn } from './helpers';

/* ── Detail (done / skip / history) ─────────────────────────────────── */

export const ChoreDetail: Component<{ chore: Chore; onDone: (el: HTMLElement) => void; onSkip: () => void; onEdit: () => void }> = (props) => {
  let doneBtn!: HTMLButtonElement;
  const history = () => choreEvents().filter((e) => e.choreId === props.chore.id).slice(0, 6);
  const next = createMemo(() => upcoming(props.chore.rrule, props.chore.dtstart, addDays(props.chore.nextDue, 1), 3));
  const days = () => diffDays(today(), props.chore.nextDue);
  const handled = () => resolvedToday(props.chore);

  return (
    <div class="flex flex-col gap-5">
      <div class="flex items-center gap-4">
        <span class="flex size-16 items-center justify-center rounded-3xl bg-(--accent)/12 text-4xl">{props.chore.emoji}</span>
        <div class="min-w-0">
          <p class="font-display text-2xl leading-tight font-bold">{props.chore.title}</p>
          <p class="text-ink-soft">{describeRule(props.chore.rrule, props.chore.dtstart)}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-2xl bg-card p-3.5">
          <p class="eyebrow">{t('chores.due')}</p>
          <p class={`mt-1 font-semibold ${days() < 0 ? 'text-coral' : ''}`}>
            {days() < 0 ? t('chores.overdue', -days()) : formatDay(props.chore.nextDue, today())}
          </p>
        </div>
        <div class="rounded-2xl bg-card p-3.5">
          <p class="eyebrow">{t('chores.turn')}</p>
          <p class="mt-1 flex items-center gap-2 font-semibold">
            <Avatar id={assigneeOf(props.chore)} size="xs" />
            <span class="truncate">{whoseTurn(assigneeOf(props.chore))}</span>
          </p>
        </div>
      </div>

      <Show
        when={canResolve(props.chore)}
        fallback={
          <div class="flex items-center gap-3 rounded-2xl bg-basil/12 p-4">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-basil text-on-accent">
              <Icon name={handled()?.action === 'skip' ? 'skip' : 'check'} class="size-5" stroke={3} />
            </span>
            <div class="min-w-0">
              <p class="font-semibold">{handled()?.action === 'skip' ? t('chores.skippedForNow') : t('chores.doneForNow')}</p>
              <p class="text-sm text-ink-soft">{t('chores.nextOnDate', { date: formatDay(props.chore.nextDue, today()) })}</p>
            </div>
          </div>
        }
      >
        <div class="flex flex-col gap-2">
          <div class="flex gap-3">
            <button ref={doneBtn} type="button" class="btn-accent flex-1 py-4 text-lg" onClick={() => props.onDone(doneBtn)}>
              <Icon name="check" class="size-6" stroke={2.5} />
              {days() > 0 ? t('chores.doneEarly') : t('chores.markDoneShort')}
            </button>
            <button type="button" class="btn-ghost" onClick={props.onSkip}>
              <Icon name="skip" class="size-5" />
              {t('chores.skip')}
            </button>
          </div>
          <Show when={days() > 0}>
            <p class="text-center text-sm text-ink-faint">{t('chores.doneEarlyHint', { date: formatShortDate(next()[0]) })}</p>
          </Show>
        </div>
      </Show>

      <div>
        <p class="label">{t('chores.thenOn')}</p>
        <div class="flex flex-wrap gap-2">
          <For each={next()}>{(d) => <span class="chip">{formatShortDate(d)}</span>}</For>
        </div>
      </div>

      <Show when={history().length}>
        <div>
          <p class="label">{t('chores.history')}</p>
          <ul class="flex flex-col gap-2">
            <For each={history()}>
              {(e) => (
                <li class="flex items-center gap-3 text-sm">
                  <Avatar id={e.userId} size="sm" />
                  <span class="flex-1">
                    {e.action === 'done' ? t('chores.historyDone', { name: member(e.userId)?.name ?? '—' }) : t('chores.historySkipped', { name: member(e.userId)?.name ?? '—' })}
                  </span>
                  <span class="text-ink-faint">{formatDay(e.day, today())}</span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>

      <button type="button" class="btn-ghost" onClick={props.onEdit}>
        <Icon name="pencil" class="size-5" />
        {t('chores.edit')}
      </button>
    </div>
  );
};
