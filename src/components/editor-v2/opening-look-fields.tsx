'use client';
import { ModernSelect } from '@/components/ui/modern-select';
import type { EditorDocument, Opening } from '@/lib/editor-document/schema';
import type { OpeningType } from '@/lib/editor-document/opening-types';
import { openingLook, openingLookControls } from '@/lib/editor-document/opening-look';
import { setOpeningLook } from '@/lib/editor-document/opening-type-commands';
import { DOOR_HANDLE_NAMES, DOOR_HANDLES, FRAME_FINISH_NAMES, FRAME_FINISHES, isDoorHandle, isFrameFinish, isLeafDesign, isLeafFinish,
  LEAF_DESIGN_NAMES, LEAF_DESIGNS, LEAF_FINISH_NAMES, LEAF_FINISHES } from '@/lib/editor-document/opening-look-options';
import { PropertySection } from './property-section';
import styles from './editor.module.css';

type Edit = (operation: (document: EditorDocument) => EditorDocument) => boolean;

/** Opción vacía del acabado: la hoja o el marco conservan el color de Pintar, como en los documentos anteriores. */
const PAINTED = '';

/**
 * Aspecto de una puerta o ventana, independiente de su tipo: diseño de la hoja, acabado, tirador y marco. Cada tipo
 * enseña solo lo que admite (una puerta de vidrio templado no tiene acabado de madera; una ventana, solo su marco).
 */
export function OpeningLookFields({ opening, type, edit }: { opening: Opening; type: OpeningType; edit: Edit }) {
  const controls = openingLookControls(type), look = openingLook(opening);
  if (!controls.design && !controls.finish && !controls.handle && !controls.frameFinish) return null;
  return <PropertySection title="Aspecto">
    {controls.design && <label className={styles.field}>Diseño de la hoja<ModernSelect aria-label="Diseño de la hoja" value={look.design}
      onChange={(event) => { const value = event.target.value; if (isLeafDesign(value)) edit((doc) => setOpeningLook(doc, opening.id, { leafDesign: value })); }}>
      {LEAF_DESIGNS.map((design) => <option key={design} value={design}>{LEAF_DESIGN_NAMES[design]}</option>)}
    </ModernSelect></label>}
    {controls.finish && <label className={styles.field}>Acabado<ModernSelect aria-label="Acabado" value={look.finish ?? PAINTED}
      onChange={(event) => { const value = event.target.value;
        edit((doc) => setOpeningLook(doc, opening.id, { leafFinish: isLeafFinish(value) ? value : undefined })); }}>
      <option value={PAINTED}>Color de Pintar</option>
      {LEAF_FINISHES.map((finish) => <option key={finish} value={finish}>{LEAF_FINISH_NAMES[finish]}</option>)}
    </ModernSelect></label>}
    {controls.handle && <label className={styles.field}>Tirador<ModernSelect aria-label="Tirador" value={look.handle}
      onChange={(event) => { const value = event.target.value; if (isDoorHandle(value)) edit((doc) => setOpeningLook(doc, opening.id, { handle: value })); }}>
      {DOOR_HANDLES.map((handle) => <option key={handle} value={handle}>{DOOR_HANDLE_NAMES[handle]}</option>)}
    </ModernSelect></label>}
    {controls.frameFinish && <label className={styles.field}>Marco<ModernSelect aria-label="Marco" value={look.frameFinish ?? PAINTED}
      onChange={(event) => { const value = event.target.value;
        edit((doc) => setOpeningLook(doc, opening.id, { frameFinish: isFrameFinish(value) ? value : undefined })); }}>
      <option value={PAINTED}>Color de Pintar</option>
      {FRAME_FINISHES.map((finish) => <option key={finish} value={finish}>{FRAME_FINISH_NAMES[finish]}</option>)}
    </ModernSelect></label>}
    <p className={styles.hint}>Se ve en 3D y en las fotos del catálogo. Las maderas usan texturas CC0; el acabado de una puerta se aplica también a su marco y tapajuntas. Pintar la hoja o el marco vuelve al color pintado.</p>
  </PropertySection>;
}
