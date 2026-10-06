import { type Component, For, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { Card, Row } from '@/components/settings';
import { createSheet, Sheet } from '@/components/Sheet';
import { Avatar, AvatarStack } from '@/components/ui';
import { t } from '@/i18n';
import { haptic } from '@/lib/feedback';
import { household, households, isOwner, leaveHousehold, ME, member, members, switchHousehold } from '@/stores/household';
import { toast } from '@/stores/toast';
import { HouseholdForm } from './HouseholdForm';
import { AddMemberForm, MemberForm } from './MemberForms';

type SheetKind = { kind: 'edit' | 'create' | 'addMember' } | { kind: 'member'; id: string };

/** Everything shared by the people in a household (A2–A4): details, members, switching, leaving. */
const Household: Component = () => {
  const sheet = createSheet<SheetKind>();
  const others = () => households().filter((h) => h.id !== household().id);

  const sheetTitle = () => {
    const v = sheet.value();
    switch (v?.kind) {
      case 'edit':
        return t('household.editHousehold');
      case 'create':
        return t('household.newHousehold');
      case 'addMember':
        return t('household.addMember');
      case 'member':
        return member(v.id)?.name ?? '';
      default:
        return '';
    }
  };

  const switchTo = (id: string) => {
    const h = households().find((x) => x.id === id);
    switchHousehold(id);
    haptic('success');
    if (h) toast({ emoji: h.emoji, message: t('household.switched', { name: h.name }) });
  };

  const leave = () => {
    const name = household().name;
    leaveHousehold(household().id);
    toast({ emoji: '👋', message: t('household.left', { name }) });
  };

  return (
    <>
      <PageHeader title={t('household.title')} />

      {/* Details */}
      <button type="button" class="card flex w-full animate-rise items-center gap-4 p-5 text-left" onClick={() => sheet.show({ kind: 'edit' })}>
        <span class="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-(--accent)/10 text-4xl" aria-hidden="true">
          {household().emoji}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-display text-xl font-bold">{household().name}</span>
          <span class="block truncate text-sm text-ink-soft">
            {household().currency} · {household().timezone.replace(/_/g, ' ')}
          </span>
          <span class="mt-1.5 flex items-center gap-1.5 text-xs text-ink-soft">
            <AvatarStack ids={members().slice(0, 5).map((m) => m.id)} size="xs" />
            {t('household.members', members().length)}
          </span>
        </span>
        <span class="icon-btn bg-sunk">
          <Icon name="pencil" class="size-5" />
          <span class="sr-only">{t('household.edit')}</span>
        </span>
      </button>

      {/* Members */}
      <Card title={t('household.members', members().length)}>
        <ul>
          <For each={members()}>
            {(m) => (
              <li class="border-b border-line last:border-0">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
                  disabled={m.id === ME || !isOwner()}
                  onClick={() => sheet.show({ kind: 'member', id: m.id })}
                >
                  <Avatar id={m.id} />
                  <span class="min-w-0 flex-1 truncate font-semibold">
                    {m.name}
                    <Show when={m.id === ME}>
                      <span class="font-normal text-ink-faint"> ({t('common.you')})</span>
                    </Show>
                  </span>
                  <span class={`rounded-full px-2.5 py-1 text-xs font-bold ${m.role === 'owner' ? 'bg-(--accent)/12 text-(--accent-ink)' : 'bg-sunk text-ink-soft'}`}>
                    {m.role === 'owner' ? t('household.owner') : t('household.member')}
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>
        <button type="button" class="btn-soft my-2 w-full" onClick={() => sheet.show({ kind: 'addMember' })}>
          <Icon name="plus" class="size-5" stroke={2.25} />
          {t('household.addMember')}
        </button>
      </Card>

      {/* Switch / create (A4) */}
      <Card title={t('household.yours')} action={{ label: t('household.newHousehold'), run: () => sheet.show({ kind: 'create' }) }}>
        <Row label={`${household().emoji}  ${household().name}`} hint={t('household.current')}>
          <Icon name="check" class="size-5 text-(--accent-ink)" stroke={2.5} />
        </Row>
        <For each={others()}>
          {(h) => (
            <div class="border-t border-line">
              <Row label={`${h.emoji}  ${h.name}`} hint={t('household.switchTo')} onClick={() => switchTo(h.id)}>
                <Icon name="swap" class="size-5 text-ink-faint" />
              </Row>
            </div>
          )}
        </For>
      </Card>

      {/* Leaving needs somewhere else to go: the app always shows one household. */}
      <Show when={others().length}>
        <Card title={t('household.danger')}>
          <Row icon="logout" label={t('household.leaveHousehold', { name: household().name })} hint={t('household.leaveHint')} onClick={leave} />
        </Card>
      </Show>

      <Sheet open={sheet.open()} onClose={sheet.close} title={sheetTitle()}>
        <Show when={sheet.value()} keyed>
          {(v) => {
            switch (v.kind) {
              case 'edit':
                return <HouseholdForm onDone={sheet.close} />;
              case 'create':
                return <HouseholdForm create onDone={sheet.close} />;
              case 'addMember':
                return <AddMemberForm onDone={sheet.close} />;
              case 'member': {
                const m = member(v.id);
                return m ? <MemberForm member={m} onDone={sheet.close} /> : null;
              }
            }
          }}
        </Show>
      </Sheet>
    </>
  );
};

export default Household;
