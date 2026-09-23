'use client';

/**
 * Asistente del proyecto. Antes de nada pregunta QUÉ quiere hacer el usuario
 * (paso 0) y de ahí salen dos rutas:
 * - `design`: crear un diseño a partir de una foto (`DesignRoute`, seis pasos).
 * - `plan`: convertir un plano al editor (`PlanRoute`: subir → fiabilidad → editor).
 *
 * La ruta elegida se persiste en el servidor (`set-intent`), así que al recargar
 * el asistente retoma donde estaba. Este componente solo enruta: cada ruta lleva
 * su propio estado.
 */
import { useState, useTransition } from 'react';
import { StepIntent } from './step-intent';
import { PlanRoute } from './plan-route';
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
  // Plano que venía de la ruta de diseño: la ruta del plano lo importa sin pedirlo otra vez.
  const [handoverImage, setHandoverImage] = useState<UploadedImage | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Fija la ruta. El servidor solo admite elegirla durante la ingesta, así que
   * cambiar de idea más adelante retrocede antes de fase (`go-back` no borra lo
   * recogido ni los diseños ya generados).
   */
  const pickIntent = (value: AssistantIntent, from: Phase = phase) => {
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
    return (
      <PlanRoute
        projectId={projectId}
        zoneId={zoneId}
        initialImage={handoverImage}
        onChangeIntent={() => {
          setHandoverImage(null);
          setIntent(null);
        }}
        onStartDesign={() => {
          setHandoverImage(null);
          pickIntent('design');
        }}
      />
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
      onConvertPlan={(current, image) => {
        setHandoverImage(image);
        pickIntent('plan', current);
      }}
    />
  );
}
