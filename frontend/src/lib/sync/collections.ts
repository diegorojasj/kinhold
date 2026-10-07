import type { PersistedStore } from '@/lib/persist';

/** Backend services; each owns some collections and has its own sync cursor per household. */
export type Service = 'household' | 'shopping' | 'chores' | 'money' | 'bills';
export const SERVICES: Service[] = ['household', 'shopping', 'chores', 'money', 'bills'];

export type SyncRecord = { id: string; householdId: string } & Record<string, unknown>;
export type RecordKey = { householdId: string; id: string };

/** A kind of record a store keeps in sync with one service (e.g. shopping `items`). */
export interface Collection {
  service: Service;
  name: string;
  // biome-ignore lint/suspicious/noExplicitAny: the registry holds stores of every shape
  store: PersistedStore<any>;
  /** Every record of this collection on the device, all households. */
  read(): SyncRecord[];
  /** Server changes (already merged with this device's unsent edits); must update with origin `remote`. */
  apply(upserts: SyncRecord[], deletes: RecordKey[]): void;
  /** False when removing locally is only trimming a cache (activity feed), not deleting for everyone. */
  pushDeletes: boolean;
}

export const registry: Collection[] = [];
const listeners: ((c: Collection) => void)[] = [];

export function register(c: Collection) {
  registry.push(c);
  for (const fn of listeners) fn(c);
}

export function onRegister(fn: (c: Collection) => void) {
  listeners.push(fn);
  for (const c of registry) fn(c);
}

const same = (r: RecordKey, k: RecordKey) => r.id === k.id && r.householdId === k.householdId;

/** The common case: an array of records with `id` and `householdId` somewhere in a store. */
export function arrayCollection<S extends object, R extends RecordKey>(
  store: PersistedStore<S>,
  service: Service,
  name: string,
  list: (state: S) => R[],
  opts: { pushDeletes?: boolean; order?: (a: R, b: R) => number } = {},
) {
  register({
    service,
    name,
    store,
    pushDeletes: opts.pushDeletes ?? true,
    read: () => list(store.state) as unknown as SyncRecord[],
    apply: (upserts, deletes) =>
      store.update((draft) => {
        const rows = list(draft);
        for (const k of deletes) {
          const i = rows.findIndex((r) => same(r, k));
          if (i >= 0) rows.splice(i, 1);
        }
        for (const u of upserts) {
          const i = rows.findIndex((r) => same(r, u));
          if (i >= 0) rows[i] = u as unknown as R;
          else rows.push(u as unknown as R);
        }
        if (opts.order) rows.sort(opts.order);
      }, 'remote'),
  });
}
