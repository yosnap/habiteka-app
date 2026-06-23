'use client';

/**
 * Suscribe un handler a un evento de `window` durante la vida del componente.
 *
 * Es el caso legítimo "sincronización con sistema externo" (la API de eventos del
 * navegador): el `useEffect` vive aquí, dentro de un hook reutilizable con nombre, no
 * disperso en los componentes (regla no-use-effect). El listener se instala UNA vez;
 * un ref mantiene el handler más reciente, así el callback siempre ve props/estado
 * frescos sin re-suscribir en cada render.
 */
import { useEffect, useRef } from 'react';

export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
): void {
  const handlerRef = useRef(handler);
  // El ref se actualiza dentro de un efecto (no en el render): así el listener,
  // instalado una sola vez, siempre invoca el handler más reciente.
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const listener = (event: WindowEventMap[K]) => handlerRef.current(event);
    window.addEventListener(type, listener);
    return () => window.removeEventListener(type, listener);
  }, [type]);
}
