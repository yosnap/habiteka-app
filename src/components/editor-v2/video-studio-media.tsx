'use client';
import { useCallback, useEffect, useState } from 'react';
import { loadVideoStudioMedia } from '@/server/walkthrough/video-studio-media';
import type { EditorScope } from '@/server/editor/authority';
import { ImageTourBuilder } from '@/components/deliverables/image-tour-builder';
import { VIDEO_DIMENSION_MODES, videoDimensionMode } from '@/lib/editor-document/video-presentation';
import { DesignVideoTask } from './design-video-task';
import { AdvertisingClipBuilder } from '@/components/deliverables/advertising-clip-builder';
import { ADVERTISING_DIMENSIONS } from '@/lib/editor-document/advertising-video';
import { VIDEO_FORMATS } from '@/lib/editor-document/video-format';
import { RenameVideo } from '@/components/deliverables/video-name';

const LABELS: Record<string, string> = { construction: 'Construcción del edificio · 3D', promotion: 'Publicidad en parcela · 3D',
  walkthrough: 'Primera persona · 3D', showcase: 'Construcción + visita · 3D', images: 'Publicidad con mis diseños', advertising: 'Publicidad con un vídeo guardado' };

export function VideoStudioMedia({ scope, gallery, revisionKey, onBusyChange, onReviewApproval, clips = false, portalContainer }: {
  scope: EditorScope; gallery: boolean; revisionKey: string; onBusyChange?: (busy: boolean) => void; onReviewApproval?: () => void;
  clips?: boolean; portalContainer?: HTMLElement | null;
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
          <p className="mt-1 text-sm text-ink-soft">{gallery ? 'Reproduce y descarga tus vídeos aquí. Las muestras 3D antiguas son archivo histórico del plano guía y no sirven como vídeos finales ni originales de publicidad.' : clips ? 'Adapta un vídeo desde diseños aceptados y revisa el anuncio antes de guardarlo.' : 'Selecciona diseños IA aceptados de una misma versión. Si falta alguno, abre la imagen en Diseños y acepta su diseño tras revisarlo.'}</p></div>
        <button type="button" className="rounded-control border border-line px-3 py-2 text-sm" disabled={loading} onClick={() => void refresh()}>{loading ? 'Cargando…' : 'Actualizar'}</button>
      </header>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {!media && loading && <p role="status">Cargando los resultados de este inmueble…</p>}
      {media && !gallery && (clips ? <AdvertisingClipBuilder key={media.approvalId} scope={scope} approvalId={media.approvalId}
        clips={media.videos.filter(video => video.url && video.approvalId === media.approvalId
          && (video.mode === 'images' || video.designJob?.status === 'accepted'))} disabled={!media.approvalId || media.approvalOutdated}
        portalContainer={portalContainer} onBusyChange={onBusyChange} onCreated={() => void refresh()} />
        : <ImageTourBuilder key={media.approvalId} projectId={scope.projectId} zoneId={scope.zoneId ?? null} {...media}
          portalContainer={portalContainer} onBusyChange={onBusyChange} onReviewApproval={onReviewApproval} onCreated={refresh} />)}
      {media && gallery && (!media.videos.length ? <p className="rounded-card border border-dashed border-line p-8 text-center text-ink-soft">Todavía no hay vídeos. Elige «Crear vídeo» para preparar el primero.</p>
        : media.videos.map(video => video.designJob ? <DesignVideoTask key={`${video.id}:${video.title}`} scope={scope} id={video.id} initial={video.designJob} initialUrl={video.url} onBusyChange={onBusyChange} onRenamed={() => void refresh()} /> : <section className="space-y-3 rounded-card border border-line bg-surface p-4" key={video.id}>
          <h3 className="font-semibold">{video.title || LABELS[video.mode] || 'Vídeo'} <span className="ml-2 text-sm font-normal text-ink-soft">{Math.round(video.durationMs / 1000)} s{video.approvedRevision !== null ? ` · revisión ${video.approvedRevision}` : ''}</span></h3>
          {video.title && <p className="text-xs text-ink-soft">{LABELS[video.mode] ?? 'Vídeo'}</p>}
          <RenameVideo scope={scope} id={video.id} title={video.title} onSaved={() => void refresh()} onBusyChange={onBusyChange} />
          {video.mode !== 'images' && video.mode !== 'advertising' && <p className="text-xs text-ink-soft">{video.contentScope === 'house' ? 'Solo la casa' : 'Todo el plano'} · {new Date(video.createdAt).toLocaleString('es-ES')}</p>}
          <p className="text-xs text-ink-soft">{VIDEO_FORMATS.find(item => item.value === (video.advertising?.format ?? video.presentation?.format ?? 'horizontal'))?.label}</p>
          {video.advertising && <p className="text-xs text-ink-soft">{ADVERTISING_DIMENSIONS.find(item => item.value === video.advertising?.dimensionMode)?.label}
            {video.advertising.dimensionMode !== 'none' ? ' · panel de medidas globales del diseño aprobado' : ''}</p>}
          {video.presentation && <p className="text-xs text-ink-soft">Cotas: {VIDEO_DIMENSION_MODES.find(item => item.value === videoDimensionMode(video.presentation!))?.label}
            {video.presentation.dimensionOcclusion !== false && videoDimensionMode(video.presentation) !== 'none' ? ' · ocultación detrás de la casa' : ''}</p>}
          {video.presentation?.prompt && <details className="text-sm"><summary className="cursor-pointer">Indicaciones guardadas para IA</summary><p className="mt-2 whitespace-pre-wrap text-ink-soft">{video.presentation.prompt}</p></details>}
          {video.url ? <><video controls playsInline preload="metadata" src={video.url} className="max-h-[55vh] w-full rounded-control bg-black" />
            <a className="inline-block text-sm text-brand-700 underline" href={video.url} download>Descargar MP4</a></> : <p className="text-sm text-ink-soft">Archivo temporalmente no disponible.</p>}
        </section>))}
    </div>
  </div>;
}
