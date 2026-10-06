import { type Component, createSignal, For, Show } from 'solid-js';
import { EmojiPicker, Field } from '@/components/ui';
import { t } from '@/i18n';
import { haptic } from '@/lib/feedback';
import { CURRENCIES, createHousehold, HOUSEHOLD_EMOJI, household, updateHousehold } from '@/stores/household';
import { toast } from '@/stores/toast';

export const timezones = (): string[] => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone');
  } catch {
    return [household().timezone, 'UTC'];
  }
};

export const HouseholdForm: Component<{ create?: boolean; onDone: () => void }> = (props) => {
  const h = household();
  const [name, setName] = createSignal(props.create ? '' : h.name);
  const [emoji, setEmoji] = createSignal(props.create ? HOUSEHOLD_EMOJI[0] : h.emoji);
  const [currency, setCurrency] = createSignal(h.currency);
  const [tz, setTz] = createSignal(props.create ? Intl.DateTimeFormat().resolvedOptions().timeZone : h.timezone);
  const zones = timezones();

  return (
    <form
      class="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name().trim()) return;
        const input = { name: name().trim(), emoji: emoji(), currency: currency(), timezone: tz() };
        if (props.create) {
          createHousehold(input);
          toast({ emoji: emoji(), message: t('household.householdCreated', { name: input.name }) });
        } else {
          updateHousehold(input);
          toast({ emoji: '✅', message: t('common.saved') });
        }
        haptic('success');
        props.onDone();
      }}
    >
      <EmojiPicker label={t('common.icon')} value={emoji()} options={HOUSEHOLD_EMOJI} onChange={setEmoji} />
      <Field
        label={t('household.householdName')}
        placeholder={t('household.householdNamePlaceholder')}
        value={name()}
        onInput={(e) => setName(e.currentTarget.value)}
        autofocus={props.create}
        required
      />
      <div class="grid grid-cols-[7rem_1fr] gap-3">
        <label class="block">
          <span class="label">{t('household.currency')}</span>
          <select class="field" value={currency()} onChange={(e) => setCurrency(e.currentTarget.value)}>
            <For each={CURRENCIES}>{(c) => <option value={c}>{c}</option>}</For>
          </select>
        </label>
        <label class="block min-w-0">
          <span class="label">{t('household.timezone')}</span>
          <select class="field" value={tz()} onChange={(e) => setTz(e.currentTarget.value)}>
            <For each={zones.includes(tz()) ? zones : [tz(), ...zones]}>{(z) => <option value={z}>{z.replace(/_/g, ' ')}</option>}</For>
          </select>
        </label>
      </div>
      <Show when={!props.create}>
        <p class="text-sm text-ink-faint">{t('household.currencyHint')}</p>
      </Show>
      <button type="submit" class="btn-accent" disabled={!name().trim()}>
        {props.create ? t('household.createHousehold') : t('common.save')}
      </button>
    </form>
  );
};
