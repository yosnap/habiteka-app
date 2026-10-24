'use client';

/**
 * Datos personales: nombre visible y cambio de contraseña. Los aplica Better Auth sobre la sesión actual, así que
 * solo cambian los datos de quien ha iniciado sesión. El correo identifica la cuenta y no se edita aquí.
 */
import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';
import { FormStatus, fieldClass, type FormResult } from './form-status';

const MIN_PASSWORD = 8;

export function PersonalDetailsForm({ name: initialName, email }: { name: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [nameResult, setNameResult] = useState<FormResult>(null);
  const [passwords, setPasswords] = useState({ current: '', next: '', repeat: '' });
  const [passwordResult, setPasswordResult] = useState<FormResult>(null);
  const [pending, start] = useTransition();

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) { setNameResult({ ok: false, message: 'El nombre debe tener entre 2 y 80 caracteres.' }); return; }
    start(async () => {
      const { error } = await authClient.updateUser({ name: trimmed });
      setNameResult(error ? { ok: false, message: error.message ?? 'No se pudo guardar el nombre.' } : { ok: true, message: 'Nombre guardado.' });
      if (!error) router.refresh();
    });
  };

  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    if (passwords.next.length < MIN_PASSWORD) { setPasswordResult({ ok: false, message: `La contraseña nueva necesita al menos ${MIN_PASSWORD} caracteres.` }); return; }
    if (passwords.next !== passwords.repeat) { setPasswordResult({ ok: false, message: 'Las dos contraseñas nuevas no coinciden.' }); return; }
    start(async () => {
      const { error } = await authClient.changePassword({ currentPassword: passwords.current, newPassword: passwords.next, revokeOtherSessions: true });
      if (error) { setPasswordResult({ ok: false, message: error.status === 400 || error.status === 401 ? 'La contraseña actual no es correcta, o tu cuenta entra sin contraseña.' : error.message ?? 'No se pudo cambiar la contraseña.' }); return; }
      setPasswords({ current: '', next: '', repeat: '' });
      setPasswordResult({ ok: true, message: 'Contraseña cambiada. Se han cerrado tus otras sesiones abiertas.' });
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="p-5">
        <form className="flex flex-col gap-4" onSubmit={saveName}>
          <h3 className="text-ink text-base font-semibold">Tu cuenta</h3>
          <label className="text-ink-soft text-sm">Nombre
            <input className={fieldClass} value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="text-ink-soft text-sm">Correo electrónico
            <input className={fieldClass} value={email} disabled readOnly />
            <span className="mt-1 block text-xs">Es el correo con el que entras; no se cambia desde aquí.</span>
          </label>
          <Button type="submit" size="sm" className="w-fit" disabled={pending || name.trim() === initialName}>Guardar nombre</Button>
          <FormStatus result={nameResult} />
        </form>
      </Card>
      <Card className="p-5">
        <form className="flex flex-col gap-4" onSubmit={savePassword}>
          <h3 className="text-ink text-base font-semibold">Contraseña</h3>
          <label className="text-ink-soft text-sm">Contraseña actual
            <input className={fieldClass} type="password" autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} />
          </label>
          <label className="text-ink-soft text-sm">Contraseña nueva
            <input className={fieldClass} type="password" autoComplete="new-password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} />
          </label>
          <label className="text-ink-soft text-sm">Repite la contraseña nueva
            <input className={fieldClass} type="password" autoComplete="new-password" value={passwords.repeat} onChange={(event) => setPasswords({ ...passwords, repeat: event.target.value })} />
          </label>
          <Button type="submit" size="sm" className="w-fit" disabled={pending || !passwords.current || !passwords.next}>Cambiar contraseña</Button>
          <FormStatus result={passwordResult} />
        </form>
      </Card>
    </div>
  );
}
