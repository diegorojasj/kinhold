import { persistedStore, uid } from '@/lib/persist';
import { dropDemoData } from '@/lib/seed';
import { arrayCollection } from '@/lib/sync';
import { household, myId } from './household';

export type ActivityType =
  | 'item.added'
  | 'item.cleared'
  | 'chore.done'
  | 'chore.skipped'
  | 'chore.created'
  | 'expense.added'
  | 'expense.updated'
  | 'expense.deleted'
  | 'settlement'
  | 'bill.paid'
  | 'bill.created'
  | 'member.joined';

export interface Activity {
  id: string;
  householdId: string;
  actor: string;
  type: ActivityType;
  /** Free-form values for the message template: name, amount (cents), count, to… */
  payload: { name?: string; amount?: number; count?: number; to?: string };
  at: string;
}

const KEEP = 50;

const seed = () => ({ events: [] as Activity[] });

const store = persistedStore('activity', seed);

// The feed keeps the last 50 per household on every device and on the server, so trimming isn't a delete.
arrayCollection(store, 'household', 'activity', (s) => s.events, { pushDeletes: false, order: (a, b) => b.at.localeCompare(a.at) });
dropDemoData(store, (s) => [s.events]);

/** Newest first, last 50 for the current household (story F3). */
export const activity = () => store.state.events.filter((e) => e.householdId === household().id);

export function log(type: ActivityType, payload: Activity['payload'] = {}, actor = myId()) {
  const hid = household().id;
  store.update((s) => {
    s.events.unshift({ id: uid(), householdId: hid, actor, type, payload, at: new Date().toISOString() });
    // Keep the last 50 per household.
    let seen = 0;
    s.events = s.events.filter((e) => e.householdId !== hid || ++seen <= KEEP);
  });
}

