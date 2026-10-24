'use client';
/**
 * Demo interactiva: un plano de ejemplo de 85 m² en el que tocar (o señalar) una
 * estancia muestra su diseño. Las estancias también se eligen con botones reales
 * para teclado y lectores de pantalla.
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEMO_ROOMS, PHOTOS } from './landing-examples';
import { AtlasPhoto, ExampleBadge } from './landing-ui';
import styles from './landing.module.css';

/**
 * Puerta sobre un muro: `x, y` es la bisagra sobre el eje del muro, `axis` la
 * dirección del muro, `along` hacia dónde se abre el hueco a lo largo de él y
 * `into` hacia qué lado del muro gira la hoja.
 */
interface Door { x: number; y: number; width: number; axis: 'h' | 'v'; along: 1 | -1; into: 1 | -1 }

const DOORS: Door[] = [
  { x: 470, y: 200, width: 56, axis: 'h', along: 1, into: -1 }, // recibidor → cocina
  { x: 750, y: 200, width: 52, axis: 'h', along: -1, into: -1 }, // recibidor → despacho
  { x: 420, y: 216, width: 48, axis: 'v', along: 1, into: -1 }, // recibidor → comedor
  { x: 600, y: 280, width: 56, axis: 'h', along: -1, into: 1 }, // recibidor → infantil
  { x: 690, y: 280, width: 52, axis: 'h', along: 1, into: 1 }, // recibidor → lavadero
  { x: 240, y: 280, width: 56, axis: 'h', along: -1, into: 1 }, // salón → dormitorio
  { x: 300, y: 470, width: 52, axis: 'v', along: -1, into: 1 }, // dormitorio → baño
];

function doorPoints({ x, y, width, axis, along, into }: Door) {
  const hinge = { x, y };
  const free = axis === 'h' ? { x: x + along * width, y } : { x, y: y + along * width };
  const leaf = axis === 'h' ? { x, y: y + into * width } : { x: x + into * width, y };
  // El arco va del extremo libre a la hoja abierta girando alrededor de la bisagra;
  // el signo del producto vectorial da su sentido en coordenadas de pantalla.
  const cross = (free.x - x) * (leaf.y - y) - (free.y - y) * (leaf.x - x);
  return { hinge, free, leaf, sweep: cross > 0 ? 1 : 0 };
}

// Rectángulo que borra el muro en el hueco de la puerta (grosor del trazo + margen).
function openingRect({ x, y, width, axis, along }: Door) {
  const start = Math.min(along === 1 ? 0 : -width, 0);
  return axis === 'h'
    ? { x: x + start, y: y - 5, width, height: 10 }
    : { x: x - 5, y: y + start, width: 10, height: width };
}

export function PlanDemo() {
  const [selectedId, setSelectedId] = useState('salon');
  const reduced = useReducedMotion();
  const selected = DEMO_ROOMS.find((room) => room.id === selectedId) ?? DEMO_ROOMS[0]!;

  return (
    <div className="grid items-stretch gap-6 lg:grid-cols-[1.05fr_1fr]">
      <div className={`bg-night relative overflow-hidden rounded-[1.75rem] p-4 ring-1 ring-white/10 sm:p-6 ${styles.blueprint}`}>
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-white/60">
          <span className="font-mono">PISO · 85 m² · VALENCIA</span>
          <span className="inline-flex items-center gap-1.5"><MousePointerClick className="size-4" aria-hidden="true" />Toca una estancia</span>
        </div>
        <svg viewBox="0 0 800 520" className="w-full" aria-hidden="true">
          {DEMO_ROOMS.map((room) => {
            const active = room.id === selected.id;
            const { x, y, w, h } = room.rect;
            return (
              <g key={room.id} className="cursor-pointer" onClick={() => setSelectedId(room.id)} onPointerEnter={(e) => e.pointerType === 'mouse' && setSelectedId(room.id)}>
                <rect x={x} y={y} width={w} height={h}
                  className={cn('stroke-white/80 transition-[fill] duration-300', active ? 'fill-[oklch(0.62_0.16_40/0.35)]' : 'fill-white/[0.02] hover:fill-white/10')}
                  strokeWidth={6} />
                <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" className={cn('text-[17px] font-semibold', active ? 'fill-white' : 'fill-white/75')}>{room.name}</text>
                {h > 100 ? <text x={x + w / 2} y={y + h / 2 + 18} textAnchor="middle" className="fill-white/45 font-mono text-[12px]">{room.size}</text> : null}
              </g>
            );
          })}
          {/* Puertas como dibujo técnico: hueco en el muro, hoja y arco de apertura. */}
          <g className="pointer-events-none">
            {DOORS.map((door) => {
              const { hinge, free, leaf, sweep } = doorPoints(door);
              return (
                <g key={`${door.x}-${door.y}`}>
                  <rect {...openingRect(door)} fill="var(--color-night)" />
                  <path d={`M${hinge.x} ${hinge.y} L${leaf.x} ${leaf.y}`} className="stroke-white/85" strokeWidth={2.5} />
                  <path d={`M${free.x} ${free.y} A${door.width} ${door.width} 0 0 ${sweep} ${leaf.x} ${leaf.y}`} className="fill-none stroke-white/45" strokeWidth={1.5} />
                </g>
              );
            })}
          </g>
        </svg>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Estancias del plano de ejemplo">
          {DEMO_ROOMS.map((room) => (
            <button
              key={room.id}
              type="button"
              aria-pressed={room.id === selected.id}
              onClick={() => setSelectedId(room.id)}
              className={cn(
                'min-h-11 rounded-full px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                room.id === selected.id ? 'bg-white text-ink' : 'bg-white/8 text-white/75 ring-1 ring-white/15 hover:bg-white/15',
              )}
            >
              {room.name}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-[22rem] overflow-hidden rounded-[1.75rem] bg-[var(--color-night-soft)] shadow-[var(--shadow-float)]">
        <AnimatePresence initial={false}>
          <motion.div
            key={selected.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: reduced ? 1 : 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.15 : 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <AtlasPhoto photo={PHOTOS[selected.photo]} className="size-full" />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-6 pt-20">
          <p aria-live="polite" className="font-display text-3xl font-medium text-white sm:text-4xl">{selected.name}</p>
          <p className="mt-1 font-mono text-sm text-white/75">{selected.size} · cotas revisadas</p>
        </div>
        <ExampleBadge className="absolute top-4 right-4" />
      </div>
    </div>
  );
}
