import { createRoot, createSignal } from 'solid-js';

export interface Toast {
  id: number;
  message: string;
  emoji?: string;
  action?: { label: string; run: () => void };
}

/**
 * One toast at a time, Gmail-style: destructive actions happen immediately and offer "Undo"
 * instead of asking "Are you sure?" first.
 */
export const toasts = createRoot(() => {
  const [current, setCurrent] = createSignal<Toast | undefined>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let next = 1;

  const dismiss = () => {
    clearTimeout(timer);
    setCurrent(undefined);
  };

  const show = (toast: Omit<Toast, 'id'>, ms = toast.action ? 5000 : 2800) => {
    clearTimeout(timer);
    setCurrent({ ...toast, id: next++ });
    timer = setTimeout(dismiss, ms);
  };

  return { current, show, dismiss };
});

export const toast = toasts.show;
