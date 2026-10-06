import { For, Show, type Component } from 'solid-js';
import { t, weekdayName } from '@/i18n';
import { fromIso } from '@/lib/dates';
import { parseRule, stringifyRule, type Freq, type Rule } from '@/lib/repeat';
import { Segmented, Stepper } from './ui';

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/**
 * Repeat rule editor (C1, E1): presets as tabs, then just the one or two settings that preset needs.
 * Emits an RRULE string.
 */
export const RepeatPicker: Component<{
  value: string;
  dtstart: string;
  onChange: (rrule: string) => void;
  freqs?: Freq[];
}> = (props) => {
  const rule = () => parseRule(props.value);
  const set = (patch: Partial<Rule>) => props.onChange(stringifyRule({ ...rule(), ...patch }));
  const startDay = () => fromIso(props.dtstart).getDay();

  const changeFreq = (freq: Freq) => {
    const base: Rule = { freq, interval: 1 };
    if (freq === 'WEEKLY') base.byDay = [startDay()];
    if (freq === 'MONTHLY') base.byMonthDay = Number(props.dtstart.slice(8, 10));
    props.onChange(stringifyRule(base));
  };

  /** Selected weekdays; a weekly rule without BYDAY repeats on its start date's weekday. */
  const days = () => {
    const byDay = rule().byDay;
    return byDay?.length ? byDay : [startDay()];
  };

  const toggleDay = (d: number) => {
    const current = days();
    const next = current.includes(d) ? current.filter((x) => x !== d) : [...current, d];
    if (next.length) set({ byDay: next.sort((a, b) => a - b) });
  };

  const freqLabel: Record<Freq, () => string> = {
    DAILY: () => t('repeat.presetDaily'),
    WEEKLY: () => t('repeat.presetWeekly'),
    MONTHLY: () => t('repeat.presetMonthly'),
    YEARLY: () => t('repeat.presetYearly'),
  };

  return (
    <div class="flex flex-col gap-3">
      <Segmented
        label={t('repeat.label')}
        value={rule().freq}
        options={(props.freqs ?? ['DAILY', 'WEEKLY', 'MONTHLY']).map((f) => ({ value: f, label: freqLabel[f]() }))}
        onChange={changeFreq}
      />

      <Show when={rule().freq === 'WEEKLY'}>
        <fieldset class="flex min-w-0 justify-between gap-1">
          <legend class="sr-only">{t('repeat.onDays')}</legend>
          <For each={MONDAY_FIRST}>
            {(d) => {
              const on = () => days().includes(d);
              return (
                <button
                  type="button"
                  aria-pressed={on()}
                  aria-label={weekdayName(d)}
                  class="flex aspect-square flex-1 items-center justify-center rounded-full border border-line bg-card text-sm font-bold text-ink-soft transition-all active:scale-90 aria-pressed:border-transparent aria-pressed:bg-(--accent) aria-pressed:text-(--accent-fg)"
                  onClick={() => toggleDay(d)}
                >
                  {weekdayName(d, 'short').slice(0, 2)}
                </button>
              );
            }}
          </For>
        </fieldset>
      </Show>

      <Show when={rule().freq === 'MONTHLY'}>
        <label class="block">
          <span class="label">{t('repeat.dayOfMonth')}</span>
          <select class="field" value={String(rule().byMonthDay ?? 1)} onChange={(e) => set({ byMonthDay: Number(e.currentTarget.value) })}>
            <For each={Array.from({ length: 31 }, (_, i) => i + 1)}>{(d) => <option value={d}>{d}</option>}</For>
            <option value={-1}>{t('repeat.lastDay')}</option>
          </select>
        </label>
      </Show>

      <Stepper
        label={t('repeat.every')}
        value={rule().interval}
        min={1}
        max={rule().freq === 'DAILY' ? 30 : 12}
        onChange={(interval) => set({ interval })}
        format={(n) =>
          ({
            DAILY: () => t('repeat.unitDays', n),
            WEEKLY: () => t('repeat.unitWeeks', n),
            MONTHLY: () => t('repeat.unitMonths', n),
            YEARLY: () => t('repeat.unitYears', n),
          })[rule().freq]()
        }
      />
    </div>
  );
};
