import { useCallback, useMemo, useState } from 'react';

/**
 * Validation de formulaire en temps réel, sans dépendance.
 *
 * Principe : on n'affiche pas une erreur avant que le champ ait été quitté une fois
 * (ou que l'envoi ait été tenté). L'utilisateur n'est donc pas agressé pendant la saisie,
 * mais il voit immédiatement ce qui bloque dès qu'il sort du champ.
 */

export type Rule = {
  test: (value: string) => boolean;
  message: string;
};

export const rules = {
  required: (label: string): Rule => ({
    test: (v) => v.trim().length > 0,
    message: `${label} est requis.`,
  }),
  min: (n: number, label: string): Rule => ({
    test: (v) => v.trim().length >= n,
    message: `${label} : ${n} caractères minimum.`,
  }),
  email: (): Rule => ({
    test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    message: 'Adresse email invalide (exemple : nom@domaine.com).',
  }),
  phone: (): Rule => ({
    test: (v) => v.trim() === '' || /^[+0-9 ().-]{8,20}$/.test(v.trim()),
    message: 'Numéro invalide — chiffres, espaces, + et tirets uniquement.',
  }),
};

export type Schema<T extends Record<string, string>> = Partial<Record<keyof T, Rule[]>>;

export function useFormValidation<T extends Record<string, string>>(values: T, schema: Schema<T>) {
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [attempted, setAttempted] = useState(false);

  /** première erreur par champ, recalculée à chaque frappe */
  const errors = useMemo(() => {
    const out: Partial<Record<keyof T, string>> = {};
    for (const key of Object.keys(schema) as (keyof T)[]) {
      const fieldRules = schema[key] ?? [];
      for (const rule of fieldRules) {
        if (!rule.test(values[key] ?? '')) {
          out[key] = rule.message;
          break;
        }
      }
    }
    return out;
  }, [values, schema]);

  const isValid = Object.keys(errors).length === 0;

  /** erreur à afficher : seulement si le champ a été quitté, ou après une tentative */
  const visibleError = useCallback(
    (key: keyof T) => (attempted || touched[key] ? errors[key] : undefined),
    [attempted, touched, errors],
  );

  const isValidField = useCallback(
    (key: keyof T) => (attempted || touched[key]) && !errors[key] && String(values[key] ?? '').trim().length > 0,
    [attempted, touched, errors, values],
  );

  const onBlur = useCallback((key: keyof T) => {
    setTouched((t) => ({ ...t, [key]: true }));
  }, []);

  /** à appeler au submit : renvoie true si tout est bon, sinon marque tout comme touché */
  const validateAll = useCallback(() => {
    setAttempted(true);
    return Object.keys(errors).length === 0;
  }, [errors]);

  return { errors, isValid, visibleError, isValidField, onBlur, validateAll, attempted };
}
