'use client';

/**
 * Importar un PLANO DIBUJADO O CREADO (esquemático, CAD, PDF) al Editor v2.
 *
 * Flujo: subir imagen o PDF (rasterizado en el navegador) → extracción →
 * superposición de los vectores sobre el original → tabla de estancias con las
 * medidas escritas (editable: la fidelidad no depende de lo que lea la IA) →
 * recalcular sin IA → enviar al editor (reemplaza el plano; confirmación en dos
 * pasos). UI mínima funcional: la lógica vive en servidor y contratos.
 */
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageUpload, type UploadedImage } from '@/components/chat/image-upload';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import type { PlanImportResult, WrittenRoomDimensions } from '@/lib/contracts';
import { callAction, type ActionErrorResult } from '@/lib/action-result';
import { pdfFirstPageToPng } from './pdf-to-png';

export interface PlanImportActions {
  importAction: (
    projectId: string,
    base64: string,
    options: { includeFurniture?: boolean },
  ) => Promise<(PlanImportResult & { imageUrl: string }) | ActionErrorResult>;
  refitAction: (
    projectId: string,
    roomOverrides: WrittenRoomDimensions[],
    options: { includeFurniture?: boolean; generalWidthMm?: number },
  ) => Promise<PlanImportResult | ActionErrorResult>;
  applyAction: (
    projectId: string,
    result: PlanImportResult,
  ) => Promise<{ issues: string[] } | ActionErrorResult>;
}

interface Props extends PlanImportActions {
  projectId: string;
  onBack: () => void;
  /** Importación ya extraída (guardada en el estudio): se retoma sin volver a llamar a la IA. */
  initialResult?: (PlanImportResult & { imageUrl: string }) | null;
}

type Busy = 'import' | 'refit' | 'apply' | 'pdf' | null;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function PlanImportPanel({ projectId, importAction, refitAction, applyAction, onBack, initialResult }: Props) {
  const router = useRouter();
  const pdfInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialResult?.imageUrl ?? null);
  const [result, setResult] = useState<PlanImportResult | null>(initialResult ?? null);
  const [rows, setRows] = useState<WrittenRoomDimensions[]>(initialResult?.writtenDimensions ?? []);
  // En esta fase importamos la ESTRUCTURA; el mobiliario leído es opcional y viene desactivado.
  const [includeFurniture, setIncludeFurniture] = useState(false);
  const [overlay, setOverlay] = useState(true);
  // Ancho total real (m) cuando el plano no trae cotas generales legibles.
  const [generalWidth, setGeneralWidth] = useState('');
  const [confirmApply, setConfirmApply] = useState(false);

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

  const svgUrl = useMemo(() => {
    if (!result) return null;
    const svg = planoToSvg(result.plano, {
      pxPerMeter: 90,
      showDimensions: !result.escalaEstimada,
      showLabels: true,
      showAreas: false,
      theme: { floorFill: 'transparent', windowColor: '#2b7bbf' },
    });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [result]);

  const importFrom = (image: UploadedImage) =>
    run('import', async () => {
      const imported = await callAction(
        importAction(projectId, image.base64, { includeFurniture }),
      );
      setImageUrl(imported.imageUrl);
      setResult(imported);
      setRows(imported.writtenDimensions);
      setConfirmApply(false);
    });

  const onPdf = (file: File) =>
    run('pdf', async () => {
      if (file.size > MAX_PDF_BYTES) throw new Error('El PDF supera el tamaño máximo (20 MB).');
      const png = await pdfFirstPageToPng(file);
      await importFrom({ base64: png.base64, mimeType: png.mimeType });
    });

  const updateRow = (zoneId: string, field: 'widthMm' | 'heightMm', value: string) => {
    const meters = Number(value.replace(',', '.'));
    setRows((prev) =>
      prev.map((row) =>
        row.zoneId !== zoneId
          ? row
          : {
              ...row,
              [field]: value.trim() === '' || !Number.isFinite(meters) ? undefined : Math.round(meters * 1000),
            },
      ),
    );
  };

  const onRefit = () =>
    run('refit', async () => {
      const meters = Number(generalWidth.replace(',', '.'));
      const generalWidthMm = generalWidth.trim() !== '' && Number.isFinite(meters) ? Math.round(meters * 1000) : undefined;
      const refitted = await callAction(
        refitAction(projectId, rows, {
          includeFurniture,
          ...(generalWidthMm ? { generalWidthMm } : {}),
        }),
      );
      setResult(refitted);
      setRows(refitted.writtenDimensions.map((w) => rows.find((r) => r.zoneId === w.zoneId) ?? w));
      setConfirmApply(false);
    });

  const onApply = () => {
    if (!result) return;
    if (!confirmApply) {
      setConfirmApply(true);
      return;
    }
    return run('apply', async () => {
      await callAction(applyAction(projectId, result));
      router.push(`/projects/${projectId}`);
    });
  };

  const metres = (mm?: number) => (mm === undefined ? '' : (mm / 1000).toFixed(2));

  // ── Sin resultado: elegir fichero ──────────────────────────────────────────
  if (!result) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="border-line bg-surface w-full max-w-lg rounded-card border border-dashed p-6 text-center shadow-sm">
          <p className="mb-1 text-3xl" aria-hidden>📐</p>
          <h1 className="text-ink mb-2 text-lg font-semibold">Importar plano dibujado</h1>
          <p className="text-ink-soft mb-6 text-sm">
            Plano esquemático, CAD exportado o PDF. Leemos muros, huecos, estancias, cotas escritas
            y mobiliario, y lo dejamos editable en el editor respetando las medidas.
          </p>
          <div className="mx-auto flex max-w-xs flex-col gap-3">
            <ImageUpload onUpload={importFrom} disabled={busy !== null} />
            <input
              ref={pdfInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              aria-label="Seleccionar PDF del plano"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onPdf(file);
                e.target.value = '';
              }}
            />
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => pdfInput.current?.click()}>
              {busy === 'pdf' ? 'Leyendo PDF…' : '📄 Subir PDF (primera página)'}
            </Button>
            <label className="text-ink-soft flex items-center justify-center gap-2 text-xs">
              <input type="checkbox" checked={includeFurniture} onChange={(e) => setIncludeFurniture(e.target.checked)} />
              Colocar el mobiliario dibujado
            </label>
            <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={onBack}>
              ← Volver
            </Button>
          </div>
          {busy === 'import' ? (
            <p className="text-ink-soft mt-4 animate-pulse text-sm">Leyendo el plano… puede tardar un minuto.</p>
          ) : null}
          {error ? <p className="text-destructive mt-4 text-sm" role="alert">{error}</p> : null}
        </div>
      </div>
    );
  }

  // ── Con resultado: superposición + tabla ───────────────────────────────────
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-ink text-lg font-semibold">Plano importado</h1>
        <div className="flex gap-2">
          <label className="text-ink-soft flex items-center gap-2 text-xs">
            <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
            Superponer sobre el original
          </label>
          <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => { setResult(null); setConfirmApply(false); }}>
            ← Otro plano
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="border-line relative grid min-h-64 flex-1 place-items-center overflow-auto rounded-card border bg-white p-4">
          <div className="relative">
            {imageUrl && overlay ? (
              // eslint-disable-next-line @next/next/no-img-element -- original subido (URL firmada).
              <img src={imageUrl} alt="Plano original" className="max-h-[70vh] max-w-full opacity-40" />
            ) : null}
            {svgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- SVG generado en memoria (data URL).
              <img
                src={svgUrl}
                alt="Plano extraído"
                className={overlay && imageUrl ? 'absolute inset-0 h-full w-full object-contain' : 'max-h-[70vh] max-w-full'}
              />
            ) : null}
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-80">
          {result.escalaEstimada || generalWidth.trim() !== '' ? (
            <div className="border-line bg-surface rounded-card border p-3">
              <p className="text-ink mb-1 text-sm font-medium">Ancho total real (m)</p>
              <p className="text-ink-soft mb-2 text-xs">
                {result.escalaEstimada
                  ? 'No se han leído cotas generales: la escala es aproximada. Indica el ancho total y recalcula.'
                  : 'Escala fijada con el ancho indicado.'}
              </p>
              <Input aria-label="Ancho total real en metros" inputMode="decimal" placeholder="Ej.: 12,5"
                value={generalWidth} onChange={(e) => setGeneralWidth(e.target.value)} className="h-8 text-sm" />
            </div>
          ) : null}
          <div className="border-line bg-surface rounded-card border p-3">
            <p className="text-ink mb-2 text-sm font-medium">Medidas por estancia (m)</p>
            <table className="w-full text-xs">
              <thead className="text-ink-soft">
                <tr><th className="text-left font-normal">Estancia</th><th className="font-normal">Ancho</th><th className="font-normal">Alto</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.zoneId}>
                    <td className="text-ink pr-2">{row.name}</td>
                    <td className="pr-1">
                      <Input aria-label={`Ancho de ${row.name}`} className="h-7 px-1 text-xs" inputMode="decimal"
                        defaultValue={metres(row.widthMm)} onBlur={(e) => updateRow(row.zoneId, 'widthMm', e.target.value)} />
                    </td>
                    <td>
                      <Input aria-label={`Alto de ${row.name}`} className="h-7 px-1 text-xs" inputMode="decimal"
                        defaultValue={metres(row.heightMm)} onBlur={(e) => updateRow(row.zoneId, 'heightMm', e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="text-ink-soft mt-2 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={includeFurniture} onChange={(e) => setIncludeFurniture(e.target.checked)} />
              Colocar el mobiliario dibujado
            </label>
            <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={onRefit} disabled={busy !== null}>
              {busy === 'refit' ? 'Recalculando…' : 'Recalcular con estas medidas'}
            </Button>
          </div>

          {result.corrections.length > 0 ? (
            <p className="text-ink-soft text-xs">
              {result.corrections.length} ajuste(s) aplicados a las cotas escritas
              {result.corrections.some((c) => Math.abs(c.residualMm) > 30) ? '; alguno quedó con desvío (ver avisos).' : '.'}
            </p>
          ) : null}
          <p className="text-ink-soft text-xs">
            {result.exteriors.length} zona(s) exterior(es) · {result.furniture.length} mueble(s) colocado(s)
          </p>
          {result.warnings.length > 0 ? (
            <ul className="text-ink-soft list-disc space-y-1 pl-4 text-xs">
              {result.warnings.slice(0, 8).map((w, i) => <li key={i}>{w.message}</li>)}
              {result.warnings.length > 8 ? <li>… y {result.warnings.length - 8} más</li> : null}
            </ul>
          ) : null}

          <div className="border-line bg-surface rounded-card border p-3">
            <p className="text-ink-soft mb-2 text-xs">
              {confirmApply
                ? 'Esto REEMPLAZA el plano actual del editor de este proyecto. ¿Continuar?'
                : 'Envía muros, huecos, estancias y mobiliario al editor para seguir trabajando.'}
            </p>
            <Button type="button" size="sm" variant={confirmApply ? 'default' : 'outline'} className="w-full" onClick={onApply} disabled={busy !== null}>
              {busy === 'apply' ? 'Enviando…' : confirmApply ? 'Sí, reemplazar y abrir el editor' : 'Enviar al editor'}
            </Button>
            {confirmApply ? (
              <Button type="button" size="sm" variant="ghost" className="mt-1 w-full" onClick={() => setConfirmApply(false)} disabled={busy !== null}>
                Cancelar
              </Button>
            ) : null}
          </div>
          {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
        </aside>
      </div>
    </div>
  );
}
