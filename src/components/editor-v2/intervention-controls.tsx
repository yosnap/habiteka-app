'use client';
import type { GeographicSite } from '@/lib/editor-document/geographic-site';
import { interventionShape, resizeIntervention, rotateIntervention } from '@/lib/editor-document/intervention-shape';
import { SiteAdjustmentControl } from './site-adjustment-control';
export function InterventionControls({ site, disabled, onChange, onMove }: {
  site: GeographicSite; disabled: boolean; onChange: (patch: Partial<GeographicSite>) => void; onMove: () => void;
}) {
  if (site.intervention.length < 3) return null;
  const shape = interventionShape(site.intervention);
  return <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
    <strong>Ajustar la zona que tapa el tejado</strong>
    <p className="text-xs">Su giro y tamaño son independientes del diseño. Cubre el tejado completo y evita los árboles que quieres conservar.</p>
    <div className="space-y-4 py-2">
      <SiteAdjustmentControl label="Giro de la zona tapada" value={shape.angle} min={-180} max={180} step={1} unit="°" disabled={disabled}
        onChange={n => onChange({ intervention: rotateIntervention(site.intervention, n) })} />
      <SiteAdjustmentControl label="Ancho de la zona tapada" value={shape.width * site.groundWidthM} min={.5} max={site.groundWidthM} step={.5} unit="m" disabled={disabled}
        onChange={n => onChange({ intervention: resizeIntervention(site.intervention, 'width', n / site.groundWidthM) })} />
      <SiteAdjustmentControl label="Largo de la zona tapada" value={shape.depth * site.groundWidthM} min={.5} max={site.groundWidthM} step={.5} unit="m" disabled={disabled}
        onChange={n => onChange({ intervention: resizeIntervention(site.intervention, 'depth', n / site.groundWidthM) })} />
    </div>
    <button type="button" disabled={disabled} className="cursor-pointer rounded border bg-white px-3 py-2 disabled:cursor-not-allowed"
      onClick={onMove}>Mover zona tapada arrastrando</button>
  </section>;
}
