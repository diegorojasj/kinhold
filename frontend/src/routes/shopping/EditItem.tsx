import { type Component, createSignal, For } from 'solid-js';
import { Icon } from '@/components/Icon';
import { Choice, ChoiceGroup, Field } from '@/components/ui';
import { t } from '@/i18n';
import { haptic } from '@/lib/feedback';
import { CATEGORIES, type CategoryId, type ShoppingItem, updateItem } from '@/stores/shopping';

/* ── Edit sheet ─────────────────────────────────────────────────────── */

export const EditItem: Component<{ item: ShoppingItem; onDone: () => void; onDelete: () => void }> = (props) => {
  const [name, setName] = createSignal(props.item.name);
  const [qty, setQty] = createSignal(props.item.qty);
  const [note, setNote] = createSignal(props.item.note);
  const [category, setCategory] = createSignal<CategoryId>(props.item.category);

  const save = (e: Event) => {
    e.preventDefault();
    if (!name().trim()) return;
    updateItem(props.item.id, { name: name(), qty: qty().trim(), note: note().trim(), category: category() });
    haptic();
    props.onDone();
  };

  return (
    <form id="edit-item" class="flex flex-col gap-5" onSubmit={save}>
      <div class="grid grid-cols-[1fr_6.5rem] gap-3">
        <Field label={t('shopping.name')} value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
        <Field label={t('shopping.qty')} value={qty()} placeholder="1" onInput={(e) => setQty(e.currentTarget.value)} />
      </div>
      <Field label={t('shopping.note')} value={note()} placeholder={t('shopping.notePlaceholder')} onInput={(e) => setNote(e.currentTarget.value)} />
      <div>
        <span class="label">{t('shopping.aisle')}</span>
        <ChoiceGroup label={t('shopping.aisle')} class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <For each={CATEGORIES}>
            {(c) => (
              <Choice checked={category() === c.id} onChange={() => setCategory(c.id)} class="chip cursor-pointer justify-start rounded-2xl">
                <span class="text-lg" aria-hidden="true">
                  {c.emoji}
                </span>
                {t(`shopping.categories.${c.id}`)}
              </Choice>
            )}
          </For>
        </ChoiceGroup>
        <p class="mt-2 text-sm text-ink-faint">{t('shopping.aisleHint')}</p>
      </div>
      <div class="flex gap-3 pt-1">
        <button type="button" class="btn-danger" onClick={props.onDelete} aria-label={t('common.delete')}>
          <Icon name="trash" class="size-5" />
        </button>
        <button type="submit" class="btn-accent flex-1" disabled={!name().trim()}>
          {t('common.save')}
        </button>
      </div>
    </form>
  );
};
