'use client';

/**
 * Estudio de planos: la superficie LIMPIA del pivote planos-IA, construida de
 * cero y sin dependencias del workspace legacy (ni Konva ni sus barras).
 *
 * Flujo en tres estados: subir boceto → plano técnico (SVG determinista como
 * protagonista) → imagen cenital fotorrealista. La lógica pesada vive en el
 * servidor (extracción + pipeline cenital); aquí solo estados de UI.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImageUpload, type UploadedImage } from '@/components/chat/image-upload';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import { rescalePlanoToWidth } from '@/lib/plan-svg/rescale-plano';
import { ESTILOS } from '@/lib/design-options';
import type { Estilo, Plano2dPayload, SketchPlanResult } from '@/lib/contracts';

type ImagePart = { type: 'image_url'; base64: string; mimeType: string };

interface Props {
  projectId: string;
  extractAction: (projectId: string, imageParts: ImagePart[]) => Promise<SketchPlanResult>;
  cenitalAction: (
    projectId: string,
    plano: Plano2dPayload,
    estilo: Estilo,
  ) => Promise<{ imageUrl: string }>;
}

type Tab = 'plano' | 'cenital';

export function PlanoStudio({ projectId, extractAction, cenitalAction }: Props) {
  const [plano, setPlano] = useState<Plano2dPayload | null>(null);
  // Escala estimada = el boceto no traía medidas escritas: las cotas y los m²
  // serían números inventados, así que no se muestran hasta que el usuario
  // aporte el ancho real.
  const [escalaEstimada, setEscalaEstimada] = useState(false);
  const [anchoRealInput, setAnchoRealInput] = useState('');
  const [cenitalUrl, setCenitalUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('plano');
  const [estilo, setEstilo] = useState<Estilo>('moderno');
  const [busy, setBusy] = useState<'extract' | 'cenital' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const svg = useMemo(
    () =>
      plano
        ? planoToSvg(plano, {
            pxPerMeter: 90,
            showDimensions: !escalaEstimada,
            showAreas: !escalaEstimada,
          })
        : null,
    [plano, escalaEstimada],
  );
  const svgUrl = useMemo(
    () => (svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : null),
    [svg],
  );

  const onUpload = async (image: UploadedImage) => {
    setBusy('extract');
    setError(null);
    try {
      const result = await extractAction(projectId, [
        { type: 'image_url', base64: image.base64, mimeType: image.mimeType },
      ]);
      setPlano(result.plano);
      setEscalaEstimada(result.escalaEstimada);
      setAnchoRealInput('');
      setCenitalUrl(null);
      setTab('plano');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo analizar el boceto.');
    } finally {
      setBusy(null);
    }
  };

  const onGenerateCenital = async () => {
    if (!plano) return;
    setBusy('cenital');
    setError(null);
    try {
      const { imageUrl } = await cenitalAction(projectId, plano, estilo);
      setCenitalUrl(imageUrl);
      setTab('cenital');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar la imagen cenital.');
    } finally {
      setBusy(null);
    }
  };

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plano.svg';
    a.click();
    URL.revokeObjectURL(url);
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
    setPlano(null);
    setEscalaEstimada(false);
    setAnchoRealInput('');
    setCenitalUrl(null);
    setError(null);
    setTab('plano');
  };

  // ── Estado 1: sin plano — el boceto es el único protagonista ───────────────
  if (!plano) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="border-line bg-surface w-full max-w-lg rounded-card border border-dashed p-10 text-center shadow-sm">
          <p className="mb-1 text-3xl" aria-hidden>
            ✏️
          </p>
          <h1 className="text-ink mb-2 text-lg font-semibold">De boceto a plano profesional</h1>
          <p className="text-ink-soft mb-6 text-sm">
            Sube la foto de un boceto en planta — dibujado a mano vale — y lo convertimos en un
            plano técnico con muros, puertas y ventanas. Después podrás generar una vista cenital
            fotorrealista.
          </p>
          <div className="mx-auto max-w-xs">
            <ImageUpload onUpload={onUpload} disabled={busy !== null} />
          </div>
          {busy === 'extract' ? (
            <p className="text-ink-soft mt-4 animate-pulse text-sm">Analizando el boceto…</p>
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

  // ── Estados 2 y 3: plano protagonista + acciones a la derecha ──────────────
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-1" role="tablist" aria-label="Vista">
          <TabButton active={tab === 'plano'} onClick={() => setTab('plano')}>
            Plano técnico
          </TabButton>
          <TabButton active={tab === 'cenital'} onClick={() => setTab('cenital')} disabled={!cenitalUrl}>
            Vista cenital
          </TabButton>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={busy !== null}>
          ← Nuevo boceto
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="border-line grid min-h-0 flex-1 place-items-center overflow-auto rounded-card border bg-white p-4">
          {tab === 'plano' && svgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- SVG generado en memoria (data URL).
            <img src={svgUrl} alt="Plano técnico generado" className="max-h-full max-w-full" />
          ) : null}
          {tab === 'cenital' ? (
            cenitalUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagen generada por IA (URL firmada del storage).
              <img src={cenitalUrl} alt="Vista cenital fotorrealista" className="max-h-full max-w-full rounded" />
            ) : (
              <p className="text-ink-soft text-sm">Genera la vista cenital para verla aquí.</p>
            )
          ) : null}
        </div>

        <aside className="flex w-64 shrink-0 flex-col gap-3">
          {escalaEstimada ? (
            <div className="border-line bg-surface rounded-card border p-4">
              <p className="text-ink mb-1 text-sm font-medium">Medidas reales</p>
              <p className="text-ink-soft mb-2 text-xs">
                Tu boceto no trae medidas, así que no mostramos cotas ni superficies. Indica el
                ancho total real del plano y las calculamos con tu dato.
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
            <Button type="button" className="mt-3 w-full" onClick={onGenerateCenital} disabled={busy !== null}>
              {busy === 'cenital' ? 'Generando…' : 'Generar vista cenital'}
            </Button>
            {busy === 'cenital' ? (
              <p className="text-ink-soft mt-2 animate-pulse text-xs">
                El render puede tardar hasta un par de minutos.
              </p>
            ) : null}
          </div>

          <div className="border-line bg-surface rounded-card border p-4">
            <p className="text-ink mb-2 text-sm font-medium">Plano</p>
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={downloadSvg}>
              Descargar SVG
            </Button>
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
