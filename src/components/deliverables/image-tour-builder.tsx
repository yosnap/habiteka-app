'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { assessTourHomogeneity, orderTourImages, pickTourImages, tourDurationMs, MAX_TOUR_SHOTS, type TourImage } from '@/lib/editor-document/image-tour';
import { recordImageTour } from './record-image-tour';
import { callAction } from '@/lib/action-result';
import { prepareImageTourUpload, finishImageTourUpload } from '@/server/walkthrough/image-tour-actions';
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
}

/** Montaje del vídeo sobre las imágenes generadas: una selección por ámbito que se puede ajustar antes de crearlo. */
export function ImageTourBuilder({ projectId, zoneId, approvalId, approvedRevision, images, ambients, validRevisions }: Props) {
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
    for (const image of images) map.set(image.ambient, [...(map.get(image.ambient) ?? []), image]);
    return [...map.entries()];
  }, [images]);
  const recording = progress !== null;
  const [assessment, setAssessment] = useState<KeyframeAssessment | null>(null);
  const [assessing, setAssessing] = useState(false);
  const presentAmbients = new Set(ordered.map((image) => image.ambient));
  const homogeneity = useMemo(() => assessTourHomogeneity(ordered, valid, ambients.filter((name) => !presentAmbients.has(name))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, valid, ambients, images]);

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
    if (!approvalId) return;
    const shots = orderTourImages(ordered);
    setMessage(null); setProgress(0);
    abort.current = new AbortController();
    try {
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear el vídeo.');
    } finally { setProgress(null); abort.current = null; }
  }

  if (!images.length) return <p className="text-muted-foreground text-sm">Aún no hay imágenes generadas para montar el vídeo. Créalas desde «Crear imágenes» en el editor.</p>;
  return <section aria-label="Vídeo con las imágenes generadas" className="border-line bg-surface flex flex-col gap-3 rounded-card border p-4">
    <h2 className="text-ink text-base font-semibold">Vídeo con las imágenes generadas</h2>
    <p className="text-ink-soft text-sm">Recorre las imágenes de cada ambiente con movimiento de cámara y fundidos. Sin consumo de IA.
      {approvedRevision !== null ? ` Se vincula al diseño aprobado · revisión ${approvedRevision}.` : ''}</p>
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
      {groups.map(([ambient, list]) => <fieldset key={ambient} disabled={recording} className="flex flex-col gap-2">
        <legend className="text-ink text-sm font-medium">{ambient}</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {list.map((image) => <label key={image.id} className={`relative cursor-pointer overflow-hidden rounded-control border ${selected.includes(image.id) ? 'border-emerald-700 ring-2 ring-emerald-700' : 'border-line opacity-70'}`}>
            <input type="checkbox" className="sr-only" checked={selected.includes(image.id)} onChange={() => toggle(image.id)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={`${ambient} · ${image.view}`} className="aspect-video w-full object-cover" loading="lazy" />
            <span className="bg-black/60 absolute inset-x-0 bottom-0 px-1 text-[11px] text-white">{image.view} · rev. {image.revision}</span>
          </label>)}
        </div>
      </fieldset>)}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="rounded border border-emerald-800 px-3 py-2 font-semibold text-emerald-900 disabled:opacity-50"
        disabled={recording || !ordered.length || !approvalId} onClick={() => void create()}>Crear vídeo con {ordered.length} imágenes · {Math.round(tourDurationMs(ordered.length) / 1000)} s</button>
      {recording && <><progress max={1} value={progress ?? 0} aria-label="Progreso del vídeo" /><button type="button" onClick={() => abort.current?.abort()}>Cancelar</button></>}
      {!approvalId && <span role="status" className="text-sm">Aprueba un diseño en el editor para poder crear el vídeo.</span>}
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
