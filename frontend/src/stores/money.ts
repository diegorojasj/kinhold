import { today, type IsoDate } from '@/lib/dates';
import { clone, persistedStore, uid } from '@/lib/persist';
import { dropDemoData } from '@/lib/seed';
import { arrayCollection } from '@/lib/sync';
import { log } from './activity';
import { household, myId } from './household';

/** Fixed list of 8 categories from day 1 (open question Q7). */
export const EXPENSE_CATEGORIES = [
  { id: 'groceries', emoji: '🛒', color: '#2f9a5c' },
  { id: 'rent', emoji: '🏠', color: '#6a55d6' },
  { id: 'utilities', emoji: '💡', color: '#d98a12' },
  { id: 'dining', emoji: '🍝', color: '#e0573f' },
  { id: 'transport', emoji: '🚌', color: '#2f86c9' },
  { id: 'home', emoji: '🛋️', color: '#c2477f' },
  { id: 'fun', emoji: '🎉', color: '#0f8b8d' },
  { id: 'other', emoji: '📦', color: '#7a6a58' },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['id'];
export const expenseCategory = (id: string) => EXPENSE_CATEGORIES.find((c) => c.id === id) ?? EXPENSE_CATEGORIES[7];

export type SplitMode = 'equal' | 'percent' | 'exact';

export interface Split {
  userId: string;
  amountCents: number;
}

export interface Expense {
  id: string;
  householdId: string;
  description: string;
  /** Integer cents (D-06). */
  amountCents: number;
  paidBy: string;
  date: IsoDate;
  category: ExpenseCategory;
  splitMode: SplitMode;
  /** What the user typed per person (percent or cents), so the editor can reopen with it. */
  splitInput: Record<string, number>;
  splits: Split[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settlement {
  id: string;
  householdId: string;
  from: string;
  to: string;
  amountCents: number;
  date: IsoDate;
  createdAt: string;
}

/** Splits `total` evenly; leftover cents go to the first people so the parts always add up. */
export function splitEqually(total: number, userIds: string[]): Split[] {
  const n = userIds.length;
  if (!n) return [];
  const base = Math.floor(total / n);
  let rest = total - base * n;
  return userIds.map((userId) => ({ userId, amountCents: base + (rest-- > 0 ? 1 : 0) }));
}

/** Percentages (any precision) → cents, largest-remainder rounding so the sum is exact. */
export function splitByPercent(total: number, percents: Record<string, number>): Split[] {
  const entries = Object.entries(percents).filter(([, p]) => p > 0);
  const raw = entries.map(([userId, p]) => ({ userId, exact: (total * p) / 100 }));
  const splits = raw.map((r) => ({ userId: r.userId, amountCents: Math.floor(r.exact) }));
  let rest = total - splits.reduce((s, x) => s + x.amountCents, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; rest > 0 && order.length; k = (k + 1) % order.length, rest--) splits[order[k].i].amountCents++;
  return splits;
}

/** Same check the server will do (D2): the parts must add up to the total. */
export const splitsValid = (total: number, splits: Split[]) =>
  total > 0 && splits.length > 0 && splits.reduce((s, x) => s + x.amountCents, 0) === total;

const seed = () => ({ expenses: [] as Expense[], settlements: [] as Settlement[] });

const store = persistedStore('money', seed);
const { state, update } = store;

arrayCollection(store, 'money', 'expenses', (s) => s.expenses);
arrayCollection(store, 'money', 'settlements', (s) => s.settlements);
dropDemoData(store, (s) => [s.expenses, s.settlements]);

export const expenses = () =>
  state.expenses
    .filter((e) => e.householdId === household().id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

export const settlements = () =>
  state.settlements
    .filter((s) => s.householdId === household().id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

export const expense = (id: string) => state.expenses.find((e) => e.id === id);

/** Net position per person: positive = is owed money, negative = owes. */
export function netBalances(memberIds: string[]): Map<string, number> {
  const net = new Map(memberIds.map((id) => [id, 0]));
  const add = (id: string, cents: number) => net.set(id, (net.get(id) ?? 0) + cents);
  for (const e of expenses()) {
    add(e.paidBy, e.amountCents);
    for (const s of e.splits) add(s.userId, -s.amountCents);
  }
  for (const s of settlements()) {
    add(s.from, s.amountCents);
    add(s.to, -s.amountCents);
  }
  return net;
}

export interface Transfer {
  from: string;
  to: string;
  amountCents: number;
}

/** Fewest payments that settle everyone (D3): repeatedly match the biggest debtor with the biggest creditor. */
export function simplifyDebts(net: Map<string, number>): Transfer[] {
  const debtors = [...net].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = [...net].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const out: Transfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.v - a.v);
    creditors.sort((a, b) => b.v - a.v);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.v, c.v);
    if (amount > 0) out.push({ from: d.id, to: c.id, amountCents: amount });
    d.v -= amount;
    c.v -= amount;
    if (d.v === 0) debtors.shift();
    if (c.v === 0) creditors.shift();
  }
  return out;
}

export type ExpenseInput = Pick<
  Expense,
  'description' | 'amountCents' | 'paidBy' | 'date' | 'category' | 'splitMode' | 'splitInput' | 'splits'
>;

export function addExpense(input: ExpenseInput, opts: { silent?: boolean } = {}): Expense {
  if (!splitsValid(input.amountCents, input.splits)) throw new Error('Splits must add up to the total');
  const now = new Date().toISOString();
  const e: Expense = { ...clone(input), id: uid(), householdId: household().id, createdBy: myId(), createdAt: now, updatedAt: now };
  update((s) => {
    s.expenses.push(e);
  });
  if (!opts.silent) log('expense.added', { name: e.description, amount: e.amountCents });
  return e;
}

/** Only the person who added an expense can change it (D5). */
export const canEdit = (e: Expense) => e.createdBy === myId();

export function updateExpense(id: string, input: ExpenseInput) {
  if (!splitsValid(input.amountCents, input.splits)) throw new Error('Splits must add up to the total');
  update((s) => {
    const e = s.expenses.find((x) => x.id === id);
    if (e && e.createdBy === myId()) Object.assign(e, clone(input), { updatedAt: new Date().toISOString() });
  });
  log('expense.updated', { name: input.description, amount: input.amountCents });
}

export function removeExpense(id: string, opts: { silent?: boolean } = {}): () => void {
  const index = state.expenses.findIndex((e) => e.id === id);
  if (index < 0) return () => {};
  const copy = clone(state.expenses[index]);
  update((s) => {
    s.expenses.splice(index, 1);
  });
  if (!opts.silent) log('expense.deleted', { name: copy.description, amount: copy.amountCents });
  return () =>
    update((s) => {
      if (!s.expenses.some((e) => e.id === id)) s.expenses.push(copy);
    });
}

export function settleUp(t: Transfer): () => void {
  const s: Settlement = { id: uid(), householdId: household().id, ...t, date: today(), createdAt: new Date().toISOString() };
  update((st) => {
    st.settlements.push(s);
  });
  log('settlement', { amount: t.amountCents, to: t.to }, t.from);
  return () =>
    update((st) => {
      st.settlements = st.settlements.filter((x) => x.id !== s.id);
    });
}

export function removeSettlement(id: string): () => void {
  const copy = state.settlements.find((s) => s.id === id);
  if (!copy) return () => {};
  const snapshot = clone(copy);
  update((st) => {
    st.settlements = st.settlements.filter((x) => x.id !== id);
  });
  return () =>
    update((st) => {
      if (!st.settlements.some((x) => x.id === id)) st.settlements.push(snapshot);
    });
}

/** Spending for the month that contains `day`, by category. */
export function monthSpend(day: IsoDate = today()) {
  const month = day.slice(0, 7);
  const byCat = new Map<ExpenseCategory, number>();
  let total = 0;
  for (const e of expenses()) {
    if (!e.date.startsWith(month)) continue;
    total += e.amountCents;
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountCents);
  }
  return { total, byCat: [...byCat].sort((a, b) => b[1] - a[1]) };
}
