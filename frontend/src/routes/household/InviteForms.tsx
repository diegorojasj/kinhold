import { type Component, createResource, createSignal, For, Match, Show, Switch } from 'solid-js';
import { Icon } from '@/components/Icon';
import { Field } from '@/components/ui';
import { formatDate, t } from '@/i18n';
import { haptic } from '@/lib/feedback';
import { uid } from '@/lib/persist';
import {
  ApiError,
  createInvite,
  downloadHousehold,
  type InvitePreview,
  type JoinAs,
  joinHousehold,
  previewInvite,
} from '@/lib/sync';
import { adoptHousehold, household, MEMBER_COLORS, me, switchHousehold } from '@/stores/household';
import { toast } from '@/stores/toast';

/** Server errors in words; anything that isn't an answer from the server means "no connection". */
const problem = (e: unknown) => {
  if (!(e instanceof ApiError) || e.unreachable || !navigator.onLine) return t('household.needsConnection');
  switch (e.code) {
    case 'invite_not_found':
      return t('household.codeNotFound');
    case 'invite_expired':
      return t('household.codeExpired');
    case 'invite_used':
      return t('household.codeUsed');
    case 'member_not_found':
      return t('household.memberGone');
    default:
      return t('household.somethingWrong');
  }
};

/** Shown in two groups of four so it's easy to read out: ABCD-2345. */
const pretty = (code: string) => code.replace(/^(.{4})(.+)$/, '$1-$2');

const Problem: Component<{ message: string }> = (props) => (
  <p role="alert" class="flex items-center gap-2 rounded-2xl bg-coral/12 px-4 py-3 text-sm font-medium">
    <Icon name="wifiOff" class="size-4 shrink-0" />
    {props.message}
  </p>
);

// Web Share API: phones' share sheet. Not in every browser (nor Android's WebView), so copying is the fallback.
const canShare = typeof navigator.share === 'function';

/** A3: creates a single-use code for the current household. */
export const InviteSheet: Component = () => {
  const name = household().name;
  const [invite] = createResource(() => createInvite(household().id));

  const share = async (code: string) => {
    const text = t('household.inviteShareText', { name, code: pretty(code) });
    if (canShare) {
      await navigator.share({ text }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(text);
    toast({ emoji: '📋', message: t('household.inviteCopied') });
  };

  return (
    <div class="flex flex-col gap-5">
      <Switch>
        <Match when={invite.loading}>
          <p class="py-6 text-center text-ink-soft">{t('household.inviteCreating')}</p>
        </Match>
        <Match when={invite.error}>
          <Problem message={problem(invite.error)} />
        </Match>
        <Match when={invite()}>
          {(inv) => (
            <>
              <div class="rounded-3xl bg-sunk px-5 py-6 text-center">
                <span class="label">{t('household.inviteCode')}</span>
                <span class="tabular block font-display text-4xl font-extrabold tracking-widest select-all">{pretty(inv().code)}</span>
                <span class="mt-2 block text-sm text-ink-soft">
                  {t('household.inviteValid', { date: formatDate(new Date(inv().expiresAt)) })}
                </span>
              </div>
              <button type="button" class="btn-accent" onClick={() => void share(inv().code)}>
                <Icon name={canShare ? 'link' : 'copy'} class="size-5" />
                {canShare ? t('household.inviteShare') : t('household.inviteCopy')}
              </button>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
};

/** A3/A4: enter a code, say who you are, and the household downloads onto this device. */
export const JoinForm: Component<{ onDone: () => void }> = (props) => {
  const [code, setCode] = createSignal('');
  const [preview, setPreview] = createSignal<InvitePreview>();
  const [who, setWho] = createSignal<string>('new');
  const [name, setName] = createSignal(me()?.name ?? '');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const attempt = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      haptic('warn');
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  };

  const lookUp = () =>
    attempt(async () => {
      const p = await previewInvite(code());
      setPreview(p);
      setWho('new');
    });

  const join = (p: InvitePreview) =>
    attempt(async () => {
      const color = MEMBER_COLORS.find((c) => !p.members.some((m) => m.color === c)) ?? MEMBER_COLORS[0];
      const as: JoinAs = who() === 'new' ? { member: { id: uid(), name: name().trim(), color } } : { memberId: who() };
      const joined = await joinHousehold(code(), as);
      adoptHousehold(joined.householdId, joined.memberId);
      await downloadHousehold(joined.householdId);
      switchHousehold(joined.householdId);
      haptic('success');
      toast({ emoji: p.emoji, message: t('household.joined', { name: p.name }) });
      props.onDone();
    });

  return (
    <Show
      when={preview()}
      fallback={
        <form
          class="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void lookUp();
          }}
        >
          <Field
            label={t('household.joinCode')}
            placeholder={t('household.joinCodePlaceholder')}
            value={code()}
            onInput={(e) => setCode(e.currentTarget.value)}
            autocapitalize="characters"
            autocomplete="off"
            spellcheck={false}
            class="field tabular text-center font-display text-2xl tracking-widest uppercase"
            autofocus
            required
          />
          <Show when={error()}>{(m) => <Problem message={m()} />}</Show>
          <button type="submit" class="btn-accent" disabled={busy() || code().replace(/[^a-z0-9]/gi, '').length < 8}>
            {t('household.joinContinue')}
          </button>
        </form>
      }
    >
      {(p) => (
        <form
          class="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void join(p());
          }}
        >
          <div>
            <p class="font-display text-lg font-bold">
              {p().emoji} {t('household.joinWho', { name: p().name })}
            </p>
            <p class="mt-1 text-sm text-ink-soft">{t('household.joinWhoHint')}</p>
          </div>
          <div role="radiogroup" class="flex flex-col gap-2">
            <For each={p().members}>
              {(m) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={who() === m.id}
                  class="flex items-center gap-3 rounded-2xl border-2 border-line px-4 py-3 text-left aria-checked:border-(--accent)"
                  onClick={() => setWho(m.id)}
                >
                  <span class="flex size-9 items-center justify-center rounded-full font-bold text-white" style={{ background: m.color }}>
                    {(m.name.trim()[0] ?? '?').toUpperCase()}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-semibold">{m.name}</span>
                    <Show when={m.linked}>
                      <span class="block text-xs text-ink-faint">{t('household.joinOnDevice')}</span>
                    </Show>
                  </span>
                </button>
              )}
            </For>
            <button
              type="button"
              role="radio"
              aria-checked={who() === 'new'}
              class="flex items-center gap-3 rounded-2xl border-2 border-line px-4 py-3 text-left aria-checked:border-(--accent)"
              onClick={() => setWho('new')}
            >
              <span class="flex size-9 items-center justify-center rounded-full bg-sunk">
                <Icon name="plus" class="size-5" />
              </span>
              <span class="font-semibold">{t('household.joinNew')}</span>
            </button>
          </div>
          <Show when={who() === 'new'}>
            <Field label={t('household.joinYourName')} value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
          </Show>
          <Show when={error()}>{(m) => <Problem message={m()} />}</Show>
          <button type="submit" class="btn-accent" disabled={busy() || (who() === 'new' && !name().trim())}>
            {t('household.joinButton', { name: p().name })}
          </button>
        </form>
      )}
    </Show>
  );
};
