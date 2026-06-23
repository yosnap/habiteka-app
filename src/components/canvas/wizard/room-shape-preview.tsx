'use client';

/**
 * Previsualización en vivo del contorno de una sala (planta a escala dentro de un recuadro
 * fijo). Dibuja el polígono INTERIOR real de la forma reusando `roomOutline` (la misma
 * geometría que genera el doc), así el preview no diverge de lo que se crea. Para el
 * rectángulo el polígono es la caja de siempre; para L/U/T es el contorno con su recorte.
 */
import { roomOutline, type RoomShapeParams } from '@/canvas/wizard/room-shapes';

const BOX = 120; // lado del área de preview (px)
const PAD = 12;

export function RoomShapePreview({
  params,
  label,
}: {
  params: RoomShapeParams;
  label: string;
}) {
  // El contorno en px de plano (origen 0,0). Si la forma es inválida, cae a un cuadrado mínimo.
  const outline = roomOutline(params, 100);
  const pts = outline.length >= 3 ? outline : [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  // Encaje del polígono en el recuadro (mantener proporción y centrar).
  let maxX = 0;
  let maxY = 0;
  for (const p of pts) {
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const span = Math.max(maxX, maxY) || 1;
  const scale = (BOX - 2 * PAD) / span;
  const drawnW = maxX * scale;
  const drawnH = maxY * scale;
  const offX = (BOX - drawnW) / 2;
  const offY = (BOX - drawnH) / 2;
  const poly = pts.map((p) => `${offX + p.x * scale},${offY + p.y * scale}`).join(' ');

  return (
    <svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} aria-hidden className="shrink-0">
      <rect x={0} y={0} width={BOX} height={BOX} fill="#f0ebe1" rx={6} />
      <polygon points={poly} fill="#ffffff" stroke="#6b6258" strokeWidth={3} strokeLinejoin="round" />
      <text
        x={BOX / 2}
        y={BOX - 3}
        textAnchor="middle"
        fontSize={9}
        fill="#6b6258"
        fontFamily="monospace"
      >
        {label}
      </text>
    </svg>
  );
}
