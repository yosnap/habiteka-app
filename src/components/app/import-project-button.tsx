'use client';

/**
 * Importa un proyecto exportado (`.habiteka`): lo sube directo al almacenamiento y
 * el servidor crea un proyecto nuevo idéntico en tu cuenta. Al terminar, lo abre.
 */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { callAction } from '@/lib/action-result';
import { finishProjectImport, startProjectImport } from '@/server/project-transfer/project-transfer-actions';

type Status = 'idle' | 'uploading' | 'importing';

export function ImportProjectButton() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const importFile = async (file: File) => {
    setError(null);
    try {
      setStatus('uploading');
      const { key, uploadUrl } = await callAction(startProjectImport(file.size));
      const uploaded = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': 'application/zip' } });
      if (!uploaded.ok) throw new Error('No se pudo subir el archivo. Vuelve a intentarlo.');
      setStatus('importing');
      const { projectId } = await callAction(finishProjectImport(key));
      router.push(`/projects/${projectId}/plano`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar el proyecto.');
      setStatus('idle');
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <input ref={input} type="file" accept=".habiteka,application/zip" className="hidden"
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file); }} />
      <Button type="button" variant="outline" disabled={status !== 'idle'} onClick={() => input.current?.click()}>
        {status === 'uploading' ? 'Subiendo proyecto…' : status === 'importing' ? 'Importando proyecto…' : 'Importar proyecto'}
      </Button>
      {error ? <p role="alert" className="text-danger max-w-xs text-right text-xs">{error}</p> : null}
    </div>
  );
}
