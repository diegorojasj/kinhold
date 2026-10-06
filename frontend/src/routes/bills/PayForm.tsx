import { type Component, createSignal } from 'solid-js';
import { Icon } from '@/components/Icon';
import { AmountInput, MemberPicker, Toggle, undoToast } from '@/components/ui';
import { formatShortDate, t } from '@/i18n';
import { celebrate } from '@/lib/feedback';
import { type Bill, markPaid } from '@/stores/bills';
import { currency, ME, members } from '@/stores/household';
import { money } from './helpers';



/* ── Pay sheet (E3) ─────────────────────────────────────────────────── */

export const PayForm: Component<{ bill: Bill; onDone: () => void }> = (props) => {
  let btn!: HTMLButtonElement;
  const [amount, setAmount] = createSignal(props.bill.amountCents);
  const [paidBy, setPaidBy] = createSignal(ME);
  const [asExpense, setAsExpense] = createSignal(true);
  const perPerson = () => Math.round(amount() / Math.max(1, members().length));

  return (
    <form
      class="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (amount() <= 0) return;
        const undo = markPaid(props.bill.id, { createExpense: asExpense(), paidBy: paidBy(), amountCents: amount() });
        celebrate(btn, true);
        undoToast(t('bills.paidToast', { name: props.bill.name }), undo, '✅');
        props.onDone();
      }}
    >
      <div class="flex items-center gap-4">
        <span class="flex size-14 items-center justify-center rounded-2xl bg-(--accent)/12 text-3xl">{props.bill.emoji}</span>
        <div>
          <p class="font-display text-xl font-bold">{props.bill.name}</p>
          <p class="text-sm text-ink-soft">{t('bills.dueOn', { date: formatShortDate(props.bill.nextDue) })}</p>
        </div>
      </div>
      <AmountInput label={t('bills.amountPaid')} cents={amount()} currency={currency()} onChange={setAmount} />
      <div>
        <span class="label">{t('money.paidBy')}</span>
        <MemberPicker label={t('money.paidBy')} ids={members().map((m) => m.id)} selected={[paidBy()]} onChange={([id]) => setPaidBy(id)} />
      </div>
      <div class="rounded-2xl bg-card px-4 py-1">
        <Toggle
          label={t('bills.addAsExpense')}
          hint={members().length > 1 ? t('bills.addAsExpenseHint', { amount: money(perPerson()) }) : undefined}
          checked={asExpense()}
          onChange={setAsExpense}
        />
      </div>
      <button ref={btn} type="submit" class="btn-accent py-4 text-lg" disabled={amount() <= 0}>
        <Icon name="check" class="size-6" stroke={2.5} />
        {t('bills.markPaid')}
      </button>
    </form>
  );
};
