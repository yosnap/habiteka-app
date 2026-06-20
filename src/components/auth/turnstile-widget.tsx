'use client';

/**
 * Widget de Cloudflare Turnstile y el hook para leer su token.
 *
 * Solo se activa si hay `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (misma condición bajo la
 * que el servidor monta el captcha). Sin clave —típico en local— el widget no se
 * renderiza y el captcha se considera deshabilitado, para no bloquear el desarrollo.
 *
 * El token se comparte por contexto para que el formulario lo envíe como header
 * `x-captcha-response`. El widget y el form deben vivir bajo el mismo provider.
 */
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import Script from 'next/script';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface TurnstileCtx {
  token: string | null;
  setToken: (t: string | null) => void;
  reset: () => void;
  enabled: boolean;
}

const Ctx = createContext<TurnstileCtx | null>(null);

export function TurnstileProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  // Reset: limpia el token y, si el widget está montado, pide a Turnstile un
  // nuevo challenge para que el usuario pueda reintentar.
  const reset = useCallback(() => {
    setToken(null);
    window.turnstile?.reset();
  }, []);
  return (
    <Ctx.Provider value={{ token, setToken, reset, enabled: Boolean(SITE_KEY) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTurnstileToken() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Sin provider, el captcha simplemente no aplica.
    return { token: null, reset: () => {}, enabled: false };
  }
  return { token: ctx.token, reset: ctx.reset, enabled: ctx.enabled };
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

/** Renderiza el widget si hay site-key; si no, no pinta nada. */
export function TurnstileWidget() {
  const ctx = useContext(Ctx);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const render = useCallback(() => {
    if (!SITE_KEY || !containerRef.current || !window.turnstile) return;
    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (t) => ctx?.setToken(t),
    });
  }, [ctx]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={render}
      />
      <div ref={containerRef} />
    </>
  );
}
