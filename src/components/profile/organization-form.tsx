'use client';

/** Nombre de la organización (solo propietario o administrador) y lista de sus miembros. */
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { callAction } from '@/lib/action-result';
import { renameOrganizationAction } from '@/server/settings/profile-actions';
import { FormStatus, fieldClass, type FormResult } from './form-status';

interface Member { name: string; email: string; role: string; you: boolean }

export function OrganizationForm({ name: initialName, canEdit, members }: { name: string; canEdit: boolean; members: Member[] }) {
  const [name, setName] = useState(initialName);
  const [result, setResult] = useState<FormResult>(null);
  const [pending, start] = useTransition();
  const save = (event: FormEvent) => {
    event.preventDefault();
    start(async () => {
      try { await callAction(renameOrganizationAction(name)); setResult({ ok: true, message: 'Nombre de la organización guardado.' }); }
      catch (cause) { setResult({ ok: false, message: cause instanceof Error ? cause.message : 'No se pudo guardar.' }); }
    });
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card className="p-5">
        <form className="flex flex-col gap-4" onSubmit={save}>
          <h3 className="text-ink text-base font-semibold">Datos de la organización</h3>
          <label className="text-ink-soft text-sm">Nombre
            <input className={fieldClass} value={name} disabled={!canEdit} onChange={(event) => setName(event.target.value)} />
          </label>
          {canEdit
            ? <Button type="submit" size="sm" className="w-fit" disabled={pending || name.trim() === initialName}>Guardar</Button>
            : <p className="text-ink-soft text-xs">Solo el propietario o un administrador puede cambiar el nombre.</p>}
          <FormStatus result={result} />
        </form>
      </Card>
      <Card className="p-5">
        <h3 className="text-ink mb-3 text-base font-semibold">Miembros</h3>
        <ul className="divide-line divide-y">
          {members.map((member) => (
            <li key={member.email} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-ink truncate text-sm font-medium">{member.name}{member.you ? ' (tú)' : ''}</p>
                <p className="text-ink-soft truncate text-xs">{member.email}</p>
              </div>
              <span className="bg-muted text-ink-soft rounded-full px-2.5 py-0.5 text-xs">{member.role}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
