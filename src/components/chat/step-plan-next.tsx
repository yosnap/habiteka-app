'use client';

/**
 * Paso 3 de la ruta del plano: qué hacer ahora que el plano está en el editor.
 *
 * Con fiabilidad baja la única salida es corregirlo: no se ofrece nada que gaste
 * generaciones, porque partirían de un plano que sabemos mal leído. Quien decide
 * es el servidor (`needsCorrection`, devuelto al aplicar); el veredicto que
 * viaja al cliente solo acompaña a los motivos.
 *
 * Con el plano en verde, la salida principal son las vistas interiores
 * realistas: es lo que el usuario venía buscando cuando subió una planta.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StyleGallery } from '@/components/canvas/style-gallery';
import { estiloLabel } from '@/lib/design-options';
import { interiorsEditorHref } from '@/components/editor-v2/auto-generate-request';
import { StepHeading } from './step-layout';
import { deliverablesHref, editorHref } from './wizard-steps';
import type { Estilo } from '@/lib/contracts';
import type { StudioQuality } from '@/lib/studio-state';

interface Props {
  projectId: string;
  zoneId: string | null;
  quality: StudioQuality;
  /** Veredicto del servidor al aplicar: el plano entra al editor «a corregir». */
  needsCorrection: boolean;
  /** Avisos que dejó la importación al materializarse en el editor. */
  issues: string[];
  /** Cambia a la ruta de diseño (crear un diseño a partir de una foto). */
  onStartDesign: () => void;
  pending: boolean;
}

export function StepPlanNext({
  projectId,
  zoneId,
  quality,
  needsCorrection,
  issues,
  onStartDesign,
  pending,
}: Props) {
  const [estilo, setEstilo] = useState<Estilo | undefined>();
  const blocked = needsCorrection || quality.decision === 'block';
  const href = editorHref(projectId, zoneId);

  return (
    <div className="flex flex-col gap-4">
      <StepHeading step={3} intent="plan">
        {blocked
          ? 'Tu plano ya está en el editor, pero la lectura no es de fiar. Corrígelo allí antes de generar nada.'
          : 'Tu plano ya está en el editor. Puedo generarte una vista realista de cada estancia, tomada desde dentro sobre tus propios muros.'}
      </StepHeading>

      {issues.length > 0 ? (
        <ul className="rounded-control border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          {issues.slice(0, 6).map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      {blocked ? (
        <div className="rounded-control border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <p>
            No generaremos diseños ni vistas con este plano hasta que lo corrijas: saldrían mal y
            te costarían igual. En el editor puedes mover muros, colocar huecos y ajustar medidas.
          </p>
        </div>
      ) : null}

      {blocked ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-ink text-sm font-medium">Elige el estilo de las vistas</p>
          <StyleGallery value={estilo} onChange={setEstilo} disabled={pending} />
          {estilo ? (
            <p className="text-ink-soft text-xs">Estilo elegido: {estiloLabel(estilo)}.</p>
          ) : (
            <p className="text-ink-soft text-xs">
              Puedes generar sin elegir: el editor propone un estilo por defecto que podrás cambiar.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {blocked ? null : (
          <Button asChild>
            <Link href={interiorsEditorHref(projectId, zoneId, estilo)}>
              Generar vistas realistas
            </Link>
          </Button>
        )}

        <Button asChild variant={blocked ? 'default' : 'outline'}>
          <Link href={href}>
            {blocked ? 'Corregir en el editor' : 'Abrir el editor (3D y recorrido)'}
          </Link>
        </Button>

        {blocked ? null : (
          <Button type="button" variant="ghost" onClick={onStartDesign} disabled={pending}>
            Crear un diseño a partir de una foto
          </Button>
        )}
      </div>

      {blocked ? null : (
        <p className="text-ink-soft text-xs">
          «Generar vistas realistas» abre el editor con una imagen por estancia ya preparada; cada
          imagen se cobra al generarla. Las que crees aparecerán en{' '}
          <Link className="underline" href={deliverablesHref(projectId, zoneId)}>
            Diseños
          </Link>
          .
        </p>
      )}
    </div>
  );
}
