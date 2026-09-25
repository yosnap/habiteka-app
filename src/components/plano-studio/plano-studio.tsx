'use client';

/**
 * Estudio de planos: la superficie LIMPIA del pivote planos-IA, sin
 * dependencias del workspace legacy.
 *
 * Flujo (una llamada de imagen por paso, sin gasto automático extra):
 *  1. Subir foto/escaneo → REDIBUJADO imagen→imagen como plano profesional
 *     (la vía visual principal: preserva la disposición mejor que reconstruir
 *     coordenadas).
 *  2. "Versión editable" (opcional, bajo demanda): extrae la geometría para
 *     obtener muros/aberturas vectoriales — la base del editor y del cenital.
 *  3. "Vista cenital": acabado generativo condicionado a la imagen guardada.
 */
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ModernSelect } from '@/components/ui/modern-select';
import { ImageUpload, type UploadedImage } from '@/components/chat/image-upload';
import {
  TOS_REQUIRED_MESSAGE,
  TosAcceptanceNotice,
  useTosAcceptance,
} from '@/components/legal/tos-acceptance';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import { callAction, type ActionErrorResult } from '@/lib/action-result';
import { SketchPad } from './sketch-pad';
import { PlanImportPanel, type ImportedPlan, type PlanImportActions } from './plan-import-panel';
import { PlanImageViewer } from './plan-image-viewer';
import { StudioStageNav } from './studio-stage-nav';
import { StudioResultsPanel, type StudioDeliverableView } from './studio-results-panel';
import { StudioNextStep } from './studio-next-step';
import {
  CenitalQualityGate,
  cenitalGateBlocks,
  cenitalGateDecision,
} from './cenital-quality-gate';
import type { StudioQuality, StudioResult, StudioResultView, StudioState } from '@/lib/studio-state';
import { ESTILOS } from '@/lib/design-options';
import type { Estilo, Plano2dPayload, SketchPlanResult } from '@/lib/contracts';

type ImagePart = { type: 'image_url'; base64: string; mimeType: string };

interface Props extends PlanImportActions {
  projectId: string;
  /** Importación de plano dibujado ya extraída y guardada (se retoma sin IA). */
  initialImport?: ImportedPlan | null;
  initialGeneralWidthMm?: number;
  initialIncludeFurniture?: boolean;
  initialState: StudioState;
  initialResults: StudioResultView[];
  deliverables: StudioDeliverableView[];
  hasEditorPlan: boolean;
  uploadAction: (
    projectId: string,
    base64: string,
  ) => Promise<{ imageUrl: string; assetKey?: string; studioResult?: StudioResult } | ActionErrorResult>;
  drawingAction: (
    projectId: string,
    base64: string,
  ) => Promise<(SketchPlanResult & { imageUrl: string; assetKey?: string; studioResult?: StudioResult; importResult: ImportedPlan }) | ActionErrorResult>;
  importCanvasAction: (projectId: string) => Promise<{ imageUrl: string; assetKey?: string; studioResult?: StudioResult } | ActionErrorResult>;
  redrawAction: (
    projectId: string,
    imageParts: ImagePart[],
    mode: RedrawMode,
  ) => Promise<{ imageUrl: string; assetKey?: string; studioResult?: StudioResult } | ActionErrorResult>;
  selectResultAction: (
    projectId: string,
    assetKey: string,
  ) => Promise<{ imageUrl: string; sourceUrl: string; assetKey: string } | ActionErrorResult>;
  startNewAction: (projectId: string) => Promise<{ ok: boolean } | ActionErrorResult>;
  /** Importa la imagen activa del estudio (redibujado u original) por el pipeline de planos. */
  importCurrentAction: (
    projectId: string,
    options: { includeFurniture?: boolean },
  ) => Promise<ImportedPlan | ActionErrorResult>;
  /** Cenital directamente desde la IMAGEN del plano redibujado. */
  cenitalAction: (
    projectId: string,
    imageUrl: string,
    estilo: Estilo,
    instrucciones?: string,
    vista?: RenderVista,
    /** Confirmación expresa cuando la puerta de calidad del plano pide confirmar. */
    qualityAck?: boolean,
  ) => Promise<{ imageUrl: string; assetKey?: string; studioResult?: StudioResult } | ActionErrorResult>;
  sendToEditorAction: (projectId: string) => Promise<void | ActionErrorResult>;
}

/** Modo de redibujado y tipo de vista: tipos locales para no importar código server en el cliente. */
type RedrawMode = 'tecnico' | 'decorado';
type RenderVista = 'cenital' | 'maqueta';
type Tab = 'plano' | 'vector' | 'render';
type Busy = 'redraw' | 'cenital' | 'send' | 'import' | 'select' | null;

export function PlanoStudio({
  projectId,
  initialState,
  initialResults,
  deliverables,
  hasEditorPlan,
  drawingAction,
  uploadAction,
  importCanvasAction,
  redrawAction,
  selectResultAction,
  startNewAction,
  importCurrentAction,
  cenitalAction,
  sendToEditorAction,
  importAction,
  refitAction,
  applyAction,
  initialImport,
  initialGeneralWidthMm,
  initialIncludeFurniture,
}: Props) {
  const router = useRouter();
  // Importar un plano dibujado/CAD/PDF es un flujo propio (tabla de cotas, mobiliario).
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(initialImport ?? null);
  const [importApplied, setImportApplied] = useState(initialState.planImportApplied === true);
  // Enviar al editor reemplaza el plano existente: se pide confirmación en dos pasos.
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [originalUrl, setOriginalUrl] = useState(initialState.source?.assetUrl);
  const [sourceKey, setSourceKey] = useState(initialState.source?.assetKey);
  const [resultViews, setResultViews] = useState(initialResults);
  const [previewResult, setPreviewResult] = useState<StudioResultView | null>(null);
  const [comparing, setComparing] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [fromCanvas, setFromCanvas] = useState(!!initialState.canvasDescription);
  const [fromDrawing, setFromDrawing] = useState(initialState.sourceKind === 'drawing');
  const [planImageUrl, setPlanImageUrl] = useState<string | null>(
    initialState.plan?.assetUrl ?? null,
  );
  const [plano, setPlano] = useState<Plano2dPayload | null>(initialImport?.plano ?? initialState.plano ?? null);
  // Sin medidas escritas en el original, las cotas serían inventadas: no se pintan.
  const [escalaEstimada, setEscalaEstimada] = useState(initialImport?.escalaEstimada ?? initialState.escalaEstimada ?? false);
  const [cenitalUrl, setCenitalUrl] = useState<string | null>(
    initialState.cenital?.assetUrl ?? null,
  );
  const [tab, setTab] = useState<Tab>('plano');
  const [estilo, setEstilo] = useState<Estilo>(initialState.estilo ?? 'moderno');
  const [redrawMode, setRedrawMode] = useState<RedrawMode>(initialState.redrawMode ?? 'tecnico');
  // Redibujados ya generados por modo: se alterna entre ellos sin regenerar.
  // Se identifican por CLAVE de asset: las URL son firmadas y cambian en cada carga.
  const [redraws, setRedraws] = useState<
    Partial<Record<RedrawMode, { url: string; key?: string }>>
  >({
    ...(initialState.redraws?.tecnico
      ? {
          tecnico: {
            url: initialState.redraws.tecnico.assetUrl,
            key: initialState.redraws.tecnico.assetKey,
          },
        }
      : {}),
    ...(initialState.redraws?.decorado
      ? {
          decorado: {
            url: initialState.redraws.decorado.assetUrl,
            key: initialState.redraws.decorado.assetKey,
          },
        }
      : {}),
  });
  const [activeKey, setActiveKey] = useState<string | undefined>(initialState.plan?.assetKey);
  // Qué se está viendo: el redibujado de un modo (aunque el selector esté en otro) o el original.
  const shownMode: RedrawMode | null =
    activeKey !== undefined && redraws.tecnico?.key === activeKey
      ? 'tecnico'
      : activeKey !== undefined && redraws.decorado?.key === activeKey
        ? 'decorado'
        : null;
  const [vista, setVista] = useState<RenderVista>(initialState.vista ?? 'cenital');
  // Fiabilidad del plano leído: la decide el servidor y decide qué se puede
  // generar. Se actualiza al importar, igual que hace el panel de importación.
  const [quality, setQuality] = useState<StudioQuality | null>(initialState.quality ?? null);
  const [cenitalAck, setCenitalAck] = useState(false);
  // Detalles del propietario para el render: mobiliario real, singularidades
  // ("cocina con isla", "registros de placas solares en la entrada"…).
  const [detalles, setDetalles] = useState(initialState.detalles ?? '');
  const [busy, setBusy] = useState<Busy>(null);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveWarning, setArchiveWarning] = useState<string | null>(null);
  // Gate de los Términos: el servidor lo exige en todas las acciones del estudio y
  // en producción su error llega como un 500 opaco; se comprueba y acepta aquí.
  const { tosAccepted, acceptTos, pending: tosPending } = useTosAcceptance();
  // Al aceptar se retira el aviso de bloqueo que pudo dejar una acción previa.
  const onAcceptTos = () => {
    setError(null);
    acceptTos();
  };
  // La importación CAD/PDF tiene sus propias acciones (no pasan por `run`), pero
  // el servidor también le exige los Términos: se bloquea la entrada al panel.
  const openImport = () => {
    if (tosAccepted === false) {
      setError(TOS_REQUIRED_MESSAGE);
      return;
    }
    setImporting(true);
  };

  const svgUrl = useMemo(() => {
    if (!plano) return null;
    const svg = planoToSvg(plano, {
      pxPerMeter: 90,
      showDimensions: !escalaEstimada,
      // Sin nombres ni rellenos de estancia (decisión de producto): el usuario
      // etiqueta en el editor; los aproximados solo ensuciaban la vista. Las
      // ventanas en azul: que no se confundan con muros interrumpidos.
      showLabels: false,
      theme: { floorFill: '#ffffff', windowColor: '#2b7bbf' },
      showAreas: !escalaEstimada,
    });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [plano, escalaEstimada]);

  const rememberResult = (result: StudioResult | undefined, url: string) => {
    if (!result) {
      setArchiveWarning('La imagen se generó, pero no se pudo archivar en el proyecto. Descárgala antes de salir.');
      return;
    }
    setArchiveWarning(null);
    setResultViews((previous) => [...previous.filter((item) => item.assetKey !== result.assetKey), { ...result, url }]);
  };

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    if (inFlight.current) return;
    if (tosAccepted === false) {
      setError(TOS_REQUIRED_MESSAGE);
      return;
    }
    inFlight.current = true;
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo falló; inténtalo de nuevo.');
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const onUpload = (image: UploadedImage) =>
    run('import', async () => {
      const result = await callAction(uploadAction(projectId, image.base64));
      rememberResult(result.studioResult, result.imageUrl);
      setRedraws({});
      setActiveKey(result.assetKey);
      setOriginalUrl(result.imageUrl);
      setSourceKey(result.assetKey);
      setFromCanvas(false);
      setFromDrawing(false);
      setPlanImageUrl(result.imageUrl);
      setPlano(null);
      setImportResult(null);
      setImportApplied(false);
      setQuality(null);
      setCenitalUrl(null);
      setConfirmSend(false);
      setPreviewResult(null);
      setComparing(false);
      setTab('plano');
    });

  const onDrawing = (image: UploadedImage) =>
    run('import', async () => {
      const result = await callAction(drawingAction(projectId, image.base64));
      rememberResult(result.studioResult, result.imageUrl);
      setRedraws({});
      setActiveKey(result.assetKey);
      setFromCanvas(false);
      setFromDrawing(true);
      setPlanImageUrl(result.imageUrl);
      setOriginalUrl(result.imageUrl);
      setSourceKey(result.assetKey);
      setPlano(result.plano);
      setEscalaEstimada(result.escalaEstimada);
      setCenitalUrl(null);
      setImportResult(result.importResult);
      setImportApplied(false);
      setQuality(result.importResult.quality);
      setConfirmSend(false);
      setPreviewResult(null);
      setComparing(false);
      setTab('plano');
      setImporting(true);
    });

  /** El selector define la próxima generación, no cambia la imagen visible. */
  const onChangeMode = (mode: RedrawMode) => {
    setRedrawMode(mode);
  };

  const onRegenerate = () => {
      void run('redraw', async () => {
        const result = await callAction(redrawAction(projectId, [], redrawMode));
        rememberResult(result.studioResult, result.imageUrl);
        setPlanImageUrl(result.imageUrl);
        setActiveKey(result.assetKey);
        setRedraws((prev) => ({
          ...prev,
          [redrawMode]: { url: result.imageUrl, key: result.assetKey },
        }));
        setFromCanvas(false);
        setPlano(null);
        setCenitalUrl(null);
        setImportResult(null);
        setImportApplied(false);
        setQuality(null);
        setConfirmSend(false);
        setEscalaEstimada(false);
        setPreviewResult(null);
        setComparing(false);
        setTab('plano');
      });
  };

  const onImportCanvas = () =>
    run('import', async () => {
      const result = await callAction(importCanvasAction(projectId));
      rememberResult(result.studioResult, result.imageUrl);
      setFromCanvas(true);
      setFromDrawing(false);
      setOriginalUrl(result.imageUrl);
      setSourceKey(result.assetKey);
      setPlanImageUrl(result.imageUrl);
      setActiveKey(result.assetKey);
      setPlano(null);
      setImportResult(null);
      setImportApplied(false);
      setQuality(null);
      setCenitalUrl(null);
      setConfirmSend(false);
      setPreviewResult(null);
      setComparing(false);
      setTab('plano');
    });

  /** Extrae el plano de trabajo, nunca una previsualización histórica. */
  const onImportCurrent = () => {
    if (!planImageUrl) return;
    return run('import', async () => {
      // Sólo estructura: muros, huecos y estancias. El mobiliario se activa en el panel si se quiere.
      const result = await callAction(importCurrentAction(projectId, { includeFurniture: false }));
      setImportResult(result);
      setPlano(result.plano);
      setEscalaEstimada(result.escalaEstimada);
      setImportApplied(false);
      setQuality(result.quality);
      setCenitalAck(false);
      setImporting(true);
    });
  };

  const onGenerateCenital = () => {
    // Desde la IMAGEN redibujada (imagen→imagen): no requiere extraer geometría.
    if (!planImageUrl) return;
    // El servidor vuelve a decidir con el veredicto guardado; esto evita el viaje.
    if (cenitalGateBlocks(quality, cenitalAck)) return;
    return run('cenital', async () => {
      const { imageUrl, studioResult } = await callAction(
        cenitalAction(projectId, planImageUrl, estilo, detalles, vista, cenitalAck),
      );
      rememberResult(studioResult, imageUrl);
      setCenitalUrl(imageUrl);
      setPreviewResult(null);
      setComparing(false);
      setTab('render');
    });
  };

  const onSendToEditor = () => {
    if (!plano) return;
    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }
    return run('send', async () => {
      await callAction(sendToEditorAction(projectId));
      router.push(`/projects/${projectId}`); // pestaña Editor, con el plano ya cargado
    });
  };

  const showTab = (next: Tab) => {
    setTab(next);
    setPreviewResult(null);
    setComparing(false);
  };

  const openResult = (result: StudioResultView) => {
    setPreviewResult(result);
    setComparing(false);
    setTab(result.kind === 'render' ? 'render' : 'plano');
  };

  const compareResult = (result: StudioResultView) => {
    setPreviewResult(result);
    setComparing(true);
    setTab(result.kind === 'render' ? 'render' : 'plano');
  };

  const continueResult = (result: StudioResultView) => run('select', async () => {
    const selected = await callAction(selectResultAction(projectId, result.assetKey));
    setPlanImageUrl(selected.imageUrl);
    setOriginalUrl(selected.sourceUrl);
    setSourceKey(result.kind === 'source' ? result.assetKey : result.sourceKey);
    setActiveKey(selected.assetKey);
    setRedraws(result.kind === 'redraw'
      ? { [result.mode ?? 'tecnico']: { url: selected.imageUrl, key: selected.assetKey } }
      : {});
    setFromCanvas(false);
    setFromDrawing(false);
    setPlano(null);
    setImportResult(null);
    setImportApplied(false);
    setQuality(null);
    setCenitalUrl(null);
    setPreviewResult(null);
    setComparing(false);
    setArchiveWarning(null);
    setTab('plano');
    router.refresh();
  });

  /** Inicia otro plano sin borrar las imágenes históricas del proyecto. */
  const reset = () => run('select', async () => {
    await callAction(startNewAction(projectId));
    setRedraws({});
    setActiveKey(undefined);
    setSourceKey(undefined);
    setOriginalUrl(undefined);
    setFromCanvas(false);
    setFromDrawing(false);
    setImportResult(null);
    setImportApplied(false);
    setQuality(null);
    setConfirmSend(false);
    setConfirmNew(false);
    setPlanImageUrl(null);
    setPlano(null);
    setEscalaEstimada(false);
    setCenitalUrl(null);
    setError(null);
    setPreviewResult(null);
    setComparing(false);
    setArchiveWarning(null);
    setTab('plano');
    router.refresh();
  });

  const comparisonSource = previewResult?.sourceKey
    ? resultViews.find((item) => item.kind === 'source' && item.assetKey === previewResult.sourceKey)?.url
      ?? (previewResult.sourceKey === sourceKey ? originalUrl : null)
    : null;
  const visibleUrl = previewResult?.url ?? (tab === 'render' ? cenitalUrl : planImageUrl);

  if (importing) {
    return (
      <PlanImportPanel
        projectId={projectId}
        hasEditorPlan={hasEditorPlan || importApplied}
        importAction={importAction}
        refitAction={refitAction}
        applyAction={applyAction}
        initialResult={importResult}
        initialGeneralWidthMm={importResult === initialImport ? initialGeneralWidthMm : undefined}
        initialIncludeFurniture={importResult === initialImport ? initialIncludeFurniture : false}
        onBack={() => { setImporting(false); router.refresh(); }}
      />
    );
  }

  // ── Estado 1: sin plano — el boceto es el único protagonista ───────────────
  if (!planImageUrl && !previewResult) {
    return (
      <div className="flex min-h-full flex-col gap-4 p-6 lg:h-full">
        <StudioStageNav hasSource={false} hasImport={false} hasEditorPlan={hasEditorPlan}
          hasDesignImages={deliverables.some((item) => item.type === 'RENDER_3D')}
          hasVideo={deliverables.some((item) => item.type === 'VIDEO')} />
        <div className="grid flex-1 place-items-center gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div
          className={`border-line bg-surface w-full ${drawing ? 'max-w-3xl' : 'max-w-lg'} rounded-card border border-dashed p-6 text-center shadow-sm`}
        >
          <p className="mb-1 text-3xl" aria-hidden>
            ✏️
          </p>
          <h1 className="text-ink mb-2 text-lg font-semibold">De boceto a plano profesional</h1>
          <p className="text-ink-soft mb-6 text-sm">
            Sube un plano, dibuja tus muros o importa el canvas. Conservamos el original; puedes
            obtener una versión editable y generar una vista cenital.
          </p>
          <div className="mx-auto max-w-xs">
            <ImageUpload onUpload={onUpload} disabled={busy !== null} />
            <Button
              className="mt-3 w-full"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setDrawing(!drawing)}
            >
              {drawing ? 'Ocultar dibujo' : 'Dibujar un boceto'}
            </Button>
            <Button
              className="mt-3 w-full"
              variant="outline"
              disabled={busy !== null}
              onClick={onImportCanvas}
            >
              {busy === 'import' ? 'Importando…' : 'Usar canvas del editor'}
            </Button>
            <Button
              className="mt-3 w-full"
              variant="outline"
              disabled={busy !== null}
              onClick={openImport}
            >
              {importResult
                ? '📐 Continuar importación de plano'
                : '📐 Importar plano dibujado (CAD / PDF)'}
            </Button>
          </div>
          <TosAcceptanceNotice
            accepted={tosAccepted}
            onAccept={onAcceptTos}
            disabled={tosPending}
            className="mt-5"
          />
          {drawing && (
            <div className="mt-5">
              <SketchPad onUse={onDrawing} disabled={busy !== null} />
            </div>
          )}
          {busy === 'redraw' ? (
            <p className="text-ink-soft mt-4 animate-pulse text-sm">
              Redibujando el plano… puede tardar hasta un par de minutos.
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive mt-4 text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <StudioResultsPanel
          projectId={projectId}
          results={resultViews}
          deliverables={deliverables}
          hasImport={false}
          selectedKey={undefined}
          onOpen={openResult}
          onCompare={compareResult}
          onContinue={continueResult}
          onReviewImport={openImport}
        />
        </div>
      </div>
    );
  }

  // ── Estados 2+: plano protagonista + acciones a la derecha ─────────────────
  return (
    <div className="flex min-h-full flex-col gap-4 p-6 lg:h-full">
      <StudioStageNav
        hasSource={!!originalUrl}
        hasImport={!!importResult && !importApplied}
        hasEditorPlan={hasEditorPlan && (importApplied || fromCanvas)}
        hasDesignImages={deliverables.some((item) => item.type === 'RENDER_3D') || resultViews.some((item) => item.kind === 'render')}
        hasVideo={deliverables.some((item) => item.type === 'VIDEO')}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="tablist" aria-label="Vista">
          <TabButton active={tab === 'plano'} onClick={() => showTab('plano')}>
            Plano visible
          </TabButton>
          <TabButton
            active={tab === 'vector'}
            onClick={() => showTab('vector')}
          >
            Vista vectorizada
          </TabButton>
          <TabButton
            active={tab === 'render'}
            onClick={() => showTab('render')}
          >
            Render
          </TabButton>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmNew(true)} disabled={busy !== null}>
            ← Nuevo plano
          </Button>
        </div>
      </div>
      {confirmNew ? (
        <div className="rounded-control border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
          <p>Las imágenes guardadas seguirán en el proyecto. La revisión de medidas aún no enviada al editor se sustituirá al empezar otro plano.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={reset}>Sí, empezar otro plano</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmNew(false)}>Cancelar</Button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="border-line relative h-72 min-w-0 shrink-0 overflow-hidden rounded-card border bg-white lg:h-auto lg:min-h-64 lg:flex-1">
          {comparing && comparisonSource && visibleUrl ? (
            <div className="grid h-full grid-cols-1 gap-px bg-slate-200 md:grid-cols-2">
              <div className="relative min-h-64 bg-white">
                <PlanImageViewer key={comparisonSource} src={comparisonSource} alt="Plano original para comparar" caption="Original" />
              </div>
              <div className="relative min-h-64 bg-white">
                <PlanImageViewer key={visibleUrl} src={visibleUrl} alt="Resultado comparado" caption="Resultado generado" />
              </div>
            </div>
          ) : tab === 'plano' && visibleUrl ? (
            <PlanImageViewer
              key={visibleUrl}
              src={visibleUrl}
              alt={
                fromCanvas
                  ? 'Plano amueblado del editor'
                  : fromDrawing
                    ? 'Plano dibujado original'
                    : 'Plano de referencia'
              }
              caption={
                previewResult
                  ? 'Previsualización histórica. «Usar este plano» lo convierte en plano de trabajo.'
                  : shownMode
                    ? `Plano de trabajo: redibujado ${shownMode}. Compara con el original antes de continuar.`
                    : 'Plano de trabajo: original guardado.'
              }
            />
          ) : null}
          {tab === 'vector' && svgUrl && !comparing ? (
            <PlanImageViewer key={svgUrl} src={svgUrl} alt="Vista vectorizada del plano extraído" caption="Vista de lectura: la edición se realiza en el Editor v2." />
          ) : null}
          {tab === 'vector' && !svgUrl ? (
            <div className="grid h-full place-content-center gap-3 p-6 text-center">
              <h2 className="text-ink font-medium">Aún no hay extracción vectorial</h2>
              <p className="text-ink-soft max-w-sm text-sm">Primero lee los muros y revisa las medidas. Después podrás abrir el plano editable en el editor.</p>
              {planImageUrl ? <Button disabled={busy !== null} onClick={importResult ? openImport : onImportCurrent}>{importResult ? 'Revisar medidas' : 'Extraer y revisar medidas'}</Button> : null}
            </div>
          ) : null}
          {tab === 'render' && visibleUrl && !comparing ? (
            <PlanImageViewer key={visibleUrl} src={visibleUrl} alt="Render de presentación" caption="Imagen de presentación, no modelo 3D navegable." />
          ) : null}
          {tab === 'render' && !visibleUrl ? (
            <div className="grid h-full place-content-center gap-3 p-6 text-center">
              <h2 className="text-ink font-medium">Aún no hay render</h2>
              <p className="text-ink-soft max-w-sm text-sm">Elige un estilo y genera una imagen cenital o una maqueta isométrica. Esto no crea una visita 3D.</p>
              <Button disabled={busy !== null || !planImageUrl || cenitalGateBlocks(quality, cenitalAck)} onClick={onGenerateCenital}>Generar imagen con IA</Button>
            </div>
          ) : null}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-80">
          {previewResult ? <p className="text-ink-soft text-xs" role="status">Viendo un resultado guardado; las acciones de edición usan el plano de trabajo.</p> : null}
          <StudioNextStep
            projectId={projectId}
            hasSource={!!planImageUrl}
            hasImport={!!importResult && !importApplied}
            hasEditorPlan={hasEditorPlan && (importApplied || fromCanvas)}
            fromDrawing={!!plano && fromDrawing}
            confirmSend={confirmSend}
            busy={busy !== null}
            onReview={openImport}
            onExtract={onImportCurrent}
            onSendDrawing={onSendToEditor}
            onCancelSend={() => setConfirmSend(false)}
          />
          <StudioResultsPanel
            projectId={projectId}
            results={resultViews}
            deliverables={deliverables}
            hasImport={!!importResult}
            activeKey={activeKey}
            selectedKey={previewResult?.assetKey}
            onOpen={openResult}
            onCompare={compareResult}
            onContinue={continueResult}
            onReviewImport={openImport}
          />
          {archiveWarning ? <p className="text-destructive text-xs" role="alert">{archiveWarning}</p> : null}
          <div className="border-line bg-surface rounded-card border p-3">
            <h2 className="text-ink text-sm font-medium">Otras entradas</h2>
            <div className="mt-2 flex flex-col gap-2">
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={onImportCanvas}>Traer el plano del editor</Button>
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={openImport}>Importar CAD / PDF</Button>
              {(tab === 'vector' ? svgUrl : visibleUrl) ? (
                <a className="text-brand-700 text-center text-xs underline" href={(tab === 'vector' ? svgUrl : visibleUrl) ?? undefined} download={tab === 'vector' ? 'plano.svg' : 'habiteka.png'} target="_blank" rel="noreferrer">Abrir o descargar esta vista</a>
              ) : null}
            </div>
          </div>
          {!fromCanvas && !fromDrawing && planImageUrl ? (
            <div className="border-line bg-surface rounded-card border p-3">
              <label htmlFor="redraw-mode" className="text-ink mb-2 block text-sm font-medium">Redibujar con IA (opcional)</label>
              <ModernSelect
                id="redraw-mode"
                aria-label="Modo de la próxima generación"
                value={redrawMode}
                onChange={(e) => onChangeMode(e.target.value as RedrawMode)}
              >
                <option value="tecnico">Técnico · solo estructura</option>
                <option value="decorado">Decorado · con mobiliario</option>
              </ModernSelect>
              <p className="text-ink-soft my-2 text-xs">{redraws[redrawMode] ? 'Ya existe una versión de este modo; una nueva generación conservará la anterior.' : 'Este modo aún no se ha generado.'} Puede cambiar detalles: compara siempre con el original.</p>
              <Button size="sm" variant="outline" className="w-full" disabled={busy !== null} onClick={onRegenerate}>{busy === 'redraw' ? 'Redibujando…' : `Generar redibujado ${redrawMode}`}</Button>
              <p className="text-ink-soft mt-2 text-xs">0 créditos de la app en este flujo. La llamada IA sí tiene coste de proveedor según el modelo configurado.</p>
            </div>
          ) : null}

          <div className="border-line bg-surface rounded-card border p-4">
            <h2 className="text-ink mb-2 text-sm font-medium">Imagen de presentación</h2>
            <p className="text-ink-soft mb-3 text-xs">Una imagen cenital o isométrica ayuda a visualizar el diseño, pero no crea un modelo 3D navegable.</p>
            <label htmlFor="estilo" className="text-ink mb-2 block text-sm font-medium">
              Estilo de interiorismo
            </label>
            <ModernSelect
              id="estilo"
              value={estilo}
              onChange={(e) => setEstilo(e.target.value as Estilo)}
              className="border-line bg-surface text-ink w-full rounded-control border px-2 py-1.5 text-sm"
            >
              {ESTILOS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </ModernSelect>
            <label htmlFor="vista" className="text-ink mb-1 mt-3 block text-sm font-medium">
              Tipo de imagen
            </label>
            <ModernSelect
              id="vista"
              value={vista}
              onChange={(e) => setVista(e.target.value as RenderVista)}
              className="border-line bg-surface text-ink w-full rounded-control border px-2 py-1.5 text-sm"
            >
              <option value="cenital">Cenital (desde arriba)</option>
              <option value="maqueta">Maqueta 3D (isométrica)</option>
            </ModernSelect>
            <label htmlFor="detalles" className="text-ink mb-1 mt-3 block text-sm font-medium">
              Detalles de tu casa (opcional)
            </label>
            <textarea
              id="detalles"
              value={detalles}
              onChange={(e) => setDetalles(e.target.value)}
              maxLength={800}
              rows={4}
              placeholder="Ej.: la cocina tiene una isla con la placa en la isla; en la entrada están los registros de las placas solares; el dormitorio grande tiene cama de matrimonio…"
              className="border-line bg-surface text-ink w-full rounded-control border px-2 py-1.5 text-xs"
            />
            <CenitalQualityGate
              quality={quality}
              ack={cenitalAck}
              onAckChange={setCenitalAck}
              disabled={busy !== null}
            />
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={onGenerateCenital}
              disabled={busy !== null || !planImageUrl || cenitalGateBlocks(quality, cenitalAck)}
            >
              {busy === 'cenital'
                ? 'Generando…'
                : vista === 'maqueta'
                  ? 'Generar maqueta 3D'
                  : 'Generar vista cenital'}
            </Button>
            <p className="text-ink-soft mt-2 text-xs">0 créditos de la app en este flujo. La llamada IA sí tiene coste de proveedor según el modelo configurado.</p>
            {cenitalGateDecision(quality) === 'block' ? (
              <p className="text-ink-soft mt-2 text-xs">
                No se generará ninguna vista con este plano hasta que lo corrijas en el editor.
              </p>
            ) : null}
            {busy === 'cenital' ? (
              <p className="text-ink-soft mt-2 animate-pulse text-xs">
                El render puede tardar hasta un par de minutos.
              </p>
            ) : null}
          </div>

          <TosAcceptanceNotice
            accepted={tosAccepted}
            onAccept={onAcceptTos}
            disabled={tosPending}
            className="mb-3"
          />
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-control px-3 py-1.5 text-sm transition-colors ${
        active ? 'bg-brand-50 text-brand-700 font-medium' : 'text-ink-soft hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
