'use client';

/**
 * Pasos 1 y 2 del asistente: subir la foto o el plano del espacio (1) y revisar lo
 * que la IA ha detectado en esa imagen (2). Comparten controles (`IngestaControls`),
 * así que comparten componente; lo que cambia es la explicación y el resumen.
 */
import { ZonePhotosPanel } from '@/components/zones/zone-photos-panel';
import { IngestaControls } from './ingesta-controls';
import { PlanDetectedNotice } from './plan-detected-notice';
import { StepHeading } from './step-layout';
import type { UploadedImage } from './image-upload';
import type { ImageKind, StructuralElements } from '@/lib/contracts';

interface Props {
  projectId: string;
  zoneId: string | null;
  detected: StructuralElements | null;
  /** Qué era la imagen analizada; un plano no sirve para el render por foto. */
  imageKind: ImageKind | null;
  /** Lleva el mismo plano a la ruta «convertir un plano al editor». */
  onConvertPlan: () => void;
  /** Aviso del análisis (lo devuelve el agente tras leer la imagen). */
  disclaimer: string | null;
  pending: boolean;
  onUpload: (image: UploadedImage) => void;
  onConfirm: () => void;
  onCorrect: (detected: StructuralElements) => void;
  onSkip: () => void;
}

export function StepSpace({
  projectId,
  zoneId,
  detected,
  imageKind,
  onConvertPlan,
  disclaimer,
  pending,
  onUpload,
  onConfirm,
  onCorrect,
  onSkip,
}: Props) {
  const reviewing = detected !== null;
  return (
    <div className="flex flex-col gap-4">
      <StepHeading step={reviewing ? 2 : 1}>
        {reviewing
          ? 'Esto es lo que he reconocido en tu imagen. Si algo no cuadra, corrige los números: el plano partirá de lo que confirmes.'
          : 'Sube una foto de la estancia o un plano en planta. Con una foto entiendo el ambiente y los muebles; con un plano en planta nítido puedo dibujar un plano 2D fiel a tus medidas.'}
      </StepHeading>

      {reviewing && imageKind === 'floor_plan' ? (
        <PlanDetectedNotice pending={pending} onConvertPlan={onConvertPlan} />
      ) : null}

      {reviewing ? (
        <p className="border-line bg-surface-muted text-ink rounded-control border p-3 text-sm">
          Detecté <strong>{detected.walls}</strong> muros, <strong>{detected.doors}</strong>{' '}
          puertas, <strong>{detected.windows}</strong> ventanas y{' '}
          <strong>{detected.pillars}</strong> pilares.
        </p>
      ) : null}

      {disclaimer ? <p className="text-ink-soft text-xs">{disclaimer}</p> : null}

      <IngestaControls
        detected={detected}
        pending={pending}
        onUpload={onUpload}
        onConfirm={onConfirm}
        onCorrect={onCorrect}
        onSkip={onSkip}
      />

      {/* Más fotos de la zona: la ACTIVA es la referencia del render por foto. */}
      {reviewing ? <ZonePhotosPanel projectId={projectId} zoneId={zoneId} /> : null}
    </div>
  );
}
