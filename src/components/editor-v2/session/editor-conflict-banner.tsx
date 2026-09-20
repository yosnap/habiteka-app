'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export function EditorConflictBanner({ revision, onResolve, onDownload, disabled }: {
  revision: number;
  onResolve: (choice: 'local' | 'server') => Promise<void>;
  onDownload: () => void;
  disabled: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [choice, setChoice] = useState<'local' | 'server' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const button = 'rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm disabled:opacity-50';
  if (collapsed) return <div className="flex items-center justify-between border-b bg-amber-50 px-4 py-2 text-amber-950">
    <span>Guardado pausado · Hay dos ediciones</span>
    <button className={button} onClick={() => setCollapsed(false)}>Resolver versiones</button>
  </div>;
  return <section className="relative border-b bg-amber-50 p-4 text-amber-950" aria-label="Conflicto de versiones">
    <button aria-label="Cerrar aviso de conflicto" className="absolute right-3 top-3 rounded-lg p-2" disabled={busy}
      onClick={() => setCollapsed(true)}><X size={18} /></button>
    <h2 className="pr-10 font-semibold">Otra pestaña guardó la revisión {revision}</h2>
    <p className="mt-1 text-sm">Elige qué edición debe quedar activa. Antes de sustituir tu borrador se conserva una copia de seguridad en este dispositivo. Cerrar este aviso no reanuda el guardado.</p>
    {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
    <button className="mt-2 text-sm underline" onClick={onDownload}>Descargar copia de ambas versiones</button>
    {choice ? <div className="mt-3 space-y-2">
      <p className="text-sm">{choice === 'local'
        ? 'Se guardará el plano que ves ahora como nueva revisión, sustituyendo la versión activa del servidor.'
        : 'Se cargará la versión del servidor en el canvas. Tu edición actual quedará respaldada localmente.'}</p>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy || disabled} onClick={async () => {
          setBusy(true); setError(null);
          try { await onResolve(choice); }
          catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo resolver el conflicto.'); }
          finally { setBusy(false); setChoice(null); }
        }}>{busy ? 'Resolviendo…' : 'Confirmar elección'}</button>
        <button className={button} disabled={busy} onClick={() => setChoice(null)}>Cancelar</button>
      </div>
    </div> : <div className="mt-3 flex flex-wrap gap-2">
      <button className={button} disabled={disabled} onClick={() => setChoice('local')}>Conservar mi edición</button>
      <button className={button} disabled={disabled} onClick={() => setChoice('server')}>Usar la versión guardada</button>
    </div>}
  </section>;
}
