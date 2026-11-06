import type { NextFunction, Request, Response } from 'express';
import type { ApiError } from '@5dev/shared';

/** Erreur métier portant un code HTTP et un code machine stable. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(404, 'NOT_FOUND', `Route inconnue : ${req.method} ${req.path}`));
};

function body(status: number, code: string, message: string, fields?: Record<string, string>): ApiError {
  return { ok: false, error: { code, message, ...(fields ? { fields } : {}) } };
}

/** Gestionnaire d'erreurs unique : jamais de stack trace vers le client. */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.status).json(body(err.status, err.code, err.message, err.fields));
    return;
  }
  // Erreur non prévue : on journalise côté serveur, message générique côté client.
  console.error('[api] erreur non gérée', err);
  res.status(500).json(body(500, 'INTERNAL', 'Une erreur interne est survenue.'));
};
