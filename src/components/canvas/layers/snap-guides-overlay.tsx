'use client';

/**
 * Overlay de GUÍAS de alineación del snap en curso (líneas finas tipo CAD, estilo
 * Planner5D). No interactivo. Dibuja una línea vertical por cada coordenada X enganchada
 * y una horizontal por cada Y, indicando a qué referencia se alineó el objeto.
 *
 * Vive dentro de la capa de objetos (no abre un Layer propio) para respetar el máximo de
 * capas de Konva, igual que `LiveDimensionOverlay`. Las coordenadas son de MUNDO: el Layer
 * ya aplica el pan/zoom, así que la guía sigue al plano. Cada línea se extiende un rango
 * amplio centrado en su coordenada para cruzar la zona visible sin depender del viewport.
 */
import { Group, Line } from 'react-konva';
import type { SnapResult } from '@/canvas/snap';

/** Semilongitud (px de mundo) de cada guía: amplio para cruzar la zona de trabajo. */
const GUIDE_HALF_LEN = 4000;
const GUIDE_COLOR = '#2a8cf0';

export function SnapGuidesOverlay({ guides }: { guides: SnapResult | null }) {
  if (!guides) return null;
  const { guidesX, guidesY } = guides;
  if (guidesX.length === 0 && guidesY.length === 0) return null;

  return (
    <Group listening={false}>
      {guidesX.map((x, i) => (
        <Line
          key={`gx-${i}`}
          points={[x, -GUIDE_HALF_LEN, x, GUIDE_HALF_LEN]}
          stroke={GUIDE_COLOR}
          strokeWidth={1}
          dash={[4, 4]}
        />
      ))}
      {guidesY.map((y, i) => (
        <Line
          key={`gy-${i}`}
          points={[-GUIDE_HALF_LEN, y, GUIDE_HALF_LEN, y]}
          stroke={GUIDE_COLOR}
          strokeWidth={1}
          dash={[4, 4]}
        />
      ))}
    </Group>
  );
}
