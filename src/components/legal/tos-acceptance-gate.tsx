'use client';

/**
 * Puerta de aceptación de los Términos de Servicio. Envuelve la acción de generar:
 * si el usuario no ha aceptado el ToS vigente, muestra el aviso y el botón de
 * aceptación en lugar del contenido. Aceptar registra la versión server-side y
 * desbloquea el contenido.
 *
 * La aceptación es CONDICIÓN CONTRACTUAL: el gate de servidor
 * (`assertTosAccepted`) la vuelve a exigir antes de generar, así que esto es la
 * capa de UX, no la única barrera.
 */
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useMountEffect } from '@/lib/use-mount-effect';
import { acceptCurrentTos, checkTosAccepted } from '@/server/legal/actions';

interface Props {
  children: ReactNode;
}

export function TosAcceptanceGate({ children }: Props) {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useMountEffect(() => {
    void checkTosAccepted().then(setAccepted);
  });

  if (accepted === null) return null; // cargando
  if (accepted) return <>{children}</>;

  async function accept() {
    setPending(true);
    try {
      await acceptCurrentTos();
      setAccepted(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-line bg-surface-muted flex flex-col gap-3 rounded-control border p-4">
      <p className="text-sm">
        Antes de generar, debes aceptar los{' '}
        <Link href="/legal/terminos" className="underline">
          Términos de Servicio
        </Link>
        . Las propuestas son <strong>conceptuales</strong> y requieren validación por un profesional
        cualificado.
      </p>
      <div>
        <Button type="button" size="sm" onClick={accept} disabled={pending}>
          {pending ? 'Registrando…' : 'Acepto los Términos de Servicio'}
        </Button>
      </div>
    </div>
  );
}
