import { request } from './api';
import { SERVICES } from './collections';
import { ensureDevice, ensureLinked, kick, pull, purgeLocal, syncNow } from './engine';
import { reconnectLive } from './live';
import * as outbox from './outbox';
import { editState, setLinked } from './state';

/** Things only the server can do: they need a connection (the UI says so when there is none). */

export interface Invite {
  code: string;
  expiresAt: string;
}

export interface InvitePreview {
  householdId: string;
  name: string;
  emoji: string;
  members: { id: string; name: string; color: string; linked: boolean }[];
  expiresAt: string;
}

/** Join as someone already in the household (`memberId`), or as a new person (`member`). */
export type JoinAs = { memberId: string } | { member: { id: string; name: string; color: string } };

/** A3: a single-use code, valid 7 days. Sends pending changes first so the household exists on the server. */
export async function createInvite(householdId: string): Promise<Invite> {
  await ensureLinked(householdId);
  await syncNow();
  return request<Invite>(`/household/households/${householdId}/invites`, { method: 'POST' });
}

export async function previewInvite(code: string): Promise<InvitePreview> {
  await ensureDevice();
  return request<InvitePreview>(`/household/invites/${encodeURIComponent(normalizeCode(code))}`);
}

/** Joins and downloads the household, so the app can switch to it straight away. */
export async function joinHousehold(code: string, as: JoinAs): Promise<{ householdId: string; memberId: string }> {
  await ensureDevice();
  const joined = await request<{ householdId: string; memberId: string }>(
    `/household/invites/${encodeURIComponent(normalizeCode(code))}/accept`,
    { method: 'POST', body: as },
  );
  setLinked(joined.householdId, true);
  editState((s) => {
    s.orphaned = s.orphaned.filter((h) => h !== joined.householdId);
  });
  return joined;
}

/** Downloads everything of a household the device just joined. */
export async function downloadHousehold(householdId: string) {
  for (const service of SERVICES) await pull(service, householdId);
  reconnectLive();
}

/** Stops syncing a household and removes its data from this device; the server is told when online. */
export function forgetHousehold(householdId: string) {
  outbox.dropHousehold(householdId);
  purgeLocal(householdId);
  editState((s) => {
    if (s.linked.includes(householdId) && !s.leaving.includes(householdId)) s.leaving.push(householdId);
  });
  setLinked(householdId, false);
  kick();
  reconnectLive();
}

/** "abcd-2345" → "ABCD2345" (codes are shown in two groups of four). */
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');
