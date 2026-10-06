import { persistedStore, uid } from '@/lib/persist';

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

export const ME = 'u-me';
const SAM = 'u-sam';
const NOA = 'u-noa';

const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const seed = () => {
  const now = new Date().toISOString();
  const home: Household = {
    id: 'hh-home',
    name: 'Our flat',
    emoji: '🏡',
    currency: 'EUR',
    timezone: deviceTimezone(),
    createdAt: now,
    members: [
      { id: ME, name: 'Alex', color: MEMBER_COLORS[1], role: 'owner', joinedAt: now },
      { id: SAM, name: 'Sam', color: MEMBER_COLORS[0], role: 'member', joinedAt: now },
      { id: NOA, name: 'Noa', color: MEMBER_COLORS[2], role: 'member', joinedAt: now },
    ],
  };
  return { households: [home], currentId: home.id };
};

export const householdStore = persistedStore('households', seed);
const { state, update } = householdStore;

export const households = () => state.households;

export const household = (): Household => state.households.find((h) => h.id === state.currentId) ?? state.households[0];

export const members = () => household().members;

export const member = (id: string | undefined) => household().members.find((m) => m.id === id);

export const me = () => member(ME) ?? household().members[0];

export const isOwner = () => me()?.role === 'owner';

export const currency = () => household().currency;

/** "You" for the current user, otherwise the member's name. */
export const displayName = (id: string | undefined, you: string) =>
  id === ME ? you : (member(id)?.name ?? '—');

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
  update((s) => {
    s.households.push({
      id,
      ...input,
      createdAt: now,
      members: [{ id: ME, name: myProfile?.name ?? 'Me', color: myProfile?.color ?? MEMBER_COLORS[1], role: 'owner', joinedAt: now }],
    });
    s.currentId = id;
  });
  return id;
}

export function updateHousehold(patch: Partial<Pick<Household, 'name' | 'emoji' | 'currency' | 'timezone'>>) {
  update((s) => {
    const h = s.households.find((x) => x.id === s.currentId);
    if (h) Object.assign(h, patch);
  });
}

/** Leaving the last household isn't allowed: the app always needs one to show. */
export function leaveHousehold(id: string) {
  update((s) => {
    if (s.households.length <= 1) return;
    s.households = s.households.filter((h) => h.id !== id);
    if (s.currentId === id) s.currentId = s.households[0].id;
  });
}

/** Profile changes apply to "me" in every household. */
export function updateProfile(patch: Partial<Pick<Member, 'name' | 'color'>>) {
  update((s) => {
    for (const h of s.households) {
      const m = h.members.find((x) => x.id === ME);
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
  if (id === ME) return;
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

/** Members are added by name only; they don't need an account or an invite. */
export function addMember(name: string, color = nextFreeColor()) {
  const id = uid();
  update((s) => {
    s.households
      .find((x) => x.id === s.currentId)
      ?.members.push({ id, name, color, role: 'member', joinedAt: new Date().toISOString() });
  });
  return id;
}
