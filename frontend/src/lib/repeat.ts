import { addDays, daysInMonth, diffDays, fromIso, type IsoDate, startOfWeek, toIso } from './dates';

/**
 * Repeat rules are stored as RFC 5545 RRULE strings (decision D-07) so the backend can feed them
 * straight into `dateutil.rrule`. The client understands the subset the editors produce:
 *   FREQ=DAILY;INTERVAL=n
 *   FREQ=WEEKLY;INTERVAL=n;BYDAY=MO,TH
 *   FREQ=MONTHLY;INTERVAL=n;BYMONTHDAY=15   (-1 = last day of the month)
 *   FREQ=YEARLY;INTERVAL=n
 * Difference from strict RFC 5545: a monthly day that doesn't exist (31st in April) falls on the
 * month's last day instead of being skipped, which is what people expect for bills.
 */
export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Rule {
  freq: Freq;
  interval: number;
  /** 0 = Sunday … 6 = Saturday (JS `getDay()` order). */
  byDay?: number[];
  byMonthDay?: number;
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export function parseRule(rrule: string): Rule {
  const parts: Record<string, string | undefined> = Object.fromEntries(
    rrule
      .replace(/^RRULE:/, '')
      .split(';')
      .map((p) => p.split('=') as [string, string]),
  );
  const freqs: readonly string[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
  const freq = parts.FREQ && freqs.includes(parts.FREQ) ? (parts.FREQ as Freq) : 'WEEKLY';
  const rule: Rule = { freq, interval: Math.max(1, Number(parts.INTERVAL) || 1) };
  if (parts.BYDAY) {
    rule.byDay = parts.BYDAY.split(',')
      .map((c) => DAY_CODES.indexOf(c))
      .filter((n) => n >= 0)
      .sort((a, b) => a - b);
  }
  if (parts.BYMONTHDAY) rule.byMonthDay = Number(parts.BYMONTHDAY);
  return rule;
}

export function stringifyRule(rule: Rule): string {
  const out = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) out.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === 'WEEKLY' && rule.byDay?.length) out.push(`BYDAY=${rule.byDay.map((d) => DAY_CODES[d]).join(',')}`);
  if (rule.freq === 'MONTHLY' && rule.byMonthDay) out.push(`BYMONTHDAY=${rule.byMonthDay}`);
  return out.join(';');
}

function monthlyOn(year: number, month0: number, day: number): IsoDate {
  const len = daysInMonth(year, month0);
  const d = day === -1 ? len : Math.min(day, len);
  return toIso(new Date(year, month0, d));
}

/** Occurrence #k (k ≥ 0) of a monthly/yearly rule anchored on `start`. */
function nthPeriodic(rule: Rule, start: Date, k: number): IsoDate {
  const months = rule.freq === 'YEARLY' ? 12 * rule.interval * k : rule.interval * k;
  const total = start.getMonth() + months;
  const year = start.getFullYear() + Math.floor(total / 12);
  const month0 = ((total % 12) + 12) % 12;
  const day = rule.freq === 'MONTHLY' ? (rule.byMonthDay ?? start.getDate()) : start.getDate();
  return monthlyOn(year, month0, day);
}

/**
 * Keeps a rule in step with a date the user picked, so the next occurrence is that date:
 * monthly rules move to its day (unless set to "last day"), single-day weekly rules to its weekday.
 */
export function alignRule(rrule: string, date: IsoDate): string {
  const r = parseRule(rrule);
  if (r.freq === 'MONTHLY' && r.byMonthDay !== -1) r.byMonthDay = Number(date.slice(8, 10));
  if (r.freq === 'WEEKLY' && (r.byDay?.length ?? 0) <= 1) r.byDay = [fromIso(date).getDay()];
  return stringifyRule(r);
}

/** First occurrence on or after `from` (and never before `dtstart`). */
export function nextOnOrAfter(rrule: string, dtstart: IsoDate, from: IsoDate): IsoDate {
  const rule = parseRule(rrule);
  const target = from > dtstart ? from : dtstart;

  if (rule.freq === 'DAILY') {
    const gap = diffDays(dtstart, target);
    const steps = Math.ceil(gap / rule.interval);
    return addDays(dtstart, steps * rule.interval);
  }

  if (rule.freq === 'WEEKLY') {
    const days = rule.byDay?.length ? rule.byDay : [fromIso(dtstart).getDay()];
    const anchorWeek = startOfWeek(dtstart);
    // Walk day by day; at most `interval` weeks + 7 days, so this stays cheap.
    for (let i = 0, d = target; i < 7 * rule.interval + 7; i++, d = addDays(d, 1)) {
      const weekIndex = Math.floor(diffDays(anchorWeek, startOfWeek(d)) / 7);
      if (weekIndex % rule.interval === 0 && days.includes(fromIso(d).getDay())) return d;
    }
    return target;
  }

  // MONTHLY / YEARLY: jump close to the target, then step forward.
  const start = fromIso(dtstart);
  const t = fromIso(target);
  const monthsApart = (t.getFullYear() - start.getFullYear()) * 12 + t.getMonth() - start.getMonth();
  const per = rule.freq === 'YEARLY' ? 12 * rule.interval : rule.interval;
  let k = Math.max(0, Math.floor(monthsApart / per) - 1);
  let d = nthPeriodic(rule, start, k);
  while (d < target) d = nthPeriodic(rule, start, ++k);
  return d;
}

/** First occurrence strictly after `after`. */
export const nextAfter = (rrule: string, dtstart: IsoDate, after: IsoDate) =>
  nextOnOrAfter(rrule, dtstart, addDays(after, 1));

/** The next `count` occurrences on or after `from` (used for the "next 5 dates" preview). */
export function upcoming(rrule: string, dtstart: IsoDate, from: IsoDate, count: number): IsoDate[] {
  const out: IsoDate[] = [];
  let d = nextOnOrAfter(rrule, dtstart, from);
  for (let i = 0; i < count; i++) {
    out.push(d);
    d = nextAfter(rrule, dtstart, d);
  }
  return out;
}

/** Roughly how many times per month a rule fires (used for "€x / month" summaries). */
export function perMonth(rrule: string): number {
  const r = parseRule(rrule);
  switch (r.freq) {
    case 'DAILY':
      return 30.44 / r.interval;
    case 'WEEKLY':
      return ((r.byDay?.length || 1) * 4.345) / r.interval;
    case 'MONTHLY':
      return 1 / r.interval;
    case 'YEARLY':
      return 1 / (12 * r.interval);
  }
}
