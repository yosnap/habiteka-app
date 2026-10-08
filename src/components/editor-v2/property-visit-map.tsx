'use client';
import type { inspectPropertyVisit } from '@/server/walkthrough/property-visit-actions';

type Report = Awaited<ReturnType<typeof inspectPropertyVisit>>;
/** Esquema de preparación. No se captura ni se ofrece como fotograma del vídeo final. */
export function PropertyVisitMap({ report, onEntry }: { report: Report; onEntry: (id: string) => void }) {
  const points = [...report.map.rooms.flatMap(room => room.boundary), ...report.map.entries.map(entry => entry.outside)];
  if (!points.length) return null;
  const minX = Math.min(...points.map(p => p.x)) - 700, minY = Math.min(...points.map(p => p.y)) - 700;
  const width = Math.max(...points.map(p => p.x)) - minX + 700, height = Math.max(...points.map(p => p.y)) - minY + 700;
  const radius = Math.max(width, height) / 65;
  const cameraPoints = (report.plan.pathFrames ?? report.plan.frames).filter(frame => frame.levelId === report.map.levelId)
    .map(frame => `${frame.camera.position[0] * 1000},${frame.camera.position[2] * 1000}`).join(' ');
  return <figure className="rounded-card border border-line bg-surface-muted p-3">
    <svg viewBox={`${minX} ${minY} ${width} ${height}`} className="max-h-96 w-full" role="img" aria-label="Esquema de cobertura y accesos del recorrido">
      {report.map.rooms.map(room => {
        const zone = report.plan.coverage.find(item => item.levelId === report.map.levelId && item.roomId === room.id);
        return <polygon key={room.id} points={room.boundary.map(p => `${p.x},${p.y}`).join(' ')}
          fill={zone?.status === 'planned' ? '#dcfce7' : '#fff1f2'} stroke="#64748b" strokeWidth={35}><title>{zone?.name}: {zone?.status === 'planned' ? 'Incluida en el trazado' : 'Pendiente'}</title></polygon>;
      })}
      <polyline points={cameraPoints} fill="none" stroke="#2563eb" strokeWidth={40} />
      {report.map.entries.map((entry, i) => <g key={entry.id} role="button" tabIndex={0} aria-label={`Elegir ${entry.label}`} onClick={() => onEntry(entry.id)}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onEntry(entry.id); } }} style={{ cursor: 'pointer' }}>
        <circle cx={entry.outside.x} cy={entry.outside.y} r={radius} fill={report.plan.entry?.id === entry.id ? '#1d4ed8' : '#334155'} />
        <text x={entry.outside.x} y={entry.outside.y} dominantBaseline="central" textAnchor="middle" fill="white" fontSize={radius * 1.2}>{i + 1}</text>
        <title>{entry.label}{entry.issue ? `: ${entry.issue}` : ''}</title>
      </g>)}
    </svg>
    <figcaption className="mt-2 text-xs text-ink-soft">Guía del plano: verde = zona incluida en el trazado; rosa = pendiente. Los números identifican accesos. No acredita el aspecto del vídeo ni la visibilidad de todos los detalles.</figcaption>
  </figure>;
}
