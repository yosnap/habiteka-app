'use client';

/**
 * Formas vectoriales de cada objeto del catálogo, dibujadas en vista de PLANTA
 * (como un plano arquitectónico). Cada función recibe el ancho/alto del objeto y
 * devuelve primitivas de Konva relativas a su origen (0,0); el contenedor las
 * posiciona/rota. Mantener el dibujo aquí desacopla el render del modelo de datos.
 */
import { Group, Rect, Circle, Line, Ellipse } from 'react-konva';
import type { StructKind } from '@/canvas/types';
import type { WallMiter } from './layers/wall-junction-caps';

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

/**
 * Dibuja un objeto en planta. Si `flip`, lo espeja en horizontal envolviéndolo en
 * un único Group con `scaleX(-1)` y `x(w)` (un solo nivel de transform, fiable).
 * `drawn` diferencia muros dibujados manualmente (necesitan extensión de esquina)
 * de los generados por outlineToWalls (ya llevan la cobertura en sus dimensiones).
 */
export function objectShape(
  kind: StructKind,
  w: number,
  h: number,
  flip = false,
  color?: string,
  drawn = false,
  miter?: WallMiter,
): React.ReactNode {
  const content = shapeFor(kind, w, h, color, drawn, miter);
  if (!flip) return content;
  return (
    <Group scaleX={-1} x={w}>
      {content}
    </Group>
  );
}

/**
 * Calcula los 8 puntos (4 vértices × 2 coords) del polígono de un muro con inglete.
 *
 * En espacio LOCAL del Group de Konva:
 *  - drawn=true:  x ∈ [-h/2, w+h/2]  (extensión de h/2 en cada extremo)
 *  - drawn=false: x ∈ [0, w]
 *  - y ∈ [0, h]  siempre
 *
 * Cada extremo con miter desplaza las dos esquinas de ese lado siguiendo la
 * bisectriz proyectada en local: la recta pasa por (x_mid, h/2) con dirección
 * (lbx, lby) y corta y=0 e y=h.
 */
function wallPolygon(w: number, h: number, drawn: boolean, miter?: WallMiter): number[] {
  const xS = drawn ? -h / 2 : 0; // x inicio estándar
  const xE = drawn ? w + h / 2 : w; // x fin estándar
  const bound = xE - xS + h; // límite de clamp

  let tlx = xS, trx = xE; // y = 0 (arriba en local)
  let blx = xS, brx = xE; // y = h (abajo en local)

  // Corte en p1 (x_mid = 0): bisectriz a través de (0, h/2)
  if (miter?.p1 && Math.abs(miter.p1.lby) > 0.01) {
    const { lbx, lby } = miter.p1;
    const clamp = (v: number) => Math.max(xS - bound, Math.min(xE + bound, v));
    tlx = clamp((-lbx * (h / 2)) / lby);
    blx = clamp((lbx * (h / 2)) / lby);
  }

  // Corte en p2 (x_mid = w): bisectriz a través de (w, h/2)
  if (miter?.p2 && Math.abs(miter.p2.lby) > 0.01) {
    const { lbx, lby } = miter.p2;
    const clamp = (v: number) => Math.max(xS - bound, Math.min(xE + bound, v));
    trx = clamp(w - (lbx * (h / 2)) / lby);
    brx = clamp(w + (lbx * (h / 2)) / lby);
  }

  // Orden: TL → TR → BR → BL (sentido horario en el espacio local de Konva)
  return [tlx, 0, trx, 0, brx, h, blx, h];
}

/** Devuelve los nodos Konva que dibujan un objeto en planta (sin espejo). */
function shapeFor(kind: StructKind, w: number, h: number, color?: string, drawn = false, miter?: WallMiter): React.ReactNode {
  switch (kind) {
    // --- Estructura ---
    case 'wall': {
      const wallFill = color ?? WALL;

      // Con datos de inglete → polígono recortado diagonalmente en los extremos
      if (miter?.p1 || miter?.p2) {
        return (
          <Line
            points={wallPolygon(w, h, drawn, miter)}
            closed
            fill={wallFill}
            stroke={STROKE}
            strokeWidth={1}
            listening={false}
          />
        );
      }

      // Sin inglete → rect estándar
      return drawn
        ? <Rect x={-h / 2} width={w + h} height={h} fill={wallFill} stroke={STROKE} strokeWidth={1} />
        : <Rect width={w} height={h} fill={wallFill} stroke={STROKE} strokeWidth={1} />;
    }
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

    // --- Decoración ---
    case 'alfombra':
      // Rectángulo con borde interior punteado, evocando el fleco/tejido.
      return (
        <>
          {box(w, h, '#e6ddd0', 4)}
          <Rect
            x={w * 0.08}
            y={h * 0.08}
            width={w * 0.84}
            height={h * 0.84}
            stroke={STROKE}
            strokeWidth={1}
            dash={[6, 4]}
            cornerRadius={2}
          />
        </>
      );
    case 'planta':
      // Maceta (cuadrado) con copa (círculo verde) centrada.
      return (
        <>
          {box(w, h, '#cdbda8', 3)}
          <Circle
            x={w / 2}
            y={h / 2}
            radius={Math.min(w, h) * 0.4}
            fill="#7faa6b"
            stroke={STROKE}
            strokeWidth={1}
          />
        </>
      );
    case 'chimenea':
      // Caja del hogar con la boca de fuego marcada al frente.
      return (
        <>
          {box(w, h, '#b9b0a6', 2)}
          <Rect
            x={w * 0.2}
            y={h * 0.35}
            width={w * 0.6}
            height={h * 0.5}
            fill="#5a4a40"
            stroke={STROKE}
            strokeWidth={1}
            cornerRadius={2}
          />
        </>
      );

    // --- Iluminación ---
    case 'foco': {
      // El foco se dibuja con su color de luz (si lo tiene): halo + punto central.
      const glow = color ?? '#ffd9a0';
      return (
        <>
          <Circle
            x={w / 2}
            y={h / 2}
            radius={Math.min(w, h) / 2}
            fill={glow}
            opacity={0.5}
            stroke={STROKE}
            strokeWidth={1}
          />
          <Circle x={w / 2} y={h / 2} radius={Math.min(w, h) * 0.22} fill={glow} stroke={STROKE} strokeWidth={1} />
        </>
      );
    }

    case 'microondas':
      return (
        <>
          {box(w, h, FIX, 3)}
          <Rect x={w * 0.07} y={h * 0.15} width={w * 0.62} height={h * 0.7} fill="#2b2b2b" cornerRadius={2} />
          <Rect x={w * 0.76} y={h * 0.2} width={w * 0.16} height={h * 0.6} fill="#9aa3ab" cornerRadius={2} />
        </>
      );
    case 'vitroceramica':
      return (
        <>
          {box(w, h, '#1a1a1a', 2)}
          <Circle x={w * 0.25} y={h * 0.3} radius={Math.min(w, h) * 0.15} fill="#333" stroke="#555" strokeWidth={1} />
          <Circle x={w * 0.65} y={h * 0.3} radius={Math.min(w, h) * 0.15} fill="#333" stroke="#555" strokeWidth={1} />
          <Circle x={w * 0.25} y={h * 0.72} radius={Math.min(w, h) * 0.15} fill="#333" stroke="#555" strokeWidth={1} />
          <Circle x={w * 0.65} y={h * 0.72} radius={Math.min(w, h) * 0.15} fill="#333" stroke="#555" strokeWidth={1} />
        </>
      );
    case 'nevera_americana':
      return (
        <>
          {box(w, h, FIX)}
          {/* Dos puertas: congelador izquierda, frío derecha */}
          <Line points={[w / 2, 0, w / 2, h]} stroke={STROKE} strokeWidth={1.5} />
          <Line points={[0, h * 0.45, w * 0.5, h * 0.45]} stroke={STROKE} strokeWidth={1} />
        </>
      );
    case 'nevera_mini':
      return (
        <>
          {box(w, h, FIX, 3)}
          <Line points={[0, h * 0.28, w, h * 0.28]} stroke={STROKE} strokeWidth={1} />
        </>
      );
    case 'sofa_grande':
      return (
        <>
          {box(w, h, SOFT, 8)}
          {/* Respaldo */}
          <Rect x={w * 0.04} y={h * 0.04} width={w * 0.92} height={h * 0.18} fill="#baa89a" cornerRadius={4} />
          {/* Tres asientos */}
          {[0.04, 0.36, 0.68].map((sx, i) => (
            <Rect key={i} x={w * sx} y={h * 0.28} width={w * 0.28} height={h * 0.6} fill="#fff" stroke={STROKE} strokeWidth={1} cornerRadius={3} />
          ))}
        </>
      );
    case 'butaca':
      return (
        <>
          {box(w, h, SOFT, 6)}
          <Rect x={w * 0.08} y={h * 0.05} width={w * 0.84} height={h * 0.18} fill="#baa89a" cornerRadius={3} />
          <Rect x={w * 0.12} y={h * 0.28} width={w * 0.76} height={h * 0.62} fill="#fff" stroke={STROKE} strokeWidth={1} cornerRadius={3} />
        </>
      );

    // Fallback: cualquier kind del catálogo sin forma propia se dibuja como una
    // caja simple. Así añadir una entrada al catálogo nunca rompe el render.
    default:
      return box(w, h, WOOD);
  }
}
