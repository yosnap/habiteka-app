'use client';
import { useEffect, useRef, useState } from 'react';
import type { EditorScope } from '@/server/editor/authority';
import { loadAdvertisingVideo, prepareAdvertisingUpload, finishAdvertisingUpload } from '@/server/walkthrough/advertising-video-actions';
import { DEFAULT_ADVERTISING_VIDEO, type AdvertisingVideoOptions } from '@/lib/editor-document/advertising-video';
import { AdvertisingControls } from './advertising-controls';
import { composeAdvertisingVideo } from './compose-advertising-video';
import { ModernSelect } from '@/components/ui/modern-select';
import { Button } from '@/components/ui/button';
import { callAction } from '@/lib/action-result';
import { VideoNameField } from './video-name';

interface Clip { id: string; mode: string; durationMs: number; title?: string | null }
const LABELS: Record<string, string> = { 'walkthrough-ai': 'Primera persona H3', 'construction-ai': 'Construcción H3', images: 'Montaje de diseños' };
export function AdvertisingClipBuilder({ scope, approvalId, clips, disabled, portalContainer, onBusyChange, onCreated, onChooseImages, onOpenSaved }: {
  scope: EditorScope; approvalId: string | null; clips: Clip[]; disabled: boolean; portalContainer?: HTMLElement | null;
  onBusyChange?: (busy: boolean) => void; onCreated: () => void;
  onChooseImages?: () => void; onOpenSaved?: () => void;
}) {
  const [sourceId, setSourceId] = useState(clips[0]?.id ?? '');
  const [options, setOptions] = useState<AdvertisingVideoOptions>({ ...DEFAULT_ADVERTISING_VIDEO, format: 'vertical' });
  const [preview, setPreview] = useState<{ blob: Blob; url: string; sourceId: string; options: AdvertisingVideoOptions; saved?: boolean } | null>(null);
  const [progress, setProgress] = useState<number | null>(null), [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const abort = useRef<AbortController | null>(null), busy = progress !== null;
  useEffect(() => () => { abort.current?.abort(); }, []);
  const previewUrl = preview?.url;
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const selected = clips.find(clip => clip.id === sourceId) ?? clips[0];
  async function create() {
    if (!approvalId || !selected || disabled) return;
    const controller = new AbortController(); abort.current = controller;
    setProgress(0); setMessage(''); setPreview(null); onBusyChange?.(true);
    try {
      const source = await callAction(loadAdvertisingVideo(scope, approvalId, selected.id));
      if (options.dimensionMode !== 'none' && !source.measurements) throw new Error('El diseño aprobado no tiene medidas disponibles. Elige Sin medidas.');
      const result = await composeAdvertisingVideo(source.url, options, source.measurements, controller.signal, setProgress);
      if (Math.abs(result.durationMs - source.durationMs) > 250) throw new Error('La duración del archivo no coincide con el clip guardado. Revisa el original antes de exportar.');
      setPreview({ blob: result.blob, url: URL.createObjectURL(result.blob), sourceId: selected.id, options });
    } catch (error) { setMessage(controller.signal.aborted ? 'Preparación cancelada.' : error instanceof Error ? error.message : 'No se pudo preparar el anuncio.'); }
    finally { abort.current = null; setProgress(null); onBusyChange?.(false); }
  }
  async function save() {
    if (!preview || !approvalId || disabled) return;
    setSaving(true); setProgress(0); setMessage(''); onBusyChange?.(true);
    try {
      const upload = await callAction(prepareAdvertisingUpload(scope, approvalId, preview.sourceId, preview.blob.size, preview.options, title));
      const response = await fetch(upload.url, { method: 'PUT', body: preview.blob, headers: { 'Content-Type': 'video/mp4' } });
      if (!response.ok) throw new Error('No se pudo subir el anuncio. Puedes descargar la vista previa.');
      await callAction(finishAdvertisingUpload(upload.ticket));
      setPreview({ ...preview, saved: true }); setMessage('Anuncio guardado en Vídeos.'); onCreated();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar el anuncio.'); }
    finally { setSaving(false); setProgress(null); onBusyChange?.(false); }
  }
  return <section className="space-y-4 rounded-card border border-line bg-surface p-4">
    <h3 className="font-semibold">Publicidad a partir de un vídeo guardado</h3>
    <VideoNameField value={title} onChange={setTitle} disabled={busy || disabled || preview?.saved} />
    <p className="text-sm text-ink-soft">Usa el clip existente, conserva su sonido y prepara el anuncio sin generar otro vídeo con IA. La revisión de fidelidad del original sigue siendo necesaria.</p>
    <p className="text-xs text-ink-soft">Las cotas que ya incluya el original se conservan. Elige Sin medidas para evitar añadir otro panel.</p>
    {disabled && <p role="status" className="text-sm">Revisa la versión del proyecto y su luz con el botón de arriba antes de preparar publicidad.</p>}
    {!clips.length ? <div className="space-y-3 rounded-control border border-dashed border-line bg-surface-muted p-4"><p role="status" className="text-sm">Falta un vídeo compatible con esta aprobación. Crea un montaje de diseños aceptados o revisa y acepta una prueba H3. Los vídeos del plano 3D no sirven como original.</p>
      <div className="flex flex-wrap gap-2">{onChooseImages && <Button variant="outline" onClick={onChooseImages}>Crear montaje con mis diseños</Button>}
        {onOpenSaved && <Button variant="outline" onClick={onOpenSaved}>Revisar vídeos guardados</Button>}</div></div> : <>
      <label className="block text-sm">Vídeo original<ModernSelect aria-label="Vídeo original del anuncio" value={selected?.id ?? ''} disabled={busy || disabled} portalContainer={portalContainer} popoverZIndex={150}
        onChange={event => { setSourceId(event.target.value); setPreview(null); setMessage(''); }} className="mt-1 w-full">
        {clips.map((clip, index) => <option key={clip.id} value={clip.id}>{clip.title || LABELS[clip.mode] || 'Vídeo'} · {Math.round(clip.durationMs / 1000)} s · {index + 1}</option>)}
      </ModernSelect></label>
      <AdvertisingControls value={options} disabled={busy || disabled} portalContainer={portalContainer}
        onChange={value => { setOptions(value); setPreview(null); setMessage(''); }} />
      {busy ? <div className="space-y-2"><p role="status">Preparando anuncio · {Math.round((progress ?? 0) * 100)} %</p><progress max={1} value={progress ?? 0} className="w-full" />
        {!saving && <Button variant="outline" onClick={() => abort.current?.abort()}>Cancelar</Button>}</div>
        : <Button disabled={disabled || !approvalId || !selected} onClick={() => void create()}>Preparar vista previa del anuncio</Button>}
    </>}
    {preview && <div className="space-y-3"><video src={preview.url} controls playsInline className="max-h-[55vh] w-full rounded-control bg-black" />
      <div className="flex flex-wrap gap-3"><Button disabled={busy || disabled || preview.saved} onClick={() => void save()}>{preview.saved ? 'Anuncio guardado' : 'Guardar en Vídeos'}</Button>
        <a href={preview.url} download={`habiteka-publicidad-${preview.options.format}.mp4`} className="self-center text-sm underline">Descargar MP4</a>
        {preview.saved && onOpenSaved && <Button variant="outline" disabled={busy} onClick={onOpenSaved}>Ver en Vídeos guardados</Button>}</div></div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
