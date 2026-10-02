'use client';
import { useState } from 'react';
import type { NativeVideoMode } from '@/lib/editor-document/native-video';
import type { ApprovedLightingPreset } from '@/lib/editor-document/approved-design';
import type { VideoPresentationOptions } from '@/lib/editor-document/video-presentation';
import { videoGenerationPrompt } from '@/lib/editor-document/video-generation-prompt';
import { Button } from '@/components/ui/button';

export function VideoPromptControls({ mode, lighting, value, onChange, disabled }: {
  mode: NativeVideoMode; lighting: ApprovedLightingPreset; value: VideoPresentationOptions;
  onChange: (value: VideoPresentationOptions) => void; disabled: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const prompt = videoGenerationPrompt(mode, lighting, value);
  async function copy() {
    try { await navigator.clipboard.writeText(prompt); setMessage('Guion copiado.'); }
    catch { setMessage('No se pudo copiar. Selecciona el guion completo y cópialo.'); }
  }
  return <details className="rounded-control border border-line p-3">
    <summary className="cursor-pointer text-sm font-medium">Guion para generar con IA</summary>
    <div className="mt-3 space-y-3">
      <p className="text-xs text-ink-soft">En esta prueba 3D las indicaciones no ejecutan IA ni modifican la animación. Para probar H3 con las imágenes generadas, abre Construcción → Mis diseños. Las cotas del MP4 3D se ajustan con el selector de medidas.</p>
      <label className="block text-sm">Tus indicaciones<textarea aria-label="Indicaciones para el vídeo" maxLength={2000} disabled={disabled}
        value={value.prompt ?? ''} placeholder="Ej.: vuelo final lento, sin música; conservar todos los muebles del diseño."
        className="mt-1 min-h-24 w-full resize-y rounded-control border border-line bg-surface p-2 text-sm"
        onChange={event => { onChange({ ...value, prompt: event.target.value }); setMessage(null); }} /></label>
      <details><summary className="cursor-pointer text-xs font-medium">Ver guion completo</summary>
        <textarea aria-label="Guion completo para IA" readOnly value={prompt} className="mt-2 min-h-48 w-full resize-y rounded-control border border-line bg-surface p-2 text-xs" />
      </details>
      <p className="text-xs text-ink-soft">Usa tramos de hasta 15 s con referencias coherentes. Para reproducir el orden exacto de muros, aporta también un tramo del vídeo 3D como referencia de movimiento cuando el proveedor lo admita.</p>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={copy}>Copiar guion para IA</Button>
      {message && <p role="status" className="text-xs text-ink-soft">{message}</p>}
    </div>
  </details>;
}
