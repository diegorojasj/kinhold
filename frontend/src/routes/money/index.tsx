import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { createSheet, Sheet } from '@/components/Sheet';
import { SwipeRow } from '@/components/SwipeRow';
import { Avatar, EmptyState, Fab, SectionTitle, undoToast } from '@/components/ui';
import { formatDay, formatMoneyShort, formatMonth, t } from '@/i18n';
import { today } from '@/lib/dates';
import { haptic } from '@/lib/feedback';
import { currency, myId, members } from '@/stores/household';
import { canEdit, type Expense, expenseCategory, expenses, monthSpend, netBalances, removeExpense, removeSettlement, type Settlement, settlements, simplifyDebts, type Transfer } from '@/stores/money';

import { ExpenseEditor } from './ExpenseEditor';
import { canRemoveSettlement, money, myImpact, NEGATIVE, name, nameObj, POSITIVE } from './helpers';
import { SettleForm } from './SettleForm';

/* ── Screen ─────────────────────────────────────────────────────────── */

type Entry = { kind: 'expense'; date: string; item: Expense } | { kind: 'settlement'; date: string; item: Settlement };

const Money: Component = () => {
  const editor = createSheet<string>();
  const settle = createSheet<Transfer>();
  const [showAll, setShowAll] = createSignal(false);

  const net = createMemo(() => netBalances(members().map((m) => m.id)));
  const mine = () => net().get(myId()) ?? 0;
  const transfers = createMemo(() => simplifyDebts(net()));
  const spend = createMemo(() => monthSpend());

  const entries = createMemo<Entry[]>(() =>
    [
      ...expenses().map((item) => ({ kind: 'expense' as const, date: item.date, item, at: item.createdAt })),
      ...settlements().map((item) => ({ kind: 'settlement' as const, date: item.date, item, at: item.createdAt })),
    ].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at)),
  );
  const visible = () => (showAll() ? entries() : entries().slice(0, 15));
  const byDay = createMemo(() => {
    const groups: { date: string; entries: Entry[] }[] = [];
    for (const e of visible()) {
      const last = groups.at(-1);
      if (last?.date === e.date) last.entries.push(e);
      else groups.push({ date: e.date, entries: [e] });
    }
    return groups;
  });

  const editing = () => {
    const id = editor.value();
    return id && id !== 'new' ? expenses().find((e) => e.id === id) : undefined;
  };

  const editorTitle = () => {
    const e = editing();
    if (!e) return t('money.addExpense');
    return canEdit(e) ? t('money.editExpense') : t('money.expense');
  };

  const remove = (e: Expense) => {
    const undo = removeExpense(e.id);
    haptic();
    undoToast(t('money.deleted', { name: e.description }), undo, '🗑️');
  };

  const removeSettle = (s: Settlement) => {
    const undo = removeSettlement(s.id);
    haptic();
    undoToast(t('money.settlementDeleted'), undo, '🗑️');
  };

  return (
    <>
      <PageHeader
        title={t('money.title')}
        subtitle={t('money.spentThisMonth', { amount: formatMoneyShort(spend().total, currency()), month: formatMonth(today()) })}
      />

      {/* Balance hero */}
      {/* Always a dark card (in both themes) so the green/red amounts keep their contrast. */}
      <div class="relative animate-rise overflow-hidden rounded-[2rem] bg-[#1d1a16] p-6 text-[#f5f0e8] dark:bg-card dark:ring-1 dark:ring-line">
        <div aria-hidden="true" class="absolute -top-16 -right-10 size-48 rounded-full bg-(--accent) opacity-30 blur-3xl" />
        <div aria-hidden="true" class="absolute -bottom-20 -left-10 size-40 rounded-full bg-coral opacity-20 blur-3xl" />
        <div class="relative">
          <p class="text-sm font-semibold opacity-60">{t('money.yourBalance')}</p>
          <Show
            when={mine() !== 0}
            fallback={
              <p class="mt-1 font-display text-3xl font-extrabold tracking-tight">
                {t('money.allSettled')} <span class="inline-block animate-pop">✨</span>
              </p>
            }
          >
            <p class="mt-1 text-sm font-semibold" style={{ color: mine() > 0 ? POSITIVE : NEGATIVE }}>
              {mine() > 0 ? t('money.youAreOwedLabel') : t('money.youOweLabel')}
            </p>
            <p class="tabular font-display text-5xl font-extrabold tracking-tight">{money(Math.abs(mine()))}</p>
          </Show>

          <Show when={transfers().length}>
            <ul class="mt-5 flex flex-col gap-2">
              <For each={transfers()}>
                {(tr) => {
                  const involvesMe = () => tr.from === myId() || tr.to === myId();
                  return (
                    <li class={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${involvesMe() ? 'bg-white/12' : 'bg-white/5'}`}>
                      <span class="flex items-center -space-x-1.5">
                        <Avatar id={tr.from} size="sm" />
                        <Avatar id={tr.to} size="sm" />
                      </span>
                      <span class="min-w-0 flex-1 text-sm">
                        <span class="block truncate">{t('money.owes', { from: name(tr.from), to: name(tr.to) })}</span>
                        <span class="tabular font-bold">{money(tr.amountCents)}</span>
                      </span>
                      <button
                        type="button"
                        class={`rounded-xl px-3 py-2 text-sm font-bold transition-transform active:scale-95 ${involvesMe() ? 'bg-(--accent) text-[#1d1a16]' : 'bg-white/15'}`}
                        onClick={() => settle.show(tr)}
                      >
                        {t('money.settle')}
                      </button>
                    </li>
                  );
                }}
              </For>
            </ul>
          </Show>
        </div>
      </div>

      {/* Where the money went this month */}
      <Show when={spend().total > 0}>
        <div class="card mt-4 p-5">
          <div class="flex items-baseline justify-between">
            <p class="eyebrow">{t('money.byCategory')}</p>
            <p class="tabular font-display text-lg font-bold">{formatMoneyShort(spend().total, currency())}</p>
          </div>
          <div class="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full">
            <For each={spend().byCat}>
              {([cat, cents]) => (
                <span
                  class="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${(cents / spend().total) * 100}%`, background: expenseCategory(cat).color }}
                  title={t(`money.categories.${cat}`)}
                />
              )}
            </For>
          </div>
          <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            <For each={spend().byCat.slice(0, 5)}>
              {([cat, cents]) => (
                <li class="flex items-center gap-1.5 text-sm">
                  <span class="size-2.5 rounded-full" style={{ background: expenseCategory(cat).color }} />
                  <span class="text-ink-soft">{t(`money.categories.${cat}`)}</span>
                  <span class="tabular font-semibold">{Math.round((cents / spend().total) * 100)}%</span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>

      <Show
        when={entries().length}
        fallback={<EmptyState emoji="💸" title={t('money.emptyTitle')} text={t('money.empty')} />}
      >
        <For each={byDay()}>
          {(group) => (
            <section>
              <SectionTitle>{formatDay(group.date, today())}</SectionTitle>
              <ul class="card divide-y divide-line overflow-hidden">
                <For each={group.entries}>
                  {(entry) =>
                    entry.kind === 'expense' ? (
                      <li>
                        <SwipeRow
                          end={canEdit(entry.item) ? { icon: 'trash', label: t('common.delete'), color: 'var(--color-coral)', run: () => remove(entry.item) } : undefined}
                        >
                          <button type="button" class="flex w-full items-center gap-3 bg-card px-4 py-3 text-left" onClick={() => editor.show(entry.item.id)}>
                            <span
                              class="flex size-11 shrink-0 items-center justify-center rounded-2xl text-xl"
                              style={{ background: `color-mix(in oklab, ${expenseCategory(entry.item.category).color} 15%, transparent)` }}
                            >
                              {expenseCategory(entry.item.category).emoji}
                            </span>
                            <span class="min-w-0 flex-1">
                              <span class="block truncate font-semibold">{entry.item.description}</span>
                              <span class="block truncate text-sm text-ink-soft">
                                {t('money.paidLine', { name: name(entry.item.paidBy), amount: money(entry.item.amountCents) })}
                              </span>
                            </span>
                            <span class="shrink-0 text-right">
                              <Show when={myImpact(entry.item) !== 0} fallback={<span class="text-xs text-ink-faint">{t('money.notInvolved')}</span>}>
                                <span class={`block text-xs font-semibold ${myImpact(entry.item) > 0 ? 'text-basil' : 'text-coral'}`}>
                                  {myImpact(entry.item) > 0 ? t('money.youLent') : t('money.youBorrowed')}
                                </span>
                                <span class={`tabular block font-bold ${myImpact(entry.item) > 0 ? 'text-basil' : 'text-coral'}`}>
                                  {money(Math.abs(myImpact(entry.item)))}
                                </span>
                              </Show>
                            </span>
                          </button>
                        </SwipeRow>
                      </li>
                    ) : (
                      <li>
                        <SwipeRow
                          end={canRemoveSettlement(entry.item) ? { icon: 'trash', label: t('common.delete'), color: 'var(--color-coral)', run: () => removeSettle(entry.item) } : undefined}
                        >
                          <div class="flex items-center gap-3 bg-card py-3 pr-2 pl-4">
                            <span class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-basil/15 text-xl">🤝</span>
                            <span class="min-w-0 flex-1">
                              <span class="block truncate font-semibold">
                                {t('money.settledLine', { from: name(entry.item.from), to: nameObj(entry.item.to) })}
                              </span>
                              <span class="block text-sm text-ink-soft">{t('money.settlement')}</span>
                            </span>
                            <span class="tabular font-bold text-basil">{money(entry.item.amountCents)}</span>
                            <Show when={canRemoveSettlement(entry.item)}>
                              <button type="button" class="icon-btn text-ink-faint" aria-label={t('money.removeSettlement')} onClick={() => removeSettle(entry.item)}>
                                <Icon name="trash" class="size-5" />
                              </button>
                            </Show>
                          </div>
                        </SwipeRow>
                      </li>
                    )
                  }
                </For>
              </ul>
            </section>
          )}
        </For>
        <Show when={!showAll() && entries().length > 15}>
          <button type="button" class="btn-ghost mt-4 w-full" onClick={() => setShowAll(true)}>
            {t('money.showAll', entries().length)}
          </button>
        </Show>
      </Show>

      <Fab label={t('money.addExpense')} onClick={() => editor.show('new')} />

      <Sheet
        open={editor.open()}
        onClose={editor.close}
        title={editorTitle()}
      >
        <Show when={editor.value() === 'new' || editing() ? editor.value() : undefined} keyed>
          <ExpenseEditor
            expense={editing()}
            onDone={editor.close}
            onDelete={() => {
              const e = editing();
              editor.close();
              if (e) setTimeout(() => remove(e), 200);
            }}
          />
        </Show>
      </Sheet>

      <Sheet open={settle.open()} onClose={settle.close} title={t('money.settleUp')}>
        <Show when={settle.value()} keyed>
          {(tr) => <SettleForm transfer={tr} onDone={settle.close} />}
        </Show>
      </Sheet>
    </>
  );
};

export default Money;
