import { For, type Component } from 'solid-js';
import { locale, locales, setLocale, t, type Locale } from '@/i18n';

export const LanguageSwitcher: Component = () => (
  <label class="block">
    <span class="label !mb-0">{t('config.language')}</span>
    <span class="mb-2 block text-sm text-ink-soft">{t('config.languageHint')}</span>
    <select class="field" value={locale()} onChange={(e) => void setLocale(e.currentTarget.value as Locale)}>
      <For each={Object.entries(locales)}>{(entry) => <option value={entry[0]}>{entry[1]}</option>}</For>
    </select>
  </label>
);
