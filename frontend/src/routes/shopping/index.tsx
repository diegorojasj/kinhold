import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { createSheet, Sheet } from '@/components/Sheet';
import { EmptyState, ProgressRing, SectionTitle, undoToast } from '@/components/ui';
import { t } from '@/i18n';
import { celebrate, haptic, sound } from '@/lib/feedback';
import { CATEGORIES, clearChecked, items, removeItem, type ShoppingItem, toggleItem } from '@/stores/shopping';
import { toast } from '@/stores/toast';

import { AddBar } from './AddBar';
import { EditItem } from './EditItem';
import { ItemRow } from './ItemRow';

/* ── Screen ─────────────────────────────────────────────────────────── */

const Shopping: Component = () => {
  const [fresh, setFresh] = createSignal<string>();
  const [flash, setFlash] = createSignal<string>();
  const editor = createSheet<string>();
  // Just-ticked items stay where they are for a moment so the next row doesn't jump under the thumb.
  const [settling, setSettling] = createSignal<ReadonlySet<string>>(new Set());
  const settle = (id: string, on: boolean) =>
    setSettling((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const open = createMemo(() => items().filter((i) => !i.checked || settling().has(i.id)));
  const done = createMemo(() =>
    items()
      .filter((i) => i.checked && !settling().has(i.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
  const groups = createMemo(() =>
    CATEGORIES.map((c) => ({
      ...c,
      items: open()
        .filter((i) => i.category === c.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    })).filter((g) => g.items.length),
  );
  const total = () => items().length;
  // Real counts (ignoring the settling delay) for the header and progress ring.
  const left = () => items().filter((i) => !i.checked).length;
  const editingItem = () => items().find((i) => i.id === editor.value());

  const toggle = (item: ShoppingItem, el: HTMLElement) => {
    const ticking = !item.checked;
    toggleItem(item.id);
    if (!ticking) {
      settle(item.id, false);
      haptic();
      sound('down');
      return;
    }
    settle(item.id, true);
    setTimeout(() => settle(item.id, false), 1200);
    if (items().every((i) => i.checked)) {
      celebrate(el, true);
      toast({ emoji: '🎉', message: t('shopping.allDoneToast') });
    } else {
      celebrate(el);
    }
  };

  const remove = (item: ShoppingItem) => {
    const undo = removeItem(item.id);
    haptic();
    undoToast(t('shopping.removed', { name: item.name }), undo, '🗑️');
  };

  const clear = () => {
    const n = done().length;
    const undo = clearChecked();
    undoToast(t('shopping.cleared', n), undo, '🧹');
  };

  const highlight = (id: string) => {
    setFlash(id);
    requestAnimationFrame(() => document.getElementById(`item-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    setTimeout(() => setFlash(undefined), 1400);
  };

  return (
    <>
      <PageHeader
        title={t('shopping.title')}
        subtitle={
          <Show when={total()} fallback={t('shopping.subtitleEmpty')}>
            <Show when={left()} fallback={t('shopping.subtitleDone')}>
              {t('shopping.subtitle', left())}
            </Show>
          </Show>
        }
      >
        <Show when={total()}>
          <ProgressRing value={(total() - left()) / total()} size={60} label={t('shopping.progress')}>
            <span class="tabular font-display text-sm font-bold">
              {total() - left()}/{total()}
            </span>
          </ProgressRing>
        </Show>
      </PageHeader>

      <AddBar
        onAdded={(id) => {
          setFresh(id);
          setTimeout(() => setFresh(undefined), 600);
        }}
        onExists={highlight}
      />

      <Show
        when={total()}
        fallback={<EmptyState emoji="🧺" title={t('shopping.emptyTitle')} text={t('shopping.empty')} />}
      >
        <Show when={!left()}>
          <div class="card mt-2 flex animate-rise flex-col items-center gap-3 px-6 py-8 text-center">
            <span class="text-5xl">🎉</span>
            <p class="font-display text-xl font-bold">{t('shopping.allDoneTitle')}</p>
            <p class="text-ink-soft">{t('shopping.allDoneText')}</p>
            <button type="button" class="btn-accent mt-1" onClick={clear}>
              <Icon name="check" class="size-5" stroke={2.5} />
              {t('shopping.clearTicked')}
            </button>
          </div>
        </Show>

        <For each={groups()}>
          {(g) => (
            <section>
              <SectionTitle count={g.items.length}>
                <span class="text-base tracking-normal">{g.emoji}</span>
                {t(`shopping.categories.${g.id}`)}
              </SectionTitle>
              <ul class="card divide-y divide-line overflow-hidden">
                <For each={g.items}>
                  {(item) => (
                    <li id={`item-${item.id}`}>
                      <ItemRow
                        item={item}
                        fresh={fresh() === item.id}
                        flash={flash() === item.id}
                        onToggle={(el) => toggle(item, el)}
                        onEdit={() => editor.show(item.id)}
                        onDelete={() => remove(item)}
                      />
                    </li>
                  )}
                </For>
              </ul>
            </section>
          )}
        </For>

        <Show when={done().length}>
          <section class="mt-2">
            <SectionTitle
              count={done().length}
              right={
                <button type="button" class="btn-soft px-3 py-1.5 text-sm" onClick={clear}>
                  {t('shopping.clearTicked')}
                </button>
              }
            >
              <Icon name="cart" class="size-4" />
              {t('shopping.inCart')}
            </SectionTitle>
            <ul class="card divide-y divide-line overflow-hidden opacity-80">
              <For each={done()}>
                {(item) => (
                  <li id={`item-${item.id}`}>
                    <ItemRow
                      item={item}
                      fresh={false}
                      flash={flash() === item.id}
                      onToggle={(el) => toggle(item, el)}
                      onEdit={() => editor.show(item.id)}
                      onDelete={() => remove(item)}
                    />
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>

        <p class="mt-6 text-center text-sm text-ink-faint">{t('shopping.swipeHint')}</p>
      </Show>

      <Sheet open={editor.open() && !!editingItem()} onClose={editor.close} title={t('shopping.editTitle')}>
        <Show when={editingItem()} keyed>
          {(item) => (
            <EditItem
              item={item}
              onDone={editor.close}
              onDelete={() => {
                editor.close();
                // Let the sheet slide away before the row disappears behind it.
                setTimeout(() => remove(item), 200);
              }}
            />
          )}
        </Show>
      </Sheet>
    </>
  );
};

export default Shopping;
