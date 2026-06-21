'use client';

/**
 * Formas vectoriales de cada objeto del catálogo, dibujadas en vista de PLANTA
 * (como un plano arquitectónico). Cada función recibe el ancho/alto del objeto y
 * devuelve primitivas de Konva relativas a su origen (0,0); el contenedor las
 * posiciona/rota. Mantener el dibujo aquí desacopla el render del modelo de datos.
 */
import { Rect, Circle, Line, Ellipse } from 'react-konva';
import type { StructKind } from '@/canvas/types';

// Paleta de planta: trazo oscuro, rellenos suaves por familia.
const STROKE = '#3a322e';
const WALL = '#6b5a50';
const GLASS = '#9ec7dd';
const FIX = '#cdd5d8'; // sanitarios/electrodomésticos (porcelana/metal)
const WOOD = '#d8b892'; // mobiliario
const SOFT = '#c9b9ad'; // tapizados

function box(w: number, h: number, fill: string, radius = 2) {
  return (
    <Rect
      width={w}
      height={h}
      fill={fill}
      stroke={STROKE}
      strokeWidth={1.5}
      cornerRadius={radius}
    />
  );
}

/** Devuelve los nodos Konva que dibujan un objeto en planta. */
export function objectShape(kind: StructKind, w: number, h: number): React.ReactNode {
  switch (kind) {
    // --- Estructura ---
    case 'wall':
      return <Rect width={w} height={h} fill={WALL} stroke={STROKE} strokeWidth={1} />;
    case 'window':
      return (
        <>
          <Rect width={w} height={h} fill={GLASS} stroke={STROKE} strokeWidth={1} />
          <Line points={[0, h / 2, w, h / 2]} stroke={STROKE} strokeWidth={1} />
        </>
      );
    case 'door':
      return (
        <>
          <Rect width={w} height={h} fill="#efe7df" stroke={STROKE} strokeWidth={1} />
          {/* Hoja abatible: arco de apertura. */}
          <Line points={[0, h, 0, h - w]} stroke={STROKE} strokeWidth={1.5} />
          <Line points={[0, h, w, h]} stroke={STROKE} strokeWidth={1.5} />
        </>
      );

    // --- Sanitarios ---
    case 'inodoro':
      return (
        <>
          {box(w, h * 0.35, FIX)}
          <Ellipse
            x={w / 2}
            y={h * 0.65}
            radiusX={w * 0.42}
            radiusY={h * 0.32}
            fill={FIX}
            stroke={STROKE}
            strokeWidth={1.5}
          />
        </>
      );
    case 'lavabo':
      return (
        <>
          {box(w, h, FIX, 6)}
          <Ellipse
            x={w / 2}
            y={h / 2}
            radiusX={w * 0.32}
            radiusY={h * 0.3}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
          />
        </>
      );
    case 'ducha':
      return (
        <>
          {box(w, h, '#eef2f3')}
          <Line points={[0, 0, w, h]} stroke={STROKE} strokeWidth={1} />
          <Line points={[w, 0, 0, h]} stroke={STROKE} strokeWidth={1} />
          <Circle x={w * 0.2} y={h * 0.2} radius={3} fill={STROKE} />
        </>
      );
    case 'banera':
      return (
        <>
          {box(w, h, FIX, 10)}
          <Rect
            x={w * 0.08}
            y={h * 0.12}
            width={w * 0.84}
            height={h * 0.76}
            cornerRadius={10}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
          />
        </>
      );
    case 'bidet':
      return (
        <>
          {box(w, h, FIX, 8)}
          <Ellipse
            x={w / 2}
            y={h / 2}
            radiusX={w * 0.3}
            radiusY={h * 0.34}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
          />
        </>
      );

    // --- Cocina ---
    case 'fregadero':
      return (
        <>
          {box(w, h, FIX)}
          <Rect
            x={w * 0.08}
            y={h * 0.15}
            width={w * 0.4}
            height={h * 0.7}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
            cornerRadius={2}
          />
          <Rect
            x={w * 0.52}
            y={h * 0.15}
            width={w * 0.4}
            height={h * 0.7}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
            cornerRadius={2}
          />
        </>
      );
    case 'encimera':
      return box(w, h, WOOD);
    case 'nevera':
      return (
        <>
          {box(w, h, FIX)}
          <Line points={[0, h * 0.4, w, h * 0.4]} stroke={STROKE} strokeWidth={1} />
        </>
      );
    case 'horno':
      return (
        <>
          {box(w, h, '#b9bec1')}
          <Circle
            x={w * 0.3}
            y={h * 0.3}
            radius={Math.min(w, h) * 0.12}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
          />
          <Circle
            x={w * 0.7}
            y={h * 0.3}
            radius={Math.min(w, h) * 0.12}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
          />
          <Circle
            x={w * 0.3}
            y={h * 0.7}
            radius={Math.min(w, h) * 0.12}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
          />
          <Circle
            x={w * 0.7}
            y={h * 0.7}
            radius={Math.min(w, h) * 0.12}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
          />
        </>
      );
    case 'isla':
      return box(w, h, WOOD, 4);

    // --- Mobiliario ---
    case 'cama':
      return (
        <>
          {box(w, h, SOFT, 4)}
          {/* Almohadas en la cabecera. */}
          <Rect
            x={w * 0.08}
            y={h * 0.04}
            width={w * 0.38}
            height={h * 0.16}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
            cornerRadius={3}
          />
          <Rect
            x={w * 0.54}
            y={h * 0.04}
            width={w * 0.38}
            height={h * 0.16}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
            cornerRadius={3}
          />
        </>
      );
    case 'sofa':
      return (
        <>
          {box(w, h, SOFT, 6)}
          <Rect
            x={w * 0.06}
            y={h * 0.2}
            width={w * 0.88}
            height={h * 0.6}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={1}
            cornerRadius={4}
          />
        </>
      );
    case 'mesa':
      return box(w, h, WOOD, 3);
    case 'silla':
      return (
        <>
          {box(w, h, WOOD, 3)}
          <Rect x={w * 0.1} y={0} width={w * 0.8} height={h * 0.2} fill={STROKE} cornerRadius={2} />
        </>
      );
    case 'armario':
      return (
        <>
          {box(w, h, WOOD)}
          <Line points={[w / 2, 0, w / 2, h]} stroke={STROKE} strokeWidth={1} />
        </>
      );
    case 'estanteria':
      return box(w, h, WOOD);
    case 'mesilla':
      return box(w, h, WOOD, 3);

    // --- Electrónica ---
    case 'tv':
      return (
        <Rect
          width={w}
          height={h}
          fill="#2b2b2b"
          stroke={STROKE}
          strokeWidth={1.5}
          cornerRadius={2}
        />
      );
    case 'ordenador':
      return (
        <>
          {box(w, h, '#cfd6da', 2)}
          <Rect x={w * 0.15} y={h * 0.15} width={w * 0.7} height={h * 0.55} fill="#2b2b2b" />
        </>
      );
    case 'lampara':
      return (
        <>
          <Circle
            x={w / 2}
            y={h / 2}
            radius={Math.min(w, h) / 2}
            fill="#fff3d0"
            stroke={STROKE}
            strokeWidth={1.5}
          />
          <Circle x={w / 2} y={h / 2} radius={Math.min(w, h) * 0.18} fill="#f4c95d" />
        </>
      );
  }
}
