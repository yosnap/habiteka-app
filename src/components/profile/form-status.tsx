/** Mensaje de resultado de un formulario de «Mi perfil»: verde si salió bien, en color de peligro si no. */
import { CheckCircle2, XCircle } from 'lucide-react';

export type FormResult = { ok: boolean; message: string } | null;

export function FormStatus({ result }: { result: FormResult }) {
  if (!result) return null;
  return (
    <p role="status" className={`flex items-center gap-2 text-sm ${result.ok ? 'text-brand-700' : 'text-[--color-danger]'}`}>
      {result.ok ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}{result.message}
    </p>
  );
}

export const fieldClass = 'border-line bg-surface text-ink mt-1 w-full rounded-control border px-3 py-2 text-sm disabled:opacity-60';
