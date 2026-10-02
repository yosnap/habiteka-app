'use client';
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VIDEO_TITLE_MAX } from '@/lib/editor-document/video-title';
import { renameStudioVideo } from '@/server/walkthrough/studio-media-actions';
import type { EditorScope } from '@/server/editor/authority';
import { callAction } from '@/lib/action-result';

export function VideoNameField({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="block text-sm">Nombre del vídeo <span className="text-ink-soft">(opcional)</span>
    <input aria-label="Nombre del vídeo" maxLength={VIDEO_TITLE_MAX} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}
      placeholder="Ej.: Construcción · presentación final" className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2" />
  </label>;
}
export function RenameVideo({ scope, id, title, onSaved, onBusyChange }: { scope: EditorScope; id: string; title: string | null;
  onSaved: () => void; onBusyChange?: (busy: boolean) => void }) {
  const [editing, setEditing] = useState(false), [value, setValue] = useState(title ?? ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!editing) return <Button size="sm" variant="outline" onClick={() => { setValue(title ?? ''); setError(''); setEditing(true); }}><Pencil size={14} />Cambiar nombre</Button>;
  return <form className="space-y-2" onSubmit={event => {
    event.preventDefault(); setBusy(true); onBusyChange?.(true); setError('');
    void callAction(renameStudioVideo(scope, id, value)).then(() => { setEditing(false); onSaved(); }, cause => setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el nombre.'))
      .finally(() => { setBusy(false); onBusyChange?.(false); });
  }}><VideoNameField value={value} onChange={setValue} disabled={busy} />
    <div className="flex gap-2"><Button size="sm" disabled={busy}>{busy ? 'Guardando…' : 'Guardar nombre'}</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setEditing(false)}>Cancelar</Button></div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </form>;
}
