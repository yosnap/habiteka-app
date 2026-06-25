/**
 * Cliente de Better Auth para el navegador.
 *
 * Espeja los plugins del servidor (organización, admin, email-OTP) para que las
 * llamadas del cliente casen con la API montada en `/api/auth`. El `baseURL` es
 * relativo: funciona en cualquier entorno sin exponer una URL absoluta.
 *
 * El captcha (Turnstile) NO tiene plugin de cliente: es middleware del servidor;
 * el token del widget se envía como header `x-captcha-response` en cada llamada
 * protegida (ver formularios de registro/acceso).
 */
'use client';

import { createAuthClient } from 'better-auth/react';
import { organizationClient, adminClient, emailOTPClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
  basePath: '/api/auth',
  plugins: [organizationClient(), adminClient(), emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
