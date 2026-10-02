'use client';
import type { Ceiling, EditorDocument, LightStrip } from '@/lib/editor-document/schema';
import { addCoveStrip, addUnderCabinetStrip, refitLightStrip, removeLightStrip, updateLightStrip, type LightStripPatch } from '@/lib/editor-document/light-strip-commands';
import type { KitchenRun } from '@/lib/editor-document/kitchen-run-types';
import { lightStripIssue } from '@/lib/editor-document/light-strip-geometry';
import { STRIP_KIND_LABELS, stripLengthMm } from '@/lib/editor-document/light-strip-types';
import { LightStripFields } from './light-strip-fields';
import { InlineConfirmButton } from '@/components/ui/inline-confirm-button';
import styles from './ceiling-lighting.module.css';

/**
 * Tiras LED de una estancia: foseado del falso techo en un clic y tramos
 * libres dibujados a mano. La ficha dice siempre si la tira sigue al contorno
 * o se ajustó a mano, que es lo que explica que deje de seguir al muro.
 */
export function CeilingStripSection({ doc, ceiling, strips, kitchenRuns, selectedId, readOnly, run, onDraw }: {
  doc: EditorDocument;
  ceiling: Ceiling;
  /** Tiras de esta estancia: el foseado del techo, las de cocina y los tramos libres que caen dentro. */
  strips: readonly LightStrip[];
  /** Tramos de cocina de esta estancia, para colgar su tira bajo los módulos altos. */
  kitchenRuns: readonly KitchenRun[];
  selectedId?: string;
  readOnly: boolean;
  run: (operation: (document: EditorDocument) => EditorDocument) => boolean;
  onDraw: () => void;
}) {
  const cove = strips.find((strip) => strip.kind === 'cove');
  const suspended = ceiling.kind === 'suspended' && ceiling.dropMm >= 80;
  const update = (id: string) => (patch: LightStripPatch) => run((document) => updateLightStrip(document, id, patch));
  return <>
    <h3>Tiras LED</h3>
    <div className={styles.buttons}>
      <button type="button" disabled={!suspended || !!cove}
        title={!suspended ? 'Requiere falso techo con al menos 8 cm de descenso' : cove ? 'Esta estancia ya tiene foseado' : undefined}
        onClick={() => run((document) => addCoveStrip(document, ceiling.id))}>Foseado del falso techo</button>
      <button type="button" onClick={onDraw}>Dibujar tira libre</button>
      {kitchenRuns.map((kitchenRun, index) => {
        const existing = strips.some((strip) => strip.kitchenRunId === kitchenRun.id);
        return <button type="button" key={kitchenRun.id} disabled={!kitchenRun.kitchen.uppers || existing}
          title={!kitchenRun.kitchen.uppers ? 'Este tramo no tiene módulos altos bajo los que colgar la tira'
            : existing ? 'Este tramo de cocina ya tiene tira bajo los módulos altos' : undefined}
          onClick={() => run((document) => addUnderCabinetStrip(document, kitchenRun.id))}>
          Tira bajo módulos altos{kitchenRuns.length > 1 ? ` · Tramo ${index + 1}` : ''}
        </button>;
      })}
    </div>
    <p>El foseado sigue al contorno de la estancia y la tira de cocina, a su mueble. Arrastra un vértice en el plano para ajustarla a mano; entonces deja de seguir al muro o al mueble.</p>
    {strips.map((strip, index) => {
      const issue = lightStripIssue(doc, strip);
      return <details className={styles.light} key={strip.id} open={selectedId === strip.id || undefined}>
        <summary>{STRIP_KIND_LABELS[strip.kind]} {index + 1} · {strip.derived ? 'Sigue el contorno' : 'Ajustada a mano'}</summary>
        <p>{(stripLengthMm(strip.pathMm) / 1000).toFixed(2)} m · {Math.round((stripLengthMm(strip.pathMm) / 1000) * strip.lumensPerMeter)} lm</p>
        {issue && <p role="status">Revisar: {issue}.</p>}
        <LightStripFields strip={strip} update={update(strip.id)} />
        <div className={styles.buttons}>
          {strip.kind !== 'free' && !strip.derived && <InlineConfirmButton
            label={strip.kind === 'under-cabinet' ? 'Reajustar al mueble' : 'Reajustar al contorno de la estancia'}
            question="Se perderán los retoques del recorrido. ¿Reajustar?"
            disabled={readOnly}
            onConfirm={() => run((document) => refitLightStrip(document, strip.id))} />}
          <button type="button" className={styles.danger} onClick={() => run((document) => removeLightStrip(document, strip.id))}>Eliminar tira</button>
        </div>
      </details>;
    })}
    {!strips.length && !readOnly && <p>Sin tiras en esta estancia.</p>}
  </>;
}
