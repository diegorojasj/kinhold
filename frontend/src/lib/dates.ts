/**
 * Calendar days are handled as local ISO dates ('YYYY-MM-DD'): due dates for chores and bills
 * are about *which day*, not an instant, so this sidesteps time-zone and DST drift.
 */
import { createRoot, createSignal } from 'solid-js';

export type IsoDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toIso(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromIso(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Reactive "today": everything derived from it (buckets, countdowns, badges) refreshes at midnight
 * and when the app comes back to the foreground, e.g. a PWA resumed the next morning.
 */
export const today = createRoot(() => {
  const [day, setDay] = createSignal(toIso(new Date()));
  const refresh = () => setDay(toIso(new Date()));
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 60_000);
  return day;
});

export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  // Date.UTC avoids 23/25-hour days around DST changes.
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export const daysInMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();

/** Monday-based start of the week containing `iso`. */
export function startOfWeek(iso: IsoDate): IsoDate {
  const dow = (fromIso(iso).getDay() + 6) % 7;
  return addDays(iso, -dow);
}

export const startOfMonth = (iso: IsoDate): IsoDate => `${iso.slice(0, 7)}-01`;

export const maxIso = (a: IsoDate, b: IsoDate) => (a > b ? a : b);
