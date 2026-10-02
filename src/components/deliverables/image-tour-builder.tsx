'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { assessTourHomogeneity, orderTourImages, pickTourImages, tourDurationMs, MAX_TOUR_SHOTS, missingTourAmbients, tourAmbientKey, type TourImage } from '@/lib/editor-document/image-tour';
import { recordImageTour } from './record-image-tour';
import { callAction } from '@/lib/action-result';
import { prepareImageTourUpload, finishImageTourUpload, validateImageTourSources } from '@/server/walkthrough/image-tour-actions';
import { assessKeyframeSet, type KeyframeAssessment } from '@/server/walkthrough/keyframe-assessment';

interface Props {
  projectId: string;
  zoneId: string | null;
  approvalId: string | null;
  approvedRevision: number | null;
  images: TourImage[];
  /** Ámbitos que el montaje debería cubrir: el inmueble y cada zona de diseño. */
  ambients: string[];
  /** Revisiones con el mismo aspecto que el diseño aprobado. */
  validRevisions: number[];
  approvalOutdated: boolean;
  onCreated?: () => void;
  onBusyChange?: (busy: boolean) => void;
  onReviewApproval?: () => void;
}

/** Montaje del vídeo sobre las imágenes generadas: una selección por ámbito que se puede ajustar antes de crearlo. */
export function ImageTourBuilder({ projectId, zoneId, approvalId, approvedRevision, images, ambients, validRevisions, approvalOutdated, onCreated, onBusyChange, onReviewApproval }: Props) {
  const router = useRouter();
  // Sin diseño aprobado no hay revisión de referencia con la que comparar.
  const valid = useMemo(() => approvalId ? new Set(validRevisions) : null, [approvalId, validRevisions]);
  const suggestion = useMemo(() => pickTourImages(images, ambients, 2, MAX_TOUR_SHOTS, valid), [images, ambients, valid]);
  const [selected, setSelected] = useState<string[]>(() => suggestion.shots.map((shot) => shot.id));
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const byId = useMemo(() => new Map(images.map((image) => [image.id, image])), [images]);
  const ordered = selected.map((id) => byId.get(id)).filter((image): image is TourImage => !!image);
  const groups = useMemo(() => {
    const map = new Map<string, TourImage[]>();
    for (const image of images) {
      const key = tourAmbientKey(image);
      map.set(key, [...(map.get(key) ?? []), image]);
    }
    return [...map.entries()];
  }, [images]);
  const recording = progress !== null;
  const [assessment, setAssessment] = useState<KeyframeAssessment | null>(null);
  const [assessing, setAssessing] = useState(false);
  const homogeneity = useMemo(() => assessTourHomogeneity(ordered, valid, missingTourAmbients(ordered, ambients)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, valid, ambients, images]);
  // Un montaje parcial es válido; mezclar casas, luces o acabados no lo es.
  const incompatible = homogeneity.issues.some(issue => issue.code !== 'missing');

  const toggle = (id: string) => { setAssessment(null); setSelected((current) => current.includes(id) ? current.filter((item) => item !== id)
    : current.length >= MAX_TOUR_SHOTS ? current : [...current, id]); };

  async function askJev() {
    if (!approvalId) return;
    setAssessing(true); setMessage(null);
    try { setAssessment(await callAction(assessKeyframeSet({ projectId, zoneId }, approvalId, orderTourImages(ordered).map((image) => image.id)))); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo evaluar el conjunto.'); }
    finally { setAssessing(false); }
  }

  async function create() {
    if (!approvalId || approvalOutdated || incompatible) return;
    const shots = orderTourImages(ordered);
    setMessage(null); setProgress(0);
    onBusyChange?.(true);
    abort.current = new AbortController();
    try {
      await callAction(validateImageTourSources({ projectId, zoneId }, approvalId, shots.map(shot => shot.id)));
      const { blob } = await recordImageTour(shots, abort.current.signal, setProgress);
      const link = document.createElement('a'), local = URL.createObjectURL(blob);
      link.href = local; link.download = 'habiteka-video-imagenes.mp4'; link.click(); setTimeout(() => URL.revokeObjectURL(local), 60000);
      const scope = { projectId, zoneId };
      const upload = await callAction(prepareImageTourUpload(scope, approvalId, shots.map((shot) => shot.id), blob.size));
      const response = await fetch(upload.url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'video/mp4' } });
      if (!response.ok) throw new Error('El MP4 se descargó, pero no se pudo subir a Vídeos.');
      await callAction(finishImageTourUpload(upload.ticket));
      setMessage('Vídeo creado y guardado en Vídeos.');
      router.refresh();
      onCreated?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear el vídeo.');
    } finally { setProgress(null); abort.current = null; onBusyChange?.(false); }
  }

  if (!images.length) return <p className="text-muted-foreground text-sm">Aún no hay imágenes generadas para montar el vídeo. Créalas desde «Diseñar con IA» en el editor.</p>;
  return <section aria-label="Vídeo con las imágenes generadas" className="border-line bg-surface flex flex-col gap-3 rounded-card border p-4">
    <h2 className="text-ink text-base font-semibold">Montaje con tus diseños generados</h2>
    <p className="text-ink-soft text-sm">Recorre las imágenes de cada ambiente con movimiento de cámara y fundidos. Sin consumo de IA.
      {approvedRevision !== null ? ` Se vincula al diseño aprobado · revisión ${approvedRevision}.` : ''}</p>
    <p className="text-ink-soft text-xs">Muestra tus renders terminados. El paseo continuo fotorrealista entre estancias todavía no está disponible.</p>
    {approvalOutdated && <p role="alert" className="rounded-control border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      El diseño del editor ha cambiado desde esta aprobación. Revisa y aprueba los cambios, incluido el tejado, y genera imágenes de esa versión.
      {' '}{onReviewApproval ? <button type="button" className="font-semibold underline" onClick={onReviewApproval}>Revisar y aprobar aquí</button>
        : <a href={`/projects/${encodeURIComponent(projectId)}${zoneId ? `?zona=${encodeURIComponent(zoneId)}` : ''}`} className="font-semibold underline">Revisar mi diseño</a>}
    </p>}
    {approvalId && !suggestion.shots.length && <p role="status" className="text-sm text-amber-800">No hay imágenes del diseño aprobado actual. Las imágenes de otras versiones permanecen en el historial.</p>}
    {!!suggestion.missing.length && <p role="status" className="text-sm text-amber-800">Aún no hay imágenes generadas de: {suggestion.missing.join(', ')}.</p>}
    {!homogeneity.ok && <ul role="status" className="list-disc pl-5 text-sm text-amber-800">
      {homogeneity.issues.map((issue) => <li key={issue.code}>{issue.message}</li>)}
    </ul>}
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="rounded border border-line px-3 py-2 text-sm disabled:opacity-50" disabled={assessing || recording || !ordered.length || !approvalId}
        onClick={() => void askJev()}>{assessing ? 'Consultando a Jev…' : 'Comprobar homogeneidad con Jev'}</button>
      {assessment && <span role="status" className="text-sm">
        {assessment.decision === 'proceed' ? 'Apto para animar' : assessment.decision === 'confirm' ? 'Conviene revisarlo antes de animar' : 'Regenera las imágenes antes de animar'}
        {assessment.score !== null ? ` · puntuación ${Math.round(assessment.score)} sobre 100` : ''}
        {assessment.confidence !== null ? ` · confianza ${Math.round(assessment.confidence * 100)} %` : ''}
        {assessment.fromJev ? '' : ' · Jev no disponible: decisión por política de fallo'}
        {assessment.reasons.length ? ` — ${assessment.reasons.join(' ')}` : ''}
      </span>}
    </div>
    <div className="flex flex-col gap-3">
      {groups.map(([key, list]) => <fieldset key={key} disabled={recording} className="flex flex-col gap-2">
        <legend className="text-ink text-sm font-medium">{list[0]!.ambient}</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {list.map((image) => <label key={image.id} className={`relative cursor-pointer overflow-hidden rounded-control border ${selected.includes(image.id) ? 'border-emerald-700 ring-2 ring-emerald-700' : 'border-line opacity-70'}`}>
            <input type="checkbox" className="sr-only" disabled={!!valid && !valid.has(image.revision)} checked={selected.includes(image.id)} onChange={() => toggle(image.id)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={`${image.ambient} · ${image.view}`} className="aspect-video w-full object-cover" loading="lazy" />
            <span className="bg-black/60 absolute inset-x-0 bottom-0 px-1 text-[11px] text-white">{image.view} · rev. {image.revision}{valid && !valid.has(image.revision) ? ' · otro diseño' : ''}</span>
          </label>)}
        </div>
      </fieldset>)}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="rounded border border-emerald-800 px-3 py-2 font-semibold text-emerald-900 disabled:opacity-50"
        disabled={recording || !ordered.length || !approvalId || approvalOutdated || incompatible} onClick={() => void create()}>Crear montaje con {ordered.length} imágenes · {Math.round(tourDurationMs(ordered.length) / 1000)} s</button>
      {recording && <><progress max={1} value={progress ?? 0} aria-label="Progreso del vídeo" /><button type="button" onClick={() => abort.current?.abort()}>Cancelar</button></>}
      {!approvalId && <span role="status" className="text-sm">Aprueba un diseño en el editor para poder crear el vídeo.</span>}
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
