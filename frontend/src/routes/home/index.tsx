import { A } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { ACTIVITY_META, ActivityList, type Section } from '@/components/Activity';
import { ACCENTS } from '@/components/AppShell';
import { Icon, type IconName } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { Choice, ChoiceGroup, EmptyState, SectionTitle } from '@/components/ui';
import { formatDay, formatLongDate, formatMoneyShort, t } from '@/i18n';
import { today } from '@/lib/dates';
import { activity } from '@/stores/activity';
import { bills, daysLeft, urgency } from '@/stores/bills';
import { assigneeOf, bucketOf, chores, householdStreak } from '@/stores/chores';
import { currency, myId, me, member, members } from '@/stores/household';
import { netBalances, simplifyDebts } from '@/stores/money';
import { items } from '@/stores/shopping';

/* ── Snapshot tiles ─────────────────────────────────────────────────── */

const Tile: Component<{
  href: string;
  icon: IconName;
  accent: { fill: string; ink: string };
  label: string;
  value: JSX.Element;
  hint: JSX.Element;
}> = (props) => (
  <A
    href={props.href}
    class="card group relative flex min-h-36 flex-col overflow-hidden p-4 transition-transform active:scale-[0.97]"
    style={{ '--tile': props.accent.fill, '--tile-ink': props.accent.ink }}
  >
    <span aria-hidden="true" class="absolute -top-8 -right-8 size-24 rounded-full bg-(--tile) opacity-10 transition-transform group-hover:scale-110" />
    <span class="flex items-center justify-between">
      <span class="flex size-9 items-center justify-center rounded-xl bg-(--tile)/14 text-(--tile-ink)">
        <Icon name={props.icon} class="size-5" stroke={2} />
      </span>
      <Icon name="chevron" class="size-4 text-ink-faint" />
    </span>
    <span class="mt-auto pt-3">
      <span class="eyebrow block">{props.label}</span>
      <span class="mt-0.5 block font-display text-xl leading-tight font-extrabold tracking-tight">{props.value}</span>
      <span class="mt-0.5 block truncate text-sm text-ink-soft">{props.hint}</span>
    </span>
  </A>
);

/* ── Screen ─────────────────────────────────────────────────────────── */

type Filter = 'all' | Exclude<Section, 'household'>;

const Home: Component = () => {
  const [filter, setFilter] = createSignal<Filter>('all');

  const greeting = () => {
    const h = new Date().getHours();
    const name = me()?.name ?? '';
    if (h < 12) return t('home.morning', { name });
    if (h < 19) return t('home.afternoon', { name });
    return t('home.evening', { name });
  };

  // Snapshot of every section.
  const toGet = () => items().filter((i) => !i.checked).length;
  const dueChores = createMemo(() => chores().filter((c) => bucketOf(c) === 'today'));
  const myChores = () => dueChores().filter((c) => assigneeOf(c) === myId());
  const net = createMemo(() => netBalances(members().map((m) => m.id)));
  const balance = () => net().get(myId()) ?? 0;
  const nextBill = () => bills()[0];
  const overdueBills = () => bills().filter((b) => urgency(b) === 'overdue');

  // Bills tile: overdue first, otherwise the next bill due.
  const billValue = () => {
    const late = overdueBills().length;
    if (late) return <span class="text-coral">{t('home.billsOverdue', late)}</span>;
    const next = nextBill();
    return next ? <span class="tabular">{formatMoneyShort(next.amountCents, currency())}</span> : t('home.billsNone');
  };
  const billHint = () => {
    const late = overdueBills();
    if (late.length) return late.map((b) => b.name).join(', ');
    const next = nextBill();
    if (!next) return t('home.billsHint');
    const when = daysLeft(next) === 0 ? t('bills.todayShort') : formatDay(next.nextDue, today());
    return `${next.emoji} ${next.name} · ${when.toLowerCase()}`;
  };

  /** The single most useful thing to do now (one clear next step beats a to-do wall). */
  const nextUp = createMemo((): { emoji: string; text: string; href: string } | undefined => {
    const late = overdueBills()[0];
    if (late) return { emoji: late.emoji, text: t('home.nudgeBill', { name: late.name }), href: '/bills' };
    const chore = myChores()[0];
    if (chore) return { emoji: chore.emoji, text: t('home.nudgeChore', { name: chore.title }), href: '/chores' };
    const debt = simplifyDebts(net()).find((d) => d.from === myId());
    if (debt)
      return {
        emoji: '🤝',
        text: t('home.nudgeOwe', { name: member(debt.to)?.name ?? '', amount: formatMoneyShort(debt.amountCents, currency()) }),
        href: '/money',
      };
    const soon = bills().find((b) => urgency(b) === 'today' || urgency(b) === 'soon');
    if (soon) return { emoji: soon.emoji, text: t('home.nudgeBillSoon', { name: soon.name, when: formatDay(soon.nextDue, today()).toLowerCase() }), href: '/bills' };
    return undefined;
  });

  // Activity feed, filtered and grouped by day.
  const feed = createMemo(() => activity().filter((a) => filter() === 'all' || ACTIVITY_META[a.type].section === filter()));
  const byDay = createMemo(() => {
    const groups: { day: string; events: ReturnType<typeof activity> }[] = [];
    for (const a of feed()) {
      const d = new Date(a.at);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const last = groups.at(-1);
      if (last?.day === day) last.events.push(a);
      else groups.push({ day, events: [a] });
    }
    return groups;
  });

  const filters: { id: Filter; label: () => string }[] = [
    { id: 'all', label: () => t('home.filterAll') },
    { id: 'list', label: () => t('nav.shopping') },
    { id: 'chores', label: () => t('nav.chores') },
    { id: 'money', label: () => t('nav.money') },
    { id: 'bills', label: () => t('nav.bills') },
  ];

  return (
    <>
      <PageHeader title={greeting()} subtitle={formatLongDate(today())} />

      {/* Next up */}
      <Show when={nextUp()}>
        {(n) => (
          <A
            href={n().href}
            class="mb-4 flex animate-rise items-center gap-4 rounded-[1.75rem] bg-[#1d1a16] p-4 pr-5 text-[#f5f0e8] transition-transform active:scale-[0.98] dark:bg-card dark:text-ink dark:ring-1 dark:ring-line"
          >
            <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl">{n().emoji}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-xs font-bold tracking-[0.12em] uppercase opacity-60">{t('home.nextUp')}</span>
              <span class="block font-semibold leading-snug">{n().text}</span>
            </span>
            <Icon name="arrow" class="size-5 shrink-0 opacity-70" stroke={2} />
          </A>
        )}
      </Show>

      {/* Today at home */}
      <div class="grid animate-rise grid-cols-2 gap-3">
        <Tile
          href="/list"
          icon="list"
          accent={ACCENTS.list}
          label={t('nav.shopping')}
          value={toGet() ? t('home.toGet', toGet()) : t('home.listDone')}
          hint={toGet() ? t('home.listHint') : t('home.listDoneHint')}
        />
        <Tile
          href="/chores"
          icon="chores"
          accent={ACCENTS.chores}
          label={t('nav.chores')}
          value={dueChores().length ? t('home.choresDue', dueChores().length) : t('home.choresDone')}
          hint={
            householdStreak() > 0
              ? `🔥 ${t('home.streak', householdStreak())}`
              : myChores().length
                ? t('home.yourTurns', myChores().length)
                : t('home.choresHint')
          }
        />
        <Tile
          href="/money"
          icon="money"
          accent={ACCENTS.money}
          label={t('nav.money')}
          value={
            <span class="tabular" style={{ color: balance() > 0 ? 'var(--color-basil)' : balance() < 0 ? 'var(--color-coral)' : undefined }}>
              {balance() === 0 ? t('home.settled') : formatMoneyShort(Math.abs(balance()), currency())}
            </span>
          }
          hint={balance() > 0 ? t('home.owedToYou') : balance() < 0 ? t('home.youOwe') : t('home.settledHint')}
        />
        <Tile
          href="/bills"
          icon="bills"
          accent={ACCENTS.bills}
          label={t('nav.bills')}
          value={billValue()}
          hint={billHint()}
        />
      </div>

      {/* Activity (F3) */}
      <SectionTitle count={feed().length}>{t('home.activity')}</SectionTitle>
      <ChoiceGroup label={t('home.filterLabel')} class="no-scrollbar -mx-4 mb-1 flex gap-2 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
        <For each={filters}>
          {(f) => (
            <Choice checked={filter() === f.id} onChange={() => setFilter(f.id)} class="chip cursor-pointer">
              {f.label()}
            </Choice>
          )}
        </For>
      </ChoiceGroup>

      <Show when={feed().length} fallback={<EmptyState emoji="🌱" title={t('home.emptyTitle')} text={t('home.empty')} />}>
        <For each={byDay()}>
          {(g) => (
            <section>
              <h3 class="eyebrow mt-4 mb-2 px-1">{formatDay(g.day, today())}</h3>
              <div class="card px-4">
                <ActivityList events={g.events} />
              </div>
            </section>
          )}
        </For>
        <p class="mt-6 text-center text-sm text-ink-faint">{t('home.feedHint')}</p>
      </Show>
    </>
  );
};

export default Home;
