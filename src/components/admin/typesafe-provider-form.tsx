'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { adminUpdateTypesafeProvider } from '@/server/admin/config/actions';

interface Props { configured: boolean; enabled: boolean; keyHint: string | null; }

export function TypesafeProviderForm({ configured, enabled: initialEnabled, keyHint }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () => {
    setError(null);
    if (!apiKey.trim() && !configured) { setError('Introduce una API key para guardar Jev (TypeSafe).'); return; }
    start(async () => {
      try { await adminUpdateTypesafeProvider({ apiKey, enabled }); setApiKey(''); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar Jev (TypeSafe)'); }
    });
  };
  return <div className="flex flex-col gap-3">
    <p className="text-sm font-medium">{configured ? `Clave guardada: ${keyHint}` : 'Sin clave guardada'}</p>
    <label className="text-sm">API key<input className="border-line bg-surface mt-1 w-full rounded-control border px-2 py-1" type="password" value={apiKey} autoComplete="new-password" onChange={(event) => setApiKey(event.target.value)} placeholder={configured ? 'Pega una nueva clave para sustituirla, o déjalo vacío' : 'Pega la clave de TypeSafe'} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Habilitar las evaluaciones de calidad con Jev</label>
    <Button type="button" size="sm" className="w-fit" disabled={pending} onClick={submit}>{pending ? 'Guardando…' : 'Guardar Jev'}</Button>
    {error && <p className="text-sm text-[--color-danger]">{error}</p>}
  </div>;
}
