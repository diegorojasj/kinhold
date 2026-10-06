import { createSignal, Show, type JSX, type ParentComponent } from 'solid-js';
import { haptic } from '@/lib/feedback';
import { Icon, type IconName } from './Icon';

interface SwipeAction {
  icon: IconName;
  label: string;
  /** CSS colour of the revealed background. */
  color: string;
  run: () => void;
}

/**
 * Swipe a row sideways to act on it (Mail / Todoist pattern): right = `start` action, left = `end` action.
 * Vertical scrolling still works; the gesture only engages once the finger clearly moves sideways.
 * Every action is also reachable without swiping, so this is a shortcut, not the only way.
 */
export const SwipeRow: ParentComponent<{ start?: SwipeAction; end?: SwipeAction; class?: string }> = (props) => {
  let row!: HTMLDivElement;
  const [dx, setDx] = createSignal(0);
  const [settling, setSettling] = createSignal(false);
  let startX = 0;
  let startY = 0;
  let mode: 'idle' | 'pending' | 'swiping' | 'scrolling' = 'idle';
  let armed = false;
  let swallowClick = false;

  const threshold = () => Math.min(120, row.offsetWidth * 0.3);

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    mode = 'pending';
    armed = false;
    swallowClick = false;
    setSettling(false);
  };

  const onMove = (e: PointerEvent) => {
    if (mode === 'idle' || mode === 'scrolling') return;
    const x = e.clientX - startX;
    const y = e.clientY - startY;
    if (mode === 'pending') {
      if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) {
        mode = 'scrolling';
        return;
      }
      if (Math.abs(x) < 10) return;
      mode = 'swiping';
      row.setPointerCapture(e.pointerId);
    }
    // Only allow directions that have an action; resist past the threshold.
    let next = x;
    if ((x > 0 && !props.start) || (x < 0 && !props.end)) next = 0;
    const limit = threshold();
    if (Math.abs(next) > limit) next = Math.sign(next) * (limit + (Math.abs(next) - limit) * 0.35);
    setDx(next);
    const nowArmed = Math.abs(next) >= limit;
    if (nowArmed !== armed) {
      armed = nowArmed;
      if (armed) haptic();
    }
  };

  const onUp = () => {
    if (mode === 'swiping') {
      swallowClick = true;
      const action = armed ? (dx() > 0 ? props.start : props.end) : undefined;
      setSettling(true);
      if (action) {
        setDx(Math.sign(dx()) * row.offsetWidth);
        setTimeout(() => {
          action.run();
          setSettling(false);
          setDx(0);
        }, 180);
      } else {
        setDx(0);
      }
    }
    mode = 'idle';
  };

  // The OS took the gesture over (edge swipe, dialog): snap back without running the action.
  const onCancel = () => {
    setSettling(true);
    setDx(0);
    mode = 'idle';
    armed = false;
  };

  const bg = (): { action?: SwipeAction; side: 'start' | 'end' } =>
    dx() > 0 ? { action: props.start, side: 'start' } : { action: props.end, side: 'end' };

  const content: JSX.Element = (
    <div
      ref={(el) => {
        row = el;
        // A swipe ends with a click on whatever was under the finger; swallow it (capture phase).
        el.addEventListener(
          'click',
          (e) => {
            if (!swallowClick) return;
            e.stopPropagation();
            e.preventDefault();
            swallowClick = false;
          },
          true,
        );
      }}
      class="relative touch-pan-y"
      style={{
        transform: `translateX(${dx()}px)`,
        transition: settling() ? 'transform 220ms var(--ease-out-soft)' : 'none',
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
    >
      {props.children}
    </div>
  );

  return (
    <div class={`relative overflow-hidden ${props.class ?? ''}`}>
      <Show when={dx() !== 0 && bg().action}>
        {(action) => (
          <div
            aria-hidden="true"
            class={`absolute inset-0 flex items-center px-6 text-white ${bg().side === 'start' ? 'justify-start' : 'justify-end'}`}
            style={{ background: action().color }}
          >
            <span
              class="flex items-center gap-2 font-semibold transition-transform"
              style={{ transform: `scale(${Math.min(1, 0.6 + Math.abs(dx()) / (threshold() * 2.5))})` }}
            >
              <Icon name={action().icon} class="size-6" stroke={2} />
              {action().label}
            </span>
          </div>
        )}
      </Show>
      {content}
    </div>
  );
};
