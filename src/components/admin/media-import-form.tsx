'use client';

/**
 * Importación de una imagen por URL desde el media manager. Dispara la Server
 * Action, que valida el destino (anti-SSRF), sanea el contenido y almacena. El
 * resultado o el error se muestran al admin.
 */
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { adminImportMediaFromUrl } from '@/server/admin/media/actions';

export function MediaImportForm() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    start(async () => {
      try {
        await adminImportMediaFromUrl(url);
        setUrl('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo importar');
      }
    });
  };

  return (
    <div className="flex max-w-lg items-end gap-2">
      <label className="flex-1 text-sm">
        Importar imagen por URL
        <input
          className="border-line bg-surface mt-1 w-full rounded-[var(--radius-control)] border px-2 py-1"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/imagen.png"
        />
      </label>
      <Button type="button" size="sm" onClick={submit} disabled={pending || !url.trim()}>
        {pending ? 'Importando…' : 'Importar'}
      </Button>
      {error && <p className="text-sm text-[--color-danger]">{error}</p>}
    </div>
  );
}
