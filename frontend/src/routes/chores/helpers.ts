import { t } from '@/i18n';
import { ME, member } from '@/stores/household';

export const whoseTurn = (id: string) => (id === ME ? t('chores.yourTurn') : t('chores.theirTurn', { name: member(id)?.name ?? '—' }));
