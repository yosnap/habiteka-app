'use client';

/**
 * Banner de consentimiento de cookies (ePrivacy). Aparece mientras el usuario no
 * haya decidido sus categorías. Por defecto NADA no esencial está activo; el
 * usuario acepta todo, solo lo necesario, o ajusta por categoría. La elección se
 * persiste server-side vía Server Action.
 *
 * El tracking (F10/F18) NO se dispara desde aquí: este banner solo registra la
 * elección; cada tracker la consulta antes de instalar cookies.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMountEffect } from '@/lib/use-mount-effect';
import { saveCookieConsent, loadCookieBannerState } from '@/server/legal/actions';
import type { CookieChoice } from './cookie-gate';

export function CookieConsentBanner() {
  // null = cargando; true = no mostrar (sin sesión o ya decidido); false = mostrar.
  const [decided, setDecided] = useState<boolean | null>(null);
  const [analytics, setAnalytics] = useState(false);
  const [affiliate, setAffiliate] = useState(false);

  useMountEffect(() => {
    // Sin sesión, el banner no aplica (no hay dónde registrar la elección). Con
    // sesión, se muestra solo si aún no hay ninguna categoría registrada.
    void loadCookieBannerState()
      .then(({ hasSession, choice }) => {
        if (!hasSession) {
          setDecided(true);
          return;
        }
        setAnalytics(choice.analytics);
        setAffiliate(choice.affiliate);
        setDecided(choice.analytics || choice.affiliate);
      })
      .catch(() => setDecided(true));
  });

  if (decided !== false) return null;

  async function persist(choice: CookieChoice) {
    await saveCookieConsent(choice);
    setDecided(true);
  }

  return (
    <div
      role="dialog"
      aria-label="Consentimiento de cookies"
      className="border-line bg-surface fixed inset-x-0 bottom-0 z-50 border-t p-4 shadow-lg"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <p className="text-sm">
          Usamos cookies necesarias para el servicio. Con tu permiso, también de{' '}
          <strong>analítica</strong> y de <strong>afiliación</strong>. Tú eliges.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
            />
            Analítica
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={affiliate}
              onChange={(e) => setAffiliate(e.target.checked)}
            />
            Afiliación
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => persist({ analytics, affiliate })}>
            Guardar elección
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => persist({ analytics: false, affiliate: false })}
          >
            Solo necesarias
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => persist({ analytics: true, affiliate: true })}
          >
            Aceptar todo
          </Button>
        </div>
      </div>
    </div>
  );
}
