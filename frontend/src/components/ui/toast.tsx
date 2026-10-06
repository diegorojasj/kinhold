import { Show, type Component } from 'solid-js';
import { t } from '@/i18n';
import { haptic } from '@/lib/feedback';
import { toasts } from '@/stores/toast';
import { Icon } from '@/components/Icon';

/* ── Toasts ─────────────────────────────────────────────────────────── */

export const Toaster: Component = () => (
  <div
    class="pointer-events-none fixed inset-x-0 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-28 md:left-60"
    role="status"
    aria-live="polite"
  >
    <Show when={toasts.current()} keyed>
      {(toast) => (
        <div class="pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-2xl bg-ink py-2.5 pr-2.5 pl-4 text-paper shadow-2xl">
          <Show when={toast.emoji}>
            <span class="text-xl">{toast.emoji}</span>
          </Show>
          <span class="min-w-0 flex-1 text-sm font-medium">{toast.message}</span>
          <Show
            when={toast.action}
            fallback={
              <button type="button" class="flex size-11 items-center justify-center rounded-xl opacity-60 hover:opacity-100" aria-label={t('common.close')} onClick={toasts.dismiss}>
                <Icon name="x" class="size-4" />
              </button>
            }
          >
            {(action) => (
              <button
                type="button"
                class="flex min-h-11 items-center gap-1.5 rounded-xl bg-paper/15 px-3.5 text-sm font-bold transition-colors hover:bg-paper/25"
                onClick={() => {
                  action().run();
                  haptic();
                  toasts.dismiss();
                }}
              >
                <Icon name="undo" class="size-4" stroke={2} />
                {action().label}
              </button>
            )}
          </Show>
        </div>
      )}
    </Show>
  </div>
);

/** Shows an undo toast for an action that returned an undo function. */
export function undoToast(message: string, undo: () => void, emoji?: string) {
  toasts.show({ message, emoji, action: { label: t('common.undo'), run: undo } });
}
