import { addDays, diffDays, maxIso, startOfWeek, today, type IsoDate } from '@/lib/dates';
import { clone, persistedStore, uid } from '@/lib/persist';
import { dropDemoData } from '@/lib/seed';
import { arrayCollection } from '@/lib/sync';
import { nextAfter, nextOnOrAfter } from '@/lib/repeat';
import { log } from './activity';
import { household, myId } from './household';

export type AssigneeMode = 'fixed' | 'rotate';

export interface Chore {
  id: string;
  householdId: string;
  title: string;
  emoji: string;
  rrule: string;
  dtstart: IsoDate;
  assigneeMode: AssigneeMode;
  /** One person for `fixed`; the rotation order for `rotate`. */
  assignees: string[];
  rotationIndex: number;
  nextDue: IsoDate;
  createdAt: string;
}

export interface ChoreEvent {
  id: string;
  choreId: string;
  householdId: string;
  userId: string;
  action: 'done' | 'skip';
  dueAt: IsoDate;
  day: IsoDate;
  at: string;
}

export const CHORE_EMOJI = ['🧹', '🧽', '🗑️', '🍽️', '🧺', '🛏️', '🪴', '🐶', '🛁', '🧊', '🚗', '📦', '🪟', '🍳', '♻️', '🛒'];

const seed = () => ({ chores: [] as Chore[], events: [] as ChoreEvent[] });

const store = persistedStore('chores', seed);
const { state, update } = store;

arrayCollection(store, 'chores', 'chores', (s) => s.chores);
arrayCollection(store, 'chores', 'events', (s) => s.events);
dropDemoData(store, (s) => [s.chores, s.events]);

export const chores = () => state.chores.filter((c) => c.householdId === household().id);
export const choreEvents = () => state.events.filter((e) => e.householdId === household().id);
export const chore = (id: string) => state.chores.find((c) => c.id === id);

export const assigneeOf = (c: Chore) => c.assignees[c.rotationIndex % Math.max(1, c.assignees.length)];

export type ChoreInput = Pick<Chore, 'title' | 'emoji' | 'rrule' | 'dtstart' | 'assigneeMode' | 'assignees'>;

export function createChore(input: ChoreInput) {
  const c: Chore = {
    ...input,
    id: uid(),
    householdId: household().id,
    rotationIndex: 0,
    nextDue: nextOnOrAfter(input.rrule, input.dtstart, maxIso(input.dtstart, today())),
    createdAt: new Date().toISOString(),
  };
  update((s) => {
    s.chores.push(c);
  });
  log('chore.created', { name: c.title });
  return c;
}

export function updateChore(id: string, input: ChoreInput) {
  update((s) => {
    const c = s.chores.find((x) => x.id === id);
    if (!c) return;
    const scheduleChanged = c.rrule !== input.rrule || c.dtstart !== input.dtstart;
    // Whoever's turn it is now keeps it, even if people were added or removed from the rotation.
    const current = c.assignees[c.rotationIndex % Math.max(1, c.assignees.length)];
    Object.assign(c, input);
    if (scheduleChanged) c.nextDue = nextOnOrAfter(c.rrule, c.dtstart, maxIso(c.dtstart, today()));
    c.rotationIndex = Math.max(0, c.assignees.indexOf(current));
  });
}

export function removeChore(id: string): () => void {
  const index = state.chores.findIndex((c) => c.id === id);
  if (index < 0) return () => {};
  const copy = clone(state.chores[index]);
  update((s) => {
    s.chores.splice(index, 1);
  });
  return () =>
    update((s) => {
      if (!s.chores.some((c) => c.id === id)) s.chores.splice(Math.min(index, s.chores.length), 0, copy);
    });
}

/**
 * Done or skip (C3): records history and moves the chore to its next occurrence after
 * whichever is later, the due date or today (an overdue chore doesn't pile up repeats).
 * Rotation advances only on completion (C2). Returns an undo.
 */
function resolve(id: string, action: 'done' | 'skip'): () => void {
  const c = state.chores.find((x) => x.id === id);
  if (!c) return () => {};
  const before = { nextDue: c.nextDue, rotationIndex: c.rotationIndex };
  const event: ChoreEvent = {
    id: uid(),
    choreId: id,
    householdId: c.householdId,
    userId: myId(),
    action,
    dueAt: c.nextDue,
    day: today(),
    at: new Date().toISOString(),
  };
  update((s) => {
    const x = s.chores.find((y) => y.id === id);
    if (!x) return;
    x.nextDue = nextAfter(x.rrule, x.dtstart, maxIso(x.nextDue, today()));
    if (action === 'done' && x.assigneeMode === 'rotate') x.rotationIndex = (x.rotationIndex + 1) % Math.max(1, x.assignees.length);
    s.events.unshift(event);
    if (s.events.length > 500) s.events.length = 500;
  });
  log(action === 'done' ? 'chore.done' : 'chore.skipped', { name: c.title });
  return () =>
    update((s) => {
      const x = s.chores.find((y) => y.id === id);
      if (x) Object.assign(x, before);
      s.events = s.events.filter((e) => e.id !== event.id);
    });
}

export const completeChore = (id: string) => resolve(id, 'done');
export const skipChore = (id: string) => resolve(id, 'skip');

/** Consecutive days (ending today, or yesterday if nothing yet today) on which the household finished a chore. */
export function householdStreak(): number {
  const days = new Set(choreEvents().filter((e) => e.action === 'done').map((e) => e.day));
  let d = days.has(today()) ? today() : addDays(today(), -1);
  let streak = 0;
  while (days.has(d)) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

/** Completions per member since Monday, highest first. */
export function weekScores(memberIds: string[]): { id: string; count: number }[] {
  const monday = startOfWeek(today());
  const counts = new Map(memberIds.map((id) => [id, 0]));
  for (const e of choreEvents()) {
    if (e.action === 'done' && e.day >= monday && counts.has(e.userId)) counts.set(e.userId, (counts.get(e.userId) ?? 0) + 1);
  }
  return [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
}

export type Bucket = 'today' | 'week' | 'later';

/** Today = overdue + due today; This week = next 7 days; Later = the rest. */
export function bucketOf(c: Chore): Bucket {
  const d = diffDays(today(), c.nextDue);
  if (d <= 0) return 'today';
  if (d <= 7) return 'week';
  return 'later';
}
