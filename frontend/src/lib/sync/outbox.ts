import { createSignal } from 'solid-js';
import { load, onOtherTab, save } from '@/lib/persist';
import type { Service } from './collections';

/** One local change waiting for the server: set these fields of one record (D-08, D-09). */
export interface Op {
  opId: string;
  service: Service;
  collection: string;
  householdId: string;
  id: string;
  /** Client time in ms, corrected by the measured server clock offset. */
  ts: number;
  fields: Record<string, unknown>;
}

// Kept in storage and re-read on every change, so two tabs never overwrite each other's queue.
const KEY = 'sync.outbox';
const read = () => load<Op[]>(KEY) ?? [];
const [count, setCount] = createSignal(read().length);
const write = (ops: Op[]) => {
  save(KEY, ops);
  setCount(ops.length);
};
onOtherTab(KEY, () => setCount(read().length));

/** Ops this tab is sending right now. */
const inFlight = new Set<string>();

/** How many changes haven't reached the server yet. */
export const pendingCount = count;

export function enqueue(op: Op) {
  write([...read(), op]);
}

/** Households and services that have something to send. */
export function groups(): { service: Service; householdId: string }[] {
  const seen = new Map<string, { service: Service; householdId: string }>();
  for (const o of read()) seen.set(`${o.service}|${o.householdId}`, { service: o.service, householdId: o.householdId });
  return [...seen.values()];
}

/** The oldest unsent ops for one service of one household, marked as in flight. */
export function take(service: Service, householdId: string, max = 200): Op[] {
  const batch = read()
    .filter((o) => o.service === service && o.householdId === householdId && !inFlight.has(o.opId))
    .slice(0, max);
  for (const o of batch) inFlight.add(o.opId);
  return batch;
}

/** The server answered these (accepted or rejected): they're done. */
export function settle(opIds: string[]) {
  const done = new Set(opIds);
  write(read().filter((o) => !done.has(o.opId)));
  for (const id of opIds) inFlight.delete(id);
}

/** Sending failed: try these again later. */
export function release(opIds: string[]) {
  for (const id of opIds) inFlight.delete(id);
}

/** Fields of the unsent ops for one record, oldest first, so server data can be overlaid with them. */
export function pendingFields(service: Service, collection: string, householdId: string, id: string) {
  let fields: Record<string, unknown> | undefined;
  for (const o of read()) {
    if (o.service === service && o.collection === collection && o.householdId === householdId && o.id === id) {
      fields = { ...fields, ...o.fields };
    }
  }
  return fields;
}

export function dropHousehold(householdId: string) {
  write(read().filter((o) => o.householdId !== householdId));
}
