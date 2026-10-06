import { type Component, createSignal, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { RepeatPicker } from '@/components/RepeatPicker';
import { AmountInput, EmojiPicker, Field, Stepper } from '@/components/ui';
import { t } from '@/i18n';
import { today } from '@/lib/dates';
import { haptic } from '@/lib/feedback';
import { alignRule } from '@/lib/repeat';
import { BILL_EMOJI, type Bill, type BillInput, createBill, updateBill } from '@/stores/bills';
import { currency } from '@/stores/household';
import type { ExpenseCategory } from '@/stores/money';
import { toast } from '@/stores/toast';
import { ExpenseCategoryPicker } from '@/components/ExpenseCategoryPicker';

/* ── Editor (E1, E2) ────────────────────────────────────────────────── */

export const BillEditor: Component<{ bill?: Bill; onDone: () => void; onDelete?: () => void }> = (props) => {
  const b = props.bill;
  const [name, setName] = createSignal(b?.name ?? '');
  const [emoji, setEmoji] = createSignal(b?.emoji ?? BILL_EMOJI[0]);
  const [amount, setAmount] = createSignal(b?.amountCents ?? 0);
  const [dtstart, setDtstart] = createSignal(b?.nextDue ?? today());
  const [rrule, setRrule] = createSignal(b?.rrule ?? `FREQ=MONTHLY;BYMONTHDAY=${Number(today().slice(8, 10))}`);
  const [remind, setRemind] = createSignal(b?.remindDaysBefore ?? 3);
  const [category, setCategory] = createSignal<ExpenseCategory>(b?.category ?? 'utilities');
  const [shake, setShake] = createSignal(false);

  const save = (e: Event) => {
    e.preventDefault();
    if (!name().trim() || amount() <= 0) {
      setShake(true);
      haptic('warn');
      setTimeout(() => setShake(false), 400);
      return;
    }
    const input: BillInput = {
      name: name().trim(),
      emoji: emoji(),
      amountCents: amount(),
      rrule: rrule(),
      dtstart: dtstart(),
      remindDaysBefore: remind(),
      category: category(),
    };
    if (b) {
      // Keep the original anchor when neither the date nor the rule changed.
      const unchanged = b.rrule === input.rrule && b.nextDue === input.dtstart;
      updateBill(b.id, unchanged ? { ...input, dtstart: b.dtstart } : input);
      toast({ emoji: '✅', message: t('common.saved') });
    } else {
      createBill(input);
      toast({ emoji: input.emoji, message: t('bills.created', { name: input.name }) });
    }
    haptic('success');
    props.onDone();
  };

  return (
    <form class="flex flex-col gap-5" onSubmit={save}>
      <EmojiPicker label={t('common.icon')} value={emoji()} options={BILL_EMOJI} onChange={setEmoji} />
      <div class={shake() && !name().trim() ? 'animate-shake' : ''}>
        <Field
          label={t('bills.name')}
          placeholder={t('bills.namePlaceholder')}
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          autofocus={!b}
        />
      </div>
      <AmountInput label={t('money.amount')} cents={amount()} currency={currency()} onChange={setAmount} invalid={shake() && amount() <= 0} />
      <Field
        label={b ? t('bills.nextDue') : t('bills.firstDue')}
        type="date"
        value={dtstart()}
        onInput={(e) => {
          const v = e.currentTarget.value;
          if (!v) return;
          setDtstart(v);
          setRrule(alignRule(rrule(), v));
        }}
      />
      <div>
        <span class="label">{t('repeat.label')}</span>
        <RepeatPicker value={rrule()} dtstart={dtstart()} onChange={setRrule} freqs={['WEEKLY', 'MONTHLY', 'YEARLY']} />
      </div>
      <div>
        <span class="label">{t('bills.remind')}</span>
        <Stepper
          label={t('bills.remind')}
          value={remind()}
          min={0}
          max={14}
          onChange={setRemind}
          format={(n) => (n === 0 ? t('bills.remindSameDay') : t('bills.remindDays', n))}
        />
      </div>
      <ExpenseCategoryPicker value={category()} onChange={setCategory} />
      <div class="flex gap-3 pt-1">
        <Show when={props.onDelete}>
          <button type="button" class="btn-danger" onClick={() => props.onDelete?.()} aria-label={t('common.delete')}>
            <Icon name="trash" class="size-5" />
          </button>
        </Show>
        <button type="submit" class="btn-accent flex-1">
          {b ? t('common.save') : t('bills.create')}
        </button>
      </div>
    </form>
  );
};
