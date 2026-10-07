import { persistedStore, uid } from '@/lib/persist';
import { SEED } from '@/lib/seed';
import { forgetHousehold, register, setHouseholdHooks, type SyncRecord } from '@/lib/sync';

export type Role = 'owner' | 'member';

export interface Member {
  id: string;
  name: string;
  color: string;
  role: Role;
  joinedAt: string;
}

export interface Household {
  id: string;
  name: string;
  emoji: string;
  currency: string;
  timezone: string;
  members: Member[];
  createdAt: string;
}

/** Avatar colours, picked to read well with white initials in both themes. */
export const MEMBER_COLORS = ['#e0573f', '#6a55d6', '#2f9a5c', '#d98a12', '#2f86c9', '#c2477f', '#0f8b8d', '#7a6a58'];

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'BOB', 'MXN', 'ARS', 'COP', 'CLP', 'PEN', 'BRL', 'CAD', 'AUD'];

export const HOUSEHOLD_EMOJI = ['🏠', '🏡', '🏢', '🏖️', '🏔️', '🌿', '🐾', '✨'];

const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

interface HouseholdState {
  households: Household[];
  currentId: string;
  /** Who this device is in each household (per device, never synced). */
  me: Record<string, string>;
}

const seed = (): HouseholdState => {
  const now = new Date().toISOString();
  const home: Household = {
    id: SEED.household,
    name: 'Our flat',
    emoji: '🏡',
    currency: 'EUR',
    timezone: deviceTimezone(),
    createdAt: now,
    members: [
      { id: SEED.me, name: 'Alex', color: MEMBER_COLORS[1], role: 'owner', joinedAt: now },
      { id: SEED.sam, name: 'Sam', color: MEMBER_COLORS[0], role: 'member', joinedAt: now },
      { id: SEED.noa, name: 'Noa', color: MEMBER_COLORS[2], role: 'member', joinedAt: now },
    ],
  };
  return { households: [home], currentId: home.id, me: { [home.id]: SEED.me } };
};

export const householdStore = persistedStore('households', seed);
const { state, update } = householdStore;

export const households = () => state.households;

export const household = (): Household => state.households.find((h) => h.id === state.currentId) ?? state.households[0];

/** The current user's member id in the current household. */
export const myId = (): string => state.me[household().id] ?? household().members[0]?.id ?? '';

export const members = () => household().members;

export const member = (id: string | undefined) => household().members.find((m) => m.id === id);

export const me = () => member(myId()) ?? household().members[0];

export const isOwner = () => me()?.role === 'owner';

export const currency = () => household().currency;

/** "You" for the current user, otherwise the member's name. */
export const displayName = (id: string | undefined, you: string) => (id === myId() ? you : (member(id)?.name ?? '—'));

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

export function switchHousehold(id: string) {
  update((s) => {
    if (s.households.some((h) => h.id === id)) s.currentId = id;
  });
}

export function createHousehold(input: { name: string; emoji: string; currency: string; timezone: string }) {
  const now = new Date().toISOString();
  const myProfile = me();
  const id = uid();
  const memberId = uid();
  update((s) => {
    s.households.push({
      id,
      ...input,
      createdAt: now,
      members: [{ id: memberId, name: myProfile?.name ?? 'Me', color: myProfile?.color ?? MEMBER_COLORS[1], role: 'owner', joinedAt: now }],
    });
    s.me[id] = memberId;
    s.currentId = id;
  });
  return id;
}

/** After joining with an invite (A3): remember who this device is there; the data arrives with the next pull. */
export function adoptHousehold(id: string, memberId: string) {
  update((s) => {
    s.me[id] = memberId;
  }, 'remote');
}

export function updateHousehold(patch: Partial<Pick<Household, 'name' | 'emoji' | 'currency' | 'timezone'>>) {
  update((s) => {
    const h = s.households.find((x) => x.id === s.currentId);
    if (h) Object.assign(h, patch);
  });
}

/** Removes a household from this device only (it carries on for its other members). */
function dropLocally(id: string) {
  update((s) => {
    if (s.households.length <= 1) return;
    s.households = s.households.filter((h) => h.id !== id);
    delete s.me[id];
    if (s.currentId === id) s.currentId = s.households[0].id;
  }, 'remote');
}

/** Leaving the last household isn't allowed: the app always needs one to show. */
export function leaveHousehold(id: string) {
  if (state.households.length <= 1) return;
  dropLocally(id);
  forgetHousehold(id);
}

/** Profile changes apply to "me" in every household. */
export function updateProfile(patch: Partial<Pick<Member, 'name' | 'color'>>) {
  update((s) => {
    for (const h of s.households) {
      const m = h.members.find((x) => x.id === s.me[h.id]);
      if (m) Object.assign(m, patch);
    }
  });
}

export function updateMember(id: string, patch: Partial<Pick<Member, 'name' | 'color' | 'role'>>) {
  update((s) => {
    const m = s.households.find((h) => h.id === s.currentId)?.members.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
  });
}

export function removeMember(id: string) {
  if (id === myId()) return;
  update((s) => {
    const h = s.households.find((x) => x.id === s.currentId);
    if (h) h.members = h.members.filter((m) => m.id !== id);
  });
}

/** The next avatar colour nobody in the household uses yet. */
export function nextFreeColor() {
  const used = new Set(members().map((m) => m.color));
  return MEMBER_COLORS.find((c) => !used.has(c)) ?? MEMBER_COLORS[members().length % MEMBER_COLORS.length];
}

/** Members are added by name only; they can link a device later by joining with an invite as themselves. */
export function addMember(name: string, color = nextFreeColor()) {
  const id = uid();
  update((s) => {
    s.households
      .find((x) => x.id === s.currentId)
      ?.members.push({ id, name, color, role: 'member', joinedAt: new Date().toISOString() });
  });
  return id;
}

/* ── Sync (household-service) ───────────────────────────────────────── */

const placeholder = (id: string): Household => ({
  id,
  name: '…',
  emoji: '🏠',
  currency: 'EUR',
  timezone: deviceTimezone(),
  createdAt: new Date().toISOString(),
  members: [],
});

// Households and their members are separate records on the server, so two people editing different members
// don't overwrite each other.
register({
  service: 'household',
  name: 'households',
  store: householdStore,
  // Removing a household on a device means leaving it, which goes through forgetHousehold, not a delete.
  pushDeletes: false,
  read: () => state.households.map(({ members: _, ...h }) => ({ ...h, householdId: h.id })),
  apply: (upserts, deletes) =>
    update((s) => {
      for (const d of deletes) if (s.households.length > 1) s.households = s.households.filter((h) => h.id !== d.id);
      if (!s.households.some((h) => h.id === s.currentId)) s.currentId = s.households[0].id;
      for (const { householdId: _, ...fields } of upserts) {
        const h = s.households.find((x) => x.id === fields.id);
        if (h) Object.assign(h, fields);
        else s.households.push({ ...(fields as unknown as Household), members: [] });
      }
    }, 'remote'),
});

register({
  service: 'household',
  name: 'members',
  store: householdStore,
  pushDeletes: true,
  read: () => state.households.flatMap((h) => h.members.map((m) => ({ ...m, householdId: h.id }) as SyncRecord)),
  apply: (upserts, deletes) =>
    update((s) => {
      for (const d of deletes) {
        const h = s.households.find((x) => x.id === d.householdId);
        if (h) h.members = h.members.filter((m) => m.id !== d.id);
      }
      for (const { householdId, ...fields } of upserts) {
        let h = s.households.find((x) => x.id === householdId);
        if (!h) {
          // Members can arrive before their household in a long first download.
          s.households.push(placeholder(householdId));
          h = s.households[s.households.length - 1];
        }
        const i = h.members.findIndex((m) => m.id === fields.id);
        if (i >= 0) h.members[i] = fields as unknown as Member;
        else h.members.push(fields as unknown as Member);
      }
    }, 'remote'),
});

setHouseholdHooks({
  linkBody(id) {
    const h = state.households.find((x) => x.id === id);
    const mine = h?.members.find((m) => m.id === state.me[id]);
    if (!h || !mine) return undefined;
    return {
      household: { id: h.id, name: h.name, emoji: h.emoji, currency: h.currency, timezone: h.timezone, createdAt: h.createdAt },
      member: { id: mine.id, name: mine.name, color: mine.color },
    };
  },
  removed: (id) => dropLocally(id),
});
