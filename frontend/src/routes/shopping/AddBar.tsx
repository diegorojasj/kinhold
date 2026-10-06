import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { haptic, sound } from '@/lib/feedback';
import { addItem, itemEmoji, parseQuickAdd, suggest } from '@/stores/shopping';
import { toast } from '@/stores/toast';

/* ── Add bar with autocomplete (B1, B3) ─────────────────────────────── */

export const AddBar: Component<{ onAdded: (id: string) => void; onExists: (id: string) => void }> = (props) => {
  let input!: HTMLInputElement;
  const [text, setText] = createSignal('');
  const [focused, setFocused] = createSignal(false);
  // Hidden after each add so the panel doesn't sit over the list; typing or tapping the field brings it back.
  const [dismissed, setDismissed] = createSignal(false);
  const [cursor, setCursor] = createSignal(-1);

  const query = () => parseQuickAdd(text()).name;
  const suggestions = createMemo(() => (focused() && !dismissed() ? suggest(query(), text() ? 6 : 8) : []));

  const add = (name: string, qty = '') => {
    if (!name.trim()) return;
    const res = addItem({ name, qty });
    if (res.status === 'exists') {
      haptic('warn');
      toast({ emoji: '👀', message: t('shopping.alreadyOnList', { name: res.item.name }) });
      props.onExists(res.item.id);
    } else {
      haptic();
      sound('up');
      props.onAdded(res.item.id);
    }
    setText('');
    setCursor(-1);
    setDismissed(true);
    input.focus();
  };

  const submit = (e: Event) => {
    e.preventDefault();
    const picked = suggestions()[cursor()];
    const { name, qty } = parseQuickAdd(text());
    add(picked ? picked.name : name, qty);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const n = suggestions().length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      setCursor((c) => (c + 1) % n);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      setCursor((c) => (c <= 0 ? n - 1 : c - 1));
    } else if (e.key === 'Escape') {
      setCursor(-1);
      setDismissed(true);
    }
  };

  return (
    <div class="sticky top-0 z-20 -mx-4 bg-paper/85 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl md:-mx-8 md:px-8">
      <form class="relative" onSubmit={submit}>
        <div class="flex items-center gap-2 rounded-[1.4rem] bg-card p-1.5 pl-4 shadow-[0_8px_30px_-12px_rgb(40_25_10/0.25)] ring-1 ring-line transition-shadow focus-within:ring-2 focus-within:ring-(--accent)">
          <Icon name="plus" class="size-5 text-(--accent-ink)" stroke={2.25} />
          <input
            ref={input}
            type="text"
            enterkeyhint="done"
            autocomplete="off"
            autocapitalize="sentences"
            role="combobox"
            aria-expanded={suggestions().length > 0}
            aria-controls="suggestions"
            aria-activedescendant={cursor() >= 0 ? `sugg-${cursor()}` : undefined}
            aria-label={t('shopping.addPlaceholder')}
            placeholder={t('shopping.addPlaceholder')}
            class="h-11 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-ink-faint"
            value={text()}
            onInput={(e) => {
              setText(e.currentTarget.value);
              setCursor(-1);
              setDismissed(false);
            }}
            onFocus={() => setFocused(true)}
            onPointerDown={() => setDismissed(false)}
            // Delay so a tap on a suggestion lands before the list disappears.
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={onKeyDown}
          />
          <button
            type="submit"
            class="flex h-11 items-center rounded-2xl bg-(--accent) px-4 font-bold text-(--accent-fg) transition-[transform,opacity] active:scale-95 disabled:opacity-30"
            disabled={!text().trim()}
          >
            {t('shopping.add')}
          </button>
        </div>

        <Show when={focused() && suggestions().length}>
          <div
            id="suggestions"
            role="listbox"
            class="absolute inset-x-0 top-full z-30 mt-2 animate-rise overflow-hidden rounded-3xl bg-card p-2 shadow-2xl ring-1 ring-line"
          >
            <p class="eyebrow px-3 pt-1.5 pb-2">{text() ? t('shopping.suggestions') : t('shopping.usual')}</p>
            <div class={text() ? 'flex flex-col' : 'flex flex-wrap gap-2 px-1 pb-1'}>
              <For each={suggestions()}>
                {(s, i) => (
                  <button
                    type="button"
                    id={`sugg-${i()}`}
                    role="option"
                    aria-selected={cursor() === i()}
                    class={
                      text()
                        ? 'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-sunk aria-selected:bg-sunk'
                        : 'chip aria-selected:border-(--accent)'
                    }
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => add(s.name, parseQuickAdd(text()).qty)}
                  >
                    <span class={text() ? 'text-xl' : ''}>{itemEmoji(s.name, s.category)}</span>
                    <span class={text() ? 'flex-1 font-medium' : ''}>{s.name}</span>
                    <Show when={text()}>
                      <Icon name="plus" class="size-5 text-ink-faint" />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </form>
    </div>
  );
};
