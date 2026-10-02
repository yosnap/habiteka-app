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
import { Fragment, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageUpload, type UploadedImage } from '@/components/chat/image-upload';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import type { PlanDoorOverride, PlanImportResult, Plano2dPayload, WrittenRoomDimensions } from '@/lib/contracts';
import { doorSwing } from '@/lib/plan-svg/door-swing';
import { callAction, type ActionErrorResult } from '@/lib/action-result';
import type { StudioQuality } from '@/lib/studio-state';
import { pdfFirstPageToPng } from './pdf-to-png';
import { PlanQualityCard } from './plan-quality-card';

/** Importación con su veredicto de fiabilidad, tal y como la devuelve el servidor. */
export type ImportedPlan = PlanImportResult & { imageUrl: string; quality: StudioQuality };

export interface PlanImportActions {
  importAction: (
    projectId: string,
    base64: string,
    options: { includeFurniture?: boolean },
  ) => Promise<ImportedPlan | ActionErrorResult>;
  refitAction: (
    projectId: string,
    roomOverrides: WrittenRoomDimensions[],
    options: { includeFurniture?: boolean; generalWidthMm?: number | null; doorOverrides?: PlanDoorOverride[] },
  ) => Promise<(PlanImportResult & { quality: StudioQuality }) | ActionErrorResult>;
  applyAction: (
    projectId: string,
    result: PlanImportResult,
  ) => Promise<{ issues: string[]; needsCorrection: boolean } | ActionErrorResult>;
}

interface Props extends PlanImportActions {
  projectId: string;
  hasEditorPlan: boolean;
  onBack: () => void;
  /** Importación ya extraída (guardada en el estudio): se retoma sin volver a llamar a la IA. */
  initialResult?: ImportedPlan | null;
  initialGeneralWidthMm?: number;
  initialIncludeFurniture?: boolean;
}

type Busy = 'import' | 'refit' | 'apply' | 'pdf' | null;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function PlanImportPanel({ projectId, hasEditorPlan, importAction, refitAction, applyAction, onBack, initialResult, initialGeneralWidthMm, initialIncludeFurniture }: Props) {
  const router = useRouter();
  // La zona en curso se conserva al saltar al editor a corregir el plano.
  const zona = useSearchParams().get('zona');
  const pdfInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialResult?.imageUrl ?? null);
  const [result, setResult] = useState<PlanImportResult | null>(initialResult ?? null);
  const [quality, setQuality] = useState<StudioQuality | null>(initialResult?.quality ?? null);
  const [rows, setRows] = useState<WrittenRoomDimensions[]>(initialResult?.writtenDimensions ?? []);
  // En esta fase importamos la ESTRUCTURA; el mobiliario leído es opcional y viene desactivado.
  const [includeFurniture, setIncludeFurniture] = useState(initialIncludeFurniture ?? false);
  const [overlay, setOverlay] = useState(true);
  // Ancho total real (m) cuando el plano no trae cotas generales legibles.
  const [generalWidth, setGeneralWidth] = useState(initialGeneralWidthMm ? String(initialGeneralWidthMm / 1000) : '');
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmNewImport, setConfirmNewImport] = useState(false);
  const [needsRefit, setNeedsRefit] = useState(false);
  // Veredicto del SERVIDOR al aplicar: el plano queda en el editor «a corregir».
  const [needsCorrection, setNeedsCorrection] = useState(false);
  const alignedOverlay = overlay && Boolean(result?.sourceFrameMm && imageUrl);
  const spatialWarnings = result?.warnings.filter((warning) => [
    'ajuste-desplaza-muros', 'estancias-solapadas', 'estancias-fusionadas', 'estancia-inferida',
    'cotas-generales-discordantes', 'muro-inferido-omitido', 'muro-solo-modelo', 'arcos-insuficientes',
  ].includes(warning.code)) ?? [];
  const otherWarnings = result?.warnings.filter((warning) => !spatialWarnings.includes(warning)) ?? [];
  const measuredRooms = useMemo(() => new Map(result?.plano.zones.map((zone) => {
    const xs = zone.outline.map((point) => point.x);
    const ys = zone.outline.map((point) => point.y);
    return [zone.id, xs.length && ys.length
      ? { widthMm: Math.max(...xs) - Math.min(...xs), heightMm: Math.max(...ys) - Math.min(...ys) }
      : null] as const;
  }) ?? []), [result]);
  const doors = useMemo(() => {
    if (!result) return [];
    const walls = new Set(result.plano.zones.flatMap((zone) => zone.walls.map((wall) => wall.id)));
    return result.plano.zones.flatMap((zone) => zone.apertures
      .filter((aperture) => aperture.kind === 'puerta' && walls.has(aperture.wallId))
      .map((aperture) => ({ aperture, room: zone.name })));
  }, [result]);
  const keptImageWalls = result?.warnings.some((warning) =>
    warning.code === 'ajuste-desplaza-muros' && warning.message.includes('Se conservan los muros')) ?? false;

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
      viewBox: alignedOverlay && result.sourceFrameMm
        ? { minX: 0, minY: 0, width: result.sourceFrameMm.width, height: result.sourceFrameMm.height }
        : undefined,
      stretchToFrame: alignedOverlay,
      showDimensions: !alignedOverlay && !result.escalaEstimada,
      showLabels: !alignedOverlay,
      labelZoneIds: alignedOverlay ? result.exteriors.map((zone) => zone.id) : undefined,
      showAreas: false,
      showDoorNumbers: alignedOverlay,
      theme: { background: alignedOverlay ? 'transparent' : '#ffffff', floorFill: 'transparent',
        wallFill: alignedOverlay ? 'rgba(225,29,72,0.78)' : '#26221f',
        lineColor: alignedOverlay ? '#e11d48' : '#26221f', windowColor: '#2b7bbf',
        textColor: alignedOverlay ? '#be123c' : '#26221f' },
    });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [result, alignedOverlay]);

  const performImport = async (image: UploadedImage) => {
    const imported = await callAction(
      importAction(projectId, image.base64, { includeFurniture }),
    );
    setImageUrl(imported.imageUrl);
    setResult(imported);
    setQuality(imported.quality);
    setRows(imported.writtenDimensions);
    setGeneralWidth('');
    setNeedsRefit(false);
    setConfirmApply(false);
    setConfirmNewImport(false);
  };

  const importFrom = (image: UploadedImage) => run('import', () => performImport(image));

  const onPdf = (file: File) =>
    run('pdf', async () => {
      if (file.size > MAX_PDF_BYTES) throw new Error('El PDF supera el tamaño máximo (20 MB).');
      const png = await pdfFirstPageToPng(file);
      await performImport({ base64: png.base64, mimeType: png.mimeType });
    });

  const markForRefit = () => {
    setNeedsRefit(true);
    setConfirmApply(false);
  };

  const updateRow = (zoneId: string, field: 'widthMm' | 'heightMm', value: string) => {
    const meters = Number(value.replace(',', '.'));
    const nextValue = value.trim() === '' || !Number.isFinite(meters) ? undefined : Math.round(meters * 1000);
    if (rows.find((row) => row.zoneId === zoneId)?.[field] !== nextValue) markForRefit();
    setRows((prev) =>
      prev.map((row) =>
        row.zoneId !== zoneId
          ? row
          : {
              ...row,
              [field]: nextValue,
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
          generalWidthMm: generalWidthMm ?? null,
          doorOverrides: result ? doorOverridesFromPlan(result.plano) : [],
        }),
      );
      setResult(refitted);
      setQuality(refitted.quality);
      setRows(refitted.writtenDimensions.map((w) => rows.find((r) => r.zoneId === w.zoneId) ?? w));
      setNeedsRefit(false);
      setConfirmApply(false);
    });

  const changeDoor = (apertureId: string, field: 'swing' | 'hinge') => {
    if (!result) return;
    const walls = new Map(result.plano.zones.flatMap((zone) => zone.walls.map((wall) => [wall.id, wall] as const)));
    const zones = result.plano.zones.map((zone) => ({
      ...zone,
      apertures: zone.apertures.map((aperture) => {
        if (aperture.id !== apertureId || aperture.kind !== 'puerta') return aperture;
        const wall = walls.get(aperture.wallId);
        const current = field === 'swing'
          ? wall ? doorSwing(aperture, wall, result.plano.zones) : 'left'
          : aperture.hinge ?? 'left';
        return { ...aperture, [field]: current === 'left' ? 'right' : 'left' };
      }),
    }));
    setResult({ ...result, plano: { ...result.plano, zones } });
    markForRefit();
  };

  const moveDoor = (apertureId: string, position: number) => {
    if (!result || !Number.isFinite(position)) return;
    setResult({ ...result, plano: { ...result.plano, zones: result.plano.zones.map((zone) => ({
      ...zone, apertures: zone.apertures.map((aperture) => aperture.id === apertureId && aperture.kind === 'puerta'
        ? { ...aperture, position } : aperture),
    })) } });
    markForRefit();
  };

  const editorUrl = `/projects/${projectId}${zona ? `?zona=${encodeURIComponent(zona)}` : ''}`;

  const onApply = () => {
    if (!result) return;
    if (needsRefit) {
      setError('Recalcula el plano revisado antes de enviarlo al editor.');
      return;
    }
    // Incluso con fiabilidad baja, sustituir un plano requiere confirmación.
    if (!confirmApply) {
      setConfirmApply(true);
      return;
    }
    return run('apply', async () => {
      const outcome = await callAction(applyAction(projectId, result));
      // Con el plano marcado «a corregir» no se salta al editor sin avisar: el
      // usuario tiene que saber que va a corregirlo, no a seguir generando.
      if (outcome.needsCorrection) {
        setNeedsCorrection(true);
        return;
      }
      router.push(editorUrl);
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
            y mobiliario. Compararás la geometría con el original antes de enviarla al editor.
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
          <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirmNewImport(true)}>
            ← Otro plano
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={onBack}>
            Volver al estudio
          </Button>
        </div>
      </div>

      {confirmNewImport ? (
        <div className="rounded-control border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
          <p>Una nueva importación sustituirá esta revisión de medidas. El plano ya enviado al editor no se borrará.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setResult(null); setConfirmApply(false); setConfirmNewImport(false); }}>Elegir otro archivo</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmNewImport(false)}>Cancelar</Button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="border-line relative grid min-h-64 flex-1 place-items-center overflow-auto rounded-card border bg-white p-4">
          <div className="relative">
            {alignedOverlay && imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- original subido (URL firmada).
              <img src={imageUrl} alt="Plano original" className="max-h-[70vh] max-w-full" />
            ) : null}
            {svgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- SVG generado en memoria (data URL).
              <img
                src={svgUrl}
                alt="Plano extraído"
                className={alignedOverlay ? 'absolute inset-0 h-full w-full object-fill' : 'max-h-[70vh] max-w-full'}
              />
            ) : null}
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-80">
          {alignedOverlay ? <p className="text-ink-soft text-xs">Rosa: geometría extraída · negro: plano original.</p> : null}
          {overlay && imageUrl && !result.sourceFrameMm ? (
            <p className="text-ink-soft text-xs">Esta revisión antigua no conserva el marco de la imagen; se muestra el vector sin superponer.</p>
          ) : null}
          {spatialWarnings.length > 0 ? (
            <div role="alert" className="rounded-control border border-amber-400 bg-amber-50 p-3 text-xs text-amber-950">
              <p className="font-semibold">Comprueba la geometría antes de crear el 3D</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {spatialWarnings.map((warning, i) => <li key={i}>{warning.message}</li>)}
              </ul>
              {keptImageWalls ? <p className="mt-2">Se mantienen las posiciones detectadas en la imagen. Cambiar una cota escrita no desplazará esos muros: corrige la geometría en Editor v2 tras compararla con el original.</p> : null}
            </div>
          ) : null}
          {result.escalaEstimada || generalWidth.trim() !== '' ? (
            <div className="border-line bg-surface rounded-card border p-3">
              <p className="text-ink mb-1 text-sm font-medium">Ancho total real (m)</p>
              <p className="text-ink-soft mb-2 text-xs">
                {result.escalaEstimada
                  ? 'No se han leído cotas generales: la escala es aproximada. Indica el ancho total y recalcula.'
                  : 'Escala fijada con el ancho indicado.'}
              </p>
              <Input aria-label="Ancho total real en metros" inputMode="decimal" placeholder="Ej.: 12,5"
                value={generalWidth} onChange={(e) => { setGeneralWidth(e.target.value); markForRefit(); }} className="h-8 text-sm" />
            </div>
          ) : null}
          <div className="border-line bg-surface rounded-card border p-3">
            <p className="text-ink mb-1 text-sm font-medium">Cotas y geometría por estancia (m)</p>
            <p className="text-ink-soft mb-2 text-xs">La cota puede medir entre caras, ejes o extremos exteriores de las paredes. «Dibujo» muestra la caja geométrica de la estancia; compárala con el original.</p>
            <table className="w-full text-xs">
              <thead className="text-ink-soft">
                <tr><th className="text-left font-normal">Estancia</th><th className="font-normal">Ancho</th><th className="font-normal">Alto</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const measured = measuredRooms.get(row.zoneId);
                  const mismatch = Boolean(measured && (
                    differsByOverFivePercent(row.widthMm, measured.widthMm) ||
                    differsByOverFivePercent(row.heightMm, measured.heightMm)));
                  return <Fragment key={row.zoneId}>
                    <tr>
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
                    {measured ? <tr><td colSpan={3} className={`pb-2 text-[11px] ${mismatch ? 'text-red-700' : 'text-ink-soft'}`}>
                      Dibujo: {metres(measured.widthMm)} × {metres(measured.heightMm)}{mismatch ? ' · difiere más del 5 %' : ''}
                    </td></tr> : null}
                  </Fragment>;
                })}
              </tbody>
            </table>
            <label className="text-ink-soft mt-2 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={includeFurniture} onChange={(e) => { setIncludeFurniture(e.target.checked); markForRefit(); }} />
              Colocar el mobiliario dibujado
            </label>
            <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={onRefit} disabled={busy !== null}>
              {busy === 'refit' ? 'Recalculando…' : 'Recalcular plano revisado'}
            </Button>
          </div>

          {doors.length > 0 ? (
            <div className="border-line bg-surface rounded-card border p-3 text-xs">
              <p className="text-ink mb-1 text-sm font-medium">Revisión de puertas y arcos</p>
              <p className="text-ink-soft mb-2">Comprueba primero que cada número coincide con un arco de puerta real y que está sobre el muro correcto. Ajusta su posición, lado y bisagra sobre el original; recalcula antes de enviar al editor.</p>
              {doors.some(({ aperture }) => !aperture.swing || !aperture.hinge) ? (
                <p className="mb-2 text-amber-800">Algunos giros o bisagras se han estimado porque la extracción guardada no los indica.</p>
              ) : null}
              <div className="space-y-2">
                {doors.map(({ aperture, room }, index) => <div key={aperture.id} className="border-line rounded-control border p-2">
                  <p className="text-ink mb-1">{index + 1}. Puerta de {room}</p>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="outline" disabled={busy !== null}
                      onClick={() => changeDoor(aperture.id, 'swing')}>Invertir lado</Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy !== null}
                      onClick={() => changeDoor(aperture.id, 'hinge')}>Cambiar bisagra</Button>
                  </div>
                  {(() => {
                    const wall = result.plano.zones.flatMap((zone) => zone.walls).find((item) => item.id === aperture.wallId);
                    const length = wall ? Math.hypot(wall.to.x - wall.from.x, wall.to.y - wall.from.y) : 0;
                    const half = length > 0 ? Math.min(0.5, aperture.widthMm / length / 2) : 0.5;
                    return half < 0.5 ? <label className="text-ink-soft mt-2 block">
                      Posición sobre el muro: {Math.round(aperture.position * 100)} %
                      <input aria-label={`Posición de puerta ${index + 1}`} type="range" className="mt-1 w-full"
                        min={half} max={1 - half} step="0.005" value={aperture.position}
                        disabled={busy !== null} onChange={(event) => moveDoor(aperture.id, Number(event.target.value))} />
                    </label> : null;
                  })()}
                </div>)}
              </div>
            </div>
          ) : null}

          {result.corrections.length > 0 ? (
            <p className="text-ink-soft text-xs">
              {result.corrections.length} ajuste(s) aplicados a las cotas escritas
              {result.corrections.some((c) => Math.abs(c.residualMm) > 30) ? '; alguno quedó con desvío (ver avisos).' : '.'}
            </p>
          ) : null}
          <p className="text-ink-soft text-xs">
            Zonas exteriores: {result.exteriors.length
              ? result.exteriors.map((zone) => zone.name).join(', ') : 'ninguna'} · {result.furniture.length} mueble(s) colocado(s)
          </p>
          {otherWarnings.length > 0 ? (
            <ul className="text-ink-soft list-disc space-y-1 pl-4 text-xs">
              {otherWarnings.slice(0, 8).map((w, i) => <li key={i}>{w.message}</li>)}
              {otherWarnings.length > 8 ? <li>… y {otherWarnings.length - 8} más</li> : null}
            </ul>
          ) : null}

          {needsCorrection ? (
            <div
              role="status"
              className="rounded-control border border-red-300 bg-red-50 p-3 text-xs text-red-700"
            >
              <p className="font-medium">El plano está en el editor, pero hay que corregirlo.</p>
              <p className="mt-1">
                La lectura o la escala necesitan revisión. No se generarán diseños ni vistas
                hasta que corrijas las incidencias y confirmes una medida real en el editor.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-2 w-full"
                onClick={() => router.push(editorUrl)}
              >
                Corregir en el editor
              </Button>
            </div>
          ) : (
            <PlanQualityCard
              quality={quality}
              needsRefit={needsRefit}
              summary={{
                replacesExisting: hasEditorPlan,
                rooms: result.plano.zones.length,
                exteriors: result.exteriors.length,
                furniture: result.furniture.length,
              }}
              confirmApply={confirmApply}
              busy={busy !== null}
              applying={busy === 'apply'}
              onApply={onApply}
              onCancel={() => setConfirmApply(false)}
            />
          )}
          {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
        </aside>
      </div>
    </div>
  );
}

function doorOverridesFromPlan(plano: Plano2dPayload): PlanDoorOverride[] {
  const walls = new Map(plano.zones.flatMap((zone) => zone.walls.map((wall) => [wall.id, wall] as const)));
  return plano.zones.flatMap((zone) => zone.apertures.flatMap((aperture) => {
    const wall = walls.get(aperture.wallId);
    return aperture.kind === 'puerta' && wall
      ? [{ apertureId: aperture.id,
        ...(aperture.swing ? { swing: aperture.swing } : {}),
        ...(aperture.hinge ? { hinge: aperture.hinge } : {}),
        position: aperture.position }]
      : [];
  }));
}

function differsByOverFivePercent(writtenMm: number | undefined, measuredMm: number): boolean {
  return writtenMm !== undefined && writtenMm > 0 && Math.abs(measuredMm - writtenMm) / writtenMm > 0.05;
}
