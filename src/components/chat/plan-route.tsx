'use client';

/**
 * Ruta «convertir mi plano al editor» del asistente: subir el plano → revisar lo
 * leído con su fiabilidad → llevarlo al editor y decidir qué hacer después.
 *
 * El veredicto que decide qué se ofrece lo da el servidor (Jev sobre la evidencia
 * medible de la extracción); aquí solo se presenta. Aplicar REEMPLAZA el plano del
 * proyecto, así que se confirma en dos pasos incluso cuando la lectura está
 * bloqueada y el editor es el destino para corregirla.
 */
import { useState } from 'react';
import { useMountEffect } from '@/lib/use-mount-effect';
import { WizardStepper } from './wizard-stepper';
import { StepPlanUpload } from './step-plan-upload';
import { StepPlanCheck } from './step-plan-check';
import { StepPlanNext } from './step-plan-next';
import { importPlanForAssistant } from '@/app/(app)/projects/[id]/_actions/assistant-plan-actions';
import { applyPlanImportStudio } from '@/app/(app)/projects/[id]/_actions/studio-actions';
import { callAction } from '@/lib/action-result';
import { isStepReachable, PLAN_STEPS, type StepId } from './wizard-steps';
import type { UploadedImage } from './image-upload';
import type { PlanImportResult } from '@/lib/contracts';
import type { StudioQuality } from '@/lib/studio-state';

interface Props {
  projectId: string;
  zoneId: string | null;
  /** Vuelve al paso 0 para elegir otra ruta. */
  onChangeIntent: () => void;
  /** Cambia a la ruta de diseño (crear un diseño a partir de una foto). */
  onStartDesign: () => void;
  /**
   * Plano que el usuario ya subió en la ruta de diseño. Se lee al montar para no
   * obligarle a subir dos veces la misma imagen.
   */
  initialImage?: UploadedImage | null;
}

type Busy = 'import' | 'apply' | null;

export function PlanRoute({
  projectId,
  zoneId,
  onChangeIntent,
  onStartDesign,
  initialImage = null,
}: Props) {
  const [step, setStep] = useState<StepId>(1);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<{
    result: PlanImportResult;
    quality: StudioQuality;
  } | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [applied, setApplied] = useState<{ issues: string[]; needsCorrection: boolean } | null>(
    null,
  );

  const routeState = { hasImport: imported !== null, applied: applied !== null };

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo falló; inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  const onUpload = (image: UploadedImage) =>
    void run('import', async () => {
      const result = await callAction(importPlanForAssistant(projectId, image.base64));
      setImported({ result, quality: result.quality });
      setApplied(null);
      setConfirmApply(false);
      setStep(2);
    });

  const onApply = () => {
    if (!imported) return;
    if (!confirmApply) {
      setConfirmApply(true);
      return;
    }
    void run('apply', async () => {
      const outcome = await callAction(applyPlanImportStudio(projectId, imported.result));
      // `needsCorrection` es el veredicto del SERVIDOR sobre el plano aplicado:
      // manda sobre el que trae el cliente a la hora de ofrecer generaciones.
      setApplied({ issues: outcome.issues, needsCorrection: outcome.needsCorrection });
      setConfirmApply(false);
      setStep(3);
    });
  };

  useMountEffect(() => {
    if (initialImage) onUpload(initialImage);
  });

  const onSelectStep = (destino: StepId) => {
    if (destino === step || !isStepReachable(destino, { intent: 'plan', ...routeState })) return;
    setConfirmApply(false);
    setStep(destino);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto">
      <WizardStepper
        steps={PLAN_STEPS}
        current={step}
        isReachable={(destino) => isStepReachable(destino, { intent: 'plan', ...routeState })}
        onSelect={onSelectStep}
        onChangeIntent={onChangeIntent}
        disabled={busy !== null}
      />

      <div
        key={step}
        className="animate-in fade-in slide-in-from-right-6 flex flex-col gap-3 duration-300 ease-out"
      >
        {step === 1 || !imported ? (
          <StepPlanUpload pending={busy === 'import'} error={error} onUpload={onUpload} />
        ) : null}

        {step === 2 && imported ? (
          <StepPlanCheck
            result={imported.result}
            quality={imported.quality}
            confirmApply={confirmApply}
            pending={busy === 'import'}
            applying={busy === 'apply'}
            error={error}
            onApply={onApply}
            onCancelApply={() => setConfirmApply(false)}
            onRetryUpload={() => setStep(1)}
          />
        ) : null}

        {step === 3 && imported && applied ? (
          <StepPlanNext
            projectId={projectId}
            zoneId={zoneId}
            quality={imported.quality}
            needsCorrection={applied.needsCorrection}
            issues={applied.issues}
            onStartDesign={onStartDesign}
            pending={busy !== null}
          />
        ) : null}
      </div>
    </div>
  );
}
