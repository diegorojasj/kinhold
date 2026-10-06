import { prefs } from '@/stores/prefs';

/**
 * Small, immediate rewards for finishing things: a haptic tap, a soft synthesized "pop"
 * and, for bigger wins, a burst of confetti. All of it is optional (Config) and
 * respects reduced-motion.
 */

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function haptic(kind: 'tap' | 'success' | 'warn' = 'tap') {
  if (!prefs.state.haptics || !('vibrate' in navigator)) return;
  navigator.vibrate(kind === 'tap' ? 8 : kind === 'success' ? [10, 40, 18] : [30, 30, 30]);
}

let ctx: AudioContext | undefined;

/** Two quick sine blips; `up` sounds like a tick, `down` like an untick. */
export function sound(kind: 'up' | 'down' | 'win' = 'up') {
  if (!prefs.state.sounds) return;
  try {
    ctx ??= new AudioContext();
    const audio = ctx;
    if (audio.state === 'suspended') void audio.resume();
    const notes = kind === 'win' ? [660, 880, 1320] : kind === 'up' ? [520, 780] : [600, 420];
    const t0 = audio.currentTime;
    notes.forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const start = t0 + i * 0.06;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.06, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.14);
    });
  } catch {
    // Audio unavailable: silently skip.
  }
}

const CONFETTI_COLORS = ['#2f9a5c', '#6a55d6', '#d98a12', '#e0573f', '#2f86c9', '#f2c94c'];

/** Confetti burst from a point (defaults to the centre of the screen). */
export function confetti(origin?: { x: number; y: number }, count = 28) {
  if (reducedMotion()) return;
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 3;
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100;overflow:hidden';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 140;
    const size = 5 + Math.random() * 6;
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size * 0.6}px;border-radius:2px;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`;
    layer.append(p);
    p.animate(
      [
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 120}px) rotate(${Math.random() * 720 - 360}deg)`,
          opacity: 0,
        },
      ],
      { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'forwards' },
    );
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1500);
}

/** Centre of an element, for aiming confetti at what was just completed. */
export function centerOf(el: Element | null | undefined) {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Celebrate a completed task: haptic + sound + (optional) confetti. */
export function celebrate(from?: Element | null, big = false) {
  haptic('success');
  sound(big ? 'win' : 'up');
  if (big) confetti(centerOf(from), 48);
  else confetti(centerOf(from), 16);
}
