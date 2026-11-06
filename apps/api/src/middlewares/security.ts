import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

/**
 * En-têtes de sécurité — sans dépendance externe, pour que la protection soit
 * vérifiable dans les tests (voir tests/security.test.ts).
 *
 * CSP : le front est servi par Vite (dev) / un hébergeur statique (prod) ; l'API
 * ne renvoie que du JSON, donc `default-src 'none'` est le bon défaut ici. Les
 * images/photos sont servies par le front, pas par l'API.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Cache-Control', 'no-store');

  if (config.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // l'API ne doit jamais être mise en cache ni indexée
  res.setHeader('X-Robots-Tag', 'noindex');
  next();
}

/**
 * CORS en liste blanche stricte : seule l'origine de l'application est acceptée.
 * `credentials: true` est nécessaire pour le cookie de session.
 */
export function corsAllowlist(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const allowed = new Set(
    [config.APP_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173']
      .filter(Boolean)
      .map((o) => o.replace(/\/$/, '')),
  );

  if (origin && allowed.has(origin.replace(/\/$/, ''))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  } else if (origin) {
    // origine inconnue : on ne pose aucun en-tête CORS (le navigateur bloque)
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
