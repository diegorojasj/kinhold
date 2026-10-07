import { A } from '@solidjs/router';
import { For, type Component } from 'solid-js';
import { formatMoney, formatRelative, formatTime, t } from '@/i18n';
import type { Activity } from '@/stores/activity';
import { household, myId, member } from '@/stores/household';
import { Avatar } from './ui';

export type Section = 'list' | 'chores' | 'money' | 'bills' | 'household';

/** Which part of the app an event belongs to: drives the filter chips and where tapping it goes. */
export const ACTIVITY_META: Record<Activity['type'], { emoji: string; section: Section }> = {
  'item.added': { emoji: '🛒', section: 'list' },
  'item.cleared': { emoji: '🧹', section: 'list' },
  'chore.done': { emoji: '✅', section: 'chores' },
  'chore.skipped': { emoji: '⏭️', section: 'chores' },
  'chore.created': { emoji: '✨', section: 'chores' },
  'expense.added': { emoji: '💸', section: 'money' },
  'expense.updated': { emoji: '✏️', section: 'money' },
  'expense.deleted': { emoji: '🗑️', section: 'money' },
  settlement: { emoji: '🤝', section: 'money' },
  'bill.paid': { emoji: '🧾', section: 'bills' },
  'bill.created': { emoji: '📅', section: 'bills' },
  'member.joined': { emoji: '👋', section: 'household' },
};

const SECTION_HREF: Record<Section, string> = {
  list: '/list',
  chores: '/chores',
  money: '/money',
  bills: '/bills',
  household: '/household',
};

/** "just now", "5 minutes ago", "3 hours ago"; older events show the time (their day is the group header). */
function timeLabel(iso: string): string {
  const secs = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(secs);
  if (abs < 60) return formatRelative(0, 'second');
  if (abs < 3600) return formatRelative(Math.round(secs / 60), 'minute');
  if (abs < 6 * 3600) return formatRelative(Math.round(secs / 3600), 'hour');
  return formatTime(new Date(iso));
}

export function describeActivity(a: Activity): string {
  const actor = a.actor === myId() ? t('common.you') : (member(a.actor)?.name ?? t('home.someone'));
  const to = a.payload.to === myId() ? t('common.youObject') : (member(a.payload.to)?.name ?? '');
  return t(`activity.${a.type}`, {
    actor,
    name: a.payload.name ?? '',
    amount: a.payload.amount !== undefined ? formatMoney(a.payload.amount, household().currency) : '',
    count: a.payload.count ?? 0,
    to,
  });
}

/** Activity rows; each one links to the section it happened in. */
export const ActivityList: Component<{ events: Activity[] }> = (props) => (
  <ul class="flex flex-col">
    <For each={props.events}>
      {(a) => (
        <li class="border-b border-line last:border-0">
          <A href={SECTION_HREF[ACTIVITY_META[a.type].section]} class="flex items-start gap-3 py-3 transition-opacity active:opacity-60">
            <span class="relative shrink-0">
              <Avatar id={a.actor} size="md" />
              <span class="absolute -right-1 -bottom-1 text-sm" aria-hidden="true">
                {ACTIVITY_META[a.type].emoji}
              </span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[0.95rem] leading-snug">{describeActivity(a)}</span>
              <span class="text-xs text-ink-faint">{timeLabel(a.at)}</span>
            </span>
          </A>
        </li>
      )}
    </For>
  </ul>
);
