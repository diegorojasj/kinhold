import { load, type PersistedStore, save } from '@/lib/persist';
import { localId } from '@/lib/sync/device';

/**
 * Ids for the starter household a first launch creates. They are unique per device (not 'hh-home'), because
 * that data syncs like anything else and two phones' starter households must not collide on the server.
 */
export const SEED = {
  household: `hh-${localId}`,
  me: `m-${localId}`,
  sam: `sam-${localId}`,
  noa: `noa-${localId}`,
};

/**
 * Earlier versions filled the starter household with sample shopping items, chores, expenses and bills.
 * Removes them once per device. Call it after `arrayCollection`: the removals are local changes, so they
 * sync as deletions and the server and other members' phones follow.
 */
export function dropDemoData<T extends object>(store: PersistedStore<T>, lists: (s: T) => { householdId: string }[][]) {
  const flag = `demo-dropped.${store.key}`;
  if (load<boolean>(flag)) return;
  if (!store.seeded) {
    store.update((s) => {
      for (const list of lists(s)) {
        for (let i = list.length - 1; i >= 0; i--) if (list[i].householdId === SEED.household) list.splice(i, 1);
      }
    });
  }
  save(flag, true);
}
