import * as i18n from '@solid-primitives/i18n';
import { createMemo, createRoot, createSignal } from 'solid-js';
import { dict as en, type RawDictionary } from './locales/en';

export const locales = {
  en: 'English',
  es: 'Español',
} as const;

export type Locale = keyof typeof locales;
export type Dictionary = i18n.Flatten<RawDictionary>;

const STORAGE_KEY = 'kinhold.locale';
const DEFAULT_LOCALE: Locale = 'en';

// English ships in the main bundle; other locales are code-split and fetched on demand.
const loaders: Record<Locale, () => Promise<RawDictionary>> = {
  en: async () => en,
  es: () => import('./locales/es').then((m) => m.dict),
};

const fallbackDictionary: Dictionary = i18n.flatten(en);
const cache = new Map<Locale, Dictionary>([['en', fallbackDictionary]]);

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && value in locales;
}

function readStored(): Locale | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

/** Saved choice → first supported device/browser language → English. */
function detectLocale(): Locale {
  const stored = readStored();
  if (stored) return stored;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

async function loadDictionary(locale: Locale): Promise<Dictionary> {
  let d = cache.get(locale);
  if (!d) {
    d = i18n.flatten(await loaders[locale]());
    cache.set(locale, d);
  }
  return d;
}

const state = createRoot(() => {
  const [locale, setLocaleSignal] = createSignal<Locale>(DEFAULT_LOCALE);
  const [dictionary, setDictionary] = createSignal<Dictionary>(fallbackDictionary);
  const t = i18n.translator(dictionary, i18n.resolveTemplate);

  // Intl formatters are relatively expensive to build, so rebuild them only when the locale changes.
  const formatters = createMemo(() => ({
    number: new Intl.NumberFormat(locale()),
    date: new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }),
    shortDate: new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' }),
    longDate: new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }),
    monthDay: new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }),
    weekday: new Intl.DateTimeFormat(locale(), { weekday: 'long' }),
    weekdayShort: new Intl.DateTimeFormat(locale(), { weekday: 'short' }),
    month: new Intl.DateTimeFormat(locale(), { month: 'long' }),
    time: new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit' }),
    relative: new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }),
  }));

  return { locale, setLocaleSignal, setDictionary, t, formatters };
});

/** Reactive translator: `t('shopping.title')`, `t('money.youOwe', { amount })`, `t('chores.dueCount', 3)`. */
export const t = state.t;
export const locale = state.locale;

export async function setLocale(next: Locale): Promise<void> {
  // Load first, then swap both signals together so the UI never renders a half-translated frame.
  const d = await loadDictionary(next);
  state.setDictionary(d);
  state.setLocaleSignal(next);
  document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode / storage disabled: the choice just won't persist.
  }
}

/** Call once before rendering so the first paint is already in the user's language. */
export async function initI18n(): Promise<void> {
  let initial = detectLocale();
  let d: Dictionary;
  try {
    d = await loadDictionary(initial);
  } catch (err) {
    // e.g. the locale chunk failed to download: start in English rather than not at all.
    console.error(`Failed to load locale "${initial}"`, err);
    initial = DEFAULT_LOCALE;
    d = fallbackDictionary;
  }
  state.setDictionary(d);
  state.setLocaleSignal(initial);
  document.documentElement.lang = initial;
}

export const formatNumber = (n: number) => state.formatters().number.format(n);
export const formatDate = (d: Date | number) => state.formatters().date.format(d);
export const formatRelative = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
  state.formatters().relative.format(value, unit);

/** Amounts are stored as integer cents (D-06); the currency comes from the household. */
export const formatMoney = (cents: number, currency: string) =>
  new Intl.NumberFormat(state.locale(), { style: 'currency', currency }).format(cents / 100);

/** Like formatMoney but drops ".00" on whole amounts, for headlines and badges. */
export const formatMoneyShort = (cents: number, currency: string) =>
  new Intl.NumberFormat(state.locale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase(state.locale()) + s.slice(1);

/** "Today", "Tomorrow", "In 3 days", "2 days ago"; further out: "Mon, 12 Oct". `iso` is 'YYYY-MM-DD'. */
export function formatDay(iso: string, todayIso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
  if (Math.abs(diff) <= 6) return capitalize(state.formatters().relative.format(diff, 'day'));
  return capitalize(state.formatters().shortDate.format(new Date(y, m - 1, d)));
}

const isoToDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatLongDate = (iso: string) => capitalize(state.formatters().longDate.format(isoToDate(iso)));
export const formatShortDate = (iso: string) => capitalize(state.formatters().shortDate.format(isoToDate(iso)));
export const formatMonthDay = (iso: string) => state.formatters().monthDay.format(isoToDate(iso));
export const formatMonth = (iso: string) => capitalize(state.formatters().month.format(isoToDate(iso)));
export const formatTime = (d: Date) => state.formatters().time.format(d);

/** Localised weekday names, index 0 = Sunday (JS getDay order). Jan 4 2026 is a Sunday. */
export const weekdayName = (day: number, style: 'long' | 'short' = 'long') =>
  capitalize(state.formatters()[style === 'long' ? 'weekday' : 'weekdayShort'].format(new Date(2026, 0, 4 + day)));

/** Joins words as "a, b and c" in the current language. */
export const formatList = (parts: string[]) => new Intl.ListFormat(state.locale(), { type: 'conjunction' }).format(parts);
