'use client';
import { ModernSelect } from '@/components/ui/modern-select';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { EditorScope } from '@/server/editor/authority';
import { createEditorStore } from '@/canvas/editor-v2/store';
import type { CaptureRenderView } from '@/lib/editor-document/render-view';
import { loadPropertyVisit } from '@/server/walkthrough/property-visit-job-actions';
import { generatePropertyVisitImage } from '@/server/walkthrough/property-visit-image-actions';
import { rereviewPropertyVisitImage } from '@/server/walkthrough/property-visit-rereview-actions';
import { startPropertyVisitSegment, checkPropertyVisitSegment, reviewPropertyVisitSegment } from '@/server/walkthrough/property-visit-video-actions';
import { propertyVisitExportSources, propertyVisitExportClip, preparePropertyVisitUpload, finishPropertyVisitUpload, reviewPropertyVisitFinal } from '@/server/walkthrough/property-visit-export-actions';
import { setRenderAcceptance } from '@/server/walkthrough/render-acceptance-actions';
import { propertyVisitQuote, propertyVisitSegmentPrice, propertyVisitImageLocked } from '@/lib/editor-document/property-visit-job';
import { composePropertyVisit } from '@/components/deliverables/compose-property-visit';
import { Button } from '@/components/ui/button';
import { retryPropertyVisitItem } from '@/server/walkthrough/property-visit-retry-actions';
import { assertRenderViewIntegrity } from '@/lib/editor-document/render-view-integrity';
import { sameCameraPose } from '@/lib/contracts/storyboard-image';
import { cameraPoseFromView } from '@/lib/contracts/walkthrough-keyframe';
import { PropertyVisitRegionDialog } from './property-visit-region-dialog';

const Scene = dynamic(() => import('./scene/editor-scene-view'), { ssr: false });
type Loaded = Awaited<ReturnType<typeof loadPropertyVisit>>;
export function PropertyVisitProduction({ scope, id, onBusyChange }: { scope: EditorScope; id: string; onBusyChange: (value: boolean) => void }) {
  const [data, setData] = useState<Loaded | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [status, setStatus] = useState(''), [guide, setGuide] = useState(false), [ready, setReady] = useState(false);
  const [imageConsent, setImageConsent] = useState(false), [videoConsent, setVideoConsent] = useState(false), [qualityAck, setQualityAck] = useState(false);
  const [count, setCount] = useState(1), [selected, setSelected] = useState(0);
  const [analysisConsent, setAnalysisConsent] = useState(false);
  const [pilotConsent, setPilotConsent] = useState(false);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
  const [region, setRegion] = useState<{ imageId: string; id: string; url: string; reason: string } | null>(null);
  const capture = useRef<CaptureRenderView | null>(null), stop = useRef(false), controller = useRef<AbortController | null>(null);
  const onCapture = useCallback((value: CaptureRenderView | null) => { capture.current = value; setReady(Boolean(value)); }, []);
  useEffect(() => { let active = true; void loadPropertyVisit(scope, id).then(value => { if (active) setData(value); })
    .catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; stop.current = true; controller.current?.abort(); }; }, [scope, id]);
  const store = useMemo(() => {
    if (!data) return null;
    const next = createEditorStore(data.document, { readOnly: true }); next.getState().setCeilingView('solid'); return next;
    // El documento guardado es inmutable; refrescar estados no reinicia WebGL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);
  async function run(action: () => Promise<void>) {
    if (busy) return; setBusy(true); onBusyChange(true); setError(''); stop.current = false;
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación.'); }
    finally { try { setData(await loadPropertyVisit(scope, id)); } catch { /* Conserva el error de la operación. */ }
      setBusy(false); onBusyChange(false); }
  }
  if (!data) return <p role="status">{error || 'Cargando el paseo guardado…'}</p>;
  const { job } = data, quote = propertyVisitQuote(job);
  const accepted = data.images.filter(image => !image.issue).length;
  const segment = job.segments[selected], segmentMedia = data.segments[selected], previousMedia = data.segments[selected - 1];
  const allAccepted = accepted === job.images.length;
  const allReviewed = job.segments.every(item => item.state === 'accepted');
  const pilotImages = segment ? [...new Set([segment.from, segment.to])].map(imageId => {
    const frame = job.images.find(image => image.id === imageId);
    return { frame, media: data.images.find(image => image.id === frame?.sourceId) };
  }) : [];
  const pilotReady = pilotImages.length > 0 && pilotImages.every(image => image.media && !image.media.issue);
  const pilotPrice = segment ? propertyVisitSegmentPrice(segment.seconds, job.resolution, job.videoModel) : 0;
  const routeMetres = segment?.route?.reduce((metres, frame, index, route) => index ? metres + Math.hypot(
    ...frame.camera.position.map((value, axis) => value - route[index - 1]!.camera.position[axis]!)) : metres, 0);
  const checkCaptures = () => run(async () => {
    if (!capture.current) throw new Error('Prepara primero la guía de los encuadres.');
    for (const [index, image] of job.images.entries()) {
      if (stop.current) { setStatus(`Comprobación detenida: ${index}/${job.images.length} capturas. Sin gasto IA.`); return; }
      setStatus(`Comprobando captura ${index + 1}/${job.images.length}: ${image.frame.label}. Sin gasto IA.`);
      const reference = await capture.current({ camera: image.frame.camera, lighting: job.lighting, architectureOnly: true });
      assertRenderViewIntegrity(data.document, reference.view);
      if (!sameCameraPose(cameraPoseFromView(reference.view), image.frame.camera) || reference.view.ceilingView !== 'solid' ||
        reference.view.cutaway || reference.view.allLevels || Math.abs(reference.view.aspect - 16 / 9) > .02 ||
        reference.view.lighting !== job.lighting || !reference.dataUrl.startsWith('data:image/png;base64,'))
        throw new Error(`La captura ${index + 1} no conserva cámara, cubierta o iluminación del paseo.`);
      setPreview({ url: reference.dataUrl, label: image.frame.label });
    }
    setStatus(`${job.images.length}/${job.images.length} capturas comprobadas sin gasto IA. La apariencia final y la continuidad necesitan revisión de los diseños y vídeos generados.`);
  });
  const generateImages = () => run(async () => {
    if (!capture.current || !imageConsent) throw new Error('Prepara la guía y confirma las imágenes a generar.');
    const pending = job.images.filter(image => image.state === 'pending').slice(0, count);
    for (const [index, image] of pending.entries()) {
      if (stop.current) break;
      setStatus(`Generando encuadre ${index + 1} de ${pending.length}: ${image.frame.label}`);
      const reference = await capture.current({ camera: image.frame.camera, lighting: job.lighting, architectureOnly: true });
      await generatePropertyVisitImage(scope, id, image.id, reference, { generate: true, maxImageUsd: job.imagePriceUsd, qualityAck });
      setData(await loadPropertyVisit(scope, id));
    }
    setImageConsent(false); setStatus('Las imágenes terminadas están guardadas. Revisa su coherencia antes de aceptarlas.');
  });
  const generateVideos = () => run(async () => {
    if (!videoConsent || !allAccepted) throw new Error('Acepta todos los encuadres y confirma el presupuesto de los tramos.');
    for (const item of job.segments) {
      if (stop.current) break;
      if (!['pending', 'generating', 'unknown'].includes(item.state)) continue;
      setStatus(`Tramo ${job.segments.indexOf(item) + 1} de ${job.segments.length}: ${item.label}`);
      if (item.state === 'pending') await startPropertyVisitSegment(scope, id, item.id, { referencesToKie: true,
        maxUsd: propertyVisitSegmentPrice(item.seconds, job.resolution, job.videoModel) });
      for (;;) {
        const state = await checkPropertyVisitSegment(scope, id, item.id);
        if (state === 'review' || state === 'accepted') break;
        if (!['generating', 'unknown'].includes(state)) throw new Error('El tramo requiere revisión antes de continuar.');
        const updated = await loadPropertyVisit(scope, id); setData(updated);
        if (!updated.job.segments.find(value => value.id === item.id)?.taskId) throw new Error('El proveedor no confirmó la tarea. No se reenvía automáticamente.');
        if (stop.current) return;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      setData(await loadPropertyVisit(scope, id));
    }
    setVideoConsent(false); setStatus('Tramos guardados. Comprueba movimiento, arquitectura y uniones antes de componer.');
  });
  const compose = () => run(async () => {
    controller.current = new AbortController();
    const { clips, version } = await propertyVisitExportSources(scope, id);
    const result = await composePropertyVisit(clips, controller.current.signal, value => setStatus(`Uniendo el paseo: ${Math.round(value * 100)} %`),
      index => propertyVisitExportClip(scope, id, index, version));
    const upload = await preparePropertyVisitUpload(scope, id, result.blob.size, result.durationMs, version);
    setStatus('Guardando el vídeo completo…');
    const response = await fetch(upload.url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: result.blob, signal: controller.current.signal });
    if (!response.ok) throw new Error('No se pudo subir el paseo. Puedes volver a componer sin generar IA.');
    await finishPropertyVisitUpload(upload.ticket); setStatus('Paseo completo guardado; falta tu revisión de la reproducción final.');
  });
  return <div className="space-y-4 rounded-control border border-line p-4">
    <h3 className="text-lg font-semibold">Producción del paseo completo</h3>
    <p className="text-sm">Paseo guardado de la revisión {job.approvedRevision} · {job.plan.coverage.filter(zone => zone.status === 'planned').length}/{job.plan.coverage.length} zonas incluidas. El interior y exterior de estos diseños aceptados son la referencia visual del vídeo.</p>
    <div className="grid max-w-3xl gap-3 sm:grid-cols-2">{data.anchors.map((anchor, index) => <figure key={anchor.id}>
      {anchor.url && <a href={anchor.url} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={anchor.url} alt={index ? 'Diseño exterior de referencia' : 'Diseño interior de referencia'} className="aspect-video w-full rounded object-contain" /></a>}
      <figcaption className="text-xs">{index ? 'Fachadas, tejado y pérgolas' : 'Mobiliario, materiales y acabados interiores'} · {anchor.issue ?? 'Diseño aceptado por ti'}</figcaption>
    </figure>)}</div>
    <p className="text-sm">{job.images.length} encuadres únicos · {job.segments.length} tramos · {(job.durationMs / 60000).toFixed(1)} minutos. Las pausas y las uniones reutilizan imágenes.</p>
    <p className="text-sm">Pendiente: imágenes {quote.imageUsd.toFixed(2)} USD con {job.imageModel}, más análisis visuales; vídeo {quote.videoUsd.toFixed(2)} USD a {job.resolution} con {job.videoModel ?? 'MiniMax H3'}. La composición no consume IA.</p>
    {'eurWithReserve' in data.budget && <p className="text-sm">Vídeo completo con intentos anteriores y margen del 30 %: {data.budget.eurWithReserve?.toFixed(2)} € de un máximo de 2 €. Duración máxima: 60 segundos. La construcción se genera aparte.</p>}
    {data.budget.issue && <p role="alert" className="rounded border border-red-300 p-3 text-sm text-red-800">{data.budget.issue} Se conservan el recorrido y los diseños sin iniciar gasto.</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}{status && <p role="status">{status}</p>}
    {busy ? <Button variant="outline" onClick={() => { stop.current = true; controller.current?.abort(); setStatus('Deteniendo después de la petición en curso. Se conservan los resultados.'); }}>Detener al terminar la petición</Button>
      : <Button variant="outline" onClick={() => void run(async () => { setStatus('Estado actualizado sin generar.'); })}>Actualizar estado guardado</Button>}
    <details open><summary className="font-semibold">1. Diseños de los encuadres · {accepted}/{job.images.length} aceptados</summary>
      <p className="my-2 text-sm">La guía usa el plano aprobado con las puertas del paseo abiertas. Solo los diseños IA aceptados pasan al vídeo. Comprueba también que el paso está libre en el mobiliario del diseño.</p>
      <Button variant="outline" disabled={busy} onClick={() => setGuide(value => !value)}>{guide ? 'Cerrar guía' : 'Preparar guía de los encuadres'}</Button>
      {guide && store && <div className="my-3 aspect-video w-full max-w-3xl"><Scene store={store} allowVideoExport={false} presentation="spatial" lightingPreset={job.lighting}
        lightingLocked onCaptureReady={onCapture} showNotices={false} readOnlyLabel="Guía geométrica del paseo; no es el vídeo final" /></div>}
      <Button variant="outline" disabled={busy || !guide || !ready} onClick={() => void checkCaptures()}>Comprobar todas las capturas · sin gasto IA</Button>
      {preview && <figure className="my-2 max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.url} alt={`Guía geométrica: ${preview.label}`} className="aspect-video w-full object-contain" />
        <figcaption className="text-xs">Última captura comprobada: {preview.label}. Guía geométrica; no es el diseño ni el vídeo final.</figcaption>
      </figure>}
      <fieldset disabled={busy} className="my-3 space-y-2 text-sm">
        <label className="block">Imágenes en esta tanda <input type="number" min={1} max={Math.min(24, quote.images) || 1} value={count}
          onChange={event => setCount(Math.max(1, Math.min(24, Number(event.target.value) || 1)))} className="w-20 rounded border border-line p-1" /></label>
        <label className="block"><input type="checkbox" checked={qualityAck} onChange={event => setQualityAck(event.target.checked)} /> He comprobado las medidas y la distribución de la guía.</label>
        <label className="block"><input type="checkbox" checked={imageConsent} onChange={event => setImageConsent(event.target.checked)} /> Autorizo {Math.min(count, quote.images)} imágenes ({(Math.min(count, quote.images) * job.imagePriceUsd).toFixed(2)} USD) y sus análisis visuales adicionales.</label>
        <Button disabled={!ready || !guide || !imageConsent || !quote.images || Boolean(data.budget.issue)} onClick={() => void generateImages()}>Generar encuadres pendientes</Button>
      </fieldset>
      <label className="my-2 block text-sm"><input type="checkbox" checked={analysisConsent} disabled={busy}
        onChange={event => setAnalysisConsent(event.target.checked)} /> Autorizo los análisis de una nueva revisión de una imagen existente, sin regenerarla.</label>
      <div className="grid max-h-[32rem] gap-4 overflow-auto sm:grid-cols-2 lg:grid-cols-3">{job.images.map(image => {
        const media = data.images.find(item => item.id === image.sourceId);
        return <figure key={image.id} className="rounded border border-line p-2">
          {media?.url && <a href={media.url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.url} alt={image.frame.label} className="aspect-video w-full object-contain" loading="lazy" /></a>}
          <figcaption className="text-xs">{image.id} · {image.frame.label}<p>{media ? media.issue ?? 'Aceptada por ti' : image.error ?? (image.state === 'pending' ? 'Pendiente de generar' : 'Intento guardado; requiere comprobar su resultado')}</p></figcaption>
          <Button size="sm" variant="outline" disabled={busy || !ready || !guide} onClick={() => void run(async () => {
            if (!capture.current) throw new Error('Prepara primero la guía de los encuadres.');
            const reference = await capture.current({ camera: image.frame.camera, lighting: job.lighting, architectureOnly: true });
            assertRenderViewIntegrity(data.document, reference.view);
            setPreview({ url: reference.dataUrl, label: image.frame.label });
            setStatus(`Guía de ${image.id} preparada sin gasto IA. Comprueba geometría y cubierta antes de generar.`);
          })}>Ver guía de este encuadre · sin gasto IA</Button>
          {media && <Button size="sm" variant="outline" disabled={busy || Boolean(media.reviewIssue)} onClick={() => void run(async () => { await setRenderAcceptance(scope, media.id, media.version, Boolean(media.issue)); })}>{media.reviewIssue ? 'Encuadre rechazado' : media.issue ? 'Aceptar este encuadre' : 'Retirar aceptación'}</Button>}
          {media?.reviewIssue && media.url && <Button size="sm" variant="outline" disabled={busy || !ready || !guide || !qualityAck || Boolean(data.budget.issue) || propertyVisitImageLocked(job, image.id)}
            onClick={() => setRegion({ imageId: image.id, id: media.id, url: media.url!, reason: media.reviewIssue! })}>Corregir solo una zona</Button>}
          {media?.canRereview && <Button size="sm" variant="outline" disabled={busy || !ready || !guide || !analysisConsent || propertyVisitImageLocked(job, image.id)}
            onClick={() => void run(async () => {
              if (!capture.current) throw new Error('Prepara la guía antes de revisar.');
              setAnalysisConsent(false); setStatus('Revisando la imagen guardada; sin generar otra imagen.');
              const reference = await capture.current({ camera: image.frame.camera, lighting: job.lighting, architectureOnly: true });
              const result = await rereviewPropertyVisitImage(scope, id, image.id, reference, true);
              setStatus(result.passed ? 'Auditoría completada. Falta tu revisión y aceptación del encuadre.' : result.reason ?? 'La imagen requiere corrección.');
            })}>Volver a revisar este encuadre</Button>}
          {['review', 'rejected', 'failed'].includes(image.state) && <Button size="sm" variant="outline" disabled={busy || propertyVisitImageLocked(job, image.id)}
            onClick={() => void run(async () => { await retryPropertyVisitItem(scope, id, 'image', image.id); setImageConsent(false); })}>Preparar otra imagen · conserva la anterior</Button>}
        </figure>;
      })}</div>
    </details>
    <details open><summary className="font-semibold">2. Generar y revisar el paseo</summary>
      <label className="my-3 block text-sm"><input type="checkbox" disabled={busy || !allAccepted} checked={videoConsent} onChange={event => setVideoConsent(event.target.checked)} /> Autorizo enviar las referencias aceptadas a KIE/MiniMax y generar los tramos pendientes por {quote.videoUsd.toFixed(2)} USD.</label>
      <Button disabled={busy || !allAccepted || !videoConsent || Boolean(data.budget.issue)} onClick={() => void generateVideos()}>Generar o continuar los tramos</Button>
      <label className="my-3 block text-sm">Tramo a probar o revisar <ModernSelect disabled={busy} value={selected} onChange={event => { setSelected(Number(event.target.value)); setPilotConsent(false); }} className="w-full rounded border border-line p-2">{job.segments.map((item, index) => <option key={item.id} value={index}>{index + 1}. {item.label} · {item.state}</option>)}</ModernSelect></label>
      {segment && <div className="space-y-2">
        <div className="rounded border border-line p-3 space-y-2">
          <h4 className="font-semibold">Prueba de un solo tramo</h4>
          <p className="text-sm">{segment.seconds} segundos · {pilotPrice.toFixed(2)} USD{routeMetres !== undefined ? ` · ${routeMetres.toFixed(1)} m de recorrido previsto` : ''}. Usa estos encuadres existentes; no genera imágenes ni continúa con otros tramos. El coste cuenta dentro del límite de 2 € del paseo.</p>
          <div className="grid max-w-3xl gap-3 sm:grid-cols-2">{pilotImages.map(({ frame, media }, index) => <figure key={frame?.id ?? index}>
            {media?.url && <a href={media.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={media.url} alt={`${index ? 'Final' : 'Inicio'} de la prueba`} className="aspect-video w-full object-contain" /></a>}
            <figcaption className="text-xs">{index ? 'Final' : 'Inicio'} · {frame?.frame.label} · {media ? media.issue ?? 'Aceptada por ti' : 'Falta generar el encuadre'}</figcaption>
          </figure>)}</div>
          {!pilotReady && <p className="text-sm">Acepta los encuadres de esta prueba en el paso 1. Los demás pueden quedar pendientes.</p>}
          <label className="block text-sm"><input type="checkbox" checked={pilotConsent} disabled={busy || !pilotReady || segment.state !== 'pending'} onChange={event => setPilotConsent(event.target.checked)} /> Autorizo enviar estas referencias a KIE/MiniMax y generar solo este tramo por {pilotPrice.toFixed(2)} USD.</label>
          <Button disabled={busy || !pilotReady || !pilotConsent || segment.state !== 'pending' || Boolean(data.budget.issue) || job.segments.some(item => ['submitting', 'generating', 'unknown'].includes(item.state))}
            onClick={() => void run(async () => {
              setPilotConsent(false);
              await startPropertyVisitSegment(scope, id, segment.id, { referencesToKie: true, maxUsd: pilotPrice, onlyThisSegment: true });
              setStatus('Prueba enviada. Consulta este tramo sin generar hasta que termine; después revisa el movimiento completo. No se enviarán más tramos automáticamente.');
            })}>Probar solo este tramo · {pilotPrice.toFixed(2)} USD</Button>
          <p className="text-sm">Para dar la prueba por válida deben mantenerse muebles, materiales y arquitectura durante todo el movimiento, cruzarse los accesos reales y mostrarse las zonas previstas sin saltos ni transformaciones. Si falla, detén la producción y revisa la viabilidad antes de gastar más.</p>
        </div>
        <p className="text-sm">Reproduce el tramo completo y su unión con el anterior. Comprueba que no cambian muebles, huecos, materiales ni iluminación, que la cámara no atraviesa obstáculos y que muestra todas las zonas previstas.</p>
        {segment.route && <p className="text-sm">Zonas a comprobar: {[...new Set(segment.route.flatMap(frame => job.plan.coverage.filter(zone => zone.roomId === frame.roomId && zone.levelId === frame.levelId).map(zone => zone.name)))].join(' → ')}.</p>}
        <div className="grid gap-3 sm:grid-cols-2">{previousMedia?.url && <div><p>Tramo anterior</p><video controls preload="metadata" src={previousMedia.url} className="w-full" /></div>}
          {segmentMedia?.url && <div><p>Tramo actual</p><video key={segmentMedia.url} controls preload="metadata" src={segmentMedia.url} className="w-full" /></div>}</div>
        {segment.error && <p role="alert">{segment.error}</p>}
        {['rejected', 'failed'].includes(segment.state) && <Button disabled={busy} variant="outline" onClick={() => void run(async () => { await retryPropertyVisitItem(scope, id, 'segment', segment.id); setVideoConsent(false); })}>Preparar otro intento de este tramo</Button>}
        {segment.taskId && ['generating', 'unknown'].includes(segment.state) && <Button disabled={busy} variant="outline" onClick={() => void run(async () => { await checkPropertyVisitSegment(scope, id, segment.id); })}>Consultar este tramo sin generar</Button>}
        {['review', 'accepted'].includes(segment.state) && <div className="flex gap-2"><Button disabled={busy} onClick={() => void run(async () => { await reviewPropertyVisitSegment(scope, id, segment.id, true); })}>He revisado el tramo y su unión: aceptar</Button>
          <Button disabled={busy} variant="outline" onClick={() => void run(async () => { await reviewPropertyVisitSegment(scope, id, segment.id, false); })}>Rechazar</Button></div>}
      </div>}
    </details>
    <div className="space-y-3"><h4 className="font-semibold">3. Un solo vídeo del inmueble</h4>
      <p className="text-sm">Une todos los tramos aceptados, sin cortes de fundido ni música añadida. La exportación es silenciosa para evitar saltos del audio generado. Mantén esta pestaña abierta; el límite del archivo es 1 GB.</p>
      <Button disabled={busy || !allReviewed} onClick={() => void compose()}>Componer y guardar el paseo completo</Button>
      {data.url && <><video controls src={data.url} className="w-full" />
        <a href={data.url} download className="block underline">Descargar MP4 completo{job.finalReviewedAt ? ' · revisado' : ' · pendiente de revisión final'}</a>
        {!job.finalReviewedAt && <Button disabled={busy} onClick={() => void run(async () => { await reviewPropertyVisitFinal(scope, id, true); })}>He revisado el paseo completo y acepto el vídeo</Button>}</>}
    </div>
    {region && <PropertyVisitRegionDialog source={region} price={job.imagePriceUsd} busy={busy} onClose={() => setRegion(null)}
      onGenerate={edit => run(async () => {
        const image = job.images.find(item => item.id === region.imageId);
        if (!capture.current || !image || !qualityAck) throw new Error('Prepara y comprueba la guía antes del retoque.');
        const reference = await capture.current({ camera: image.frame.camera, lighting: job.lighting, architectureOnly: true });
        assertRenderViewIntegrity(data.document, reference.view);
        await retryPropertyVisitItem(scope, id, 'image', image.id);
        setRegion(null); setStatus('Corrigiendo la zona seleccionada; el resto de la imagen se conserva.');
        await generatePropertyVisitImage(scope, id, image.id, reference, { generate: true, maxImageUsd: job.imagePriceUsd, qualityAck }, edit);
        setStatus('Retoque guardado y auditado. Comprueba el fondo y sus bordes antes de aceptar el encuadre.');
      })} />}
  </div>;
}
