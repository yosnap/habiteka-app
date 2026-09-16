'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { adminUpdateKieProvider } from '@/server/admin/config/actions';

interface Props { configured: boolean; enabled: boolean; keyHint: string | null; }

export function KieProviderForm({ configured, enabled: initialEnabled, keyHint }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () => {
    setError(null);
    if (!apiKey.trim()) { setError('Introduce una API key para guardar KIE.'); return; }
    start(async () => {
      try { await adminUpdateKieProvider({ apiKey, enabled }); setApiKey(''); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar KIE'); }
    });
  };
  return <div className="flex max-w-lg flex-col gap-3 rounded-card border border-line p-4">
    <div><h2 className="font-medium">KIE</h2><p className="text-muted-foreground text-sm">{configured ? `Clave configurada: ${keyHint}` : 'Sin clave configurada'} · API server-side cifrada.</p></div>
    <label className="text-sm">API key<input className="border-line bg-surface mt-1 w-full rounded-control border px-2 py-1" type="password" value={apiKey} autoComplete="new-password" onChange={(event) => setApiKey(event.target.value)} placeholder="Pega una nueva clave para sustituirla" /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Habilitar KIE para acciones asignadas</label>
    <Button type="button" size="sm" className="w-fit" disabled={pending} onClick={submit}>{pending ? 'Guardando…' : 'Guardar KIE'}</Button>
    {error && <p className="text-sm text-[--color-danger]">{error}</p>}
  </div>;
}
