'use client';

/**
 * Ejecuta un efecto UNA sola vez al montar (y su limpieza al desmontar).
 *
 * Alternativa explícita a escribir `useEffect(fn, [])` disperso por los
 * componentes: concentra el único caso legítimo de efecto de montaje (instalar
 * suscripciones a stores externos, sincronizar estado inicial) en un punto con
 * nombre, dejando claro que la intención es "al montar", no "en cada cambio".
 */
import { useEffect, type EffectCallback } from 'react';

export function useMountEffect(effect: EffectCallback): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
