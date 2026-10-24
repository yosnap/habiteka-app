'use client';
/**
 * Comparador arrastrable plano guía ↔ diseño. El control es un `<input type="range">`
 * transparente que cubre la pieza: se arrastra con ratón o dedo y se mueve con
 * las flechas del teclado.
 */
import { useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { PHOTOS } from './landing-examples';
import { AtlasPhoto, ExampleBadge } from './landing-ui';
import styles from './landing.module.css';

function BedroomPlan() {
  return (
    <svg viewBox="0 0 600 400" className="absolute inset-0 size-full" fill="none" aria-hidden="true">
      <g className="stroke-white/85" strokeWidth={10} strokeLinecap="square">
        <path d="M90 50 H230 M370 50 H510 V350 H360 M260 350 H90 V50" />
      </g>
      <g className="stroke-white/45" strokeWidth={2}>
        <path d="M230 42 H370 M230 58 H370" />
        <path d="M360 350 A100 100 0 0 0 260 250 M260 350 V250" />
      </g>
      <g className="stroke-white/80" strokeWidth={2.5}>
        <rect x={200} y={70} width={200} height={190} rx={6} />
        <rect x={215} y={82} width={78} height={34} rx={8} />
        <rect x={307} y={82} width={78} height={34} rx={8} />
        <path d="M200 150 H400" />
        <rect x={140} y={74} width={46} height={44} />
        <rect x={414} y={74} width={46} height={44} />
        <rect x={215} y={272} width={170} height={30} />
        <circle cx={475} cy={300} r={20} />
      </g>
      <rect x={150} y={60} width={300} height={260} className="stroke-white/35" strokeWidth={1.5} strokeDasharray="6 6" />
      <g className="stroke-brand-100" strokeWidth={1.5}>
        <path d="M90 22 H510 M90 14 V30 M510 14 V30 M540 50 V350 M532 50 H548 M532 350 H548" />
      </g>
      <g className="fill-brand-100 font-mono text-[15px]">
        <text x={300} y={16} textAnchor="middle">5,60 m</text>
        <text x={562} y={200} textAnchor="middle" transform="rotate(90 562 200)">4,40 m</text>
      </g>
      <text x={300} y={385} textAnchor="middle" className="fill-white/60 font-mono text-[14px]">DORMITORIO · 24,6 m²</text>
    </svg>
  );
}

export function CompareSlider() {
  const [split, setSplit] = useState(50);
  return (
    <div className="bg-night-soft relative aspect-[3/2] overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-float)] select-none">
      <div className={`absolute inset-0 ${styles.blueprint}`}>
        <BedroomPlan />
      </div>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
        <AtlasPhoto photo={PHOTOS.dormitorio} className="size-full" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_20px_rgba(0,0,0,0.35)]" style={{ left: `${split}%` }}>
        <span className="text-ink absolute top-1/2 left-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-[var(--shadow-float)]">
          <MoveHorizontal className="size-5" />
        </span>
      </div>
      <span className="pointer-events-none absolute top-4 left-4 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">Plano guía</span>
      <span className="pointer-events-none absolute top-4 right-4 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">Diseño</span>
      <ExampleBadge className="pointer-events-none absolute right-4 bottom-4" />
      <input
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(event) => setSplit(Number(event.target.value))}
        aria-label="Comparar plano guía y diseño"
        aria-valuetext={`${split} % de plano guía visible`}
        className="peer absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-brand-500 peer-focus-visible:ring-4" />
    </div>
  );
}
