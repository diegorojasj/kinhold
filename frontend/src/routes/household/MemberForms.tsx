import { type Component, createSignal } from 'solid-js';
import { Field } from '@/components/ui';
import { t } from '@/i18n';
import { haptic } from '@/lib/feedback';
import { log } from '@/stores/activity';
import { addMember, type Member, nextFreeColor, removeMember, updateMember } from '@/stores/household';
import { toast } from '@/stores/toast';

import { ColorPicker } from '@/components/settings';

export const AddMemberForm: Component<{ onDone: () => void }> = (props) => {
  const [name, setName] = createSignal('');
  const [color, setColor] = createSignal(nextFreeColor());
  return (
    <form
      class="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const n = name().trim();
        if (!n) return;
        const id = addMember(n, color());
        log('member.joined', {}, id);
        haptic('success');
        toast({ emoji: '👋', message: t('household.memberAdded', { name: n }) });
        props.onDone();
      }}
    >
      <div class="flex justify-center">
        <span class="flex size-20 items-center justify-center rounded-full text-3xl font-bold text-white" style={{ background: color() }}>
          {(name().trim()[0] ?? '?').toUpperCase()}
        </span>
      </div>
      <Field
        label={t('household.memberName')}
        placeholder={t('household.memberNamePlaceholder')}
        value={name()}
        onInput={(e) => setName(e.currentTarget.value)}
        autofocus
        required
      />
      <div>
        <span class="label">{t('config.color')}</span>
        <ColorPicker value={color()} onChange={setColor} />
      </div>
      <p class="text-sm text-ink-soft">{t('household.addMemberHint')}</p>
      <button type="submit" class="btn-accent" disabled={!name().trim()}>
        {t('household.addMember')}
      </button>
    </form>
  );
};

export const MemberForm: Component<{ member: Member; onDone: () => void }> = (props) => {
  const [name, setName] = createSignal(props.member.name);
  const [color, setColor] = createSignal(props.member.color);
  const [confirm, setConfirm] = createSignal(false);
  return (
    <form
      class="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name().trim()) return;
        updateMember(props.member.id, { name: name().trim(), color: color() });
        haptic('success');
        props.onDone();
      }}
    >
      <Field label={t('household.memberName')} value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
      <div>
        <span class="label">{t('config.color')}</span>
        <ColorPicker value={color()} onChange={setColor} />
      </div>
      <div class="flex gap-3">
        <button
          type="button"
          class="btn-danger"
          onClick={() => {
            if (!confirm()) {
              setConfirm(true);
              haptic('warn');
              return;
            }
            removeMember(props.member.id);
            toast({ emoji: '👋', message: t('household.memberRemoved', { name: props.member.name }) });
            props.onDone();
          }}
        >
          {confirm() ? t('common.tapToConfirm') : t('household.remove')}
        </button>
        <button type="submit" class="btn-accent flex-1" disabled={!name().trim()}>
          {t('common.save')}
        </button>
      </div>
    </form>
  );
};
