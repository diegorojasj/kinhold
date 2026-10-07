import { type Component, createMemo, For, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { createSheet, Sheet } from '@/components/Sheet';
import { Avatar, EmptyState, Fab, ProgressRing, SectionTitle, undoToast } from '@/components/ui';
import { formatTime, t } from '@/i18n';
import { today } from '@/lib/dates';
import { celebrate, haptic } from '@/lib/feedback';
import { type Bucket, bucketOf, type Chore, choreEvents, chores, completeChore, householdStreak, removeChore, skipChore, weekScores } from '@/stores/chores';
import { member, members } from '@/stores/household';

import { ChoreCard } from './ChoreCard';
import { ChoreDetail } from './ChoreDetail';
import { ChoreEditor } from './ChoreEditor';

/* ── Screen ─────────────────────────────────────────────────────────── */

const SECTIONS: { id: Bucket; label: () => string }[] = [
  { id: 'today', label: () => t('chores.today') },
  { id: 'week', label: () => t('chores.thisWeek') },
  { id: 'later', label: () => t('chores.later') },
];

const Chores: Component = () => {
  const sheet = createSheet<{ mode: 'new' } | { mode: 'detail' | 'edit'; id: string }>();
  const current = () => {
    const v = sheet.value();
    return v && v.mode !== 'new' ? chores().find((c) => c.id === v.id) : undefined;
  };

  const sorted = createMemo(() =>
    [...chores()].sort((a, b) => a.nextDue.localeCompare(b.nextDue) || a.title.localeCompare(b.title)),
  );
  const byBucket = (b: Bucket) => sorted().filter((c) => bucketOf(c) === b);
  const doneToday = createMemo(() => choreEvents().filter((e) => e.day === today() && e.action === 'done'));
  const dueToday = () => byBucket('today').length;
  const progress = () => {
    const done = doneToday().length;
    return done + dueToday() ? done / (done + dueToday()) : 0;
  };
  const streak = () => householdStreak();
  const scores = () => weekScores(members().map((m) => m.id));
  const best = () => Math.max(1, ...scores().map((s) => s.count));
  // Framed as a shared effort: the household total comes first, individual bars second.
  const weekTotal = () => scores().reduce((sum, s) => sum + s.count, 0);

  const done = (c: Chore, el: HTMLElement) => {
    const lastOne = dueToday() === 1 && bucketOf(c) === 'today';
    const undo = completeChore(c.id);
    celebrate(el, lastOne);
    const cheer = t('chores.cheer', Math.floor(Math.random() * 1000));
    undoToast(lastOne ? t('chores.allClear') : cheer, undo, lastOne ? '🏆' : c.emoji);
    sheet.close();
  };

  const skip = (c: Chore) => {
    const undo = skipChore(c.id);
    haptic();
    undoToast(t('chores.skipped', { name: c.title }), undo, '⏭️');
    sheet.close();
  };

  const remove = (c: Chore) => {
    sheet.close();
    setTimeout(() => {
      const undo = removeChore(c.id);
      undoToast(t('chores.deleted', { name: c.title }), undo, '🗑️');
    }, 200);
  };

  const title = () => {
    const v = sheet.value();
    if (!v || v.mode === 'new') return t('chores.new');
    return v.mode === 'edit' ? t('chores.edit') : (current()?.title ?? '');
  };

  return (
    <>
      <PageHeader
        title={t('chores.title')}
        subtitle={dueToday() ? t('chores.dueCount', dueToday()) : t('chores.allCaughtUp')}
      >
        <Show when={streak() > 0}>
          <div class="flex animate-pop flex-col items-center rounded-2xl bg-saffron/15 px-3 py-2 text-saffron-ink" title={t('chores.streakHint')}>
            <span class="flex items-center gap-1 font-display text-xl leading-none font-extrabold">
              <Icon name="flame" class="size-5" stroke={2} />
              <span class="tabular">{streak()}</span>
            </span>
            <span class="mt-0.5 text-[0.65rem] font-bold tracking-wide uppercase">{t('chores.streak', streak())}</span>
          </div>
        </Show>
      </PageHeader>

      <Show
        when={chores().length}
        fallback={
          <EmptyState emoji="🧹" title={t('chores.emptyTitle')} text={t('chores.empty')}>
            <button type="button" class="btn-accent" onClick={() => sheet.show({ mode: 'new' })}>
              <Icon name="plus" class="size-5" stroke={2.25} />
              {t('chores.new')}
            </button>
          </EmptyState>
        }
      >
        {/* Today at a glance + who's carrying the house this week */}
        <div class="card grid animate-rise grid-cols-[auto_1fr] items-center gap-5 p-5">
          <ProgressRing value={progress()} size={84} stroke={9} label={t('chores.todayProgress')}>
            <span class="flex flex-col items-center leading-none">
              <span class="tabular font-display text-xl font-extrabold">
                {doneToday().length}
                <span class="text-ink-faint">/{doneToday().length + dueToday()}</span>
              </span>
              <span class="mt-1 text-[0.6rem] font-bold tracking-wide text-ink-faint uppercase">{t('chores.today')}</span>
            </span>
          </ProgressRing>
          <div class="min-w-0">
            <p class="eyebrow mb-2 flex justify-between gap-2">
              <span>{t('chores.thisWeekBoard')}</span>
              <span class="tracking-normal normal-case">{t('chores.together', weekTotal())}</span>
            </p>
            <ul class="flex flex-col gap-1.5">
              <For each={scores()}>
                {(s) => (
                  <li class="flex items-center gap-2">
                    <Avatar id={s.id} size="xs" />
                    <span class="h-2.5 flex-1 overflow-hidden rounded-full bg-sunk">
                      <span
                        class="block h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${(s.count / best()) * 100}%`, background: member(s.id)?.color }}
                      />
                    </span>
                    <span class="sr-only">{member(s.id)?.name}</span>
                    <span class="tabular w-6 text-right text-sm font-bold">{s.count}</span>
                  </li>
                )}
              </For>
            </ul>
          </div>
          <Show when={doneToday().length || dueToday()}>
            <p class={`col-span-2 -mt-1 text-sm font-semibold ${dueToday() ? 'text-ink-soft' : 'text-basil'}`}>
              {dueToday() ? (doneToday().length ? t('chores.toGo', dueToday()) : t('chores.letsGo', dueToday())) : t('chores.allDoneToday')}
            </p>
          </Show>
        </div>

        <For each={SECTIONS}>
          {(section) => (
            <Show when={byBucket(section.id).length}>
              <section>
                <SectionTitle count={byBucket(section.id).length}>{section.label()}</SectionTitle>
                <Show when={section.id === 'today'}>
                  <p class="-mt-1 mb-2.5 flex items-center gap-1.5 px-1 text-sm text-ink-faint">
                    <Icon name="check" class="size-4 text-basil" stroke={2.75} />
                    {t('chores.tapHint')}
                  </p>
                </Show>
                <ul class="flex flex-col gap-2.5">
                  <For each={byBucket(section.id)}>
                    {(c) => (
                      <li class="animate-rise">
                        <ChoreCard
                          chore={c}
                          onOpen={() => sheet.show({ mode: 'detail', id: c.id })}
                          onDone={(el) => done(c, el)}
                          onSkip={() => skip(c)}
                        />
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            </Show>
          )}
        </For>

        <Show when={!dueToday()}>
          <div class="card mt-6 flex items-center gap-4 p-5">
            <span class="text-4xl">🌿</span>
            <div>
              <p class="font-display text-lg font-bold">{t('chores.nothingToday')}</p>
              <p class="text-sm text-ink-soft">{t('chores.nothingTodayText')}</p>
            </div>
          </div>
        </Show>

        <Show when={doneToday().length}>
          <section>
            <SectionTitle count={doneToday().length}>{t('chores.doneToday')}</SectionTitle>
            <ul class="card divide-y divide-line">
              <For each={doneToday()}>
                {(e) => {
                  const c = () => chores().find((x) => x.id === e.choreId);
                  return (
                    <li class="flex items-center gap-3 px-4 py-3">
                      <span class="flex size-7 items-center justify-center rounded-full bg-basil text-on-accent">
                        <Icon name="check" class="size-4" stroke={3} />
                      </span>
                      <span class="flex-1 truncate text-ink-soft line-through decoration-ink-faint">{c()?.title ?? '—'}</span>
                      <span class="text-sm text-ink-faint">{formatTime(new Date(e.at))}</span>
                      <Avatar id={e.userId} size="xs" />
                    </li>
                  );
                }}
              </For>
            </ul>
          </section>
        </Show>

        <p class="mt-6 text-center text-sm text-ink-faint">{t('chores.swipeHint')}</p>
      </Show>

      <Fab label={t('chores.new')} onClick={() => sheet.show({ mode: 'new' })} />

      <Sheet open={sheet.open()} onClose={sheet.close} title={title()}>
        <Show when={sheet.value()} keyed>
          {(v) => (
            <Show
              when={v.mode !== 'new' && current()}
              keyed
              fallback={
                <Show when={v.mode === 'new'}>
                  <ChoreEditor onDone={sheet.close} />
                </Show>
              }
            >
              {(c) =>
                v.mode === 'edit' ? (
                  <ChoreEditor chore={c} onDone={sheet.close} onDelete={() => remove(c)} />
                ) : (
                  <ChoreDetail
                    chore={c}
                    onDone={(el) => done(c, el)}
                    onSkip={() => skip(c)}
                    onEdit={() => sheet.show({ mode: 'edit', id: c.id })}
                  />
                )
              }
            </Show>
          )}
        </Show>
      </Sheet>
    </>
  );
};

export default Chores;
