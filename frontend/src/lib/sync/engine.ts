import { createRoot, createSignal } from 'solid-js';
import { ApiError, request } from './api';
import { SERVICES, type Service, type SyncRecord } from './collections';
import { reloadDevice, setCredentials, token } from './device';
import * as outbox from './outbox';
import { cursorOf, editState, isLinked, measureClock, setCursor, setLinked, syncState } from './state';
import { applyChanges, onQueued, reupload } from './tracker';

export { purgeLocal } from './tracker';

/* ── Talking to the server ──────────────────────────────────────────── */

export interface HouseholdHooks {
  /** Body for POST /household/households, for a household created on this device (undefined if it's gone). */
  linkBody(householdId: string): unknown;
  /** This device was removed from the household by someone else. */
  removed(householdId: string): void;
}
let hooks: HouseholdHooks | undefined;
export const setHouseholdHooks = (h: HouseholdHooks) => {
  hooks = h;
};

export async function ensureDevice() {
  if (token()) return;
  const register = async () => {
    reloadDevice(); // another tab may have registered meanwhile
    if (token()) return;
    const d = await request<{ deviceId: string; token: string }>('/household/devices', { method: 'POST', auth: false });
    setCredentials(d.deviceId, d.token);
  };
  if (navigator.locks) await navigator.locks.request('kinhold-device', register);
  else await register();
}

/** Registers a household this device created; the server answers 409 if it belongs to others. */
async function link(householdId: string): Promise<boolean> {
  if (syncState().orphaned.includes(householdId)) return false;
  const body = hooks?.linkBody(householdId);
  if (!body) {
    outbox.dropHousehold(householdId);
    return false;
  }
  try {
    await request('/household/households', { method: 'POST', body });
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      orphan(householdId);
      return false;
    }
    throw e;
  }
  setLinked(householdId, true);
  for (const s of SERVICES) dirty.add(`${s}|${householdId}`);
  return true;
}

function orphan(householdId: string) {
  outbox.dropHousehold(householdId);
  setLinked(householdId, false);
  editState((s) => {
    if (!s.orphaned.includes(householdId)) s.orphaned.push(householdId);
  });
  hooks?.removed(householdId);
}

/** 403 on a household we thought we were in: removed by an owner, or the server lost it. */
async function lostAccess(householdId: string) {
  setLinked(householdId, false);
  if (await link(householdId)) reupload(householdId);
}

interface OpResult {
  opId: string;
  status: 'ok' | 'rejected';
  code?: string | null;
  message?: string | null;
  record?: SyncRecord | null;
}

let onRejected: ((r: OpResult) => void) | undefined;
export const setRejectionHandler = (fn: (r: OpResult) => void) => {
  onRejected = fn;
};

async function push(service: Service, householdId: string) {
  for (;;) {
    const batch = outbox.take(service, householdId);
    if (!batch.length) return;
    const ops = batch.map(({ opId, collection, id, ts, fields }) => ({ opId, collection, id, ts, fields }));
    let out: { results: OpResult[]; serverTime: number };
    const sentAt = Date.now();
    try {
      out = await request(`/${service}/households/${householdId}/sync`, { method: 'POST', body: { ops } });
    } catch (e) {
      outbox.release(batch.map((o) => o.opId));
      throw e;
    }
    measureClock(out.serverTime, sentAt, Date.now());
    outbox.settle(out.results.map((r) => r.opId));
    // The server refused some ops: show its version instead (none = the record doesn't exist there).
    for (const r of out.results) {
      if (r.status !== 'rejected') continue;
      const op = batch.find((o) => o.opId === r.opId);
      if (!op) continue;
      const record = r.record ?? { id: op.id, householdId, deleted: true };
      applyChanges(service, householdId, [{ collection: op.collection, record }]);
      onRejected?.(r);
    }
  }
}

interface PullPage {
  changes: { collection: string; seq: number; record: SyncRecord }[];
  cursor: number;
  more: boolean;
  reset: boolean;
  serverTime: number;
}

export async function pull(service: Service, householdId: string) {
  for (;;) {
    const sentAt = Date.now();
    const page = await request<PullPage>(`/${service}/households/${householdId}/sync?since=${cursorOf(service, householdId)}`);
    measureClock(page.serverTime, sentAt, Date.now());
    if (!isLinked(householdId)) return; // left meanwhile
    if (page.reset) {
      setCursor(service, householdId, 0);
      continue;
    }
    applyChanges(service, householdId, page.changes);
    setCursor(service, householdId, page.cursor);
    if (!page.more) return;
  }
}

async function tellServerWeLeft() {
  for (const householdId of syncState().leaving) {
    try {
      await request(`/household/households/${householdId}/membership`, { method: 'DELETE' });
    } catch (e) {
      if (!(e instanceof ApiError) || e.unreachable) throw e;
    }
    editState((s) => {
      s.leaving = s.leaving.filter((h) => h !== householdId);
    });
  }
}

/** Runs `fn` for a household; a 403 means this device lost access to it. */
async function guarded(householdId: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) await lostAccess(householdId);
    else throw e;
  }
}

/* ── The loop ───────────────────────────────────────────────────────── */

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';
const [status, setStatus] = createRoot(() => createSignal<SyncStatus>('idle'));
export const syncStatus = status;

/** `service|household` pairs to pull from. */
const dirty = new Set<string>();
let started = false;
let running = false;
let again = false;
let failures = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function markDirty(service?: Service, householdId?: string) {
  for (const h of householdId ? [householdId] : syncState().linked) {
    for (const s of service ? [service] : SERVICES) dirty.add(`${s}|${h}`);
  }
}

/** Sync soon (coalesces bursts of local changes into one round trip). */
export function kick(delayMs = 50) {
  if (!started) return;
  clearTimeout(timer);
  timer = setTimeout(() => void run(), delayMs);
}

async function cycle() {
  if (!navigator.onLine) throw new ApiError(0, 'network', 'Offline');
  setStatus('syncing');
  await ensureDevice();
  await tellServerWeLeft();
  for (const { service, householdId } of outbox.groups()) {
    if (!isLinked(householdId) && !(await link(householdId))) continue;
    await guarded(householdId, () => push(service, householdId));
  }
  for (const key of [...dirty]) {
    dirty.delete(key);
    const [service, householdId] = key.split('|') as [Service, string];
    if (!isLinked(householdId)) continue;
    try {
      await guarded(householdId, () => pull(service, householdId));
    } catch (e) {
      dirty.add(key);
      throw e;
    }
  }
}

async function runRounds() {
  do {
    again = false;
    await cycle();
    // Changes made while this round was running call kick(), which sets `again`.
  } while (again);
  failures = 0;
  setStatus('idle');
}

function failed(e: unknown) {
  failures++;
  const unreachable = !navigator.onLine || (e instanceof ApiError && e.unreachable);
  setStatus(unreachable ? 'offline' : 'error');
  if (!unreachable) console.warn('Sync failed', e);
  clearTimeout(timer);
  timer = setTimeout(() => void run(), Math.min(60_000, 1000 * 2 ** failures));
}

async function run() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    await runRounds();
  } catch (e) {
    failed(e);
  } finally {
    running = false;
  }
}

/** Syncs now and waits for it; throws if the server can't be reached (for actions that need it). */
export async function syncNow() {
  markDirty();
  while (running) await new Promise((r) => setTimeout(r, 50));
  running = true;
  try {
    await runRounds();
  } catch (e) {
    failed(e);
    throw e;
  } finally {
    running = false;
  }
}

/** Makes sure the server knows a household this device created (invites need it there). */
export async function ensureLinked(householdId: string) {
  await ensureDevice();
  if (!isLinked(householdId) && !(await link(householdId))) {
    throw new ApiError(403, 'not_a_member', 'This device is not a member of the household.');
  }
}

/** Starts syncing: pushes what was done offline, pulls what others did, and keeps doing so. */
export function startEngine() {
  if (started) return;
  started = true;
  onQueued(() => kick());
  markDirty();
  kick(0);
  window.addEventListener('online', () => {
    failures = 0;
    markDirty();
    kick(0);
  });
  window.addEventListener('offline', () => setStatus('offline'));
}
