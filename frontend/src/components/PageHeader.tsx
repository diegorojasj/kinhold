import { A } from '@solidjs/router';
import { Show, type JSX, type ParentComponent } from 'solid-js';
import { household } from '@/stores/household';

/** Screen title with the household chip above it and an optional summary line under it. */
export const PageHeader: ParentComponent<{ title: string; subtitle?: JSX.Element }> = (props) => (
  <header class="flex items-end justify-between gap-4 pt-6 pb-5 md:pt-10">
    <div class="min-w-0">
      <A
        href="/household"
        class="mb-1 inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-ink-faint transition-colors hover:text-ink md:hidden"
      >
        <span>{household().emoji}</span>
        <span class="truncate">{household().name}</span>
      </A>
      <h1 class="font-display text-[2rem] leading-tight font-extrabold tracking-tight md:text-4xl">{props.title}</h1>
      <Show when={props.subtitle}>
        <p class="mt-1 text-ink-soft">{props.subtitle}</p>
      </Show>
    </div>
    {props.children}
  </header>
);
