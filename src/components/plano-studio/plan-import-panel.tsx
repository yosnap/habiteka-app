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
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageUpload, type UploadedImage } from '@/components/chat/image-upload';
import type { PlanAperture, PlanWall, PlanWallOverride, PlanImportReviewOptions, PlanDoorOverride, PlanImportResult, Plano2dPayload, WrittenRoomDimensions } from '@/lib/contracts';
import { applyReviewedDoors, applyReviewedWalls, reviewedWallOverrides } from '@/lib/plan-review-geometry';
import { doorSwing } from '@/lib/plan-svg/door-swing';
import { callAction, type ActionErrorResult } from '@/lib/action-result';
import type { StudioQuality } from '@/lib/studio-state';
import { pdfFirstPageToPng } from './pdf-to-png';
import { PlanQualityCard } from './plan-quality-card';
import { PlanImportCanvas, type PlanReviewSelection } from './plan-import-canvas';
import { PlanReviewDoorFields, PlanReviewWallFields } from './plan-review-fields';

/** Importación con su veredicto de fiabilidad, tal y como la devuelve el servidor. */
export type ImportedPlan = PlanImportResult & { imageUrl: string; quality: StudioQuality;
  revision?: string; wallOverrides?: PlanWallOverride[]; generalWidthMm?: number; includeFurniture?: boolean };

export interface PlanImportActions {
  importAction: (
    projectId: string,
    base64: string,
    options: { includeFurniture?: boolean },
  ) => Promise<ImportedPlan | ActionErrorResult>;
  refitAction: (
    projectId: string,
    roomOverrides: WrittenRoomDimensions[],
    options: PlanImportReviewOptions,
  ) => Promise<(PlanImportResult & { quality: StudioQuality; revision?: string; wallOverrides?: PlanWallOverride[] }) | ActionErrorResult>;
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
  initialSelection?: PlanReviewSelection;
  onSaved?: (result: ImportedPlan) => void;
}

type Busy = 'import' | 'refit' | 'apply' | 'pdf' | null;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function PlanImportPanel({ projectId, hasEditorPlan, importAction, refitAction, applyAction, onBack, initialResult, initialGeneralWidthMm, initialIncludeFurniture, initialSelection = null, onSaved }: Props) {
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
  const [includeFurniture, setIncludeFurniture] = useState(initialResult?.includeFurniture ?? initialIncludeFurniture ?? false);
  const [overlay, setOverlay] = useState(true);
  // Ancho total real (m) cuando el plano no trae cotas generales legibles.
  const widthAtStart = initialResult?.generalWidthMm ?? initialGeneralWidthMm;
  const [generalWidth, setGeneralWidth] = useState(widthAtStart ? String(widthAtStart / 1000) : '');
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmNewImport, setConfirmNewImport] = useState(false);
  const [needsRefit, setNeedsRefit] = useState(false);
  const [revision, setRevision] = useState(initialResult?.revision);
  const [wallOverrides, setWallOverrides] = useState<PlanWallOverride[]>(initialResult?.wallOverrides ?? []);
  const [selection, setSelection] = useState<PlanReviewSelection>(initialSelection);
  const [vectorOpacity, setVectorOpacity] = useState(.7);
  const [saved, setSaved] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  type GeometryEntry = { result: PlanImportResult; walls: PlanWallOverride[] };
  const [past, setPast] = useState<GeometryEntry[]>([]), [future, setFuture] = useState<GeometryEntry[]>([]);
  const sidebar = useRef<HTMLElement | null>(null);
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
  const selectedDoor = doors.find(({ aperture }) => selection?.kind === 'door' && selection.id === aperture.id);
  const selectedWall = selection?.kind === 'wall' ? result?.plano.zones.flatMap(zone => zone.walls).find(wall => wall.id === selection.id) : null;
  const selectElement = (next: PlanReviewSelection) => { setSelection(next); sidebar.current?.scrollTo({ top: 0, behavior: 'smooth' }); };
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (needsRefit) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [needsRefit]);

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
    setRevision(imported.revision);
    setWallOverrides(imported.wallOverrides ?? []);
    setPast([]); setFuture([]); setSaved(false); setSelection(null);
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
    setSaved(false); setNeedsCorrection(false);
  };

  const updateRow = (zoneId: string, field: 'widthMm' | 'heightMm', value: string) => {
    const meters = Number(value.replace(',', '.'));
    const nextValue = value.trim() === '' || !Number.isFinite(meters) ? undefined : Math.round(meters * 1000);
    if (value.trim() && (!nextValue || nextValue < 500 || nextValue > 30000)) {
      setError('Las cotas de estancia deben estar entre 0,5 y 30 metros.'); return;
    }
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

  const onRefit = (leave = false) =>
    run('refit', async () => {
      const meters = Number(generalWidth.replace(',', '.'));
      const generalWidthMm = generalWidth.trim() !== '' && Number.isFinite(meters) ? Math.round(meters * 1000) : undefined;
      if (generalWidth.trim() && (!generalWidthMm || generalWidthMm < 1000 || generalWidthMm > 100000))
        throw new Error('Indica un ancho total entre 1 y 100 metros.');
      const refitted = await callAction(
        refitAction(projectId, rows, {
          includeFurniture,
          generalWidthMm: generalWidthMm ?? null,
          doorOverrides: result ? doorOverridesFromPlan(result.plano) : [],
          wallOverrides, revision, saveOnly: true,
        }),
      );
      setResult(refitted);
      setQuality(refitted.quality);
      setRows(refitted.writtenDimensions.map((w) => rows.find((r) => r.zoneId === w.zoneId) ?? w));
      setNeedsRefit(false);
      setConfirmApply(false);
      setRevision(refitted.revision); setWallOverrides(refitted.wallOverrides ?? wallOverrides);
      setSaved(true); setConfirmLeave(false); setNeedsCorrection(false);
      setPast([]); setFuture([]);
      if (imageUrl) onSaved?.({ ...refitted, imageUrl, generalWidthMm, includeFurniture });
      if (leave) onBack();
    });

  const editGeometry = (plano: Plano2dPayload) => {
    if (!result) return;
    setPast(previous => [...previous.slice(-49), { result, walls: wallOverrides }]); setFuture([]);
    const merged = new Map(wallOverrides.map(wall => [wall.wallId, wall]));
    reviewedWallOverrides(result.plano, plano).forEach(wall => merged.set(wall.wallId, wall));
    setWallOverrides([...merged.values()]); setResult({ ...result, plano }); markForRefit(); setError(null);
  };
  const updateDoor = (id: string, patch: Partial<PlanAperture>) => {
    if (!result || busy) return false;
    try { editGeometry(applyReviewedDoors(result.plano, [{ apertureId: id, ...patch }])); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo corregir la puerta.'); return false; }
  };
  const updateWall = (id: string, patch: Partial<PlanWall>) => {
    const wall = result?.plano.zones.flatMap(zone => zone.walls).find(item => item.id === id);
    if (!result || !wall || busy) return false;
    try {
      const next = applyReviewedWalls(result.plano, [{ ...wall, ...patch, wallId: id }]);
      editGeometry(applyReviewedDoors(next, doorOverridesFromPlan(next))); return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo corregir el muro.'); return false; }
  };
  const historyMove = (redo: boolean) => {
    const list = redo ? future : past, entry = list.at(-1);
    if (!entry || !result) return;
    const current = { result, walls: wallOverrides };
    if (redo) { setFuture(list.slice(0, -1)); setPast(previous => [...previous, current]); }
    else { setPast(list.slice(0, -1)); setFuture(previous => [...previous, current]); }
    setResult(entry.result); setWallOverrides(entry.walls); markForRefit(); setError(null);
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
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-ink-soft flex items-center gap-2 text-xs">
            <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
            Superponer sobre el original
          </label>
          {alignedOverlay ? <label className="flex items-center gap-2 text-xs">Opacidad
            <input aria-label="Opacidad de geometría" type="range" min="0.2" max="1" step="0.05" value={vectorOpacity} onChange={e => setVectorOpacity(Number(e.target.value))} /></label> : null}
          <Button size="sm" disabled={busy !== null || !needsRefit} onClick={() => void onRefit()}>Guardar revisión</Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirmNewImport(true)}>
            ← Otro plano
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => needsRefit ? setConfirmLeave(true) : onBack()}>
            Volver al estudio
          </Button>
        </div>
      </div>

      {confirmLeave ? <div role="alert" className="rounded-control border border-amber-300 bg-amber-50 p-3 text-sm">
        <p>Hay cambios sin guardar en esta revisión.</p><div className="mt-2 flex flex-wrap gap-2">
          <Button disabled={busy !== null} onClick={() => void onRefit(true)}>Guardar y volver</Button>
          <Button variant="outline" disabled={busy !== null} onClick={onBack}>Descartar y volver</Button>
          <Button variant="ghost" onClick={() => setConfirmLeave(false)}>Seguir revisando</Button>
        </div></div> : null}

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
        <div className="border-line relative min-h-96 flex-1 overflow-hidden rounded-card border bg-white">
          <PlanImportCanvas plano={result.plano} sourceFrame={result.sourceFrameMm} imageUrl={imageUrl}
            overlay={overlay} opacity={vectorOpacity} selected={selection} onSelect={busy ? undefined : selectElement}
            onMoveEndpoint={busy ? undefined : (id, endpoint, point) => { updateWall(id, { [endpoint]: point }); }} />
        </div>

        <aside ref={sidebar} className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto lg:w-80">
          <p role="status" className="text-sm">{needsRefit ? 'Cambios sin guardar' : saved ? 'Revisión guardada en el proyecto' : 'Revisión del proyecto'}</p>
          <p className="text-ink-soft text-xs">Guardar recalcula y conserva la revisión sin llamar a la IA. Después puedes enviarla al Editor.</p>
          {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy !== null || !past.length} onClick={() => historyMove(false)}>Deshacer geometría</Button>
            <Button size="sm" variant="outline" disabled={busy !== null || !future.length} onClick={() => historyMove(true)}>Rehacer</Button></div>
          {selectedDoor ? <PlanReviewDoorFields door={{ ...selectedDoor.aperture, swing: selectedDoor.aperture.swing ?? (() => {
            const wall = result.plano.zones.flatMap(zone => zone.walls).find(item => item.id === selectedDoor.aperture.wallId);
            return wall ? doorSwing(selectedDoor.aperture, wall, result.plano.zones) : 'left';
          })() }} room={selectedDoor.room} wallLengthMm={(() => {
            const wall = result.plano.zones.flatMap(zone => zone.walls).find(item => item.id === selectedDoor.aperture.wallId);
            return wall ? Math.hypot(wall.to.x - wall.from.x, wall.to.y - wall.from.y) : 0;
          })()}
            number={doors.indexOf(selectedDoor) + 1} disabled={busy !== null} change={patch => updateDoor(selectedDoor.aperture.id, patch)} onClose={() => setSelection(null)} /> : null}
          {selectedWall ? <PlanReviewWallFields wall={selectedWall} disabled={busy !== null}
            change={patch => updateWall(selectedWall.id, patch)} onClose={() => setSelection(null)} /> : null}
          {selection?.kind === 'zone' ? <p className="text-sm">Estancia resaltada. Selecciona uno de sus muros para corregir su geometría.</p> : null}
          {alignedOverlay ? <p className="text-ink-soft text-xs">Rosa: geometría extraída · negro: plano original.</p> : null}
          {overlay && imageUrl && !result.sourceFrameMm ? (
            <p className="text-ink-soft text-xs">Esta revisión antigua no conserva el marco de la imagen; se muestra el vector sin superponer.</p>
          ) : null}
          {spatialWarnings.length > 0 ? (
            <div role="alert" className="rounded-control border border-amber-400 bg-amber-50 p-3 text-xs text-amber-950">
              <p className="font-semibold">Comprueba la geometría antes de crear el 3D</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {spatialWarnings.map((warning, i) => <li key={i}><button type="button" className="text-left underline underline-offset-2"
                  onClick={() => selectElement(warning.zoneId ? { kind: 'zone', id: warning.zoneId } : { kind: 'scale', id: 'general' })}>{warning.message}</button></li>)}
              </ul>
              {keptImageWalls ? <p className="mt-2">Cambiar una cota escrita no desplazará estos muros. Selecciona un muro sobre el original para corregirlo aquí; puedes continuar en el Editor.</p> : null}
            </div>
          ) : null}
          {result.escalaEstimada || generalWidth.trim() !== '' || selection?.kind === 'scale' ? (
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
                      <td className="text-ink pr-2"><button className="text-left underline" onClick={() => selectElement({ kind: 'zone', id: row.zoneId })}>{row.name}</button></td>
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
            <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={() => void onRefit()} disabled={busy !== null}>
              {busy === 'refit' ? 'Guardando…' : 'Guardar y recalcular revisión'}
            </Button>
          </div>

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
        position: aperture.position, widthMm: aperture.widthMm }]
      : [];
  }));
}

function differsByOverFivePercent(writtenMm: number | undefined, measuredMm: number): boolean {
  return writtenMm !== undefined && writtenMm > 0 && Math.abs(measuredMm - writtenMm) / writtenMm > 0.05;
}
