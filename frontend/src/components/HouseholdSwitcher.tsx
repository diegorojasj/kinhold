import { A } from '@solidjs/router';
import { createSignal, For, onCleanup, onMount, Show, type Component } from 'solid-js';
import { Icon } from '@/components/Icon';
import { AvatarStack } from '@/components/ui';
import { t } from '@/i18n';
import { haptic } from '@/lib/feedback';
import { household, households, members, switchHousehold } from '@/stores/household';
import { toast } from '@/stores/toast';

/**
 * Current household with a menu to switch between households or open household settings.
 * Sits in its own section at the bottom of the desktop sidebar, apart from the navigation.
 */
export const HouseholdSwitcher: Component = () => {
  let root!: HTMLDivElement;
  const [open, setOpen] = createSignal(false);
  const others = () => households().filter((h) => h.id !== household().id);

  // Close on a click outside or Esc.
  onMount(() => {
    const onPointer = (e: PointerEvent) => open() && !root.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    });
  });

  const pick = (id: string) => {
    const h = households().find((x) => x.id === id);
    switchHousehold(id);
    setOpen(false);
    haptic('success');
    if (h) toast({ emoji: h.emoji, message: t('household.switched', { name: h.name }) });
  };

  return (
    <div ref={root} class="relative">
      <Show when={open()}>
        <div class="absolute inset-x-0 bottom-full z-40 mb-2 animate-rise overflow-hidden rounded-2xl bg-card p-1.5 shadow-2xl ring-1 ring-line">
          <Show when={others().length}>
            <p class="eyebrow px-2.5 pt-1.5 pb-1">{t('nav.switchTo')}</p>
            <ul>
              <For each={others()}>
                {(h) => (
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition-colors hover:bg-sunk"
                      onClick={() => pick(h.id)}
                    >
                      <span class="text-lg" aria-hidden="true">
                        {h.emoji}
                      </span>
                      <span class="min-w-0 flex-1 truncate">{h.name}</span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
            <hr class="my-1.5 border-line" />
          </Show>
          <A
            href="/household"
            class="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-sunk hover:text-ink"
            onClick={() => setOpen(false)}
          >
            <Icon name="config" class="size-5" />
            {t('nav.householdSettings')}
          </A>
        </div>
      </Show>

      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open()}
        class="flex w-full items-center gap-3 rounded-2xl bg-card p-2.5 text-left shadow-sm ring-1 ring-line transition-colors hover:ring-ink-faint"
        onClick={() => setOpen((v) => !v)}
      >
        <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sunk text-xl" aria-hidden="true">
          {household().emoji}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-semibold">{household().name}</span>
          <span class="mt-0.5 flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-soft">
            <AvatarStack ids={members().slice(0, 4).map((m) => m.id)} size="xs" />
            {t('household.members', members().length)}
          </span>
        </span>
        <Icon name="chevronDown" class={`size-4 shrink-0 text-ink-faint transition-transform ${open() ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
};
