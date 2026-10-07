import { createRoot } from 'solid-js';
import { createStore, produce, reconcile, type SetStoreFunction, unwrap } from 'solid-js/store';

// v2: ids became unique per device (v1 demo data used fixed ids like 'hh-home', which would collide once synced).
const PREFIX = 'kinhold.v2.';
const OLD_PREFIXES = ['kinhold.v1.'];

/** Reads a JSON value saved by `save` (undefined if missing, unreadable or storage is disabled). */
export function load<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or disabled: keep working in memory.
  }
}

/** Calls `fn` when another tab or window on this device changes `key`. */
export function onOtherTab(key: string, fn: (raw: string | null) => void) {
  window.addEventListener('storage', (e) => {
    if (e.key === PREFIX + key) fn(e.newValue);
  });
}

/** `local`: the user changed something on this device. `remote`: it came from the server or another tab. */
export type Origin = 'local' | 'remote';

export interface PersistedStore<T extends object> {
  key: string;
  state: T;
  /** Mutates and saves (batched to one write per tick). Sync turns `local` changes into ops for the server. */
  update: (fn: (draft: T) => void, origin?: Origin) => void;
  /** True when this device had no saved data and the store started from its seed. */
  seeded: boolean;
  /** Called synchronously after every change. */
  subscribe: (fn: (origin: Origin) => void) => void;
}

/**
 * A Solid store saved to localStorage: the device's own copy of the household data, so the app works
 * offline. `lib/sync` diffs local changes into ops for the server and applies the server's changes back
 * with origin `remote`. Other tabs on this device get changes through the `storage` event.
 */
export function persistedStore<T extends object>(key: string, seed: () => T): PersistedStore<T> {
  return createRoot(() => {
    const saved = load<T>(key);
    const [state, setState] = createStore<T>(saved ?? seed());
    const listeners: ((origin: Origin) => void)[] = [];
    let pending = false;

    const write = () => {
      pending = false;
      save(key, unwrap(state));
    };

    const update = (fn: (draft: T) => void, origin: Origin = 'local') => {
      setState(produce(fn));
      if (!pending) {
        pending = true;
        queueMicrotask(write);
      }
      for (const listener of listeners) listener(origin);
    };

    onOtherTab(key, (raw) => {
      const next = raw ? (JSON.parse(raw) as T) : seed();
      (setState as SetStoreFunction<T>)(reconcile(next, { key: 'id', merge: true }));
      for (const listener of listeners) listener('remote');
    });

    if (!saved) queueMicrotask(write);
    return { key, state, update, seeded: !saved, subscribe: (fn) => void listeners.push(fn) };
  });
}

/** Wipes everything Kinhold keeps on this device, including its sign-in to its households. */
export function clearPersisted() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX) || OLD_PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k);
    }
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
