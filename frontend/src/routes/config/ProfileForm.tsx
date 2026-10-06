import { type Component, createSignal } from 'solid-js';
import { Field } from '@/components/ui';
import { t } from '@/i18n';
import { haptic } from '@/lib/feedback';
import { MEMBER_COLORS, me, updateProfile } from '@/stores/household';
import { toast } from '@/stores/toast';

import { ColorPicker } from '@/components/settings';

/* ── Sheets ─────────────────────────────────────────────────────────── */

export const ProfileForm: Component<{ onDone: () => void }> = (props) => {
  const [name, setName] = createSignal(me()?.name ?? '');
  const [color, setColor] = createSignal(me()?.color ?? MEMBER_COLORS[0]);
  return (
    <form
      class="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name().trim()) return;
        updateProfile({ name: name().trim(), color: color() });
        haptic('success');
        toast({ emoji: '✅', message: t('common.saved') });
        props.onDone();
      }}
    >
      <div class="flex justify-center">
        <span class="flex size-20 items-center justify-center rounded-full text-3xl font-bold text-white" style={{ background: color() }}>
          {(name().trim()[0] ?? '?').toUpperCase()}
        </span>
      </div>
      <Field label={t('config.yourName')} value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
      <div>
        <span class="label">{t('config.color')}</span>
        <ColorPicker value={color()} onChange={setColor} />
      </div>
      <button type="submit" class="btn-accent" disabled={!name().trim()}>
        {t('common.save')}
      </button>
    </form>
  );
};
