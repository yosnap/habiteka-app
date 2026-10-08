'use client';

/**
 * Asistente del proyecto. Antes de nada pregunta QUÉ quiere hacer el usuario
 * (paso 0) y de ahí salen dos rutas:
 * - `design`: crear un diseño a partir de una foto (`DesignRoute`, seis pasos).
 * - `plan`: convertir un plano al editor. Se hace en la pestaña Plano, el único
 *   camino del plano: el asistente lleva allí (con la imagen, si ya se subió).
 *
 * La ruta elegida se persiste en el servidor (`set-intent`), así que al recargar
 * el asistente retoma donde estaba. Este componente solo enruta: cada ruta lleva
 * su propio estado.
 */
import { useState, useTransition } from 'react';
import { StepIntent } from './step-intent';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { uploadStudio } from '@/app/(app)/projects/[id]/_actions/studio-actions';
import { DesignRoute } from './design-route';
import { callAction, type ActionErrorResult } from '@/lib/action-result';
import type { Phase } from './wizard-steps';
import type { AgentInput, AgentOutcome } from '@/server/agent';
import type { UploadedImage } from './image-upload';
import type {
  AssistantIntent,
  DeliverableType,
  Estilo,
  ImageKind,
  StructuralElements,
} from '@/lib/contracts';

interface Props {
  projectId: string;
  advance: (
    projectId: string,
    input: AgentInput,
    zoneId?: string | null,
  ) => Promise<AgentOutcome | ActionErrorResult>;
  initialPhase?: Phase;
  /** Zona activa del proyecto; null = flujo por defecto. El asistente es por zona. */
  zoneId?: string | null;
  /** Lo ya recogido en el servidor: al recargar, se retoma la ruta y los pasos hechos. */
  initialCollected?: {
    intent?: AssistantIntent;
    estilo?: Estilo;
    entregables?: DeliverableType[];
    objetivo?: string;
    detected?: StructuralElements;
    imageKind?: ImageKind;
  };
}

export function QualificationChat({
  projectId,
  advance,
  initialPhase = 'ingesta',
  zoneId = null,
  initialCollected = {},
}: Props) {
  const [intent, setIntent] = useState<AssistantIntent | null>(initialCollected.intent ?? null);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const planoHref = `/projects/${encodeURIComponent(projectId)}/plano${zoneId ? `?zona=${encodeURIComponent(zoneId)}` : ''}`;

  /** El plano se trabaja en la pestaña Plano; una imagen ya subida se guarda como su original, sin IA. */
  const openPlano = (image: UploadedImage | null = null) => {
    setError(null);
    startTransition(async () => {
      try {
        if (image) await callAction(uploadStudio(projectId, image.base64));
        router.push(planoHref);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo abrir el plano.');
      }
    });
  };

  /**
   * Fija la ruta. El servidor solo admite elegirla durante la ingesta, así que
   * cambiar de idea más adelante retrocede antes de fase (`go-back` no borra lo
   * recogido ni los diseños ya generados).
   */
  const pickIntent = (value: AssistantIntent, from: Phase = phase) => {
    if (value === 'plan') return openPlano();
    setError(null);
    startTransition(async () => {
      try {
        let current = from;
        // Como mucho dos saltos: feedback → cualificación → ingesta.
        for (let i = 0; i < 2 && current !== 'ingesta'; i += 1) {
          const back = await callAction(advance(projectId, { action: 'go-back' }, zoneId));
          current = back.phase as Phase;
        }
        const out = await callAction(
          advance(projectId, { action: 'set-intent', intent: value }, zoneId),
        );
        setPhase(out.phase as Phase);
        setIntent(value);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo continuar.');
      }
    });
  };

  if (intent === null) {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto">
        {error ? (
          <p
            role="alert"
            className="rounded-control border border-red-300 bg-red-50 p-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}
        <StepIntent pending={pending} onPick={(value) => pickIntent(value)} />
      </div>
    );
  }

  if (intent === 'plan') {
    // Asistentes anteriores guardaron esta ruta: ahora el plano vive en su pestaña.
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4 text-sm">
        <p>Tu plano se sube, se revisa y se envía al editor en la pestaña <strong>Plano</strong>.</p>
        <div className="flex flex-wrap gap-3">
          <Link className="text-brand-700 underline" href={planoHref}>Ir a la pestaña Plano</Link>
          <button type="button" className="underline" onClick={() => setIntent(null)}>Elegir otra opción</button>
        </div>
      </div>
    );
  }

  return (
    <DesignRoute
      // Remontar al cambiar de ruta: la ruta de diseño arranca de la fase vigente.
      key={phase}
      projectId={projectId}
      advance={advance}
      initialPhase={phase}
      zoneId={zoneId}
      initialCollected={initialCollected}
      onChangeIntent={(current) => {
        setPhase(current);
        setIntent(null);
      }}
      onConvertPlan={(_current, image) => openPlano(image)}
    />
  );
}
