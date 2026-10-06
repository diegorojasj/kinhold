import { type Component, createSignal } from 'solid-js';
import { Icon } from '@/components/Icon';
import { AmountInput, Avatar, MemberPicker, undoToast } from '@/components/ui';
import { t } from '@/i18n';
import { celebrate } from '@/lib/feedback';
import { currency, members } from '@/stores/household';
import { settleUp, type Transfer } from '@/stores/money';

import { money, name, nameObj } from './helpers';

/* ── Settle up (D4) ─────────────────────────────────────────────────── */

export const SettleForm: Component<{ transfer: Transfer; onDone: () => void }> = (props) => {
  let btn!: HTMLButtonElement;
  const [from, setFrom] = createSignal(props.transfer.from);
  const [to, setTo] = createSignal(props.transfer.to);
  const [amount, setAmount] = createSignal(props.transfer.amountCents);
  const ids = () => members().map((m) => m.id);
  const valid = () => amount() > 0 && from() !== to();

  return (
    <form
      class="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid()) return;
        const undo = settleUp({ from: from(), to: to(), amountCents: amount() });
        celebrate(btn, true);
        undoToast(t('money.settledToast', { from: name(from()), to: nameObj(to()), amount: money(amount()) }), undo, '🤝');
        props.onDone();
      }}
    >
      <div class="flex items-center justify-center gap-4 py-2">
        <div class="flex flex-col items-center gap-1.5">
          <Avatar id={from()} size="lg" />
          <span class="text-sm font-semibold">{name(from())}</span>
        </div>
        <Icon name="arrow" class="size-7 text-(--accent-ink)" stroke={2.25} />
        <div class="flex flex-col items-center gap-1.5">
          <Avatar id={to()} size="lg" />
          <span class="text-sm font-semibold">{name(to())}</span>
        </div>
      </div>
      <AmountInput label={t('money.amount')} cents={amount()} currency={currency()} onChange={setAmount} />
      <div>
        <span class="label">{t('money.from')}</span>
        <MemberPicker label={t('money.from')} ids={ids()} selected={[from()]} onChange={([id]) => setFrom(id)} />
      </div>
      <div>
        <span class="label">{t('money.to')}</span>
        <MemberPicker label={t('money.to')} ids={ids().filter((id) => id !== from())} selected={[to()]} onChange={([id]) => setTo(id)} />
      </div>
      <p class="text-sm text-ink-faint">{t('money.settleHint')}</p>
      <button ref={btn} type="submit" class="btn-accent" disabled={!valid()}>
        <Icon name="check" class="size-5" stroke={2.5} />
        {t('money.recordPayment')}
      </button>
    </form>
  );
};
