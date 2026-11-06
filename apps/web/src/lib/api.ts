import type { ApiError, ApiOk } from '@5dev/shared';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export function apiUrl(path: string): string {
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readJson<T>(res: Response): Promise<ApiOk<T> | ApiError | null> {
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return null;
  try {
    return (await res.json()) as ApiOk<T> | ApiError;
  } catch {
    return null;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function request<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await readJson<T>(res);

  if (!res.ok || !payload || payload.ok === false) {
    const err = payload && payload.ok === false ? payload.error : null;
    throw new ApiRequestError(
      res.status,
      err?.code ?? 'NETWORK',
      err?.message ?? `Requête échouée (${res.status})`,
      err?.fields,
    );
  }
  return payload.data;
}

export const apiGet = <T,>(path: string): Promise<T> => request<T>(path, 'GET');
export const apiPost = <T,>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, 'POST', body);
export const apiPatch = <T,>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, 'PATCH', body);
export const apiPut = <T,>(path: string, body?: unknown): Promise<T> => request<T>(path, 'PUT', body);
export const apiDelete = <T,>(path: string): Promise<T> => request<T>(path, 'DELETE');

export function databaseLabel(state: 'up' | 'down' | 'not_configured'): string {
  switch (state) {
    case 'up':
      return 'base de données connectée';
    case 'down':
      return 'base de données injoignable';
    default:
      return 'base de données non configurée';
  }
}
