import { createSignal, Show, type Component } from 'solid-js';
import { locale } from '@/i18n';

/** Currency symbol and whether it goes before the number, for the household currency. */
export function currencyParts(currency: string) {
  const parts = new Intl.NumberFormat(locale(), { style: 'currency', currency }).formatToParts(1);
  const symbol = parts.find((p) => p.type === 'currency')?.value ?? currency;
  const before = parts.findIndex((p) => p.type === 'currency') < parts.findIndex((p) => p.type === 'integer');
  return { symbol, before };
}

export const centsToInput = (cents: number) => (cents ? (cents / 100).toFixed(2).replace(/\.00$/, '') : '');

/** "12,5" / "12.50" / "1.234,50" → 1250 cents (NaN when it isn't a number). */
export function parseAmount(text: string): number {
  // Trailing separators ("1.5.") are typing in progress, not decimal marks.
  let s = text.replace(/[^\d.,]/g, '').replace(/[.,]+$/, '');
  if (!s) return 0;
  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  // A separator followed by 1–2 digits is the decimal mark; anything else is a thousands separator.
  if (lastSep >= 0 && s.length - lastSep - 1 <= 2) {
    s = `${s.slice(0, lastSep).replace(/[.,]/g, '')}.${s.slice(lastSep + 1)}`;
  } else {
    s = s.replace(/[.,]/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Big Cash-App-style amount field; opens the phone's decimal keypad. Value is in cents. */
export const AmountInput: Component<{
  cents: number;
  onChange: (cents: number) => void;
  currency: string;
  label: string;
  autofocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}> = (props) => {
  const [text, setText] = createSignal(centsToInput(props.cents));
  const parts = () => currencyParts(props.currency);
  return (
    <label class={`block rounded-3xl bg-(--accent)/8 px-5 py-5 text-center ${props.invalid ? 'animate-shake' : ''}`}>
      <span class="eyebrow block">{props.label}</span>
      <span class="mt-1 flex items-baseline justify-center gap-1 font-display font-bold tracking-tight text-ink">
        <Show when={parts().before}>
          <span class="text-3xl text-ink-faint">{parts().symbol}</span>
        </Show>
        <input
          type="text"
          inputmode="decimal"
          autocomplete="off"
          enterkeyhint="next"
          placeholder="0"
          ref={(el) => props.autofocus && requestAnimationFrame(() => el.focus())}
          disabled={props.disabled}
          class="tabular max-w-full min-w-0 bg-transparent text-center text-5xl outline-none placeholder:text-ink-faint md:text-6xl"
          // Width follows the text so the currency symbol stays next to the number (works without field-sizing).
          style={{ width: `${Math.max(1, text().length) + 0.4}ch` }}
          value={text()}
          onInput={(e) => {
            const v = e.currentTarget.value.replace(/[^\d.,]/g, '');
            if (v !== e.currentTarget.value) e.currentTarget.value = v;
            setText(v);
            const cents = parseAmount(v);
            props.onChange(Number.isNaN(cents) ? 0 : cents);
          }}
        />
        <Show when={!parts().before}>
          <span class="text-3xl text-ink-faint">{parts().symbol}</span>
        </Show>
      </span>
    </label>
  );
};
