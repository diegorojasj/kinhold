import { For, type Component } from 'solid-js';
import { Choice, ChoiceGroup } from '@/components/ui';
import { t } from '@/i18n';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/stores/money';

/** Horizontally scrolling chips for the 8 expense categories (used by expenses and bills). */
export const ExpenseCategoryPicker: Component<{ value: ExpenseCategory; onChange: (c: ExpenseCategory) => void }> = (props) => (
  <div>
    <span class="label">{t('money.category')}</span>
    <ChoiceGroup label={t('money.category')} class="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:-mx-6 md:px-6">
      <For each={EXPENSE_CATEGORIES}>
        {(c) => (
          <Choice checked={props.value === c.id} onChange={() => props.onChange(c.id)} class="chip cursor-pointer">
            <span aria-hidden="true">{c.emoji}</span>
            {t(`money.categories.${c.id}`)}
          </Choice>
        )}
      </For>
    </ChoiceGroup>
  </div>
);
