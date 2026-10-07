import { load, save } from '@/lib/persist';
import type { Service } from './collections';

/** What the device remembers about syncing (kept apart from the data stores). */
interface SyncState {
  /** Households the server knows this device belongs to. */
  linked: string[];
  /** Left while offline: the server still has to be told. */
  leaving: string[];
  /** Households this device was removed from: no longer synced. */
  orphaned: string[];
  /** Last seq pulled, per `service|household`. */
  cursors: Record<string, number>;
  /** Server clock minus device clock (ms), so ops from a phone with a wrong clock still order correctly. */
  clockOffset: number;
  lastTs: number;
}

const KEY = 'sync.state';
const empty = (): SyncState => ({ linked: [], leaving: [], orphaned: [], cursors: {}, clockOffset: 0, lastTs: 0 });

// Re-read on every access: another tab may have changed it.
export const syncState = (): SyncState => ({ ...empty(), ...load<SyncState>(KEY) });

export function editState(fn: (s: SyncState) => void) {
  const s = syncState();
  fn(s);
  save(KEY, s);
}

const cursorKey = (service: Service, householdId: string) => `${service}|${householdId}`;

export const cursorOf = (service: Service, householdId: string) => syncState().cursors[cursorKey(service, householdId)] ?? 0;

export const setCursor = (service: Service, householdId: string, cursor: number) =>
  editState((s) => {
    s.cursors[cursorKey(service, householdId)] = cursor;
  });

export const isLinked = (householdId: string) => syncState().linked.includes(householdId);

export function setLinked(householdId: string, linked: boolean) {
  editState((s) => {
    s.linked = s.linked.filter((h) => h !== householdId);
    if (linked) s.linked.push(householdId);
    else for (const k of Object.keys(s.cursors)) if (k.endsWith(`|${householdId}`)) delete s.cursors[k];
  });
}

/** Timestamp for a new op: server-corrected, and never earlier than this device's previous op. */
export function nextTs(): number {
  let ts = 0;
  editState((s) => {
    ts = Math.max(Date.now() + s.clockOffset, s.lastTs + 1);
    s.lastTs = ts;
  });
  return ts;
}

/** From a response's `serverTime`, assuming the request took as long to go as to come back. */
export function measureClock(serverTime: number, sentAt: number, receivedAt: number) {
  editState((s) => {
    s.clockOffset = Math.round(serverTime - (sentAt + receivedAt) / 2);
  });
}
