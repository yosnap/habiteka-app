/**
 * Ruta de desarrollo del 3D navegable (F6). Monta `Plan3DView` (cliente-only, WebGL)
 * con un `CanvasDoc` real para ver la escena: muros, suelo, muebles glTF y luces. NO es
 * parte del producto (la UI definitiva "Ver en 3D" en el editor es F6.4); vive fuera del
 * área autenticada a propósito (no necesita login).
 *
 * Para probar las luces (F6.3) se deriva el salón de ejemplo añadiéndole un foco — sin
 * mutar `EXAMPLE_SALON`, que es contenido de producto con tests asociados.
 */
'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { EXAMPLE_SALON } from '@/canvas/examples';
import { buildShapeDoc } from '@/canvas/wizard/build-room-doc';
import type { RoomShape, RoomShapeParams } from '@/canvas/wizard/room-shapes';
import type { CanvasDoc } from '@/canvas/types';

const Plan3DView = dynamic(
  () => import('@/components/canvas/3d/plan-3d-view').then((m) => m.Plan3DView),
  {
    loading: () => (
      <div className="grid h-full w-full place-items-center text-sm text-neutral-500">
        Cargando escena 3D…
      </div>
    ),
  },
);

// Salón de ejemplo + un foco central (luz cálida intensa) para ver F6.3 en acción.
// Con `?luz=0` se omite el foco, para comparar A/B el efecto de la luz.
// Fila de muebles para verificar los modelos glTF nuevos (F8): se activa con `?kinds=1`.
// Cada uno a 1,2 m de separación dentro de la sala, en una rejilla simple.
const KINDS_DEMO = ['nevera', 'armario', 'horno', 'inodoro', 'lavabo', 'ducha', 'cama', 'tv'] as const;
function kindsRow() {
  return KINDS_DEMO.map((kind, i) => ({
    id: `k-${kind}`,
    kind,
    x: 240 + (i % 4) * 120,
    y: 200 + Math.floor(i / 4) * 120,
    width: 80,
    height: 80,
    rotation: 0,
  }));
}

function demoDoc(withLight: boolean, withKinds: boolean): CanvasDoc {
  return {
    ...EXAMPLE_SALON,
    objects: [
      ...EXAMPLE_SALON.objects,
      ...(withKinds ? kindsRow() : []),
      ...(withLight
        ? [
            {
              id: 'foco-demo',
              kind: 'foco' as const,
              x: 430,
              y: 280,
              width: 40,
              height: 40,
              rotation: 0,
              light: { color: '#ffd9a0', intensidad: 85 },
            },
          ]
        : []),
    ],
  };
}

/** Parámetros de demo por forma no rectangular (para verificar el suelo poligonal). */
const SHAPE_DEMOS: Record<Exclude<RoomShape, 'rect'>, RoomShapeParams> = {
  l: { shape: 'l', widthM: 6, lengthM: 5, cutWidthM: 2.5, cutLengthM: 2.5 },
  u: { shape: 'u', widthM: 6, lengthM: 5, notchWidthM: 2, notchLengthM: 3 },
  t: { shape: 't', widthM: 6, lengthM: 6, barLengthM: 2.5, stemWidthM: 2.5 },
};

function Dev3DContent() {
  const params = useSearchParams();
  const withLight = params.get('luz') !== '0';
  const withKinds = params.get('kinds') === '1';
  // `?forma=l|u|t` muestra una sala no rectangular generada por el wizard (suelo poligonal),
  // para verificar el contorno de muros y el suelo en formas L/U/T. Sin el parámetro (o `rect`),
  // se muestra el salón de ejemplo de siempre.
  const forma = params.get('forma');
  const shapeDemo =
    forma === 'l' || forma === 'u' || forma === 't' ? SHAPE_DEMOS[forma] : null;
  const doc = shapeDemo
    ? buildShapeDoc({ shape: shapeDemo, ceilingHeightM: 2.6 })
    : demoDoc(withLight, withKinds);
  return (
    <main className="h-dvh w-dvw bg-neutral-100">
      <Plan3DView doc={doc} />
    </main>
  );
}

export default function Dev3DPage() {
  return (
    <Suspense fallback={null}>
      <Dev3DContent />
    </Suspense>
  );
}
