import { t } from '@/i18n';
import { myId, member } from '@/stores/household';

export const whoseTurn = (id: string) => (id === myId() ? t('chores.yourTurn') : t('chores.theirTurn', { name: member(id)?.name ?? '—' }));
