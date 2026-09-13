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
import { ImageUpload, type UploadedImage } from '@/components/chat/image-upload';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import { SketchPad } from './sketch-pad';
import type { StudioState } from '@/lib/studio-state';
import { ESTILOS } from '@/lib/design-options';
import type { Estilo, Plano2dPayload, SketchPlanResult } from '@/lib/contracts';

type ImagePart = { type: 'image_url'; base64: string; mimeType: string };

interface Props {
  projectId: string;
  initialState: StudioState;
  uploadAction: (projectId: string, base64: string) => Promise<{ imageUrl: string }>;
  drawingAction: (
    projectId: string,
    base64: string,
  ) => Promise<SketchPlanResult & { imageUrl: string }>;
  importCanvasAction: (projectId: string) => Promise<{ imageUrl: string }>;
  scaleAction: (projectId: string, meters: number) => Promise<Plano2dPayload>;
  redrawAction: (projectId: string, imageParts: ImagePart[]) => Promise<{ imageUrl: string }>;
  /** Extrae la geometría del plano REDIBUJADO (muros medidos por píxeles). */
  extractAction: (projectId: string, imageUrl: string) => Promise<SketchPlanResult>;
  /** Cenital directamente desde la IMAGEN del plano redibujado. */
  cenitalAction: (
    projectId: string,
    imageUrl: string,
    estilo: Estilo,
    instrucciones?: string,
  ) => Promise<{ imageUrl: string }>;
  sendToEditorAction: (projectId: string, plano: Plano2dPayload) => Promise<void>;
}

type Tab = 'plano' | 'editable' | 'cenital';
type Busy = 'redraw' | 'extract' | 'cenital' | 'send' | 'import' | 'scale' | null;

export function PlanoStudio({
  projectId,
  initialState,
  drawingAction,
  uploadAction,
  importCanvasAction,
  scaleAction,
  redrawAction,
  extractAction,
  cenitalAction,
  sendToEditorAction,
}: Props) {
  const router = useRouter();
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
  const [anchoRealInput, setAnchoRealInput] = useState('');
  const [cenitalUrl, setCenitalUrl] = useState<string | null>(
    initialState.cenital?.assetUrl ?? null,
  );
  const [tab, setTab] = useState<Tab>('plano');
  const [estilo, setEstilo] = useState<Estilo>(initialState.estilo ?? 'moderno');
  // Detalles del propietario para el render: mobiliario real, singularidades
  // ("cocina con isla", "registros de placas solares en la entrada"…).
  const [detalles, setDetalles] = useState(initialState.detalles ?? '');
  const [busy, setBusy] = useState<Busy>(null);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

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
      const { imageUrl } = await redrawAction(projectId, parts(image));
      setSource(image);
      setFromCanvas(false);
      setFromDrawing(false);
      setPlanImageUrl(imageUrl);
      setPlano(null);
      setCenitalUrl(null);
      setConfirmSend(false);
      setEscalaEstimada(false);
      setAnchoRealInput('');
      setTab('plano');
    });

  const onUpload = (image: UploadedImage) =>
    run('import', async () => {
      const result = await uploadAction(projectId, image.base64);
      setSource(image);
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
      setFromCanvas(false);
      setFromDrawing(true);
      setPlanImageUrl(result.imageUrl);
      setOriginalUrl(result.imageUrl);
      setPlano(result.plano);
      setEscalaEstimada(true);
      setCenitalUrl(null);
      setConfirmSend(false);
      setAnchoRealInput('');
      setTab('plano');
    });

  /** Repite la tirada con la MISMA imagen (varianza generativa: a veces la
   *  siguiente sale sin el defecto), sin obligar a re-subir. */
  const onRegenerate = () => {
    if (source) void redrawFrom(source);
    else
      void run('redraw', async () => {
        const result = await redrawAction(projectId, []);
        setPlanImageUrl(result.imageUrl);
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

  const onExtract = () => {
    // Se extrae del REDIBUJADO, no de la foto original: es la versión con
    // muros macizos que la detección de píxeles mide con exactitud.
    if (!planImageUrl) return;
    return run('extract', async () => {
      const result = await extractAction(projectId, planImageUrl);
      setPlano(result.plano);
      setEscalaEstimada(result.escalaEstimada);
      setAnchoRealInput('');
      setTab('editable');
    });
  };

  const onGenerateCenital = () => {
    // Desde la IMAGEN redibujada (imagen→imagen): no requiere extraer geometría.
    if (!planImageUrl) return;
    return run('cenital', async () => {
      const { imageUrl } = await cenitalAction(projectId, planImageUrl, estilo, detalles);
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
  const applyRealWidth = () => {
    if (!plano) return;
    const meters = Number(anchoRealInput.replace(',', '.'));
    if (!Number.isFinite(meters) || meters < 1 || meters > 100) {
      setError('Indica un ancho en metros entre 1 y 100.');
      return;
    }
    void run('scale', async () => {
      setPlano(await scaleAction(projectId, meters));
      setEscalaEstimada(false);
    });
  };

  const reset = () => {
    setSource(null);
    setConfirmSend(false);
    setPlanImageUrl(null);
    setPlano(null);
    setEscalaEstimada(false);
    setAnchoRealInput('');
    setCenitalUrl(null);
    setError(null);
    setTab('plano');
  };

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
          </div>
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
            disabled={!plano}
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
        <div className="flex gap-1">
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
        <div className="border-line grid min-h-64 flex-1 place-items-center overflow-auto rounded-card border bg-white p-4">
          {tab === 'plano' ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen generada por IA (URL firmada o data URL).
            <img
              src={planImageUrl}
              alt={
                fromCanvas
                  ? 'Plano amueblado del editor'
                  : fromDrawing
                    ? 'Plano dibujado original'
                    : 'Plano de referencia'
              }
              className="max-h-full max-w-full"
            />
          ) : null}
          {tab === 'editable' && svgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- SVG generado en memoria (data URL).
            <img src={svgUrl} alt="Plano editable extraído" className="max-h-full max-w-full" />
          ) : null}
          {tab === 'cenital' && cenitalUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen generada por IA.
            <img
              src={cenitalUrl}
              alt="Vista cenital fotorrealista"
              className="max-h-full max-w-full rounded"
            />
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
            Actualizar desde el canvas
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
          {!plano && !fromCanvas ? (
            <div className="border-line bg-surface rounded-card border p-4">
              <p className="text-ink mb-1 text-sm font-medium">Versión editable</p>
              <p className="text-ink-soft mb-2 text-xs">
                Extrae muros y aberturas como geometría editable (beta) para retocar el plano en el
                editor.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={onExtract}
                disabled={busy !== null}
              >
                {busy === 'extract' ? 'Extrayendo…' : 'Extraer geometría'}
              </Button>
            </div>
          ) : null}

          {plano ? (
            <div className="border-line bg-surface rounded-card border p-4">
              <p className="text-ink mb-1 text-sm font-medium">Editar en la app</p>
              {!fromDrawing && !fromCanvas && (
                <Button type="button" size="sm" variant="outline" className="mb-2 w-full"
                  onClick={onExtract} disabled={busy !== null}>
                  {busy === 'extract' ? 'Extrayendo…' : 'Recalcular geometría'}
                </Button>
              )}
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

          {plano ? (
            <div className="border-line bg-surface rounded-card border p-4">
              <p className="text-ink mb-1 text-sm font-medium">Medidas reales</p>
              <p className="text-ink-soft mb-2 text-xs">
                {escalaEstimada
                  ? 'Sin una medida confirmada no mostramos cotas ni superficies. Indica el ancho total real.'
                  : 'Puedes corregir el ancho total real. Todas las medidas se ajustan proporcionalmente.'}
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={0.1}
                  value={anchoRealInput}
                  onChange={(e) => setAnchoRealInput(e.target.value)}
                  placeholder="Ancho (m)"
                  aria-label="Ancho total real en metros"
                  className="border-line bg-surface text-ink w-full rounded-control border px-2 py-1.5 text-sm"
                />
                <Button type="button" size="sm" onClick={applyRealWidth} disabled={busy !== null}>
                  Aplicar
                </Button>
              </div>
            </div>
          ) : null}

          <div className="border-line bg-surface rounded-card border p-4">
            <label htmlFor="estilo" className="text-ink mb-2 block text-sm font-medium">
              Estilo de interiorismo
            </label>
            <select
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
            </select>
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
              {busy === 'cenital' ? 'Generando…' : 'Generar vista cenital'}
            </Button>
            {busy === 'cenital' ? (
              <p className="text-ink-soft mt-2 animate-pulse text-xs">
                El render puede tardar hasta un par de minutos.
              </p>
            ) : null}
          </div>

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
