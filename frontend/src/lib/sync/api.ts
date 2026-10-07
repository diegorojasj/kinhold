import { token } from './device';

// Web: same origin, so '/api' (D-01). Native builds are served from capacitor://localhost and need the
// server's address (VITE_API_URL). The Vite dev server proxies /api to the gateway (vite.config.ts).
const ORIGIN = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const apiUrl = (path: string) => `${ORIGIN}/api${path}`;

/** Errors from the API keep its `{code, message}`; `status` 0 means the server couldn't be reached. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  /** No usable answer: offline, timed out, or the gateway couldn't reach the service. */
  get unreachable() {
    return this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

export const authHeader = (): Record<string, string> => {
  const t = token();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.auth !== false) {
    if (!token()) throw new ApiError(401, 'no_device', 'This device is not registered yet');
    Object.assign(headers, authHeader());
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), init.timeoutMs ?? 15_000);
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: abort.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'network', 'No connection');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => undefined)) as { code?: string; message?: string } | undefined;
  if (!res.ok) throw new ApiError(res.status, data?.code ?? 'error', data?.message ?? res.statusText);
  // The connection dropped mid-response: treat it as unanswered (ops are retried, which is harmless).
  if (data === undefined) throw new ApiError(0, 'network', 'Incomplete response');
  return data as T;
}
