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
 *  3. "Vista cenital" (requiere la versión editable): render fotorrealista.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ImageUpload, type UploadedImage } from '@/components/chat/image-upload';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import { rescalePlanoToWidth } from '@/lib/plan-svg/rescale-plano';
import { ESTILOS } from '@/lib/design-options';
import type { Estilo, Plano2dPayload, SketchPlanResult } from '@/lib/contracts';

type ImagePart = { type: 'image_url'; base64: string; mimeType: string };

interface Props {
  projectId: string;
  redrawAction: (projectId: string, imageParts: ImagePart[]) => Promise<{ imageUrl: string }>;
  /** Extrae la geometría del plano REDIBUJADO (muros medidos por píxeles). */
  extractAction: (projectId: string, imageUrl: string) => Promise<SketchPlanResult>;
  cenitalAction: (
    projectId: string,
    plano: Plano2dPayload,
    estilo: Estilo,
  ) => Promise<{ imageUrl: string }>;
  sendToEditorAction: (projectId: string, plano: Plano2dPayload) => Promise<void>;
}

type Tab = 'plano' | 'editable' | 'cenital';
type Busy = 'redraw' | 'extract' | 'cenital' | 'send' | null;

export function PlanoStudio({
  projectId,
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
  const [planImageUrl, setPlanImageUrl] = useState<string | null>(null);
  const [plano, setPlano] = useState<Plano2dPayload | null>(null);
  // Sin medidas escritas en el original, las cotas serían inventadas: no se pintan.
  const [escalaEstimada, setEscalaEstimada] = useState(false);
  const [anchoRealInput, setAnchoRealInput] = useState('');
  const [cenitalUrl, setCenitalUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('plano');
  const [estilo, setEstilo] = useState<Estilo>('moderno');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const svgUrl = useMemo(() => {
    if (!plano) return null;
    const svg = planoToSvg(plano, {
      pxPerMeter: 90,
      showDimensions: !escalaEstimada,
      // Sin nombres ni rellenos de estancia (decisión de producto): el usuario
      // etiqueta en el editor; los aproximados solo ensuciaban la vista.
      showLabels: false,
      theme: { floorFill: '#ffffff' },
      showAreas: !escalaEstimada,
    });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [plano, escalaEstimada]);

  const parts = (img: UploadedImage): ImagePart[] => [
    { type: 'image_url', base64: img.base64, mimeType: img.mimeType },
  ];

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
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

  const redrawFrom = (image: UploadedImage) =>
    run('redraw', async () => {
      const { imageUrl } = await redrawAction(projectId, parts(image));
      setSource(image);
      setPlanImageUrl(imageUrl);
      setPlano(null);
      setCenitalUrl(null);
      setTab('plano');
    });

  const onUpload = redrawFrom;

  /** Repite la tirada con la MISMA imagen (varianza generativa: a veces la
   *  siguiente sale sin el defecto), sin obligar a re-subir. */
  const onRegenerate = () => {
    if (source) void redrawFrom(source);
  };

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
    if (!plano) return;
    return run('cenital', async () => {
      const { imageUrl } = await cenitalAction(projectId, plano, estilo);
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
    setError(null);
    setPlano(rescalePlanoToWidth(plano, meters));
    setEscalaEstimada(false);
    setCenitalUrl(null); // el render anterior ya no corresponde a la escala nueva
  };

  const reset = () => {
    setSource(null);
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
        <div className="border-line bg-surface w-full max-w-lg rounded-card border border-dashed p-10 text-center shadow-sm">
          <p className="mb-1 text-3xl" aria-hidden>
            ✏️
          </p>
          <h1 className="text-ink mb-2 text-lg font-semibold">De boceto a plano profesional</h1>
          <p className="text-ink-soft mb-6 text-sm">
            Sube la foto de un plano o boceto en planta y lo redibujamos como un plano de
            arquitectura profesional, respetando tu distribución.
          </p>
          <div className="mx-auto max-w-xs">
            <ImageUpload onUpload={onUpload} disabled={busy !== null} />
          </div>
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
      <div className="flex items-center justify-between">
        <div className="flex gap-1" role="tablist" aria-label="Vista">
          <TabButton active={tab === 'plano'} onClick={() => setTab('plano')}>
            Plano
          </TabButton>
          <TabButton active={tab === 'editable'} onClick={() => setTab('editable')} disabled={!plano}>
            Editable (beta)
          </TabButton>
          <TabButton active={tab === 'cenital'} onClick={() => setTab('cenital')} disabled={!cenitalUrl}>
            Vista cenital
          </TabButton>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRegenerate}
            disabled={busy !== null || !source}
            title="Repite el redibujado con la misma imagen (cada tirada puede variar en detalles)"
          >
            {busy === 'redraw' ? 'Regenerando…' : '↻ Regenerar'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={busy !== null}>
            ← Nuevo plano
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="border-line grid min-h-0 flex-1 place-items-center overflow-auto rounded-card border bg-white p-4">
          {tab === 'plano' ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen generada por IA (URL firmada o data URL).
            <img src={planImageUrl} alt="Plano profesional redibujado" className="max-h-full max-w-full" />
          ) : null}
          {tab === 'editable' && svgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- SVG generado en memoria (data URL).
            <img src={svgUrl} alt="Plano editable extraído" className="max-h-full max-w-full" />
          ) : null}
          {tab === 'cenital' && cenitalUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen generada por IA.
            <img src={cenitalUrl} alt="Vista cenital fotorrealista" className="max-h-full max-w-full rounded" />
          ) : null}
        </div>

        <aside className="flex w-64 shrink-0 flex-col gap-3">
          {!plano ? (
            <div className="border-line bg-surface rounded-card border p-4">
              <p className="text-ink mb-1 text-sm font-medium">Versión editable</p>
              <p className="text-ink-soft mb-2 text-xs">
                Extrae muros y aberturas como geometría editable (beta). Necesaria para la vista
                cenital.
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

          {plano && escalaEstimada ? (
            <div className="border-line bg-surface rounded-card border p-4">
              <p className="text-ink mb-1 text-sm font-medium">Medidas reales</p>
              <p className="text-ink-soft mb-2 text-xs">
                Tu plano no trae medidas, así que no mostramos cotas ni superficies. Indica el
                ancho total real y las calculamos con tu dato.
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
                <Button type="button" size="sm" onClick={applyRealWidth}>
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
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={onGenerateCenital}
              disabled={busy !== null || !plano}
              title={!plano ? 'Extrae antes la geometría editable' : undefined}
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
        active ? 'bg-accent-soft text-accent font-medium' : 'text-ink-soft hover:text-ink'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      {children}
    </button>
  );
}
