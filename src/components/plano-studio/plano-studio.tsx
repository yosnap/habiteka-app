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
import { SketchPad } from './sketch-pad';
import { PlanImportPanel, type PlanImportActions } from './plan-import-panel';
import { PlanImageViewer } from './plan-image-viewer';
import type { StudioState } from '@/lib/studio-state';
import { ESTILOS } from '@/lib/design-options';
import type { Estilo, PlanImportResult, Plano2dPayload, SketchPlanResult } from '@/lib/contracts';

type ImagePart = { type: 'image_url'; base64: string; mimeType: string };

interface Props extends PlanImportActions {
  projectId: string;
  /** Importación de plano dibujado ya extraída y guardada (se retoma sin IA). */
  initialImport?: (PlanImportResult & { imageUrl: string }) | null;
  initialState: StudioState;
  uploadAction: (projectId: string, base64: string) => Promise<{ imageUrl: string }>;
  drawingAction: (
    projectId: string,
    base64: string,
  ) => Promise<SketchPlanResult & { imageUrl: string }>;
  importCanvasAction: (projectId: string) => Promise<{ imageUrl: string }>;
  redrawAction: (
    projectId: string,
    imageParts: ImagePart[],
    mode: RedrawMode,
  ) => Promise<{ imageUrl: string; assetKey?: string }>;
  /** Activa el redibujado ya generado de ese modo como plano de trabajo. */
  selectRedrawAction: (
    projectId: string,
    mode: RedrawMode,
  ) => Promise<{ imageUrl: string; assetKey?: string }>;
  /** Importa la imagen activa del estudio (redibujado u original) por el pipeline de planos. */
  importCurrentAction: (
    projectId: string,
    options: { includeFurniture?: boolean },
  ) => Promise<PlanImportResult & { imageUrl: string }>;
  /** Cenital directamente desde la IMAGEN del plano redibujado. */
  cenitalAction: (
    projectId: string,
    imageUrl: string,
    estilo: Estilo,
    instrucciones?: string,
    vista?: RenderVista,
  ) => Promise<{ imageUrl: string }>;
  sendToEditorAction: (projectId: string, plano: Plano2dPayload) => Promise<void>;
}

/** Modo de redibujado y tipo de vista: tipos locales para no importar código server en el cliente. */
type RedrawMode = 'tecnico' | 'decorado';
type RenderVista = 'cenital' | 'maqueta';
type Tab = 'plano' | 'editable' | 'cenital';
type Busy = 'redraw' | 'cenital' | 'send' | 'import' | null;

export function PlanoStudio({
  projectId,
  initialState,
  drawingAction,
  uploadAction,
  importCanvasAction,
  redrawAction,
  selectRedrawAction,
  importCurrentAction,
  cenitalAction,
  sendToEditorAction,
  importAction,
  refitAction,
  applyAction,
  initialImport,
}: Props) {
  const router = useRouter();
  // Importar un plano dibujado/CAD/PDF es un flujo propio (tabla de cotas, mobiliario).
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(initialImport ?? null);
  // Enviar al editor reemplaza el plano existente: se pide confirmación en dos pasos.
  const [confirmSend, setConfirmSend] = useState(false);
  // La imagen original se conserva para las acciones bajo demanda.
  const [source, setSource] = useState<UploadedImage | null>(null);
  const [originalUrl, setOriginalUrl] = useState(initialState.source?.assetUrl);
  const [drawing, setDrawing] = useState(false);
  const [fromCanvas, setFromCanvas] = useState(!!initialState.canvasDescription);
  const [fromDrawing, setFromDrawing] = useState(initialState.sourceKind === 'drawing');
  const [planImageUrl, setPlanImageUrl] = useState<string | null>(
    initialState.plan?.assetUrl ?? null,
  );
  const [plano, setPlano] = useState<Plano2dPayload | null>(initialState.plano ?? null);
  // Sin medidas escritas en el original, las cotas serían inventadas: no se pintan.
  const [escalaEstimada, setEscalaEstimada] = useState(initialState.escalaEstimada ?? false);
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
  // Detalles del propietario para el render: mobiliario real, singularidades
  // ("cocina con isla", "registros de placas solares en la entrada"…).
  const [detalles, setDetalles] = useState(initialState.detalles ?? '');
  const [busy, setBusy] = useState<Busy>(null);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // Gate de los Términos: el servidor lo exige en todas las acciones del estudio y
  // en producción su error llega como un 500 opaco; se comprueba y acepta aquí.
  const { tosAccepted, acceptTos, pending: tosPending } = useTosAcceptance();

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

  const parts = (img: UploadedImage): ImagePart[] => [
    { type: 'image_url', base64: img.base64, mimeType: img.mimeType },
  ];

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

  const redrawFrom = (image: UploadedImage) =>
    run('redraw', async () => {
      const { imageUrl, assetKey } = await redrawAction(projectId, parts(image), redrawMode);
      setSource(image);
      setFromCanvas(false);
      setFromDrawing(false);
      setPlanImageUrl(imageUrl);
      setActiveKey(assetKey);
      setRedraws((prev) => ({ ...prev, [redrawMode]: { url: imageUrl, key: assetKey } }));
      setPlano(null);
      setCenitalUrl(null);
      setConfirmSend(false);
      setEscalaEstimada(false);
      setTab('plano');
    });

  const onUpload = (image: UploadedImage) =>
    run('import', async () => {
      const result = await uploadAction(projectId, image.base64);
      setSource(image);
      setRedraws({});
      setActiveKey(undefined);
      setOriginalUrl(result.imageUrl);
      setFromCanvas(false);
      setFromDrawing(false);
      setPlanImageUrl(result.imageUrl);
      setPlano(null);
      setCenitalUrl(null);
      setConfirmSend(false);
      setTab('plano');
    });

  const onDrawing = (image: UploadedImage) =>
    run('import', async () => {
      const result = await drawingAction(projectId, image.base64);
      setSource(null);
      setRedraws({});
      setActiveKey(undefined);
      setFromCanvas(false);
      setFromDrawing(true);
      setPlanImageUrl(result.imageUrl);
      setOriginalUrl(result.imageUrl);
      setPlano(result.plano);
      setEscalaEstimada(true);
      setCenitalUrl(null);
      setConfirmSend(false);
      setTab('plano');
    });

  /** Repite la tirada con la MISMA imagen (varianza generativa: a veces la
   *  siguiente sale sin el defecto), sin obligar a re-subir. */
  /** Cambiar de modo muestra el redibujado ya generado de ese modo, si lo hay. */
  const onChangeMode = (mode: RedrawMode) => {
    setRedrawMode(mode);
    const target = redraws[mode];
    if (!target || (target.key !== undefined && target.key === activeKey)) return;
    void run('redraw', async () => {
      const { imageUrl, assetKey } = await selectRedrawAction(projectId, mode);
      setPlanImageUrl(imageUrl);
      setActiveKey(assetKey);
      setPlano(null);
      setCenitalUrl(null);
      setConfirmSend(false);
      setTab('plano');
    });
  };

  const onRegenerate = () => {
    if (source) void redrawFrom(source);
    else
      void run('redraw', async () => {
        const result = await redrawAction(projectId, [], redrawMode);
        setPlanImageUrl(result.imageUrl);
        setActiveKey(result.assetKey);
        setRedraws((prev) => ({
          ...prev,
          [redrawMode]: { url: result.imageUrl, key: result.assetKey },
        }));
        setFromCanvas(false);
        setPlano(null);
        setCenitalUrl(null);
        setConfirmSend(false);
        setTab('plano');
      });
  };

  const onImportCanvas = () =>
    run('import', async () => {
      const result = await importCanvasAction(projectId);
      setFromCanvas(true);
      setFromDrawing(false);
      setOriginalUrl(result.imageUrl);
      setPlanImageUrl(result.imageUrl);
      setSource(null);
      setPlano(null);
      setCenitalUrl(null);
      setConfirmSend(false);
      setTab('plano');
    });

  /** Importa la imagen que se está viendo (redibujado técnico/decorado u original) al editor. */
  const onImportCurrent = () => {
    if (!planImageUrl) return;
    return run('import', async () => {
      // Sólo estructura: muros, huecos y estancias. El mobiliario se activa en el panel si se quiere.
      const result = await importCurrentAction(projectId, { includeFurniture: false });
      setImportResult(result);
      setImporting(true);
    });
  };

  const onGenerateCenital = () => {
    // Desde la IMAGEN redibujada (imagen→imagen): no requiere extraer geometría.
    if (!planImageUrl) return;
    return run('cenital', async () => {
      const { imageUrl } = await cenitalAction(projectId, planImageUrl, estilo, detalles, vista);
      setCenitalUrl(imageUrl);
      setTab('cenital');
    });
  };

  const onSendToEditor = () => {
    if (!plano) return;
    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }
    return run('send', async () => {
      await sendToEditorAction(projectId, plano);
      router.push(`/projects/${projectId}`); // pestaña Editor, con el plano ya cargado
    });
  };

  /** Aplica el ancho real aportado por el usuario: la escala deja de ser conjetura. */
  const reset = () => {
    setSource(null);
    setRedraws({});
    setActiveKey(undefined);
    setConfirmSend(false);
    setPlanImageUrl(null);
    setPlano(null);
    setEscalaEstimada(false);
    setCenitalUrl(null);
    setError(null);
    setTab('plano');
  };

  if (importing) {
    return (
      <PlanImportPanel
        projectId={projectId}
        importAction={importAction}
        refitAction={refitAction}
        applyAction={applyAction}
        initialResult={importResult}
        onBack={() => setImporting(false)}
      />
    );
  }

  // ── Estado 1: sin plano — el boceto es el único protagonista ───────────────
  if (!planImageUrl) {
    return (
      <div className="grid h-full place-items-center p-6">
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
              onClick={() => setImporting(true)}
            >
              {importResult
                ? '📐 Continuar importación de plano'
                : '📐 Importar plano dibujado (CAD / PDF)'}
            </Button>
          </div>
          <TosAcceptanceNotice
            accepted={tosAccepted}
            onAccept={acceptTos}
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
      </div>
    );
  }

  // ── Estados 2+: plano protagonista + acciones a la derecha ─────────────────
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="tablist" aria-label="Vista">
          <TabButton active={tab === 'plano'} onClick={() => setTab('plano')}>
            Plano
          </TabButton>
          <TabButton
            active={tab === 'editable'}
            onClick={() => setTab('editable')}
            disabled={!plano || !fromDrawing}
          >
            Editable (beta)
          </TabButton>
          <TabButton
            active={tab === 'cenital'}
            onClick={() => setTab('cenital')}
            disabled={!cenitalUrl}
          >
            Vista cenital
          </TabButton>
        </div>
        <div className="flex items-center gap-1">
          {!fromCanvas && !fromDrawing && (
            <ModernSelect
              aria-label="Modo de redibujado"
              value={redrawMode}
              onChange={(e) => onChangeMode(e.target.value as RedrawMode)}
              className="border-line bg-surface text-ink rounded-control border px-2 py-1 text-xs"
            >
              <option value="tecnico">
                Técnico (solo estructura){redraws.tecnico ? '' : ' · no generado'}
              </option>
              <option value="decorado">
                Decorado (con mobiliario){redraws.decorado ? '' : ' · no generado'}
              </option>
            </ModernSelect>
          )}
          {!fromCanvas && !fromDrawing && !redraws[redrawMode] && (
            <span className="text-destructive text-xs" role="status">
              Sin redibujado {redrawMode === 'decorado' ? 'decorado' : 'técnico'}: pulsa «Redibujar
              con IA».
            </span>
          )}
          {!fromCanvas && !fromDrawing && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRegenerate}
              disabled={busy !== null}
              title="Repite el redibujado con la misma imagen (cada tirada puede variar en detalles)"
            >
              {busy === 'redraw' ? 'Redibujando…' : 'Redibujar con IA (opcional)'}
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={busy !== null}>
            ← Nuevo plano
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="border-line relative min-h-64 min-w-0 flex-1 overflow-hidden rounded-card border bg-white">
          {tab === 'plano' ? (
            <PlanImageViewer
              key={planImageUrl}
              src={planImageUrl}
              alt={
                fromCanvas
                  ? 'Plano amueblado del editor'
                  : fromDrawing
                    ? 'Plano dibujado original'
                    : 'Plano de referencia'
              }
              caption={
                !fromCanvas && !fromDrawing
                  ? `${
                      shownMode
                        ? `Mostrando el redibujado ${shownMode === 'decorado' ? 'decorado' : 'técnico'}. «Importar este plano» y la vista cenital usan esta imagen.`
                        : 'Mostrando el original subido. Redibuja con IA o elige un modo ya generado.'
                    }${
                      shownMode !== redrawMode && !redraws[redrawMode]
                        ? ` El redibujado ${redrawMode === 'decorado' ? 'decorado' : 'técnico'} aún no está generado: pulsa «Redibujar con IA».`
                        : ''
                    }`
                  : undefined
              }
            />
          ) : null}
          {tab === 'editable' && svgUrl ? (
            <PlanImageViewer key={svgUrl} src={svgUrl} alt="Plano editable extraído" />
          ) : null}
          {tab === 'cenital' && cenitalUrl ? (
            <PlanImageViewer key={cenitalUrl} src={cenitalUrl} alt="Vista cenital fotorrealista" />
          ) : null}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-64">
          <p className="text-ink-soft text-xs">Resultados guardados en este proyecto.</p>
          {!fromCanvas && !fromDrawing && (
            <p className="text-ink-soft text-xs">
              El redibujado con IA puede modificar detalles. Compara siempre con el original antes
              de editar o generar vistas.
            </p>
          )}
          {originalUrl && (
            <a
              className="text-brand-700 text-sm underline"
              href={originalUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ver original guardado
            </a>
          )}
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={onImportCanvas}>
            Traer el plano del editor
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => setImporting(true)}
          >
            Importar plano dibujado (CAD / PDF)
          </Button>
          <a
            className="text-brand-700 text-sm underline"
            href={
              tab === 'cenital'
                ? (cenitalUrl ?? undefined)
                : tab === 'editable'
                  ? (svgUrl ?? undefined)
                  : planImageUrl
            }
            download={tab === 'editable' ? 'plano.svg' : 'habiteka.png'}
            target="_blank"
            rel="noreferrer"
          >
            Abrir / descargar esta vista
          </a>
          {fromCanvas && (
            <a className="text-brand-700 text-sm underline" href={`/projects/${projectId}`}>
              Editar el canvas original
            </a>
          )}
          {!fromCanvas && !fromDrawing ? (
            <div className="border-line bg-surface rounded-card border p-4">
              <p className="text-ink mb-1 text-sm font-medium">Llevar al editor</p>
              <p className="text-ink-soft mb-2 text-xs">
                Lee muros, huecos, estancias y cotas escritas de la imagen que estás viendo y abre
                la tabla de medidas para revisarla antes de enviar. Mejor desde el redibujado
                técnico.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={onImportCurrent}
                disabled={busy !== null}
              >
                {busy === 'import' ? 'Leyendo el plano…' : 'Importar este plano'}
              </Button>
            </div>
          ) : null}

          {plano && fromDrawing ? (
            <div className="border-line bg-surface rounded-card border p-4">
              <p className="text-ink mb-1 text-sm font-medium">Editar en la app</p>
              <p className="text-ink-soft mb-2 text-xs">
                {confirmSend
                  ? 'Esto REEMPLAZA el plano actual del editor de este proyecto. ¿Continuar?'
                  : 'Envía los muros y aberturas al editor para ajustarlos a mano.'}
              </p>
              <Button
                type="button"
                size="sm"
                variant={confirmSend ? 'default' : 'outline'}
                className="w-full"
                onClick={onSendToEditor}
                disabled={busy !== null}
              >
                {busy === 'send'
                  ? 'Enviando…'
                  : confirmSend
                    ? 'Sí, reemplazar y abrir el editor'
                    : 'Enviar al editor'}
              </Button>
              {confirmSend && busy === null ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1 w-full"
                  onClick={() => setConfirmSend(false)}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="border-line bg-surface rounded-card border p-4">
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
              Tipo de vista
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
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={onGenerateCenital}
              disabled={busy !== null}
            >
              {busy === 'cenital'
                ? 'Generando…'
                : vista === 'maqueta'
                  ? 'Generar maqueta 3D'
                  : 'Generar vista cenital'}
            </Button>
            {busy === 'cenital' ? (
              <p className="text-ink-soft mt-2 animate-pulse text-xs">
                El render puede tardar hasta un par de minutos.
              </p>
            ) : null}
          </div>

          <TosAcceptanceNotice
            accepted={tosAccepted}
            onAccept={acceptTos}
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
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-control px-3 py-1.5 text-sm transition-colors ${
        active ? 'bg-brand-50 text-brand-700 font-medium' : 'text-ink-soft hover:text-ink'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      {children}
    </button>
  );
}
