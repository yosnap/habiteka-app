'use client';

/** Alta de un proveedor compatible con OpenAI (NodeClub.ai u otro): nombre, URL base de su API y su clave. */
import { useState, useTransition, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { callAction } from '@/lib/action-result';
import { saveCompatibleProviderAction } from '@/server/settings/organization-ai-key-actions';
import { FormStatus, fieldClass, type FormResult } from '@/components/profile/form-status';

export function CompatibleProviderForm() {
  const [form, setForm] = useState({ label: '', baseUrl: '', apiKey: '' });
  const [result, setResult] = useState<FormResult>(null);
  const [pending, start] = useTransition();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    start(async () => {
      try {
        await callAction(saveCompatibleProviderAction(form));
        setForm({ label: '', baseUrl: '', apiKey: '' });
        setResult({ ok: true, message: 'Proveedor añadido. Habilita sus modelos en su tarjeta.' });
      } catch (cause) { setResult({ ok: false, message: cause instanceof Error ? cause.message : 'No se pudo añadir.' }); }
    });
  };
  return (
    <Card className="p-4 xl:col-span-2">
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <h2 className="text-ink flex items-center gap-2 text-base font-semibold"><Plus size={16} aria-hidden />Añadir un proveedor compatible con OpenAI</h2>
        <p className="text-ink-soft text-sm">Cualquier API que acepte el formato de OpenAI (<code>/chat/completions</code> y <code>/models</code>), solo para texto y visión. La clave solo se envía a esta URL; si la cambias, tendrás que pegarla de nuevo.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-ink-soft text-sm">Nombre<input className={fieldClass} value={form.label} maxLength={40} placeholder="Ej. NodeClub.ai" onChange={(event) => setForm({ ...form, label: event.target.value })} /></label>
          <label className="text-ink-soft text-sm">URL base<input className={fieldClass} value={form.baseUrl} placeholder="https://api.proveedor.com/v1" onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} /></label>
          <label className="text-ink-soft text-sm">API key<input className={fieldClass} type="password" autoComplete="new-password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} /></label>
        </div>
        <Button type="submit" size="sm" className="w-fit" disabled={pending || !form.label.trim() || !form.baseUrl.trim() || !form.apiKey.trim()}>Añadir proveedor</Button>
        <FormStatus result={result} />
      </form>
    </Card>
  );
}
