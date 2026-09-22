'use client';

/**
 * Formulario de email + contraseña, compartido por registro y acceso. La acción
 * concreta (signUp/signIn) se inyecta para no duplicar la UI; el captcha Turnstile
 * se incluye solo si hay site-key configurada (el servidor monta el captcha bajo
 * la misma condición).
 */
import { useId, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TurnstileWidget, useTurnstileToken } from './turnstile-widget';

export interface AuthSubmit {
  email: string;
  password: string;
  name?: string;
  captchaToken?: string;
}

interface Props {
  mode: 'registro' | 'acceso';
  onSubmit: (values: AuthSubmit) => Promise<{ error?: string } | void>;
}

export function EmailPasswordForm({ mode, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token: captchaToken, reset: resetCaptcha, enabled: captchaEnabled } = useTurnstileToken();

  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const isRegistro = mode === 'registro';

  async function handle(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (captchaEnabled && !captchaToken) {
      setError('Completa la verificación anti-robot.');
      return;
    }
    setPending(true);
    try {
      const result = await onSubmit({
        email,
        password,
        name: isRegistro ? name : undefined,
        captchaToken: captchaToken ?? undefined,
      });
      if (result?.error) {
        setError(result.error);
        resetCaptcha();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      {isRegistro ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={nameId} className="text-ink text-sm font-medium">
            Nombre
          </label>
          <Input
            id={nameId}
            type="text"
            placeholder="Tu nombre"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor={emailId} className="text-ink text-sm font-medium">
          Email
        </label>
        <Input
          id={emailId}
          type="email"
          placeholder="tu@email.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={passwordId} className="text-ink text-sm font-medium">
          Contraseña
        </label>
        <div className="relative">
          <Input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            autoComplete={isRegistro ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={showPassword}
            className="text-ink-soft hover:text-ink absolute inset-y-0 right-0 flex items-center px-3"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {isRegistro ? <p className="text-ink-soft text-xs">Mínimo 8 caracteres.</p> : null}
      </div>
      <TurnstileWidget />
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Un momento…' : isRegistro ? 'Crear cuenta' : 'Acceder'}
      </Button>
    </form>
  );
}
