'use client';
import { useState } from 'react';
import type { Ceiling, EditorDocument } from '@/lib/editor-document/schema';
import { applyLightingProposals, setCeilingsForAllRooms } from '@/lib/editor-document/ceiling-commands';
import { proposeLightingForPlan, type LightingProposal } from '@/lib/editor-document/lighting-proposal';
import { NumberField } from './property-number-field';
import styles from './ceiling-lighting.module.css';

/**
 * Techo y luces de TODA la planta en pocos pasos: el mismo techo en todas las
 * estancias, una propuesta de luces para las que aún no tienen y seleccionar
 * todas las luces para editarlas en bloque. Lo específico de una estancia se
 * sigue haciendo en el modo «Una estancia».
 */
export function CeilingPlanSection({ doc, roomCount, readOnly, run, onNotice, onSelectAll }: {
  doc: EditorDocument;
  roomCount: number;
  readOnly: boolean;
  run: (operation: (document: EditorDocument) => EditorDocument) => boolean;
  onNotice: (message: string) => void;
  onSelectAll: () => void;
}) {
  const [kind, setKind] = useState<Ceiling['kind']>('plain');
  const [color, setColor] = useState('#f4f1e9');
  const [dropMm, setDropMm] = useState(150);
  const [style, setStyle] = useState('moderno');
  const [proposals, setProposals] = useState<LightingProposal[] | null>(null);
  const ceilings = doc.ceilings?.length ?? 0, lights = doc.luminaires?.length ?? 0;
  const proposedLights = proposals?.reduce((sum, proposal) => sum + proposal.lights.length, 0) ?? 0;

  const applyCeilings = () => {
    let summary = '';
    const ok = run((document) => {
      const result = setCeilingsForAllRooms(document, { kind, color, ...(kind === 'suspended' ? { dropMm } : {}) });
      summary = `Techo aplicado en ${result.applied} estancias.${result.skipped ? ` ${result.skipped} no lo admiten por altura libre o cierre.` : ''}`;
      return result.document;
    });
    if (ok) { onNotice(summary); setProposals(null); }
  };

  return <fieldset disabled={readOnly} aria-label="Techo y luces de toda la planta">
    <p>{roomCount} estancias interiores · {ceilings} con techo · {lights} luces.</p>
    <h3>Techo en todas las estancias</h3>
    <div className={styles.fields}>
      <label>Tipo de techo<select value={kind} onChange={(e) => setKind(e.target.value as Ceiling['kind'])}>
        <option value="plain">Techo plano</option><option value="suspended">Falso techo</option>
      </select></label>
      <label>Acabado<input type="color" aria-label="Acabado de todos los techos" value={color} onChange={(e) => setColor(e.target.value)} /></label>
      {kind === 'suspended' && <NumberField label="Descenso del techo (cm)" value={dropMm / 10} change={(value) => setDropMm(value * 10)} />}
    </div>
    <button className={styles.primary} type="button" onClick={applyCeilings}>
      {ceilings ? 'Aplicar este techo a todas las estancias' : 'Poner techo en todas las estancias'}
    </button>
    <div className={styles.proposal}>
      <h3>Luces en toda la planta</h3>
      <p>Propone luces para cada estancia con techo que aún no tiene ninguna. No consume créditos IA.</p>
      <label>Estilo<select value={style} onChange={(e) => { setStyle(e.target.value); setProposals(null); }}>
        <option value="moderno">Moderno</option><option value="mediterraneo">Mediterráneo</option>
      </select></label>
      <button type="button" disabled={!ceilings} onClick={() => {
        const next = proposeLightingForPlan(doc, style);
        setProposals(next);
        if (!next.length) onNotice('Todas las estancias con techo ya tienen luces.');
      }}>Preparar propuesta para toda la planta</button>
      {proposals && proposals.length > 0 && <div aria-label="Revisión de propuesta de la planta">
        <p>{proposedLights} luminarias nuevas en {proposals.length} estancias. Después puedes seleccionarlas todas y ajustarlas a la vez.</p>
        <div className={styles.buttons}>
          <button className={styles.primary} type="button" onClick={() => { if (run((d) => applyLightingProposals(d, proposals))) setProposals(null); }}>Añadir al plano</button>
          <button type="button" onClick={() => setProposals(null)}>Cancelar</button>
        </div>
      </div>}
      <button type="button" disabled={!lights} onClick={onSelectAll}>Seleccionar todas las luces ({lights})</button>
    </div>
  </fieldset>;
}
