import { type Component, createMemo, For, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { createSheet, Sheet } from '@/components/Sheet';
import { Avatar, EmptyState, Fab, SectionTitle, undoToast } from '@/components/ui';
import { formatDay, formatMoneyShort, t } from '@/i18n';
import { today } from '@/lib/dates';
import { describeRule } from '@/lib/describe';
import { celebrate } from '@/lib/feedback';
import { type Bill, bills, dueThisMonth, markPaid, monthlyTotal, payments, removeBill, urgency } from '@/stores/bills';
import { currency, displayName, members } from '@/stores/household';
import { BillEditor } from './BillEditor';
import { BillRow } from './BillRow';
import { money } from './helpers';
import { PayForm } from './PayForm';

/* ── Screen ─────────────────────────────────────────────────────────── */

const Bills: Component = () => {
  const sheet = createSheet<{ mode: 'new' } | { mode: 'edit' | 'pay'; id: string }>();
  const current = () => {
    const v = sheet.value();
    return v && v.mode !== 'new' ? bills().find((b) => b.id === v.id) : undefined;
  };

  const attention = createMemo(() => bills().filter((b) => urgency(b) !== 'later'));
  const later = createMemo(() => bills().filter((b) => urgency(b) === 'later'));
  const overdue = () => attention().filter((b) => urgency(b) === 'overdue').length;
  const recent = () => payments().slice(0, 5);

  const quickPay = (b: Bill) => {
    const undo = markPaid(b.id, { createExpense: true });
    celebrate(undefined);
    undoToast(t('bills.paidToast', { name: b.name }), undo, '✅');
  };

  const remove = (b: Bill) => {
    sheet.close();
    setTimeout(() => {
      const undo = removeBill(b.id);
      undoToast(t('bills.deleted', { name: b.name }), undo, '🗑️');
    }, 200);
  };

  const title = () => {
    const v = sheet.value();
    if (!v || v.mode === 'new') return t('bills.new');
    return v.mode === 'pay' ? t('bills.markPaid') : t('bills.edit');
  };

  return (
    <>
      <PageHeader
        title={t('bills.title')}
        subtitle={
          dueThisMonth() > 0
            ? t('bills.leftThisMonth', { amount: formatMoneyShort(dueThisMonth(), currency()) })
            : t('bills.nothingThisMonth')
        }
      />

      <Show
        when={bills().length}
        fallback={
          <EmptyState emoji="🧾" title={t('bills.emptyTitle')} text={t('bills.empty')}>
            <button type="button" class="btn-accent" onClick={() => sheet.show({ mode: 'new' })}>
              <Icon name="plus" class="size-5" stroke={2.25} />
              {t('bills.new')}
            </button>
          </EmptyState>
        }
      >
        {/* Fixed costs at a glance */}
        <div class="card grid animate-rise grid-cols-2 divide-x divide-line overflow-hidden">
          <div class="p-5">
            <p class="eyebrow">{t('bills.perMonth')}</p>
            <p class="tabular mt-1 font-display text-2xl font-extrabold tracking-tight">{formatMoneyShort(monthlyTotal(), currency())}</p>
            <p class="text-sm text-ink-soft">{t('bills.billCount', bills().length)}</p>
          </div>
          <div class="p-5">
            <p class="eyebrow">{t('bills.perPerson')}</p>
            <p class="tabular mt-1 font-display text-2xl font-extrabold tracking-tight">
              {formatMoneyShort(Math.round(monthlyTotal() / Math.max(1, members().length)), currency())}
            </p>
            <p class="text-sm text-ink-soft">{t('bills.splitBetween', members().length)}</p>
          </div>
        </div>

        <Show when={attention().length}>
          <SectionTitle count={attention().length} tone={overdue() ? 'alert' : undefined}>
            {overdue() ? t('bills.needsAttention') : t('bills.comingUp')}
          </SectionTitle>
          <ul class="flex flex-col gap-2.5">
            <For each={attention()}>
              {(b) => (
                <li class="animate-rise">
                  <BillRow
                    bill={b}
                    onOpen={() => sheet.show({ mode: 'edit', id: b.id })}
                    onPay={() => sheet.show({ mode: 'pay', id: b.id })}
                    onQuickPay={() => quickPay(b)}
                  />
                </li>
              )}
            </For>
          </ul>
        </Show>

        <Show when={!attention().length}>
          <div class="card mt-6 flex items-center gap-4 p-5">
            <span class="text-4xl">😌</span>
            <div>
              <p class="font-display text-lg font-bold">{t('bills.allGood')}</p>
              <p class="text-sm text-ink-soft">{t('bills.allGoodText')}</p>
            </div>
          </div>
        </Show>

        <Show when={later().length}>
          <SectionTitle count={later().length}>{t('bills.later')}</SectionTitle>
          <ul class="flex flex-col gap-2.5">
            <For each={later()}>
              {(b) => (
                <li>
                  <BillRow
                    bill={b}
                    onOpen={() => sheet.show({ mode: 'edit', id: b.id })}
                    onPay={() => sheet.show({ mode: 'pay', id: b.id })}
                    onQuickPay={() => quickPay(b)}
                  />
                </li>
              )}
            </For>
          </ul>
        </Show>

        <Show when={recent().length}>
          <SectionTitle>{t('bills.recentlyPaid')}</SectionTitle>
          <ul class="card divide-y divide-line">
            <For each={recent()}>
              {(p) => (
                <li class="flex items-center gap-3 px-4 py-3">
                  <span class="flex size-9 items-center justify-center rounded-xl bg-basil/15 text-lg">{p.emoji}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-semibold">{p.name}</span>
                    <span class="flex items-center gap-1.5 text-sm text-ink-soft">
                      <Avatar id={p.paidBy} size="xs" />
                      {t('bills.paidBy', { name: displayName(p.paidBy, t('common.you')), date: formatDay(p.paidAt, today()) })}
                    </span>
                  </span>
                  <span class="tabular font-semibold text-ink-soft">{money(p.amountCents)}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>

        <p class="mt-6 text-center text-sm text-ink-faint">{t('bills.swipeHint')}</p>
      </Show>

      <Fab label={t('bills.new')} onClick={() => sheet.show({ mode: 'new' })} />

      <Sheet open={sheet.open()} onClose={sheet.close} title={title()}>
        <Show when={sheet.value()} keyed>
          {(v) =>
            v.mode === 'new' ? (
              <BillEditor onDone={sheet.close} />
            ) : (
              <Show when={current()} keyed>
                {(b) =>
                  v.mode === 'pay' ? (
                    <PayForm bill={b} onDone={sheet.close} />
                  ) : (
                    <>
                      <Show when={urgency(b) !== 'later'}>
                        <button
                          type="button"
                          class="btn-soft mb-5 w-full"
                          onClick={() => sheet.show({ mode: 'pay', id: b.id })}
                        >
                          <Icon name="check" class="size-5" stroke={2.5} />
                          {t('bills.markPaid')}
                        </button>
                      </Show>
                      <p class="mb-4 text-sm text-ink-soft">{describeRule(b.rrule, b.dtstart)}</p>
                      <BillEditor bill={b} onDone={sheet.close} onDelete={() => remove(b)} />
                    </>
                  )
                }
              </Show>
            )
          }
        </Show>
      </Sheet>
    </>
  );
};

export default Bills;
