'use client';
import type { PlanAperture, PlanPoint, PlanWall } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function Field({ label, value, change, disabled }: { label: string; value: number; change: (value: number) => boolean; disabled: boolean }) {
  return <label className="grid gap-1 text-xs">{label}<Input key={`${label}:${value}`} aria-label={label} inputMode="decimal"
    defaultValue={String(Math.round(value * 1000) / 1000)} disabled={disabled} className="h-9"
    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
    onBlur={event => { const next = Number(event.target.value.replace(',', '.'));
      if (event.target.value.trim() === '' || !Number.isFinite(next) || !change(next)) event.target.value = String(value); }} /></label>;
}

export function PlanReviewDoorFields({ door, wallLengthMm, number, room, disabled, change, onClose }: {
  door: PlanAperture; wallLengthMm: number; number: number; room: string; disabled: boolean;
  change: (patch: Partial<PlanAperture>) => boolean; onClose: () => void;
}) {
  const maxWidth = Math.min(10000, wallLengthMm);
  const half = wallLengthMm > 0 ? Math.min(.5, door.widthMm / wallLengthMm / 2) : .5;
  return <section className="border-line bg-surface grid gap-3 rounded-card border p-3" aria-label="Propiedades de puerta">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Puerta {number} · {room}</h2>
      <Button size="sm" variant="ghost" onClick={onClose} aria-label="Cerrar propiedades de puerta">×</Button></div>
    <Field label={`Ancho de puerta ${number} (m)`} value={door.widthMm / 1000} disabled={disabled} change={value => change({ widthMm: Math.round(value * 1000) })} />
    <input aria-label={`Deslizar ancho de puerta ${number}`} aria-valuetext={`${(door.widthMm / 1000).toFixed(2)} metros`}
      type="range" className="w-full" min={100} max={Math.max(100, maxWidth)} step={10} value={door.widthMm}
      disabled={disabled || maxWidth < 100} onChange={event => change({ widthMm: Number(event.target.value) })} />
    <Field label={`Posición de puerta ${number} (%)`} value={door.position * 100} disabled={disabled} change={value => change({ position: value / 100 })} />
    <input aria-label={`Deslizar posición de puerta ${number}`} aria-valuetext={`${Math.round(door.position * 100)} por ciento del muro`}
      type="range" className="w-full" min={half} max={1 - half} step="0.005" value={door.position}
      disabled={disabled || half >= .5} onChange={event => change({ position: Number(event.target.value) })} />
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={disabled} onClick={() => change({ swing: door.swing === 'right' ? 'left' : 'right' })}>Invertir lado</Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => change({ hinge: door.hinge === 'right' ? 'left' : 'right' })}>Cambiar bisagra</Button></div>
    <p className="text-ink-soft text-xs">El ancho cambia el hueco y su arco. Debe caber en el muro sin solaparse con otra abertura.</p>
  </section>;
}

export function PlanReviewWallFields({ wall, disabled, change, onClose }: { wall: PlanWall; disabled: boolean;
  change: (patch: Partial<PlanWall>) => boolean; onClose: () => void;
}) {
  const length = Math.hypot(wall.to.x - wall.from.x, wall.to.y - wall.from.y);
  const endpoint = (name: 'from' | 'to', axis: keyof PlanPoint, value: number) => change({ [name]: { ...wall[name], [axis]: Math.round(value * 1000) } });
  return <section className="border-line bg-surface grid gap-3 rounded-card border p-3" aria-label="Propiedades de muro">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Muro seleccionado</h2>
      <Button size="sm" variant="ghost" onClick={onClose} aria-label="Cerrar propiedades de muro">×</Button></div>
    <Field label="Longitud de muro (m)" value={length / 1000} disabled={disabled} change={value => length > 0 && change({ to: {
      x: wall.from.x + (wall.to.x - wall.from.x) * value * 1000 / length,
      y: wall.from.y + (wall.to.y - wall.from.y) * value * 1000 / length,
    } })} />
    <Field label="Grosor de muro (m)" value={wall.thicknessMm / 1000} disabled={disabled} change={value => change({ thicknessMm: Math.round(value * 1000) })} />
    <div className="grid grid-cols-2 gap-2">{(['from', 'to'] as const).flatMap(name => (['x', 'y'] as const).map(axis =>
      <Field key={`${name}:${axis}`} label={`${name === 'from' ? 'Inicio' : 'Final'} ${axis.toUpperCase()} (m)`} value={wall[name][axis] / 1000}
        disabled={disabled} change={value => endpoint(name, axis, value)} />))}</div>
    <p className="text-ink-soft text-xs">Los muros unidos comparten la esquina. Puedes arrastrar los dos puntos resaltados sobre el original.</p>
  </section>;
}
