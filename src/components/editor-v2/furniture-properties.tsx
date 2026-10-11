'use client';
import { planObjects, isBoundary } from '@/lib/editor-document/boundary-types';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { isKitchenRun } from '@/lib/editor-document/kitchen-run-types';
import { isWindowDressing, windowCoverage } from '@/lib/editor-document/furniture-profiles';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { furnitureSpatial } from '@/lib/editor-document/spatial-properties';
import { MeterField, NumberField } from './property-number-field';
import { PropertySection } from './property-section';
import { isPorch, porchAccess } from '@/lib/editor-document/porch-volumes';
import styles from './editor.module.css';
import { ModernSelect } from '@/components/ui/modern-select';
import { loungerBackrest, setLoungerBackrest } from '@/lib/editor-document/lounger-backrest';

export function FurnitureProperties({ furniture, multiple, edit }: {
  furniture: ReturnType<typeof planObjects>[number]; multiple: boolean;
  edit: (operation: (document: EditorDocument) => EditorDocument) => boolean;
}) {
  const values = { ...furniture, ...furnitureSpatial(furniture) };
  const backrest = !multiple && !isBoundary(furniture) && !isKitchenRun(furniture) ? loungerBackrest(furniture) : undefined;
  return <>
    {backrest && <PropertySection title="Respaldo de la tumbona">
      <label className={styles.field}><span>Posición del respaldo</span>
        <ModernSelect appearance="editor" value={backrest.raised ? 'raised' : 'flat'}
          onChange={event => edit(doc => setLoungerBackrest(doc, furniture.id, event.target.value === 'raised'))}>
          <option value="flat">Tumbado</option><option value="raised">Inclinado</option>
        </ModernSelect>
      </label>
    </PropertySection>}
    <PropertySection title="Dimensiones">
      <div className={styles.fields}>
        {([['widthMm', 'Ancho'], ['depthMm', 'Fondo'], ['heightMm', 'Altura']] as const).map(([key, label]) =>
          <MeterField key={key} label={(isBoundary(furniture) || isKitchenRun(furniture)) && key === 'widthMm' ? 'Longitud' : isBoundary(furniture) && key === 'depthMm' ? 'Espesor' : isKitchenRun(furniture) && key === 'heightMm' ? 'Altura de encimera' : label}
            valueMm={values[key]} change={(value) => edit((doc) => updateFurniture(doc, furniture.id,
              !multiple && key === 'heightMm' && isWindowDressing(furniture)
                ? { heightMm: value, elevationMm: Math.max(0, values.elevationMm + values.heightMm - value) }
                : { [key]: value }))} />)}
      </div>
    </PropertySection>
    <PropertySection title="Posición y giro">
      <div className={styles.fields}>
        {!multiple && (['x', 'y'] as const).map((key) => <MeterField key={key} label={`Posición ${key.toUpperCase()}`} valueMm={values[key]}
          change={(value) => edit((doc) => updateFurniture(doc, furniture.id, { [key]: value }))} />)}
        <MeterField label={isPorch(furniture) ? 'Cota del suelo del porche' : 'Elevación'} valueMm={values.elevationMm} change={(elevationMm) => edit((doc) => updateFurniture(doc, furniture.id, { elevationMm }))} />
        <NumberField label="Giro (°)" value={furniture.rotation} change={(rotation) => edit((doc) => updateFurniture(doc, furniture.id, { rotation }))} />
      </div>
      {!multiple && isWindowDressing(furniture) && <NumberField label="Cobertura de la ventana (%)" value={Math.round(windowCoverage(furniture) * 100)}
        change={(percent) => edit((doc) => updateFurniture(doc, furniture.id, { coverage: Math.max(0, Math.min(100, percent)) / 100 }))} />}
    </PropertySection>
    {!multiple && isPorch(furniture) && <PropertySection title="Acceso al porche">
      <label className={styles.field}><span>Peldaños delanteros</span><input type="checkbox" checked={!!furniture.porchSteps}
        onChange={(event) => edit((doc) => updateFurniture(doc, furniture.id, { porchSteps: event.target.checked }))} /></label>
      <p>{values.elevationMm === 0 ? 'A ras de suelo, sin escalones.' : furniture.porchSteps
        ? `${porchAccess(furniture).count} subidas de ${(porchAccess(furniture).riser / 10).toFixed(1)} cm; la última llega al suelo del porche.`
        : 'Base elevada sin peldaños. Puedes activar el acceso delantero o colocar una escalera independiente.'}</p>
      <p>El fondo corresponde a la cubierta; los peldaños sobresalen por delante. El lado trasero queda libre para la puerta de la casa.</p>
    </PropertySection>}
  </>;
}
