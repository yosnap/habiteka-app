'use client';

/**
 * Ejecuta un efecto cuando un valor CAMBIA (no en el montaje inicial).
 *
 * Primitivo reutilizable con nombre para el único caso legítimo de "sincronizar un
 * sistema externo / estado imperativo cuando un valor concreto cambia" (regla
 * no-use-effect: el `useEffect` vive aquí, no disperso en los componentes). Pasa el
 * valor anterior y el nuevo al callback.
 */
import { useEffect, useRef } from 'react';

export function useValueChangeEffect<T>(
  value: T,
  onChange: (next: T, prev: T) => void,
): void {
  const prevRef = useRef(value);
  const onChangeRef = useRef(onChange);
  // El ref se actualiza dentro de un efecto (no en el render).
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (prevRef.current !== value) {
      onChangeRef.current(value, prevRef.current);
      prevRef.current = value;
    }
  }, [value]);
}
