import { formatMoney } from '@/i18n';
import { currency } from '@/stores/household';

export const money = (cents: number) => formatMoney(cents, currency());
