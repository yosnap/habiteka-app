'use client';
import { useRef, useState } from 'react';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { planToSite, type GeographicSite, type SitePoint } from '@/lib/editor-document/geographic-site';
import { wallPath } from '@/lib/editor-document/wall-path';
import { moveIntervention } from '@/lib/editor-document/intervention-shape';
import { InterventionControls } from './intervention-controls';
import { SiteAdjustmentControl } from './site-adjustment-control';
import type { ReactNode } from 'react';

type Tool = 'move' | 'cover' | 'pan' | 'mask';
type Drag = { start: SitePoint; anchor: SitePoint; mask: SitePoint[] };
export function GeographicSiteMap({ document, site, url, disabled, onChange, locationControls, designControls, videoControls }: {
  document: EditorDocument; site: GeographicSite; url: string; disabled: boolean;
  onChange: (patch: Partial<GeographicSite>) => void;
  locationControls: ReactNode; designControls: ReactNode; videoControls: ReactNode;
}) {
  const [zoom, setZoom] = useState(4);
  const [center, setCenter] = useState(site.anchor);
  const [tool, setTool] = useState<Tool>('move');
  const [original, setOriginal] = useState(false);
  const [draft, setDraft] = useState<SitePoint[] | null>(null);
  const drag = useRef<Drag | null>(null);
  const span = 1000 / zoom;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const rectangle = (a: SitePoint, b: SitePoint) => [
    { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }, { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) },
    { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) }, { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) },
  ];
  function point(event: React.PointerEvent<SVGSVGElement>) {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: clamp(p.x / 1000), y: clamp(p.y / 1000) };
  }
  function coverDesign() {
    const points = document.vertices;
    if (!points.length) return;
    const margin = 2000 / (site.planScale ?? 1);
    onChange({ intervention: rectangle(
      { x: Math.min(...points.map(p => p.x)) - margin, y: Math.min(...points.map(p => p.y)) - margin },
      { x: Math.max(...points.map(p => p.x)) + margin, y: Math.max(...points.map(p => p.y)) + margin })
        .map(p => planToSite(p, site)),
      scenario: 'reconstruction' });
    setOriginal(false);
  }
  const mask = draft ?? site.intervention;
  return <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
    <div className="flex min-h-0 flex-col gap-3 bg-stone-100/70 p-4 lg:p-5">
    <div className="grid gap-2 text-sm sm:grid-cols-3">
      {([['pan', '1 · Mover la fotografía'], ['cover', '2 · Tapar la casa actual'], ['move', '3 · Colocar el diseño']] as const).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={tool === value} disabled={value !== 'pan' && disabled}
          className={`rounded-lg border px-3 py-3 text-left ${tool === value ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'bg-white hover:bg-surface-muted'}`}
          onClick={() => { setTool(value); setOriginal(false); }}>{label}</button>)}
    </div>
    <p className="text-sm text-ink-soft">{original ? 'Así aparece la casa en la fotografía original.' : tool === 'cover'
      ? 'Arrastra desde una esquina hasta la contraria para tapar la construcción que quieres sustituir.'
      : tool === 'mask' ? 'Arrastra la zona beige para cubrir el tejado. El plano mantiene su posición.'
      : tool === 'pan' ? 'Arrastra la fotografía hasta tener la casa en el centro. El diseño mantiene su posición.'
      : 'Arrastra el diseño hasta su lugar. Usa «Giro del diseño» para alinearlo con la casa.'}</p>
    <svg viewBox={`${center.x * 1000 - span / 2} ${center.y * 1000 - span / 2} ${span} ${span}`}
      className="min-h-72 w-full flex-1 touch-none rounded-xl border bg-stone-200 lg:min-h-0"
      style={{ cursor: original ? 'default' : tool === 'cover' ? 'crosshair' : 'grab' }}
      aria-label="Fotografía de la parcela con el diseño propuesto"
      onPointerDown={event => {
        if (original || (tool !== 'pan' && disabled)) return;
        const p = point(event); if (!p) return;
        drag.current = { start: p, anchor: site.anchor, mask: site.intervention };
        event.currentTarget.setPointerCapture(event.pointerId);
        if (tool === 'cover') setDraft(rectangle(p, p));
      }}
      onPointerMove={event => {
        const current = drag.current, p = point(event);
        if (!current || !p) return;
        if (tool === 'cover') setDraft(rectangle(current.start, p));
        else if (tool === 'mask') onChange({ intervention: moveIntervention(current.mask, p.x - current.start.x, p.y - current.start.y) });
        else if (tool === 'move') onChange({ anchor: { x: clamp(current.anchor.x + p.x - current.start.x), y: clamp(current.anchor.y + p.y - current.start.y) } });
        else {
          // Use the original view transform during a pan to avoid feedback from its moving centre.
          const rect = event.currentTarget.getBoundingClientRect(), scale = Math.min(rect.width, rect.height);
          const deltaX = event.movementX / scale / zoom, deltaY = event.movementY / scale / zoom;
          setCenter(value => ({ x: clamp(value.x - deltaX), y: clamp(value.y - deltaY) }));
        }
      }}
      onPointerUp={event => {
        const current = drag.current, p = point(event);
        if (current && p && tool === 'cover' && Math.abs(p.x - current.start.x) > .001 && Math.abs(p.y - current.start.y) > .001)
          onChange({ intervention: rectangle(current.start, p), scenario: 'reconstruction' });
        drag.current = null; setDraft(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; setDraft(null); }}>
      <image href={url} width="1000" height="1000" />
      {!original && <>
        {!!mask.length && <polygon points={mask.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')}
          fill="#b7a58b" stroke="#a16b27" strokeWidth={2 / zoom} />}
        {document.walls.map(wall => <polyline key={wall.id}
          points={wallPath(document, wall).samples().map(p => {
            const q = planToSite(p, site); return `${q.x * 1000},${q.y * 1000}`;
          }).join(' ')} fill="none" stroke="#007e94" strokeWidth={Math.max(1.5 / zoom, wall.thicknessMm * (site.planScale ?? 1) / site.groundWidthM)} strokeLinecap="round" />)}
        <circle cx={site.anchor.x * 1000} cy={site.anchor.y * 1000} r={5 / zoom} fill="#007e94" stroke="white" strokeWidth={1 / zoom} />
      </>}
    </svg>
    <div className="flex flex-wrap gap-2 text-sm">
      <button type="button" aria-pressed={original} className="rounded border px-3 py-2" onClick={() => setOriginal(!original)}>
        {original ? 'Ver el diseño propuesto' : 'Ver la casa actual'}</button>
      <span className="ml-auto self-center text-xs text-ink-soft">Azul · diseño &nbsp; Beige · zona tapada</span>
    </div>
    <p className="text-xs text-ink-soft">IGN · PNOA · copia guardada el {new Date(site.capturedAt).toLocaleDateString('es-ES')}. Ancho: {site.groundWidthM} m. La fecha de copia no indica la fecha del vuelo.</p>
    </div>
    <aside aria-label="Ajustes de la parcela" className="min-h-0 space-y-5 overflow-y-auto border-l bg-white p-5 text-sm">
      <section className="space-y-3">
        <h3 className="font-semibold">Fotografía</h3>
        <SiteAdjustmentControl label="Zoom de la fotografía" value={zoom} min={1} max={16} step={.25} unit="×" onChange={setZoom} />
        <div className="flex gap-2 text-xs">
          <button type="button" className="flex-1 rounded-lg border px-2 py-2 hover:bg-stone-50" onClick={() => { setCenter(site.anchor); setZoom(4); }}>Centrar diseño</button>
          <button type="button" className="flex-1 rounded-lg border px-2 py-2 hover:bg-stone-50" onClick={() => { setCenter({ x: .5, y: .5 }); setZoom(1); }}>Ver parcela completa</button>
        </div>
        {locationControls}
      </section>
      <section className="space-y-4 border-t pt-5"><h3 className="font-semibold">Diseño</h3>{designControls}</section>
      <section className="space-y-3 border-t pt-5">
        <h3 className="font-semibold">Casa actual · zona tapada</h3>
        <button type="button" disabled={disabled} className="w-full rounded-lg border px-3 py-2 hover:bg-stone-50" onClick={coverDesign}>Tapar debajo del diseño</button>
        <InterventionControls site={site} disabled={disabled} onChange={onChange} onMove={() => { setTool('mask'); setOriginal(false); }} />
        {!site.intervention.length && <p className="text-xs text-ink-soft">Dibuja una zona sobre la casa actual o usa el tapado automático. Después podrás ajustar su giro, ancho y largo.</p>}
        {!!site.intervention.length && <button type="button" disabled={disabled} className="text-xs text-ink-soft underline underline-offset-4" onClick={() => onChange({ intervention: [] })}>Quitar la zona tapada</button>}
      </section>
      <section className="space-y-3 border-t pt-5"><h3 className="font-semibold">Imágenes y vídeo</h3>{videoControls}</section>
    </aside>
  </div>;
}
