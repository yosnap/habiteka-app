'use client';

/**
 * Lista de proveedores de IA con la clave de la organización: añadir o sustituir, probar y borrar. La clave solo viaja
 * al servidor al guardarla; de vuelta llega la pista (••••abcd). Los permisos los revalida cada Server Action.
 */
import { useState, useTransition } from 'react';
import { CheckCircle2, KeyRound, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InlineConfirmButton } from '@/components/ui/inline-confirm-button';
import { callAction } from '@/lib/action-result';
import { deleteAiKeyAction, saveAiKeyAction, testAiKeyAction } from '@/server/settings/organization-ai-key-actions';

export interface AiKeyRow { provider: string; label: string; baseUrl: string; configured: boolean; keyHint: string | null; updatedAt: string | null }

export function OrganizationAiKeysPanel({ keys, canEdit }: { keys: AiKeyRow[]; canEdit: boolean }) {
  return (
    <div className="mt-6 flex flex-col gap-3">
      {!canEdit ? (
        <p className="bg-muted text-ink-soft rounded-card border border-line p-3 text-sm">
          Solo el propietario o un administrador de la organización puede cambiar las claves. Aquí ves cuáles hay.
        </p>
      ) : null}
      {keys.map((row) => <AiKeyCard key={row.provider} row={row} canEdit={canEdit} />)}
    </div>
  );
}

function AiKeyCard({ row, canEdit }: { row: AiKeyRow; canEdit: boolean }) {
  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (task: () => Promise<{ ok: boolean; message: string }>) => start(async () => {
    try { setResult(await task()); }
    catch (cause) { setResult({ ok: false, message: cause instanceof Error ? cause.message : 'No se pudo completar la operación.' }); }
  });
  const save = () => run(async () => {
    if (!apiKey.trim()) return { ok: false, message: `Pega la clave de ${row.label}.` };
    await callAction(saveAiKeyAction(row.provider, apiKey));
    setApiKey('');
    return { ok: true, message: 'Clave guardada. Pulsa «Probar» para comprobarla.' };
  });
  const test = () => run(() => callAction(testAiKeyAction(row.provider)));
  const remove = () => run(async () => {
    await callAction(deleteAiKeyAction(row.provider));
    return { ok: true, message: `Clave borrada. Las funciones que usan ${row.label} quedan bloqueadas hasta que añadas otra.` };
  });

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-ink flex items-center gap-2 text-base font-semibold"><KeyRound size={16} aria-hidden />{row.label}</h2>
          <p className="text-ink-soft text-xs">{row.baseUrl}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${row.configured ? 'bg-brand-50 text-brand-700' : 'bg-muted text-ink-soft'}`}>
          {row.configured ? `Clave ${row.keyHint}` : 'Sin clave'}
        </span>
      </div>
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-ink-soft min-w-60 flex-1 text-sm">
            {row.configured ? 'Sustituir la clave' : 'API key'}
            <input
              className="border-line bg-surface text-ink mt-1 w-full rounded-control border px-2 py-1.5"
              type="password" autoComplete="new-password" spellCheck={false} value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={`Pega aquí tu clave de ${row.label}`}
            />
          </label>
          <Button type="button" size="sm" disabled={pending} onClick={save}>{pending ? 'Un momento…' : 'Guardar'}</Button>
          {row.configured ? <Button type="button" size="sm" variant="outline" disabled={pending} onClick={test}>Probar</Button> : null}
          {row.configured ? (
            <InlineConfirmButton label="Borrar" question="¿Borrar la clave?" confirmLabel="Sí, borrar" disabled={pending}
              className="text-sm text-[--color-danger] hover:underline" onConfirm={remove} />
          ) : null}
        </div>
      ) : null}
      {result ? (
        <p role="status" className={`flex items-center gap-2 text-sm ${result.ok ? 'text-brand-700' : 'text-[--color-danger]'}`}>
          {result.ok ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}{result.message}
        </p>
      ) : null}
    </Card>
  );
}
