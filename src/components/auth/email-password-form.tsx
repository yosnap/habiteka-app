'use client';

/**
 * Formulario de email + contraseña, compartido por registro y acceso. La acción
 * concreta (signUp/signIn) se inyecta para no duplicar la UI; el captcha Turnstile
 * se incluye solo si hay site-key configurada (el servidor monta el captcha bajo
 * la misma condición).
 */
import { useState, type FormEvent } from 'react';
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token: captchaToken, reset: resetCaptcha, enabled: captchaEnabled } = useTurnstileToken();

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
        <Input
          type="text"
          placeholder="Tu nombre"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      ) : null}
      <Input
        type="email"
        placeholder="tu@email.com"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        type="password"
        placeholder="Contraseña"
        autoComplete={isRegistro ? 'new-password' : 'current-password'}
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TurnstileWidget />
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Un momento…' : isRegistro ? 'Crear cuenta' : 'Acceder'}
      </Button>
    </form>
  );
}
