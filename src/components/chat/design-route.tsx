'use client';

/**
 * Ruta «crear un diseño a partir de una foto»: flujo guiado en seis pasos
 * (espacio → detección → estilo → entregables → confirmación → resultado).
 *
 * El paso visible se deriva de la fase persistida en el servidor, que sigue siendo
 * la fuente de verdad: la navegación local nunca ofrece acciones que las guardas
 * del agente vayan a rechazar. Las preferencias se guardan con `set-preferences`
 * (determinista, sin modelo); solo la generación (`deliver`) es cara.
 */
import { useState, useTransition } from 'react';
import { StepSpace } from './step-space';
import { StepStyle } from './step-style';
import { StepDeliverables } from './step-deliverables';
import { StepReview } from './step-review';
import { StepResult } from './step-result';
import { WizardStepper } from './wizard-stepper';
import { type UploadedImage } from './image-upload';
import { useMountEffect } from '@/lib/use-mount-effect';
import { acceptCurrentTos, checkTosAccepted } from '@/server/legal/actions';
import { callAction, type ActionErrorResult } from '@/lib/action-result';
import {
  DESIGN_STEPS,
  isStepReachable,
  stepFromPhase,
  type Phase,
  type StepId,
} from './wizard-steps';
import type { AgentInput, AgentOutcome } from '@/server/agent';
import type {
  Deliverable,
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
  /** Vuelve al paso 0 (elegir ruta); recibe la fase en curso para poder retroceder. */
  onChangeIntent: (phase: Phase) => void;
  /**
   * Lleva a la ruta del plano la imagen ya subida aquí, para no pedirla dos veces.
   * Recibe la fase en curso porque cambiar de ruta exige retroceder en el servidor.
   */
  onConvertPlan: (phase: Phase, image: UploadedImage | null) => void;
  /** Lo ya recogido en el servidor: al recargar, los pasos completados siguen accesibles. */
  initialCollected?: {
    estilo?: Estilo;
    entregables?: DeliverableType[];
    objetivo?: string;
    detected?: StructuralElements;
    imageKind?: ImageKind;
  };
}

export function DesignRoute({
  projectId,
  advance,
  initialPhase = 'ingesta',
  zoneId = null,
  initialCollected = {},
  onChangeIntent,
  onConvertPlan,
}: Props) {
  // Paso actual + sentido del último cambio (la animación entra por la derecha al
  // avanzar y por la izquierda al retroceder).
  const [nav, setNav] = useState<{ step: StepId; dir: 'forward' | 'back' }>(() => ({
    step: stepFromPhase(initialPhase, initialCollected.detected !== undefined),
    dir: 'forward',
  }));
  const step = nav.step;
  const setStep = (next: StepId) =>
    setNav((prev) => ({ step: next, dir: next >= prev.step ? 'forward' : 'back' }));
  const [phase, setPhase] = useState<Phase>(initialPhase);
  // Números detectados (para revisar/corregir), rehidratados de lo persistido.
  const [detectedEls, setDetectedEls] = useState<StructuralElements | null>(
    initialCollected.detected ?? null,
  );
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  // Plano o foto: decide si el paso 2 avisa de que este camino no dará vistas fieles.
  const [imageKind, setImageKind] = useState<ImageKind | null>(initialCollected.imageKind ?? null);
  // Última imagen subida aquí: si resulta ser un plano, viaja tal cual a la otra ruta.
  const [lastUpload, setLastUpload] = useState<UploadedImage | null>(null);
  // Estado acumulado de la cualificación (reflejo de lo persistido en el servidor).
  const [estilo, setEstilo] = useState<Estilo | undefined>(initialCollected.estilo);
  const [entregables, setEntregables] = useState<DeliverableType[]>(
    initialCollected.entregables ?? [],
  );
  const [objetivo, setObjetivo] = useState(initialCollected.objetivo ?? '');
  const [tosAccepted, setTosAccepted] = useState<boolean | null>(null);
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  // Entregables del turno actual, para la vista previa del paso 6. null = no se ha
  // generado en esta sesión (p. ej. se entra ya en feedback tras recargar).
  const [result, setResult] = useState<Deliverable[] | null>(null);
  const [pending, startTransition] = useTransition();

  useMountEffect(() => {
    void checkTosAccepted()
      .then(setTosAccepted)
      .catch(() => setTosAccepted(false));
  });

  const acceptTos = () =>
    startTransition(async () => {
      await acceptCurrentTos();
      setTosAccepted(true);
    });

  /**
   * Ejecuta una acción del agente y refleja el estado resultante. `nextStep` fija el
   * paso destino cuando la acción sale bien; si se omite, se deriva de la fase.
   */
  const run = (
    input: AgentInput,
    options: { nextStep?: StepId; onOk?: (out: AgentOutcome) => void } = {},
  ) => {
    setActionError(null);
    startTransition(async () => {
      try {
        const out = await callAction(advance(projectId, input, zoneId));
        setPhase(out.phase as Phase);
        setEstilo(out.collected.estilo);
        setEntregables(out.collected.entregables);
        if (out.detected) setDetectedEls(out.detected);
        setImageKind(out.collected.imageKind ?? null);
        setStep(options.nextStep ?? stepFromPhase(out.phase as Phase, out.detected !== undefined));
        options.onOk?.(out);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'No se pudo continuar.');
      }
    });
  };

  const onUploadImage = (image: UploadedImage) => {
    setDisclaimer(null);
    setLastUpload(image);
    run(
      {
        action: 'ingest',
        image: [{ type: 'image_url', base64: image.base64, mimeType: image.mimeType }],
      },
      { onOk: (out) => setDisclaimer(out.disclaimer ?? null) },
    );
  };

  const onConfirmDetection = () => run({ action: 'confirm-detection' }, { nextStep: 3 });
  const onSkipDetection = () => run({ action: 'skip-detection' }, { nextStep: 3 });
  // Corregir no avanza de fase: el plano base partirá de los números corregidos.
  const onCorrectDetection = (els: StructuralElements) =>
    run({ action: 'correct-detection', detected: els }, { nextStep: 2 });

  // Del paso 3 al 2: hay que retroceder también en el servidor (cualificación → ingesta).
  const onBackToSpace = () =>
    run(
      { action: 'go-back' },
      {
        nextStep: 2,
        onOk: () => setDisclaimer(null),
      },
    );

  const onPickStyle = (value: Estilo) => setEstilo(value);
  const onToggleDeliverable = (value: DeliverableType) =>
    setEntregables((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );

  // Con un resultado ya generado, cambiar preferencias abre una variante: el servidor
  // vuelve a cualificación antes de guardarlas. Navegar sin cambiar nada no lo hace.
  const reopenIfDelivered = async () => {
    if (phase !== 'feedback') return;
    await callAction(advance(projectId, { action: 'go-back' }, zoneId));
    setPhase('cualificacion');
    setResult(null);
    setDeliverError(null);
  };

  // Guarda lo elegido al avanzar de paso (determinista, sin modelo) para que la
  // generación encuentre estilo y entregables ya persistidos. Se envían siempre ambos:
  // la respuesta del servidor reemplaza el estado local y no debe perderse nada.
  const savePreferences = (nextStep: StepId) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await reopenIfDelivered();
        const out = await callAction(
          advance(projectId, { action: 'set-preferences', estilo, entregables }, zoneId),
        );
        setPhase(out.phase as Phase);
        setEstilo(out.collected.estilo);
        setEntregables(out.collected.entregables);
        setStep(nextStep);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'No se pudo continuar.');
      }
    });
  };

  const onNextFromStyle = () => {
    if (estilo === undefined) return;
    savePreferences(4);
  };
  const onNextFromDeliverables = () => {
    if (entregables.length === 0) return;
    savePreferences(5);
  };

  /**
   * Generación: guarda el objetivo y lanza `deliver`. Si falla, la fase no avanza y
   * se ofrece reintentar sin recargar.
   */
  const onDeliver = () => {
    setDeliverError(null);
    setActionError(null);
    setGenerating(true);
    startTransition(async () => {
      try {
        await reopenIfDelivered();
        await callAction(
          advance(projectId, { action: 'set-preferences', estilo, entregables, objetivo }, zoneId),
        );
        const out = await callAction(advance(projectId, { action: 'deliver' }, zoneId));
        setPhase(out.phase as Phase);
        setEstilo(out.collected.estilo);
        setEntregables(out.collected.entregables);
        setResult(out.deliverables ?? []);
        setStep(stepFromPhase(out.phase as Phase, false));
      } catch (err) {
        setDeliverError(err instanceof Error ? err.message : 'No se pudieron generar los diseños.');
      } finally {
        setGenerating(false);
      }
    });
  };

  // Otra variante: vuelve de feedback a cualificación y al paso del estilo.
  const onNewVariant = () =>
    run(
      { action: 'go-back' },
      {
        nextStep: 3,
        onOk: () => {
          setResult(null);
          setDeliverError(null);
        },
      },
    );

  const reachable = (destino: StepId) =>
    isStepReachable(destino, {
      intent: 'design',
      phase,
      hasDetection: detectedEls !== null,
      selection: { estilo, entregables },
    });

  // Salto desde la cabecera. Solo toca el servidor cuando el paso exige otra fase:
  // adelante desde la revisión (confirma lo detectado) o atrás hasta la subida. Con un
  // resultado ya generado se navega libremente entre preferencias y resultado.
  const onSelectStep = (destino: StepId) => {
    if (!reachable(destino) || destino === step) return;
    if (phase === 'ingesta' && destino >= 3) {
      run({ action: 'confirm-detection' }, { nextStep: destino });
      return;
    }
    if (phase === 'cualificacion' && destino <= 2) {
      onBackToSpace();
      return;
    }
    setStep(destino);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto">
      <WizardStepper
        steps={DESIGN_STEPS}
        onChangeIntent={() => onChangeIntent(phase)}
        current={step}
        isReachable={reachable}
        onSelect={onSelectStep}
        disabled={pending || generating}
      />

      {actionError ? (
        <p
          role="alert"
          className="rounded-control border border-red-300 bg-red-50 p-2 text-sm text-red-700"
        >
          {actionError}
        </p>
      ) : null}

      {pending && !generating ? (
        <p className="text-ink-soft flex items-center gap-2 text-sm">
          <span className="border-brand-500 inline-block size-3 animate-spin rounded-full border-2 border-t-transparent" />
          Un momento…
        </p>
      ) : null}

      <div
        key={step}
        className={`animate-in fade-in flex flex-col gap-3 duration-300 ease-out ${
          nav.dir === 'forward' ? 'slide-in-from-right-6' : 'slide-in-from-left-6'
        }`}
      >
        {step <= 2 ? (
          <StepSpace
            projectId={projectId}
            zoneId={zoneId}
            detected={detectedEls}
            imageKind={imageKind}
            onConvertPlan={() => onConvertPlan(phase, lastUpload)}
            disclaimer={disclaimer}
            pending={pending}
            onUpload={onUploadImage}
            onConfirm={onConfirmDetection}
            onCorrect={onCorrectDetection}
            onSkip={onSkipDetection}
          />
        ) : null}

        {step === 3 ? (
          <StepStyle
            estilo={estilo}
            pending={pending}
            onPick={onPickStyle}
            onBack={onBackToSpace}
            onNext={onNextFromStyle}
          />
        ) : null}

        {step === 4 ? (
          <StepDeliverables
            entregables={entregables}
            pending={pending}
            onToggle={onToggleDeliverable}
            onBack={() => setStep(3)}
            onNext={onNextFromDeliverables}
          />
        ) : null}

        {step === 5 ? (
          <StepReview
            estilo={estilo}
            entregables={entregables}
            objetivo={objetivo}
            onObjetivoChange={setObjetivo}
            tosAccepted={tosAccepted}
            onAcceptTos={acceptTos}
            generating={generating}
            pending={pending}
            error={deliverError}
            onGenerate={onDeliver}
            onBack={() => setStep(4)}
          />
        ) : null}

        {step === 6 ? (
          <StepResult
            projectId={projectId}
            zoneId={zoneId}
            deliverables={result}
            pending={pending}
            onNewVariant={onNewVariant}
          />
        ) : null}
      </div>
    </div>
  );
}
