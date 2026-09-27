'use client';
import { useState } from 'react';
import type { Ceiling, EditorDocument, LightZone } from '@/lib/editor-document/schema';
import { applyLightingProposals, ceilingDropMm, MAX_CEILING_DROP_MM, MIN_CEILING_DROP_MM, roofThicknessMm, setCeilingTopMaterialForAllRooms, setCeilingsForAllRooms } from '@/lib/editor-document/ceiling-commands';
import { proposeLightingForPlan, type LightingProposal } from '@/lib/editor-document/lighting-proposal';
import { NumberField } from './property-number-field';
import styles from './ceiling-lighting.module.css';
import { ModernSelect } from '@/components/ui/modern-select';
import { SurfaceMaterialPicker } from './surface-material-picker';

/**
 * Techo y luces de TODA la planta en pocos pasos: el mismo techo en todas las
 * estancias, una propuesta de luces para las que aún no tienen y seleccionar
 * todas las luces para editarlas en bloque. Lo específico de una estancia se
 * sigue haciendo en el modo «Una estancia».
 */
export function CeilingPlanSection({ doc, roomCount, readOnly, zone, run, onNotice, onSelectAll }: {
  doc: EditorDocument;
  roomCount: number;
  readOnly: boolean;
  /** Zona de luces activa: si la hay, la propuesta no sale de su contorno. */
  zone: LightZone | null;
  run: (operation: (document: EditorDocument) => EditorDocument) => boolean;
  onNotice: (message: string) => void;
  onSelectAll: () => void;
}) {
  const [kind, setKind] = useState<Ceiling['kind']>('plain');
  const [color, setColor] = useState('#f4f1e9');
  const [topMaterialId, setTopMaterialId] = useState<string | null>(() => {
    const materials = new Set(doc.ceilings?.map((ceiling) => ceiling.topMaterialId ?? null) ?? []);
    return materials.size === 1 ? [...materials][0] ?? null : null;
  });
  const [dropMm, setDropMm] = useState(150);
  const [thicknessMm, setThicknessMm] = useState(160);
  const [style, setStyle] = useState('moderno');
  const [proposals, setProposals] = useState<LightingProposal[] | null>(null);
  // Estancias con luces que la última propuesta se saltó, y si el usuario pidió incluirlas.
  const [skippedLit, setSkippedLit] = useState(0);
  const [includeLit, setIncludeLit] = useState(false);
  const [accentSpots, setAccentSpots] = useState(false);
  const [cove, setCove] = useState(false);
  const ceilings = doc.ceilings?.length ?? 0, lights = doc.luminaires?.length ?? 0;
  const proposedLights = proposals?.reduce((sum, proposal) => sum + proposal.lights.length, 0) ?? 0;
  const proposedCoves = proposals?.filter((proposal) => proposal.cove).length ?? 0;

  const applyCeilings = () => {
    let summary = '';
    const ok = run((document) => {
      const result = setCeilingsForAllRooms(document, { kind, color, topMaterialId, roofThicknessMm: thicknessMm,
        ...(kind === 'suspended' ? { dropMm } : {}) });
      summary = `Techo aplicado en ${result.applied} estancias.${result.skipped ? ` ${result.skipped} se saltaron. ${result.skippedReason ?? ''}` : ''}`.trim();
      return result.document;
    });
    if (ok) { onNotice(summary); setProposals(null); setSkippedLit(0); }
  };

  return <fieldset disabled={readOnly} aria-label="Techo y luces de toda la planta">
    <p>{roomCount} estancias interiores · {ceilings} con techo · {lights} luces.</p>
    <h3>Techo en todas las estancias</h3>
    <div className={styles.fields}>
      <label>Tipo de techo<ModernSelect value={kind} onChange={(e) => setKind(e.target.value as Ceiling['kind'])}>
        <option value="plain">Techo plano</option><option value="suspended">Falso techo</option>
      </ModernSelect></label>
      <label>Acabado<input type="color" aria-label="Acabado de todos los techos" value={color} onChange={(e) => setColor(e.target.value)} /></label>
      {kind === 'suspended' && <NumberField label="Descenso del techo (cm)" value={dropMm / 10} change={(value) => setDropMm(ceilingDropMm(value))} />}
    </div>
    <SurfaceMaterialPicker label="Cara superior de todas las cubiertas" value={topMaterialId ?? undefined}
      onChange={(id) => setTopMaterialId(id ?? null)} />
    <NumberField label="Espesor de las cubiertas (cm)" value={thicknessMm / 10}
      change={(value) => setThicknessMm(roofThicknessMm(value))} />
    <button type="button" disabled={!ceilings} onClick={() => {
      if (run((document) => setCeilingTopMaterialForAllRooms(document, topMaterialId)))
        onNotice(`Material superior ${topMaterialId ? 'aplicado' : 'quitado'} en ${ceilings} techos. Se han conservado el tipo, el acabado interior y las luces.`);
    }}>Aplicar solo a las caras superiores ({ceilings})</button>
    {kind === 'suspended' && <p>El descenso va en centímetros, entre {MIN_CEILING_DROP_MM / 10} y {MAX_CEILING_DROP_MM / 10} cm.</p>}
    <button className={styles.primary} type="button" onClick={applyCeilings}>
      {ceilings ? 'Aplicar este techo a todas las estancias' : 'Poner techo en todas las estancias'}
    </button>
    <div className={styles.proposal}>
      <h3>Luces en toda la planta</h3>
      <p>Propone luces para cada estancia con techo que aún no tiene ninguna. No consume créditos IA.</p>
      <label>Estilo<ModernSelect value={style} onChange={(e) => { setStyle(e.target.value); setProposals(null); }}>
        <option value="moderno">Moderno</option><option value="mediterraneo">Mediterráneo</option>
      </ModernSelect></label>
      <label className={styles.check}><input type="checkbox" checked={accentSpots}
        onChange={(e) => { setAccentSpots(e.target.checked); setProposals(null); }} /> Focos orientables de acento</label>
      <label className={styles.check}><input type="checkbox" checked={cove}
        onChange={(e) => { setCove(e.target.checked); setProposals(null); }} /> Foseado perimetral en las estancias con falso techo</label>
      <label className={styles.check}><input type="checkbox" checked={includeLit}
        onChange={(e) => { setIncludeLit(e.target.checked); setProposals(null); setSkippedLit(0); }} /> Proponer también donde ya hay luces</label>
      {zone && <p>Acotada a la zona «{zone.name}»: fuera de su contorno no se propone ninguna luz.</p>}
      <button type="button" disabled={!ceilings} onClick={() => {
        const next = proposeLightingForPlan(doc, style, { accentSpots, cove, includeLit, ...(zone ? { zonePolygonsMm: zone.polygonsMm } : {}) });
        setProposals(next.proposals);
        setSkippedLit(next.skippedLit);
        if (!next.proposals.length) onNotice(next.skippedLit
          ? `Todas las estancias con techo ya tienen luces (${next.skippedLit}). Marca «Proponer también donde ya hay luces» para añadir más.`
          : 'No hay ninguna estancia con techo a la que proponer luces.');
      }}>Preparar propuesta para toda la planta</button>
      {!!skippedLit && <p role="status">{skippedLit} {skippedLit === 1 ? 'estancia se ha saltado' : 'estancias se han saltado'} por tener ya luces. Marca «Proponer también donde ya hay luces» para añadir sin quitar las existentes.</p>}
      {proposals && proposals.length > 0 && <div aria-label="Revisión de propuesta de la planta">
        <p>{proposedLights} luminarias nuevas{proposedCoves ? ` y ${proposedCoves} foseados` : ''} en {proposals.length} estancias. Después puedes seleccionarlas todas y ajustarlas a la vez.</p>
        <div className={styles.buttons}>
          <button className={styles.primary} type="button" onClick={() => { if (run((d) => applyLightingProposals(d, proposals))) { setProposals(null); setSkippedLit(0); } }}>Añadir al plano</button>
          <button type="button" onClick={() => { setProposals(null); setSkippedLit(0); }}>Cancelar</button>
        </div>
      </div>}
      <button type="button" disabled={!lights} onClick={onSelectAll}>Seleccionar todas las luces ({lights})</button>
    </div>
  </fieldset>;
}
