import { apiUrl, authHeader } from './api';
import { token } from './device';

/**
 * Live updates over server-sent events (D-05). Read with fetch rather than EventSource so the device token
 * can go in a header (EventSource can't send one). Reconnects with backoff; a watchdog drops connections
 * that went silent (phones switching networks rarely close them cleanly).
 */
export interface LiveHandlers {
  /** Connected and subscribed: pull to catch up on anything missed while disconnected. */
  onReady(): void;
  onChange(change: { householdId: string; service: string; cursor: number }): void;
  onDown(): void;
}

const SILENCE_MS = 50_000; // the server sends a ping every 20 s
const MAX_BACKOFF_MS = 30_000;

let handlers: LiveHandlers | undefined;
let current: AbortController | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let backoff = 1000;

export function startLive(h: LiveHandlers) {
  handlers = h;
  window.addEventListener('online', reconnectLive);
  document.addEventListener('visibilitychange', () => {
    // Back from the background (or the app resumed on a phone): the old connection is usually dead.
    if (document.visibilityState === 'visible') reconnectLive();
  });
  reconnectLive();
}

/** Reconnect now, e.g. after joining or leaving a household (the server subscribes per household). */
export function reconnectLive() {
  backoff = 1000;
  clearTimeout(retry);
  current?.abort();
  void connect();
}

function later() {
  clearTimeout(retry);
  retry = setTimeout(() => void connect(), backoff);
  backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
}

async function connect() {
  if (!handlers) return;
  if (!navigator.onLine || document.visibilityState === 'hidden') return; // the online/visible events bring us back
  if (!token()) return later(); // the sync loop registers the device first
  const abort = new AbortController();
  current = abort;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const alive = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => abort.abort(), SILENCE_MS);
  };
  try {
    alive();
    const res = await fetch(apiUrl('/household/events'), {
      headers: { Accept: 'text/event-stream', ...authHeader() },
      signal: abort.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!res.ok || !res.body) throw new Error(`Live updates unavailable (${res.status})`);
    backoff = 1000;
    await readEvents(res.body, alive, (event, data) => {
      if (event === 'ready') handlers?.onReady();
      else if (event === 'change') handlers?.onChange(JSON.parse(data));
    });
  } catch {
    // Network error, abort, or a non-200 answer: fall through to reconnect.
  } finally {
    clearTimeout(watchdog);
    if (current === abort) {
      current = undefined;
      handlers.onDown();
      later();
    }
  }
}

async function readEvents(body: ReadableStream<Uint8Array>, alive: () => void, onEvent: (event: string, data: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    alive();
    buffer += decoder.decode(value, { stream: true });
    for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (data.length) onEvent(event, data.join('\n'));
    }
  }
}
