'use client';

/**
 * Botones de acceso con proveedores sociales (Google / Meta). `signIn.social`
 * devuelve la URL de OAuth; la redirección es manual. Tras el login, el proveedor
 * vuelve a `callbackURL`.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth-client';

const CALLBACK = '/proyectos';

export function SocialButtons() {
  const [pending, setPending] = useState<string | null>(null);

  async function go(provider: 'google' | 'facebook') {
    setPending(provider);
    try {
      const res = await signIn.social({ provider, callbackURL: CALLBACK });
      const url = (res as { data?: { url?: string } }).data?.url;
      if (url) window.location.href = url;
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending !== null}
        onClick={() => go('google')}
      >
        {pending === 'google' ? 'Conectando…' : 'Continuar con Google'}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={pending !== null}
        onClick={() => go('facebook')}
      >
        {pending === 'facebook' ? 'Conectando…' : 'Continuar con Meta'}
      </Button>
    </div>
  );
}
