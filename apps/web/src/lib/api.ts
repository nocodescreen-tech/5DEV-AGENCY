import type { ApiError, ApiOk, HealthPayload } from '@5dev/shared';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

/** Construit une URL d'API sans double slash. */
export function apiUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${clean}`;
}

async function readJson<T>(res: Response): Promise<ApiOk<T> | ApiError | null> {
  try {
    return (await res.json()) as ApiOk<T> | ApiError;
  } catch {
    return null;
  }
}

/** Appel d'API normalisé : renvoie `data` ou lève une ApiRequestError. */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: { Accept: 'application/json' },
    ...init,
  });
  const body = await readJson<T>(res);

  if (!res.ok || !body || body.ok === false) {
    const err = body && body.ok === false ? body.error : null;
    throw new ApiRequestError(
      res.status,
      err?.code ?? 'NETWORK',
      err?.message ?? `Requête échouée (${res.status})`,
    );
  }
  return body.data;
}

export const fetchHealth = (): Promise<HealthPayload> => apiGet<HealthPayload>('/api/v1/healthz');

/** Libellé lisible de l'état de la base pour l'affichage. */
export function databaseLabel(state: HealthPayload['database']): string {
  switch (state) {
    case 'up':
      return 'base de données connectée';
    case 'down':
      return 'base de données injoignable';
    default:
      return 'base de données non configurée';
  }
}
