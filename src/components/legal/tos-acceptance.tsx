'use client';

/**
 * Gate de los Términos de Servicio para las pantallas que generan contenido.
 *
 * El servidor exige la aceptación antes de procesar imágenes o generar diseños,
 * pero en producción un error lanzado desde una Server Action llega al cliente
 * como un 500 sin mensaje. Por eso cada pantalla comprueba el estado al montar,
 * muestra el aviso con el botón de aceptar y bloquea sus acciones hasta entonces.
 */
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useMountEffect } from '@/lib/use-mount-effect';
import { acceptCurrentTos, checkTosAccepted } from '@/server/legal/actions';

/** Mensaje para bloquear una acción en cliente cuando faltan los Términos. */
export const TOS_REQUIRED_MESSAGE =
  'Antes de continuar, acepta los Términos de Servicio (encontrarás el botón en esta pantalla).';

/** Estado de aceptación del ToS vigente: `null` mientras se consulta. */
export function useTosAcceptance() {
  const [tosAccepted, setTosAccepted] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  useMountEffect(() => {
    void checkTosAccepted()
      .then(setTosAccepted)
      .catch(() => setTosAccepted(false));
  });

  const acceptTos = () =>
    startTransition(async () => {
      await acceptCurrentTos();
      setTosAccepted(true);
    });

  return { tosAccepted, acceptTos, pending };
}

interface TosAcceptanceNoticeProps {
  accepted: boolean | null;
  onAccept: () => void;
  disabled?: boolean;
  className?: string;
}

/** Aviso con el botón de aceptar; no renderiza nada si ya está aceptado o se desconoce. */
export function TosAcceptanceNotice({
  accepted,
  onAccept,
  disabled,
  className,
}: TosAcceptanceNoticeProps) {
  if (accepted !== false) return null;
  return (
    <div
      className={`border-line bg-surface-muted flex flex-col gap-2 rounded-control border p-3 text-left text-sm ${className ?? ''}`}
      role="status"
    >
      <p className="text-ink-soft">
        Antes de generar, acepta los{' '}
        <Link href="/legal/terminos" target="_blank" className="text-brand-700 underline">
          Términos de Servicio
        </Link>
        . Las propuestas son conceptuales y requieren validación profesional.
      </p>
      <Button type="button" size="sm" onClick={onAccept} disabled={disabled}>
        Acepto los Términos de Servicio
      </Button>
    </div>
  );
}
