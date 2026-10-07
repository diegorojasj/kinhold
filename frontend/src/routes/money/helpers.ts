import { formatMoney, t } from '@/i18n';
import { currency, displayName, myId } from '@/stores/household';
import type {  Expense, Settlement } from '@/stores/money';

export const name = (id: string) => displayName(id, t('common.you'));
/** Mid-sentence object form: "Sam paid you". */
export const nameObj = (id: string) => displayName(id, t('common.youObject'));
// Bright variants used on the always-dark balance card.
export const POSITIVE = '#4cc47f';
export const NEGATIVE = '#f27a63';
export const money = (cents: number) => formatMoney(cents, currency());

/** Only the two people involved can remove a recorded payment. */
export const canRemoveSettlement = (s: Settlement) => s.from === myId() || s.to === myId();

/** How an expense changes *my* balance: positive = I lent, negative = I borrowed. */
export function myImpact(e: Expense): number {
  const myShare = e.splits.find((s) => s.userId === myId())?.amountCents ?? 0;
  return (e.paidBy === myId() ? e.amountCents : 0) - myShare;
}
