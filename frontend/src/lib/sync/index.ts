import { createRoot, createSignal } from 'solid-js';
import type { Service } from './collections';
import { kick, markDirty, startEngine } from './engine';
import { startLive } from './live';
import { cursorOf, isLinked } from './state';

export { arrayCollection, register, type SyncRecord } from './collections';
export { setHouseholdHooks, setRejectionHandler, syncStatus } from './engine';
export * from './households';
export { ApiError } from './api';
export { pendingCount } from './outbox';

const [live, setLive] = createRoot(() => createSignal(false));
/** Connected to the live-update stream: other members' changes show up within a second. */
export const isLive = live;

const POLL_MS = 30_000; // without the live stream (Valkey down, proxy without streaming)
const SAFETY_PULL_MS = 5 * 60_000; // even with it, in case a notification got lost

/** Call once at startup, after the stores have loaded. */
export function startSync() {
  startEngine();
  startLive({
    onReady() {
      setLive(true);
      markDirty();
      kick(0);
    },
    onChange({ householdId, service, cursor }) {
      if (!isLinked(householdId) || cursor <= cursorOf(service as Service, householdId)) return;
      markDirty(service as Service, householdId);
      kick(0);
    },
    onDown: () => setLive(false),
  });
  let lastPull = Date.now();
  setInterval(() => {
    if (document.visibilityState === 'hidden') return;
    if (live() && Date.now() - lastPull < SAFETY_PULL_MS) return;
    lastPull = Date.now();
    markDirty();
    kick(0);
  }, POLL_MS);
}
