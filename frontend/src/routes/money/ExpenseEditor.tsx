import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { AmountInput, Avatar, centsToInput, Choice, Field, MemberPicker, parseAmount, Segmented } from '@/components/ui';
import { t } from '@/i18n';
import { today } from '@/lib/dates';
import { haptic } from '@/lib/feedback';
import { currency, myId, member, members } from '@/stores/household';
import { addExpense, canEdit, type Expense, type ExpenseCategory, expenseCategory, type Split, type SplitMode, splitByPercent, splitEqually, splitsValid, updateExpense } from '@/stores/money';
import { toast } from '@/stores/toast';

import { money, name } from './helpers';
import { ExpenseCategoryPicker } from '@/components/ExpenseCategoryPicker';

/** 100% spread over people with 2 decimals, the first person taking the rounding (33.34 / 33.33 / 33.33). */
export function evenPercents(ids: string[]): Record<string, number> {
  if (!ids.length) return {};
  const base = Math.floor(10000 / ids.length) / 100;
  const first = Math.round((100 - base * (ids.length - 1)) * 100) / 100;
  return Object.fromEntries(ids.map((id, i) => [id, i === 0 ? first : base]));
}

/* ── Expense editor (D1, D2, D5) ────────────────────────────────────── */

export const ExpenseEditor: Component<{ expense?: Expense; onDone: () => void; onDelete?: () => void }> = (props) => {
  const everyone = () => members().map((m) => m.id);
  const readOnly = () => !!props.expense && !canEdit(props.expense);
  const e = props.expense;

  const [amount, setAmount] = createSignal(e?.amountCents ?? 0);
  const [description, setDescription] = createSignal(e?.description ?? '');
  const [category, setCategory] = createSignal<ExpenseCategory>(e?.category ?? 'groceries');
  const [paidBy, setPaidBy] = createSignal(e?.paidBy ?? myId());
  const [date, setDate] = createSignal(e?.date ?? today());
  const [mode, setMode] = createSignal<SplitMode>(e?.splitMode ?? 'equal');
  const [included, setIncluded] = createSignal<string[]>(
    e?.splitMode === 'equal' ? Object.keys(e.splitInput).filter((id) => e.splitInput[id]) : everyone(),
  );
  const [percents, setPercents] = createSignal<Record<string, number>>(e?.splitMode === 'percent' ? { ...e.splitInput } : evenPercents(everyone()));
  // Raw text per person (like AmountInput) so typing "12.5" isn't rewritten to "12.50" mid-entry.
  const [exactText, setExactText] = createSignal<Record<string, string>>(
    e?.splitMode === 'exact' ? Object.fromEntries(Object.entries(e.splitInput).map(([id, c]) => [id, centsToInput(c)])) : {},
  );
  const exact = createMemo<Record<string, number>>(() =>
    Object.fromEntries(
      Object.entries(exactText()).map(([id, txt]) => {
        const c = parseAmount(txt);
        return [id, Number.isNaN(c) ? 0 : c];
      }),
    ),
  );
  const [shake, setShake] = createSignal(false);

  const splits = createMemo<Split[]>(() => {
    if (mode() === 'equal') return splitEqually(amount(), everyone().filter((id) => included().includes(id)));
    if (mode() === 'percent') return splitByPercent(amount(), percents());
    return Object.entries(exact())
      .filter(([, c]) => c > 0)
      .map(([userId, amountCents]) => ({ userId, amountCents }));
  });
  const assigned = () => splits().reduce((s, x) => s + x.amountCents, 0);
  const percentTotal = () => Math.round(Object.values(percents()).reduce((s, p) => s + (p || 0), 0) * 100) / 100;
  const remaining = () => (mode() === 'percent' ? 100 - percentTotal() : amount() - assigned());
  const valid = () =>
    !!description().trim() && splitsValid(amount(), splits()) && (mode() !== 'percent' || Math.abs(percentTotal() - 100) < 0.001);

  const save = (ev: Event) => {
    ev.preventDefault();
    if (readOnly()) return props.onDone();
    if (!valid()) {
      setShake(true);
      haptic('warn');
      setTimeout(() => setShake(false), 400);
      return;
    }
    const input = {
      description: description().trim(),
      amountCents: amount(),
      paidBy: paidBy(),
      date: date(),
      category: category(),
      splitMode: mode(),
      splitInput:
        mode() === 'equal'
          ? Object.fromEntries(included().map((id) => [id, 1]))
          : mode() === 'percent'
            ? { ...percents() }
            : { ...exact() },
      splits: splits(),
    };
    if (props.expense) {
      updateExpense(props.expense.id, input);
      toast({ emoji: '✅', message: t('common.saved') });
    } else {
      addExpense(input);
      toast({ emoji: expenseCategory(input.category).emoji, message: t('money.added', { amount: money(input.amountCents) }) });
    }
    haptic('success');
    props.onDone();
  };

  return (
    <form class="flex flex-col gap-5" onSubmit={save}>
      <Show when={readOnly() && props.expense}>
        {(expense) => (
          <p class="flex items-center gap-2 rounded-2xl bg-sunk px-4 py-3 text-sm text-ink-soft">
            <Avatar id={expense().createdBy} size="xs" />
            {t('money.readOnly', { name: member(expense().createdBy)?.name ?? '—' })}
          </p>
        )}
      </Show>
      <fieldset disabled={readOnly()} class="flex min-w-0 flex-col gap-5">
        <AmountInput
          label={t('money.amount')}
          cents={amount()}
          currency={currency()}
          onChange={setAmount}
          autofocus={!props.expense}
          invalid={shake() && amount() <= 0}
        />
        <div class={shake() && !description().trim() ? 'animate-shake' : ''}>
          <Field
            label={t('money.description')}
            placeholder={t('money.descriptionPlaceholder')}
            value={description()}
            onInput={(ev) => setDescription(ev.currentTarget.value)}
            enterkeyhint="next"
          />
        </div>

        <ExpenseCategoryPicker value={category()} onChange={setCategory} />

        <div class="grid gap-5 sm:grid-cols-[1fr_auto]">
          <div>
            <span class="label">{t('money.paidBy')}</span>
            <MemberPicker label={t('money.paidBy')} ids={everyone()} selected={[paidBy()]} onChange={([id]) => setPaidBy(id)} />
          </div>
          <Field label={t('money.date')} type="date" value={date()} onInput={(ev) => ev.currentTarget.value && setDate(ev.currentTarget.value)} />
        </div>

        <div class="flex flex-col gap-3">
          <span class="label !mb-0">{t('money.split')}</span>
          <Segmented
            label={t('money.split')}
            value={mode()}
            options={[
              { value: 'equal', label: t('money.splitEqual') },
              { value: 'percent', label: t('money.splitPercent') },
              { value: 'exact', label: t('money.splitExact') },
            ]}
            onChange={setMode}
          />

          <ul class="flex flex-col divide-y divide-line rounded-2xl border border-line bg-card">
            <For each={everyone()}>
              {(id) => {
                const share = () => splits().find((s) => s.userId === id)?.amountCents ?? 0;
                return (
                  <li class="flex min-h-14 items-center gap-3 px-3 py-2">
                    <Show
                      when={mode() === 'equal'}
                      fallback={
                        <>
                          <Avatar id={id} size="sm" />
                          <span class="min-w-0 flex-1 truncate font-medium">{name(id)}</span>
                        </>
                      }
                    >
                      <Choice
                        type="checkbox"
                        checked={included().includes(id)}
                        onChange={() => setIncluded((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
                        class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                      >
                        <span
                          class={`flex size-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${included().includes(id) ? 'border-(--accent) bg-(--accent) text-(--accent-fg)' : 'border-line'}`}
                        >
                          <Show when={included().includes(id)}>
                            <Icon name="check" class="size-4" stroke={3} />
                          </Show>
                        </span>
                        <Avatar id={id} size="sm" />
                        <span class="truncate font-medium">{name(id)}</span>
                      </Choice>
                    </Show>

                    <Show when={mode() === 'percent'}>
                      <label class="flex w-24 items-center rounded-xl bg-sunk px-3 py-2">
                        <input
                          type="text"
                          inputmode="decimal"
                          aria-label={t('money.percentFor', { name: name(id) })}
                          class="tabular w-full min-w-0 bg-transparent text-right font-semibold outline-none"
                          value={percents()[id] ? String(percents()[id]) : ''}
                          placeholder="0"
                          onInput={(ev) => {
                            const v = Number(ev.currentTarget.value.replace(',', '.'));
                            setPercents((p) => ({ ...p, [id]: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0 }));
                          }}
                        />
                        <span class="ml-1 text-ink-faint">%</span>
                      </label>
                    </Show>
                    <Show when={mode() === 'exact'}>
                      <input
                        type="text"
                        inputmode="decimal"
                        aria-label={t('money.amountFor', { name: name(id) })}
                        class="tabular w-28 rounded-xl bg-sunk px-3 py-2 text-right font-semibold outline-none focus:ring-2 focus:ring-(--accent)"
                        value={exactText()[id] ?? ''}
                        placeholder="0"
                        onInput={(ev) => {
                          const v = ev.currentTarget.value;
                          setExactText((x) => ({ ...x, [id]: v }));
                        }}
                      />
                    </Show>
                    <Show when={mode() !== 'exact'}>
                      <span class={`tabular w-20 text-right text-sm font-semibold ${share() ? '' : 'text-ink-faint'}`}>{money(share())}</span>
                    </Show>
                  </li>
                );
              }}
            </For>
          </ul>

          <Show when={amount() > 0 && mode() !== 'equal'}>
            <p class={`text-sm font-semibold ${Math.abs(remaining()) < 0.001 ? 'text-basil' : 'text-coral'}`}>
              {Math.abs(remaining()) < 0.001
                ? `✓ ${t('money.splitOk')}`
                : mode() === 'percent'
                  ? t(remaining() > 0 ? 'money.percentLeft' : 'money.percentOver', { n: Math.abs(Math.round(remaining() * 100) / 100) })
                  : t(remaining() > 0 ? 'money.amountLeft' : 'money.amountOver', { amount: money(Math.abs(remaining())) })}
            </p>
          </Show>
        </div>
      </fieldset>

      <div class="flex gap-3 pt-1">
        <Show when={props.onDelete && !readOnly()}>
          <button type="button" class="btn-danger" onClick={() => props.onDelete?.()} aria-label={t('common.delete')}>
            <Icon name="trash" class="size-5" />
          </button>
        </Show>
        <button type="submit" class={readOnly() ? 'btn-ghost flex-1' : 'btn-accent flex-1'} aria-disabled={!readOnly() && !valid()}>
          {readOnly() ? t('common.close') : props.expense ? t('common.save') : t('money.addExpense')}
        </button>
      </div>
    </form>
  );
};
