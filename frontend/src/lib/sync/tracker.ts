import { uid } from '@/lib/persist';
import { type Collection, onRegister, type RecordKey, registry, type Service, type SyncRecord } from './collections';
import * as outbox from './outbox';
import { nextTs } from './state';

let queued = () => {};
/** Called whenever local changes were queued (the engine schedules a sync). */
export const onQueued = (fn: () => void) => {
  queued = fn;
};

/* ── Local changes → ops ────────────────────────────────────────────── */

// Per collection: record key → field → JSON of the value the server has (or will have once the outbox is sent).
type Snapshot = Map<string, Record<string, string>>;
const snapshots = new Map<Collection, Snapshot>();
const SEP = '\u0000';
const keyOf = (r: RecordKey) => `${r.householdId}${SEP}${r.id}`;

function fieldsOf(r: SyncRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) if (k !== 'id' && k !== 'householdId' && v !== undefined) out[k] = JSON.stringify(v);
  return out;
}

const snapshot = (c: Collection): Snapshot => new Map(c.read().map((r) => [keyOf(r), fieldsOf(r)]));

function enqueue(c: Collection, key: string, fields: Record<string, unknown>) {
  const [householdId, id] = key.split(SEP);
  outbox.enqueue({ opId: uid(), service: c.service, collection: c.name, householdId, id, ts: nextTs(), fields });
}

/** Turns what changed since the last snapshot into ops: only the changed fields, `null` for removed ones. */
function diff(c: Collection) {
  const before = snapshots.get(c) ?? new Map();
  const after = snapshot(c);
  for (const [key, now] of after) {
    const prev = before.get(key);
    const changed: Record<string, unknown> = {};
    if (!prev) {
      for (const [f, v] of Object.entries(now)) changed[f] = JSON.parse(v);
      changed.deleted = false;
    } else {
      for (const f of new Set([...Object.keys(prev), ...Object.keys(now)])) {
        if (prev[f] !== now[f]) changed[f] = f in now ? JSON.parse(now[f]) : null;
      }
    }
    if (Object.keys(changed).length) enqueue(c, key, changed);
  }
  if (c.pushDeletes) for (const key of before.keys()) if (!after.has(key)) enqueue(c, key, { deleted: true });
  snapshots.set(c, after);
  if (outbox.pendingCount()) queued();
}

const watchedStores = new Set<unknown>();

// Collections register when their store module loads. A freshly seeded store (first launch) starts from an
// empty snapshot, so its seed data is queued for upload right away.
onRegister((c) => {
  snapshots.set(c, c.store.seeded ? new Map() : snapshot(c));
  if (c.store.seeded) diff(c);
  if (watchedStores.has(c.store)) return;
  watchedStores.add(c.store);
  c.store.subscribe((origin) => {
    for (const x of registry) {
      if (x.store !== c.store) continue;
      // Remote changes (server, other tab) are already on the server: just move the snapshot.
      if (origin === 'local') diff(x);
      else snapshots.set(x, snapshot(x));
    }
  });
});

/* ── Server changes → stores ────────────────────────────────────────── */

/** Server record with this device's unsent edits on top, so a pull never undoes what you just did. */
export function applyChanges(service: Service, householdId: string, changes: { collection: string; record: SyncRecord }[]) {
  const batches = new Map<Collection, { upserts: SyncRecord[]; deletes: RecordKey[] }>();
  for (const { collection, record } of changes) {
    const c = registry.find((x) => x.service === service && x.name === collection);
    if (!c) continue;
    const mine = outbox.pendingFields(service, collection, householdId, record.id);
    const merged: Record<string, unknown> = { ...record, ...mine };
    const batch = batches.get(c) ?? { upserts: [], deletes: [] };
    batches.set(c, batch);
    if (merged.deleted) batch.deletes.push({ householdId, id: record.id });
    else {
      delete merged.deleted;
      for (const [k, v] of Object.entries(merged)) if (v === null) delete merged[k];
      batch.upserts.push(merged as SyncRecord);
    }
  }
  // Registry order: a household before its members.
  for (const c of registry) {
    const b = batches.get(c);
    if (b) c.apply(b.upserts, b.deletes);
  }
}

/** Removes a household's data from every store on this device (no ops: nothing changes for others). */
export function purgeLocal(householdId: string) {
  for (const c of registry) {
    const keys = c.read().filter((r) => r.householdId === householdId);
    if (keys.length) c.apply([], keys.map(({ householdId: h, id }) => ({ householdId: h, id })));
  }
}

/** Queues every record of a household again (the server lost it, e.g. after a database restore). */
export function reupload(householdId: string) {
  for (const c of registry) {
    const snap = snapshots.get(c);
    for (const r of c.read()) if (r.householdId === householdId) snap?.delete(keyOf(r));
    diff(c);
  }
}
