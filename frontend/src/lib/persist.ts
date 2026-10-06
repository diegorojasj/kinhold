import { createRoot } from 'solid-js';
import { createStore, produce, reconcile, type SetStoreFunction, unwrap } from 'solid-js/store';

const PREFIX = 'kinhold.v1.';

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A Solid store saved to localStorage. Until the API exists this is the "server":
 * - `update(draft => …)` mutates and saves (batched to one write per tick)
 * - other tabs/windows on this device receive the change through the `storage` event,
 *   which mimics the live household sync the backend will provide over SSE.
 */
export function persistedStore<T extends object>(key: string, seed: () => T) {
  return createRoot(() => {
    const [state, setState] = createStore<T>(read<T>(key) ?? seed());
    let pending = false;

    const save = () => {
      pending = false;
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(unwrap(state)));
      } catch {
        // Storage full or disabled: keep working in memory.
      }
    };

    const update = (fn: (draft: T) => void) => {
      setState(produce(fn));
      if (!pending) {
        pending = true;
        queueMicrotask(save);
      }
    };

    window.addEventListener('storage', (e) => {
      if (e.key !== PREFIX + key) return;
      const next = e.newValue ? (JSON.parse(e.newValue) as T) : seed();
      (setState as SetStoreFunction<T>)(reconcile(next, { key: 'id', merge: true }));
    });

    return { state, update };
  });
}

/** Wipes every Kinhold store on this device (seed data comes back on reload). */
export function clearPersisted() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

/** Client-generated ids (D-08) so offline writes can be retried without duplicates. */
export const uid = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Plain deep copy of store data (for undo snapshots); store proxies can't go through structuredClone. */
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(unwrap(value))) as T;
