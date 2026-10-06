import { createEffect, createSignal, on, onCleanup, Show, type JSX, type ParentComponent } from 'solid-js';
import { Portal } from 'solid-js/web';
import { t } from '@/i18n';
import { Icon } from './Icon';

/**
 * Modal editor: a bottom sheet you can drag down on phones, a centred dialog on wider screens.
 * Built on <dialog> for focus trapping, Esc and the top layer. Content mounts fresh on every open,
 * so forms always start from the current data.
 */
export const Sheet: ParentComponent<{
  open: boolean;
  onClose: () => void;
  title: string;
  /** Accent colour for focus rings and primary buttons inside the sheet. */
  accent?: string;
  footer?: JSX.Element;
}> = (props) => {
  let dialog!: HTMLDialogElement;
  let panel!: HTMLDivElement;
  // 0 = unmounted; a new number on every open remounts the content (fresh form state),
  // even when reopened during the close animation.
  const [mounted, setMounted] = createSignal(0);
  let generation = 0;

  const finishClose = () => {
    panel.removeEventListener('animationend', onPanelAnimationEnd);
    delete dialog.dataset.closing;
    panel.style.removeProperty('--drag');
    panel.style.transform = '';
    if (dialog.open) dialog.close();
    setMounted(0);
  };
  // Child animations bubble up too; only the panel's own exit animation ends the close.
  const onPanelAnimationEnd = (e: AnimationEvent) => {
    if (e.target === panel && dialog.dataset.closing !== undefined) finishClose();
  };

  createEffect(
    on(
      () => props.open,
      (open) => {
        // Reopened while the close animation was still running: cancel the pending close.
        panel.removeEventListener('animationend', onPanelAnimationEnd);
        if (open) {
          setMounted(++generation);
          delete dialog.dataset.closing;
          if (!dialog.open) dialog.showModal();
        } else if (dialog.open) {
          const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (reduce) return finishClose();
          dialog.dataset.closing = '';
          panel.addEventListener('animationend', onPanelAnimationEnd);
        }
      },
    ),
  );
  onCleanup(() => dialog?.open && dialog.close());

  // Drag the handle down to dismiss (phones).
  let startY = 0;
  let dragging = false;
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && window.innerWidth >= 768) return;
    dragging = true;
    startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panel.style.transition = 'none';
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dy = Math.max(0, e.clientY - startY);
    panel.style.transform = `translateY(${dy}px)`;
    panel.style.setProperty('--drag', `${dy}px`);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const dy = Math.max(0, e.clientY - startY);
    panel.style.transition = 'transform 250ms var(--ease-out-soft)';
    if (dy > 110) {
      props.onClose();
    } else {
      panel.style.transform = '';
      panel.style.removeProperty('--drag');
    }
  };

  return (
    <Portal>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is a pointer shortcut; Esc (native dialog cancel) is the keyboard equivalent */}
      <dialog
        ref={dialog}
        class="sheet"
        aria-label={props.title}
        style={props.accent ? { '--accent': props.accent } : undefined}
        // Closed natively mid-animation (no animationend will come): clean up anyway.
        onClose={() => mounted() && !props.open && finishClose()}
        onCancel={(e) => {
          e.preventDefault();
          props.onClose();
        }}
        onClick={(e) => {
          // A click on the dialog box itself (outside the panel) is a backdrop click.
          if (e.target === dialog) props.onClose();
        }}
      >
        <div
          ref={panel}
          class="sheet-panel flex max-h-[94dvh] flex-col overflow-hidden rounded-t-[2rem] bg-paper pb-safe shadow-2xl md:max-h-[86dvh] md:rounded-[2rem] md:pb-0"
        >
          <div
            class="flex cursor-grab touch-none justify-center pt-3 pb-1 md:hidden"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <span class="h-1.5 w-10 rounded-full bg-line" />
          </div>
          <header class="flex items-center justify-between gap-3 px-5 pt-1 pb-3 md:px-6 md:pt-5">
            <h2 class="font-display text-xl font-bold tracking-tight">{props.title}</h2>
            <button type="button" class="icon-btn -mr-2 bg-sunk" aria-label={t('common.close')} onClick={() => props.onClose()}>
              <Icon name="x" class="size-5" />
            </button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 md:px-6">
            <Show when={mounted()} keyed>
              {(_generation) => props.children}
            </Show>
          </div>
          <Show when={mounted() && props.footer}>
            <footer class="border-t border-line px-5 py-4 md:px-6">{props.footer}</footer>
          </Show>
        </div>
      </dialog>
    </Portal>
  );
};

/**
 * Open/close state for a sheet that edits one thing. The value is kept while the sheet animates
 * closed, so its content doesn't vanish mid-animation.
 */
export function createSheet<T>() {
  const [open, setOpen] = createSignal(false);
  const [value, setValue] = createSignal<T>();
  return {
    open,
    value,
    show: (v: T) => {
      setValue(() => v);
      setOpen(true);
    },
    close: () => setOpen(false),
  };
}
