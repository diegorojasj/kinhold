import { type Component, Show } from 'solid-js';
import { SwipeRow } from '@/components/SwipeRow';
import { formatDay, formatMoneyShort, t } from '@/i18n';
import { today } from '@/lib/dates';
import { type Bill, daysLeft, type Urgency, urgency } from '@/stores/bills';
import { currency } from '@/stores/household';

export const TONE: Record<Urgency, { bg: string; fg: string }> = {
  overdue: { bg: 'bg-coral', fg: 'text-on-accent' },
  today: { bg: 'bg-coral/15', fg: 'text-coral' },
  soon: { bg: 'bg-saffron/15', fg: 'text-saffron-ink' },
  later: { bg: 'bg-sunk', fg: 'text-ink-soft' },
};

/** Big countdown tile: the number of days is the first thing you read. */
export const DaysBadge: Component<{ bill: Bill }> = (props) => {
  const d = () => daysLeft(props.bill);
  const tone = () => TONE[urgency(props.bill)];
  return (
    <span class={`flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl leading-none ${tone().bg} ${tone().fg}`}>
      <Show when={d() !== 0} fallback={<span class="text-[0.7rem] font-extrabold uppercase">{t('bills.todayShort')}</span>}>
        <span class="tabular font-display text-xl font-extrabold">{Math.abs(d())}</span>
        <span class="mt-0.5 text-[0.6rem] font-bold uppercase">{d() < 0 ? t('bills.late') : t('bills.daysShort', Math.abs(d()))}</span>
      </Show>
    </span>
  );
};

/* ── Row ────────────────────────────────────────────────────────────── */

export const BillRow: Component<{ bill: Bill; onOpen: () => void; onPay: () => void; onQuickPay: () => void }> = (props) => {
  const u = () => urgency(props.bill);
  return (
    <SwipeRow class="rounded-3xl" start={{ icon: 'check', label: t('bills.markPaid'), color: 'var(--color-basil)', run: props.onQuickPay }}>
      <div class={`card flex items-center gap-3 p-3 ${u() === 'overdue' ? 'ring-2 ring-coral/50' : ''}`}>
        <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={props.onOpen}>
          <DaysBadge bill={props.bill} />
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1.5">
              <span class="text-lg">{props.bill.emoji}</span>
              <span class="truncate font-semibold">{props.bill.name}</span>
            </span>
            <span class="block truncate text-sm text-ink-soft">
              {u() === 'overdue' ? t('bills.overdueSince', { date: formatDay(props.bill.nextDue, today()) }) : t('bills.dueIn', daysLeft(props.bill))}
            </span>
          </span>
          <span class="tabular shrink-0 font-display text-lg font-bold">{formatMoneyShort(props.bill.amountCents, currency())}</span>
        </button>
        <Show when={u() !== 'later'}>
          <button
            type="button"
            class="shrink-0 rounded-2xl bg-(--accent) px-3.5 py-2.5 text-sm font-bold text-(--accent-fg) transition-transform active:scale-95"
            aria-label={t('bills.markPaidNamed', { name: props.bill.name })}
            onClick={props.onPay}
          >
            {t('bills.pay')}
          </button>
        </Show>
      </div>
    </SwipeRow>
  );
};
