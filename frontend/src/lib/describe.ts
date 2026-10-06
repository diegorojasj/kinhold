import { formatList, formatMonthDay, t, weekdayName } from '@/i18n';
import { fromIso } from './dates';
import { parseRule } from './repeat';

/** Human description of an RRULE, e.g. "Every Mon and Thu", "Every 2 weeks on Sun", "Monthly on day 15". */
export function describeRule(rrule: string, dtstart: string): string {
  const r = parseRule(rrule);
  switch (r.freq) {
    case 'DAILY':
      return r.interval === 1 ? t('repeat.daily') : t('repeat.everyNDays', r.interval);
    case 'WEEKLY': {
      const days = r.byDay?.length ? r.byDay : [fromIso(dtstart).getDay()];
      // Monday-first order reads more naturally.
      const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      const names = sorted.length === 7 ? t('repeat.everyDayOfWeek') : formatList(sorted.map((d) => weekdayName(d, 'short')));
      return r.interval === 1 ? t('repeat.weekly', { days: names }) : t('repeat.everyNWeeks', { n: r.interval, days: names });
    }
    case 'MONTHLY': {
      const day = r.byMonthDay ?? Number(dtstart.slice(8, 10));
      const on = day === -1 ? t('repeat.lastDay') : t('repeat.onDay', { day });
      return r.interval === 1 ? t('repeat.monthly', { on }) : t('repeat.everyNMonths', { n: r.interval, on });
    }
    case 'YEARLY':
      return t('repeat.yearly', { date: formatMonthDay(dtstart) });
  }
}
