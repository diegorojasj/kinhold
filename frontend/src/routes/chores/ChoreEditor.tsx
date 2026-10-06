import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { RepeatPicker } from '@/components/RepeatPicker';
import { Avatar, EmojiPicker, Field, MemberPicker, Segmented } from '@/components/ui';
import { formatShortDate, t } from '@/i18n';
import { maxIso, today } from '@/lib/dates';
import { haptic } from '@/lib/feedback';
import { alignRule, upcoming } from '@/lib/repeat';
import { type AssigneeMode, assigneeOf, CHORE_EMOJI, type Chore, type ChoreInput, createChore, updateChore } from '@/stores/chores';
import { ME, members } from '@/stores/household';
import { toast } from '@/stores/toast';

/* ── Editor (C1, C2) ────────────────────────────────────────────────── */

export const ChoreEditor: Component<{ chore?: Chore; onDone: () => void; onDelete?: () => void }> = (props) => {
  const everyone = () => members().map((m) => m.id);
  const [title, setTitle] = createSignal(props.chore?.title ?? '');
  const [emoji, setEmoji] = createSignal(props.chore?.emoji ?? CHORE_EMOJI[0]);
  const [dtstart, setDtstart] = createSignal(props.chore ? maxIso(props.chore.nextDue, props.chore.dtstart) : today());
  const [rrule, setRrule] = createSignal(props.chore?.rrule ?? 'FREQ=WEEKLY');
  const [mode, setMode] = createSignal<AssigneeMode>(props.chore?.assigneeMode ?? 'fixed');
  const [assignees, setAssignees] = createSignal<string[]>(props.chore?.assignees ?? [ME]);
  const [invalid, setInvalid] = createSignal(false);

  // Rotation starts with whoever's turn it is now, so the preview matches what will happen.
  const rotationNow = () => {
    const a = assignees();
    if (!props.chore || mode() !== 'rotate') return a;
    const current = assigneeOf(props.chore);
    const i = a.indexOf(current);
    return i > 0 ? [...a.slice(i), ...a.slice(0, i)] : a;
  };
  const preview = createMemo(() => upcoming(rrule(), dtstart(), maxIso(dtstart(), today()), 5));

  const save = (e: Event) => {
    e.preventDefault();
    if (!title().trim() || !assignees().length) {
      setInvalid(true);
      haptic('warn');
      setTimeout(() => setInvalid(false), 400);
      return;
    }
    const input: ChoreInput = {
      title: title().trim(),
      emoji: emoji(),
      rrule: rrule(),
      // Editing an existing chore keeps its history anchor unless the schedule actually changed.
      dtstart: dtstart(),
      assigneeMode: mode(),
      assignees: mode() === 'fixed' ? assignees().slice(0, 1) : assignees(),
    };
    if (props.chore) {
      const unchanged = props.chore.rrule === input.rrule && maxIso(props.chore.nextDue, props.chore.dtstart) === input.dtstart;
      updateChore(props.chore.id, unchanged ? { ...input, dtstart: props.chore.dtstart } : input);
      toast({ emoji: '✅', message: t('common.saved') });
    } else {
      createChore(input);
      toast({ emoji: '✨', message: t('chores.created', { name: input.title }) });
    }
    haptic('success');
    props.onDone();
  };

  return (
    <form id="chore-form" class="flex flex-col gap-5" onSubmit={save}>
      <EmojiPicker label={t('common.icon')} value={emoji()} options={CHORE_EMOJI} onChange={setEmoji} />
      <div class={invalid() && !title().trim() ? 'animate-shake' : ''}>
        <Field
          label={t('chores.titleLabel')}
          placeholder={t('chores.titlePlaceholder')}
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
          autofocus={!props.chore}
          required
        />
      </div>

      <div>
        <span class="label">{t('repeat.label')}</span>
        <RepeatPicker value={rrule()} dtstart={dtstart()} onChange={setRrule} />
      </div>

      <Field label={props.chore ? t('chores.nextOn') : t('chores.starts')} type="date" value={dtstart()} onInput={(e) => {
        const v = e.currentTarget.value;
        if (!v) return;
        setDtstart(v);
        setRrule(alignRule(rrule(), v));
      }} />

      <div class="flex flex-col gap-3">
        <span class="label !mb-0">{t('chores.who')}</span>
        <Segmented
          label={t('chores.who')}
          value={mode()}
          options={[
            { value: 'fixed', label: t('chores.fixed') },
            { value: 'rotate', label: t('chores.rotate') },
          ]}
          onChange={(m) => {
            setMode(m);
            if (m === 'rotate' && assignees().length < 2) setAssignees(everyone());
            if (m === 'fixed') setAssignees(assignees().slice(0, 1));
          }}
        />
        <MemberPicker
          label={t('chores.who')}
          ids={everyone()}
          selected={assignees()}
          multiple={mode() === 'rotate'}
          onChange={setAssignees}
        />
        <Show when={mode() === 'rotate'}>
          <p class="text-sm text-ink-faint">{t('chores.rotateHint')}</p>
        </Show>
      </div>

      <div>
        <span class="label">{t('chores.nextDates')}</span>
        <ol class="flex flex-col divide-y divide-line rounded-2xl border border-line bg-card">
          <For each={preview()}>
            {(d, i) => {
              const who = () => {
                const r = rotationNow();
                return mode() === 'rotate' ? r[i() % Math.max(1, r.length)] : r[0];
              };
              return (
                <li class="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span class="tabular w-5 font-bold text-ink-faint">{i() + 1}</span>
                  <span class="flex-1 font-medium">{formatShortDate(d)}</span>
                  <Show when={who()}>
                    <Avatar id={who()} size="xs" />
                  </Show>
                </li>
              );
            }}
          </For>
        </ol>
      </div>

      <div class="flex gap-3 pt-1">
        <Show when={props.onDelete}>
          <button type="button" class="btn-danger" onClick={() => props.onDelete?.()} aria-label={t('common.delete')}>
            <Icon name="trash" class="size-5" />
          </button>
        </Show>
        <button type="submit" class="btn-accent flex-1">
          {props.chore ? t('common.save') : t('chores.create')}
        </button>
      </div>
    </form>
  );
};
