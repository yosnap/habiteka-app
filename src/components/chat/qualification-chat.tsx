'use client';

/**
 * Asistente del proyecto, guiado por la fase de la máquina de estados del agente.
 *
 * Muestra SOLO los controles válidos en la fase actual para que el usuario no
 * choque con las guardas del servidor (p. ej. no se puede cualificar antes de
 * confirmar la detección de la imagen). Las fases: ingesta → (confirmar) →
 * cualificación → (estilo/entregables) → entrega → feedback.
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { MessageList, type ChatTurn } from './message-list';
import { MessageInput } from './message-input';
import { StyleQuickPicks } from './style-quick-picks';
import { DeliverablePicker } from './deliverable-picker';
import { type UploadedImage } from './image-upload';
import { IngestaControls } from './ingesta-controls';
import { ZonePhotosPanel } from '@/components/zones/zone-photos-panel';
import { Button } from '@/components/ui/button';
import { useMountEffect } from '@/lib/use-mount-effect';
import { acceptCurrentTos, checkTosAccepted } from '@/server/legal/actions';
import type { AgentInput, AgentOutcome } from '@/server/agent';
import type { Estilo, DeliverableType, ChatMessage, StructuralElements } from '@/lib/contracts';

type Phase = 'ingesta' | 'cualificacion' | 'entrega' | 'feedback';

interface Props {
  projectId: string;
  advance: (
    projectId: string,
    input: AgentInput,
    zoneId?: string | null,
  ) => Promise<AgentOutcome>;
  initialPhase?: Phase;
  /** Zona activa del proyecto; null = flujo por defecto. El asistente es por zona. */
  zoneId?: string | null;
}

let turnSeq = 0;

export function QualificationChat({
  projectId,
  advance,
  initialPhase = 'ingesta',
  zoneId = null,
}: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  // La detección debe confirmarse antes de pasar a cualificación. Si el proyecto
  // ya avanzó más allá de la ingesta, se considera confirmada.
  const [detected, setDetected] = useState(initialPhase !== 'ingesta');
  // Números detectados (para los controles de ingesta: corregir/confirmar). null hasta
  // que se analiza una foto en esta sesión (tras recargar en ingesta no se rehidratan;
  // el usuario re-sube si quiere corregir).
  const [detectedEls, setDetectedEls] = useState<StructuralElements | null>(null);
  // Estado acumulado de la cualificación (el servidor es la fuente de verdad; se
  // refleja aquí para guiar y habilitar la generación cuando está completo).
  const [estilo, setEstilo] = useState<Estilo | undefined>();
  const [entregables, setEntregables] = useState<DeliverableType[]>([]);
  // Aceptación de los Términos: condición para generar (gate del servidor).
  const [tosAccepted, setTosAccepted] = useState<boolean | null>(null);
  // Error de la generación de diseños: si falla, la fase NO avanza (queda en
  // cualificación) y se muestra un aviso con opción de REINTENTAR, en vez de dejar al
  // usuario mirando el paso sin saber qué pasó (era el bug del "vuelve a salir el paso").
  const [deliverError, setDeliverError] = useState<string | null>(null);
  // Generación en curso (entrega de diseños): muestra un estado explícito en pantalla
  // porque el render puede tardar; sin esto el usuario no sabe si está pasando algo.
  const [generating, setGenerating] = useState(false);
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

  const pushTurn = (role: 'user' | 'assistant', text: string, imageUrl?: string) =>
    setTurns((prev) => [...prev, { id: `t${++turnSeq}`, role, text, ...(imageUrl ? { imageUrl } : {}) }]);

  // Ejecuta una acción del agente y refleja la fase y el estado resultantes; ante
  // un error de guarda, lo muestra como mensaje en vez de romper la pantalla.
  const run = (input: AgentInput, echo?: string, onOk?: (out: AgentOutcome) => void) => {
    if (echo) pushTurn('user', echo);
    startTransition(async () => {
      try {
        const out = await advance(projectId, input, zoneId);
        setPhase(out.phase as Phase);
        setEstilo(out.collected.estilo);
        setEntregables(out.collected.entregables);
        onOk?.(out);
      } catch (err) {
        pushTurn('assistant', err instanceof Error ? err.message : 'No se pudo continuar.');
      }
    });
  };

  const onUploadImage = (image: UploadedImage) => {
    // Muestra la imagen subida en el chat (data URL) para que el usuario compruebe qué
    // envió sin abrir el explorador. El `run` va sin echo para no duplicar el turno.
    pushTurn('user', '📷 Imagen del espacio subida', `data:${image.mimeType};base64,${image.base64}`);
    run(
      {
        action: 'ingest',
        image: [{ type: 'image_url', base64: image.base64, mimeType: image.mimeType }],
      },
      undefined,
      (out) => {
        if (out.detected) {
          const d = out.detected;
          pushTurn(
            'assistant',
            `Detecté ${d.walls} muros, ${d.doors} puertas, ${d.windows} ventanas y ${d.pillars} pilares. Revísalo, corrígelo o confirma para continuar.`,
          );
          setDetected(true);
          setDetectedEls(d);
        }
        if (out.disclaimer) pushTurn('assistant', out.disclaimer);
      },
    );
  };

  const onConfirmDetection = () =>
    run({ action: 'confirm-detection' }, '✅ Confirmo lo detectado', () =>
      pushTurn('assistant', 'Genial. Cuéntame el estilo y qué entregables quieres.'),
    );

  // Corrige a mano los números detectados (no avanza de fase): el plano base partirá de
  // los valores corregidos. Refleja la corrección en los controles de ingesta.
  const onCorrectDetection = (els: StructuralElements) =>
    run({ action: 'correct-detection', detected: els }, '✏️ Corrijo lo detectado', (out) => {
      if (out.detected) setDetectedEls(out.detected);
      pushTurn('assistant', 'Hecho, lo dejé como me dijiste. Confirma cuando quieras seguir.');
    });

  // Avanza a cualificación sin endosar la detección (era pobre o se subió por el panel).
  const onSkipDetection = () =>
    run({ action: 'skip-detection' }, '⏭️ Continuar sin la detección', () =>
      pushTurn('assistant', 'Seguimos. Podrás afinar el plano más tarde. Cuéntame el estilo.'),
    );

  // Vuelve al paso anterior para corregir sin perder lo recogido.
  const onGoBack = () =>
    run({ action: 'go-back' }, '↩️ Volver al paso anterior', (out) => {
      // Al volver a ingesta, se reabre la confirmación de la detección si la había.
      if (out.phase === 'ingesta') setDetected(detectedEls !== null);
      pushTurn('assistant', 'Volvimos un paso atrás. Ajusta lo que necesites.');
    });

  const sendQualify = (history: ChatMessage[], echo: string) =>
    run({ action: 'qualify', history }, echo, (out) => {
      const summary = describeCollected(out);
      if (summary) pushTurn('assistant', summary);
    });

  const onSend = (text: string) =>
    sendQualify([{ role: 'user', content: [{ type: 'text', text }] }], text);
  const onPickStyle = (estilo: Estilo) =>
    sendQualify(
      [{ role: 'user', content: [{ type: 'text', text: `Estilo: ${estilo}` }] }],
      `Estilo: ${estilo}`,
    );
  const onPickDeliverables = (types: DeliverableType[]) =>
    sendQualify(
      [{ role: 'user', content: [{ type: 'text', text: `Entregables: ${types.join(', ')}` }] }],
      `Entregables: ${types.join(', ')}`,
    );

  // Generación de diseños: maneja el error de forma EXPLÍCITA. `advance` espera a que la
  // generación termine, así que al resolver los diseños ya están listos (fase → feedback);
  // si lanza, la fase no avanza y se ofrece reintentar (sin recargar).
  const onDeliver = () => {
    setDeliverError(null);
    if (deliverError === null) pushTurn('user', '🎨 Generar mis diseños');
    setGenerating(true);
    startTransition(async () => {
      try {
        const out = await advance(projectId, { action: 'deliver' }, zoneId);
        setPhase(out.phase as Phase);
        setEstilo(out.collected.estilo);
        setEntregables(out.collected.entregables);
        // Muestra el render AQUÍ MISMO (no obliga a saltar a otra pestaña): el
        // entregable ya trae su URL presignada. Así ves el resultado donde lo pediste.
        const render = out.deliverables?.find((d) => d.payload.type === 'render3d');
        if (render && render.payload.type === 'render3d') {
          pushTurn('assistant', '🎨 Aquí está tu render:', render.payload.assetUrl);
        }
        // Resumen de lo generado + dónde encontrarlo todo (memoria, plano, versiones).
        const tipos = (out.deliverables ?? []).map((d) => d.payload.type);
        const otros = tipos.filter((t) => t !== 'render3d');
        pushTurn(
          'assistant',
          otros.length > 0
            ? `Listo. También generé: ${otros.join(', ')}. Todo queda guardado en la pestaña «Diseños».`
            : 'Listo. También lo tienes guardado en la pestaña «Diseños».',
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudieron generar los diseños.';
        setDeliverError(msg);
      } finally {
        setGenerating(false);
      }
    });
  };

  const ready = estilo !== undefined && entregables.length > 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <PhaseHint phase={phase} />
      <MessageList turns={turns} streamingText="" />
      {generating ? (
        <div className="border-brand-200 bg-brand-50 flex items-start gap-2 rounded-control border p-3 text-sm">
          <span className="border-brand-500 mt-0.5 inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-ink">
            Generando tus diseños… El render puede tardar hasta ~2 minutos. No cierres esta
            pestaña; te aviso aquí cuando esté listo (o si algo falla).
          </span>
        </div>
      ) : pending ? (
        <p className="text-ink-soft flex items-center gap-2 text-sm">
          <span className="border-brand-500 inline-block size-3 animate-spin rounded-full border-2 border-t-transparent" />
          El asistente está pensando…
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {/* Volver al paso anterior: disponible en las fases de reposo con anterior
            (cualificación→ingesta, feedback→cualificación). Corrige sin perder lo recogido. */}
        {phase === 'cualificacion' || phase === 'feedback' ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={onGoBack}
            disabled={pending}
          >
            ← Volver al paso anterior
          </Button>
        ) : null}

        {phase === 'ingesta' ? (
          <IngestaControls
            detected={detectedEls}
            pending={pending}
            onUpload={onUploadImage}
            onConfirm={onConfirmDetection}
            onCorrect={onCorrectDetection}
            onSkip={onSkipDetection}
          />
        ) : null}

        {phase === 'cualificacion' ? (
          <>
            <SelectionSummary estilo={estilo} entregables={entregables} />
            {estilo === undefined ? (
              <div className="flex flex-col gap-1">
                <p className="text-ink text-sm font-medium">1. ¿Qué estilo quieres?</p>
                <StyleQuickPicks onPick={onPickStyle} />
              </div>
            ) : null}
            {entregables.length === 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-ink text-sm font-medium">
                  2. ¿Qué quieres que generemos? (elige uno o varios)
                </p>
                <p className="text-ink-soft text-xs">
                  Render 3D = imagen realista · Plano 2D = planta acotada · Memoria = materiales.
                </p>
                <DeliverablePicker onConfirm={onPickDeliverables} />
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <p className="text-ink-soft text-xs">
                ¿Algo más que deba saber? (objetivo, colores, presupuesto…). Opcional.
              </p>
              <MessageInput onSend={onSend} disabled={pending} />
            </div>

            {tosAccepted === false ? (
              <div className="border-line bg-surface-muted flex flex-col gap-2 rounded-control border p-3 text-sm">
                <p className="text-ink-soft">
                  Antes de generar, acepta los{' '}
                  <Link href="/legal/terminos" target="_blank" className="text-brand-700 underline">
                    Términos de Servicio
                  </Link>
                  . Las propuestas son conceptuales y requieren validación profesional.
                </p>
                <Button type="button" size="sm" onClick={acceptTos} disabled={pending}>
                  Acepto los Términos de Servicio
                </Button>
              </div>
            ) : null}

            {deliverError ? (
              <div className="flex flex-col gap-2 rounded-control border border-red-300 bg-red-50 p-3 text-sm">
                <p className="text-red-700">No se pudieron generar los diseños: {deliverError}</p>
                <Button type="button" size="sm" onClick={onDeliver} disabled={pending}>
                  Reintentar
                </Button>
              </div>
            ) : null}

            <Button
              type="button"
              onClick={onDeliver}
              disabled={pending || !ready || tosAccepted !== true}
            >
              🎨 Generar mis diseños
            </Button>
            {!ready ? (
              <p className="text-ink-soft text-xs">
                Para generar, elige {estilo === undefined ? 'un estilo' : ''}
                {estilo === undefined && entregables.length === 0 ? ' y ' : ''}
                {entregables.length === 0 ? 'al menos un entregable' : ''}.
              </p>
            ) : null}
          </>
        ) : null}

        {phase === 'feedback' ? (
          <p className="text-ink-soft text-sm">
            Tus diseños están listos en la pestaña «Diseños». Puedes pedir cambios por zona desde
            allí.
          </p>
        ) : null}

        {/* Panel de fotos de la zona: disponible una vez superada la subida inicial de
            ingesta (que dispara la detección). Permite añadir más fotos y elegir la
            ACTIVA, que es la referencia del render por foto (img2img). */}
        {!(phase === 'ingesta' && !detected) ? (
          <ZonePhotosPanel projectId={projectId} zoneId={zoneId} />
        ) : null}
      </div>
    </div>
  );
}

function SelectionSummary({
  estilo,
  entregables,
}: {
  estilo?: Estilo;
  entregables: DeliverableType[];
}) {
  if (estilo === undefined && entregables.length === 0) return null;
  return (
    <div className="border-line bg-surface-muted flex flex-wrap gap-2 rounded-control border p-2 text-xs">
      {estilo ? <span className="text-ink">Estilo: {estilo} ✓</span> : null}
      {entregables.length ? (
        <span className="text-ink">Entregables: {entregables.join(', ')} ✓</span>
      ) : null}
    </div>
  );
}

function PhaseHint({ phase }: { phase: Phase }) {
  const map: Record<Phase, string> = {
    ingesta: 'Paso 1 · Sube una foto o boceto de tu espacio',
    cualificacion: 'Paso 2 · Elige estilo y entregables, y cuéntame tu idea',
    entrega: 'Generando tus diseños…',
    feedback: 'Paso 3 · Revisa tus diseños',
  };
  return (
    <div className="bg-brand-50 text-brand-700 rounded-control px-3 py-2 text-xs font-medium">
      {map[phase]}
    </div>
  );
}

function describeCollected(out: AgentOutcome): string {
  const c = out.collected;
  const parts: string[] = [];
  if (c.estilo) parts.push(`estilo ${c.estilo}`);
  if (c.entregables.length) parts.push(`entregables ${c.entregables.join(', ')}`);
  return parts.length ? `Anotado: ${parts.join(' · ')}.` : '';
}
