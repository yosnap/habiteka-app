'use client';

/**
 * Sincroniza un `Transformer` de Konva con los nodos seleccionados.
 *
 * Konva es una librería imperativa: el `Transformer` gobierna sus nodos vía
 * `tr.nodes([...])`, que hay que reasignar cuando cambia la selección o el conjunto
 * de objetos. Encapsular esa sincronización en un custom hook deja el componente sin
 * `useEffect` directo (regla no-use-effect: el efecto vive solo dentro de un hook
 * reutilizable con nombre, como `useMountEffect`).
 */
import { useEffect, type RefObject } from 'react';
import type Konva from 'konva';

export function useTransformerNodes(
  trRef: RefObject<Konva.Transformer | null>,
  layerRef: RefObject<Konva.Layer | null>,
  selectedIds: string[],
  // `objects` no se usa directamente, pero su cambio debe re-sincronizar (los nodos
  // se crean/destruyen con los objetos); se incluye en las dependencias.
  objects: unknown,
): void {
  useEffect(() => {
    const tr = trRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;
    // El Transformer puede gobernar varios nodos a la vez (multiselección).
    const nodes = selectedIds
      .map((id) => layer.findOne(`#${id}`))
      .filter((n): n is Konva.Node => Boolean(n));
    tr.nodes(nodes);
  }, [trRef, layerRef, selectedIds, objects]);
}
