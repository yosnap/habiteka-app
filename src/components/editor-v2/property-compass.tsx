'use client';
import { propertyNorth } from '@/lib/editor-document/property-orientation';
import type { EditorDocument } from '@/lib/editor-document/schema';

export function PropertyCompass({ northDeg, size = 100 }: { northDeg: number; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Norte del plano: ${Math.round(northDeg)} grados desde arriba`}>
    <circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" opacity=".25" />
    <g transform={`rotate(${northDeg} 50 50)`}>
      <path d="M50 22 L43 51 L50 46 L57 51 Z" fill="#c44b39" />
      <path d="M50 78 L43 51 L50 54 L57 51 Z" fill="currentColor" opacity=".35" />
    </g>
    {['N', 'E', 'S', 'O'].map((label, i) => {
      const angle = (northDeg + i * 90) * Math.PI / 180;
      return <text key={label} x={50 + Math.sin(angle) * 43} y={50 - Math.cos(angle) * 43 + 4}
        textAnchor="middle" fontSize="12" fontWeight={label === 'N' ? 'bold' : 'normal'} fill="currentColor">{label}</text>;
    })}
  </svg>;
}
/** Referencia de los ejes del plano; no simula el rumbo de la cámara 3D. No entra en capturas del lienzo. */
export function PropertyCompassOverlay({ document }: { document: EditorDocument }) {
  const north = propertyNorth(document);
  return north === undefined ? null : <div className="pointer-events-none absolute right-3 bottom-14 z-10 rounded-xl border bg-white/90 px-2 py-1 text-center text-[#22362e] shadow-sm">
    <PropertyCompass northDeg={north} size={76} /><p className="text-[10px]">Norte del plano</p>
  </div>;
}
