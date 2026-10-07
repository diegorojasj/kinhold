import { addDays, diffDays, maxIso, today, type IsoDate } from '@/lib/dates';
import { clone, persistedStore, uid } from '@/lib/persist';
import { SEED } from '@/lib/seed';
import { nextAfter, nextOnOrAfter, perMonth } from '@/lib/repeat';
import { log } from './activity';
import { household, myId, members } from './household';
import { addExpense, removeExpense, splitEqually, type ExpenseCategory } from './money';

export interface Bill {
  id: string;
  householdId: string;
  name: string;
  emoji: string;
  amountCents: number;
  rrule: string;
  dtstart: IsoDate;
  nextDue: IsoDate;
  remindDaysBefore: number;
  category: ExpenseCategory;
  lastPaidAt?: IsoDate;
  createdAt: string;
}

export interface BillPayment {
  id: string;
  billId: string;
  householdId: string;
  name: string;
  emoji: string;
  amountCents: number;
  dueDate: IsoDate;
  paidAt: IsoDate;
  paidBy: string;
  expenseId?: string;
}

export const BILL_EMOJI = ['🏠', '💡', '💧', '🔥', '📶', '📱', '🎬', '🎵', '🛡️', '🚗', '🏋️', '☁️', '📰', '🎮', '🧾', '💳'];

const seed = () => {
  const t = today();
  const hid = SEED.household;
  const now = new Date().toISOString();
  const day = (offset: number) => Number(addDays(t, offset).slice(8, 10));
  const mk = (name: string, emoji: string, amountCents: number, rrule: string, offset: number, category: ExpenseCategory, remind = 3): Bill => {
    // First occurrence = the due date we want to show, so the demo looks the same any day.
    const dtstart = addDays(t, offset);
    return {
      id: uid(),
      householdId: hid,
      name,
      emoji,
      amountCents,
      rrule,
      dtstart,
      nextDue: nextOnOrAfter(rrule, dtstart, dtstart),
      remindDaysBefore: remind,
      category,
      createdAt: now,
    };
  };
  const bills = [
    mk('Rent', '🏠', 120000, `FREQ=MONTHLY;BYMONTHDAY=${day(9)}`, 9, 'rent', 5),
    mk('Internet', '📶', 3999, `FREQ=MONTHLY;BYMONTHDAY=${day(2)}`, 2, 'utilities'),
    mk('Streaming', '🎬', 1399, `FREQ=MONTHLY;BYMONTHDAY=${day(0)}`, 0, 'fun', 1),
    mk('Water', '💧', 4580, `FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=${day(-2)}`, -2, 'utilities'),
    mk('Home insurance', '🛡️', 21500, 'FREQ=YEARLY', 47, 'home', 7),
  ];
  return { bills, payments: [] as BillPayment[] };
};

const store = persistedStore('bills', seed);
const { state, update } = store;

export const bills = () =>
  state.bills.filter((b) => b.householdId === household().id).sort((a, b) => a.nextDue.localeCompare(b.nextDue));

export const payments = () =>
  state.payments.filter((p) => p.householdId === household().id).sort((a, b) => b.paidAt.localeCompare(a.paidAt));

export const bill = (id: string) => state.bills.find((b) => b.id === id);

export const daysLeft = (b: Bill) => diffDays(today(), b.nextDue);

export type Urgency = 'overdue' | 'today' | 'soon' | 'later';

/** "Soon" starts when the reminder would fire (E2). */
export function urgency(b: Bill): Urgency {
  const d = daysLeft(b);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d <= b.remindDaysBefore) return 'soon';
  return 'later';
}

/** Normalised monthly cost of all bills. */
export const monthlyTotal = () => Math.round(bills().reduce((s, b) => s + b.amountCents * perMonth(b.rrule), 0));

/** What's still to pay this month, overdue included. */
export function dueThisMonth() {
  const month = today().slice(0, 7);
  return bills()
    .filter((b) => b.nextDue.slice(0, 7) <= month)
    .reduce((s, b) => s + b.amountCents, 0);
}

export type BillInput = Pick<Bill, 'name' | 'emoji' | 'amountCents' | 'rrule' | 'dtstart' | 'remindDaysBefore' | 'category'>;

export function createBill(input: BillInput) {
  const b: Bill = {
    ...input,
    id: uid(),
    householdId: household().id,
    // A first due date in the past starts from the next upcoming occurrence, not as overdue.
    nextDue: nextOnOrAfter(input.rrule, input.dtstart, maxIso(input.dtstart, today())),
    createdAt: new Date().toISOString(),
  };
  update((s) => {
    s.bills.push(b);
  });
  log('bill.created', { name: b.name, amount: b.amountCents });
  return b;
}

export function updateBill(id: string, input: BillInput) {
  update((s) => {
    const b = s.bills.find((x) => x.id === id);
    if (!b) return;
    const scheduleChanged = b.rrule !== input.rrule || b.dtstart !== input.dtstart;
    Object.assign(b, input);
    // The editor's "next due" is the new anchor, so the bill lands exactly on it.
    if (scheduleChanged) b.nextDue = nextOnOrAfter(b.rrule, b.dtstart, b.dtstart);
  });
}

export function removeBill(id: string): () => void {
  const index = state.bills.findIndex((b) => b.id === id);
  if (index < 0) return () => {};
  const copy = clone(state.bills[index]);
  update((s) => {
    s.bills.splice(index, 1);
  });
  return () =>
    update((s) => {
      if (!s.bills.some((b) => b.id === id)) s.bills.push(copy);
    });
}

/**
 * Mark paid (E3): records the payment, moves the bill to its next due date and, optionally,
 * adds it as an expense split equally between everyone. Returns an undo for all of it.
 */
export function markPaid(id: string, opts: { createExpense: boolean; paidBy?: string; amountCents?: number }): () => void {
  const b = state.bills.find((x) => x.id === id);
  if (!b) return () => {};
  const paidBy = opts.paidBy ?? myId();
  // Variable bills (electricity, water) can be paid with this period's actual amount.
  const amountCents = opts.amountCents && opts.amountCents > 0 ? opts.amountCents : b.amountCents;
  const before = { nextDue: b.nextDue, lastPaidAt: b.lastPaidAt };

  let undoExpense: (() => void) | undefined;
  let expenseId: string | undefined;
  if (opts.createExpense) {
    const ids = members().map((m) => m.id);
    const e = addExpense(
      {
        description: b.name,
        amountCents,
        paidBy,
        date: today(),
        category: b.category,
        splitMode: 'equal',
        splitInput: Object.fromEntries(ids.map((x) => [x, 1])),
        splits: splitEqually(amountCents, ids),
      },
      { silent: true },
    );
    expenseId = e.id;
    undoExpense = () => removeExpense(e.id, { silent: true });
  }

  const payment: BillPayment = {
    id: uid(),
    billId: id,
    householdId: b.householdId,
    name: b.name,
    emoji: b.emoji,
    amountCents,
    dueDate: b.nextDue,
    paidAt: today(),
    paidBy,
    expenseId,
  };
  update((s) => {
    const x = s.bills.find((y) => y.id === id);
    if (!x) return;
    x.lastPaidAt = today();
    // Paying early keeps the schedule; paying late doesn't create an instant second due date.
    x.nextDue = nextAfter(x.rrule, x.dtstart, maxIso(x.nextDue, addDays(today(), -1)));
    s.payments.unshift(payment);
    if (s.payments.length > 200) s.payments.length = 200;
  });
  log('bill.paid', { name: b.name, amount: amountCents }, paidBy);

  return () => {
    undoExpense?.();
    update((s) => {
      const x = s.bills.find((y) => y.id === id);
      if (x) Object.assign(x, before);
      s.payments = s.payments.filter((p) => p.id !== payment.id);
    });
  };
}
