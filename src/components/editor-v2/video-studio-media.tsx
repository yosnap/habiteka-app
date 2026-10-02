'use client';
import { useCallback, useEffect, useState } from 'react';
import { loadVideoStudioMedia } from '@/server/walkthrough/video-studio-media';
import type { EditorScope } from '@/server/editor/authority';
import { ImageTourBuilder } from '@/components/deliverables/image-tour-builder';
import { VIDEO_DIMENSION_MODES, videoDimensionMode } from '@/lib/editor-document/video-presentation';
import { DesignVideoTask } from './design-video-task';

const LABELS: Record<string, string> = { construction: 'Construcción del edificio · 3D', promotion: 'Publicidad en parcela · 3D',
  walkthrough: 'Primera persona · 3D', showcase: 'Construcción + visita · 3D', images: 'Publicidad con mis diseños' };

export function VideoStudioMedia({ scope, gallery, revisionKey, onBusyChange, onReviewApproval }: {
  scope: EditorScope; gallery: boolean; revisionKey: string; onBusyChange?: (busy: boolean) => void; onReviewApproval?: () => void;
}) {
  const [media, setMedia] = useState<Awaited<ReturnType<typeof loadVideoStudioMedia>> | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setMedia(await loadVideoStudioMedia(scope)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los vídeos.'); }
    finally { setLoading(false); }
  }, [scope]);
  useEffect(() => {
    let active = true;
    void loadVideoStudioMedia(scope).then(value => { if (active) { setMedia(value); setError(''); } },
      cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los vídeos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope, revisionKey]);
  return <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div><h2 className="text-xl font-semibold">{gallery ? 'Vídeos guardados' : 'Publicidad con tus diseños'}</h2>
          <p className="mt-1 text-sm text-ink-soft">{gallery ? 'Reproduce y descarga tus vídeos aquí.' : 'Selecciona imágenes de una misma versión. Se montan con movimiento suave y fundidos.'}</p></div>
        <button type="button" className="rounded-control border border-line px-3 py-2 text-sm" disabled={loading} onClick={() => void refresh()}>{loading ? 'Cargando…' : 'Actualizar'}</button>
      </header>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {!media && loading && <p role="status">Cargando los resultados de este inmueble…</p>}
      {media && !gallery && <ImageTourBuilder key={`${media.approvalId}:${media.images.map(image => image.id).join()}`} projectId={scope.projectId} zoneId={scope.zoneId ?? null} {...media}
        onBusyChange={onBusyChange} onReviewApproval={onReviewApproval} onCreated={() => void refresh()} />}
      {media && gallery && (!media.videos.length ? <p className="rounded-card border border-dashed border-line p-8 text-center text-ink-soft">Todavía no hay vídeos. Elige «Crear vídeo» para preparar el primero.</p>
        : media.videos.map(video => video.designJob ? <DesignVideoTask key={video.id} scope={scope} id={video.id} initial={video.designJob} initialUrl={video.url} onBusyChange={onBusyChange} /> : <section className="space-y-3 rounded-card border border-line bg-surface p-4" key={video.id}>
          <h3 className="font-semibold">{LABELS[video.mode] ?? 'Vídeo'} <span className="ml-2 text-sm font-normal text-ink-soft">{Math.round(video.durationMs / 1000)} s{video.approvedRevision !== null ? ` · revisión ${video.approvedRevision}` : ''}</span></h3>
          {video.mode !== 'images' && <p className="text-xs text-ink-soft">{video.contentScope === 'house' ? 'Solo la casa' : 'Todo el plano'} · {new Date(video.createdAt).toLocaleString('es-ES')}</p>}
          {video.presentation && <p className="text-xs text-ink-soft">Cotas: {VIDEO_DIMENSION_MODES.find(item => item.value === videoDimensionMode(video.presentation!))?.label}
            {video.presentation.dimensionOcclusion !== false && videoDimensionMode(video.presentation) !== 'none' ? ' · ocultación detrás de la casa' : ''}</p>}
          {video.presentation?.prompt && <details className="text-sm"><summary className="cursor-pointer">Indicaciones guardadas para IA</summary><p className="mt-2 whitespace-pre-wrap text-ink-soft">{video.presentation.prompt}</p></details>}
          {video.url ? <><video controls playsInline preload="metadata" src={video.url} className="max-h-[55vh] w-full rounded-control bg-black" />
            <a className="inline-block text-sm text-brand-700 underline" href={video.url} download>Descargar MP4</a></> : <p className="text-sm text-ink-soft">Archivo temporalmente no disponible.</p>}
        </section>))}
    </div>
  </div>;
}
