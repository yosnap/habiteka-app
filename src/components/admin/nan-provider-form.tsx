'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { adminUpdateNanProvider } from '@/server/admin/config/actions';

export function NanProviderForm({ configured, enabled: initialEnabled, keyHint }: { configured: boolean; enabled: boolean; keyHint: string | null }) {
  const [apiKey, setApiKey] = useState(''), [enabled, setEnabled] = useState(initialEnabled), [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => {
    if (!apiKey.trim()) { setError('Introduce una API key de NaN.'); return; }
    setError(null); start(async () => {
      try { await adminUpdateNanProvider({ apiKey, enabled }); setApiKey(''); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar NaN'); }
    });
  };
  return <div className="flex max-w-lg flex-col gap-3 rounded-card border border-line p-4">
    <div><h2 className="font-medium">NaN</h2><p className="text-muted-foreground text-sm">{configured ? `Clave configurada: ${keyHint}` : 'Sin clave configurada'} · API OpenAI-compatible cifrada.</p></div>
    <label className="text-sm">API key<input className="border-line bg-surface mt-1 w-full rounded-control border px-2 py-1" type="password" value={apiKey} autoComplete="new-password" onChange={(event) => setApiKey(event.target.value)} placeholder="Pega una nueva clave para sustituirla" /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Habilitar NaN para acciones asignadas</label>
    <Button type="button" size="sm" className="w-fit" disabled={pending} onClick={save}>{pending ? 'Guardando…' : 'Guardar NaN'}</Button>
    {error && <p className="text-sm text-[--color-danger]">{error}</p>}
  </div>;
}
