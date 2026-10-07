import { persistedStore, uid } from '@/lib/persist';
import { SEED } from '@/lib/seed';
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

const seed = () => {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const hid = SEED.household;
  const events: Activity[] = [
    { id: uid(), householdId: hid, actor: SEED.sam, type: 'item.added', payload: { name: 'Dish soap' }, at: ago(25) },
    { id: uid(), householdId: hid, actor: SEED.me, type: 'expense.added', payload: { name: 'Weekly groceries', amount: 8640 }, at: ago(90) },
    { id: uid(), householdId: hid, actor: SEED.noa, type: 'chore.done', payload: { name: 'Vacuum living room' }, at: ago(60 * 20) },
    { id: uid(), householdId: hid, actor: SEED.sam, type: 'expense.added', payload: { name: 'Pizza night', amount: 4250 }, at: ago(60 * 26) },
    { id: uid(), householdId: hid, actor: SEED.noa, type: 'expense.added', payload: { name: 'Electricity', amount: 7320 }, at: ago(60 * 72) },
    { id: uid(), householdId: hid, actor: SEED.sam, type: 'settlement', payload: { amount: 1500, to: SEED.me }, at: ago(60 * 24 * 6) },
  ];
  return { events };
};

const store = persistedStore('activity', seed);

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

