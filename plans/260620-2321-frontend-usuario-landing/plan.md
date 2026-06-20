# Frontend de usuario — landing + mis proyectos + onboarding

**Objetivo:** dar cara de producto a Habiteka para el usuario B2C: una landing
pública, autenticación visible (registro/login), pantalla de "mis proyectos" y el
flujo de nuevo usuario (registro → crear proyecto → subir foto → generar).

**Stack:** Next.js 16 App Router, React 19, Tailwind v4 (@theme), Better Auth.
Reutiliza tokens de marca de F1 (`brand-500` terracota, `ink`, `surface`,
`surface-muted`, `line`, radios `card`/`control`). Solo existe `Button`; añadiré
los primitivos mínimos que falten (Input, Card) en `components/ui`.

## Fases (PRs independientes, CI-gated, merge a develop)

### F-U1 · Cliente de auth + primitivos UI
- `src/lib/auth-client.ts`: `createAuthClient` de Better Auth (signUp/signIn/social/OTP/useSession).
- `components/ui/input.tsx`, `components/ui/card.tsx` (shadcn-style, con tokens de marca).
- Sin esto, los forms no pueden hablar con auth desde el cliente.

### F-U2 · Landing page pública (`/`)
- Sustituye el home de dev por una **landing real**: hero (propuesta de valor +
  CTA), "cómo funciona" (3 pasos), nota de confianza (disclaimer conceptual de F1,
  en tono que genera confianza, no miedo), footer con enlace a `/legal/terminos`.
- El home de dev (nav + dev-login) se **conserva** detrás de un bloque visible solo
  con `ENABLE_DEV_LOGIN` (no se pierde la herramienta de pruebas).
- CTA → `/registro` (o `/acceder`).

### F-U3 · Registro y acceso (`/registro`, `/acceder`)
- Formularios con email+password (Better Auth client), botones OAuth Google/Meta,
  y el captcha Turnstile donde el server lo exige. Email-OTP como alternativa.
- Manejo de errores y estados de carga. Tras registro/login → redirige a `/proyectos`.
- Respeta `requireEmailVerification` (mensaje de "verifica tu correo" cuando aplique).

### F-U4 · Layout autenticado + "Mis proyectos" (`/proyectos`)
- `src/app/(app)/layout.tsx`: header con marca, enlace a proyectos, saldo de
  créditos, sign-out. Guard: sin sesión → redirige a `/acceder`.
- `/proyectos`: lista los proyectos del usuario (`listProjects`), botón "Nuevo
  proyecto" (`createProject` → redirige a `/projects/[id]`), y acceso al canvas.
  Estado vacío con CTA claro. Resuelve el hueco actual (solo se llega al canvas por
  el proyecto de muestra).

### F-U5 · Subida de imagen en el flujo del agente
- Componente de upload de imagen en el chat/canvas que construye el `MessagePart`
  `image_url` (base64) y dispara `advanceAgent({action:'ingest', image})`.
- Cierra el onboarding: registro → proyecto → **subir foto → generar**.
- Pasa la imagen por el saneado existente (la capa de IA ya valida/strip EXIF).

## Decisiones tomadas (no re-preguntar)
- Frontend primero, providers de imagen después.
- Las 3 piezas (landing + mis proyectos + onboarding) entran, en este orden de fases.

## Fuera de alcance (por ahora)
- Rediseño visual fino / branding final (usa el design system actual).
- Providers Nano Banana/Imagen (van DESPUÉS, ya acordado).
- Pasarela de compra de créditos desde la UI de usuario (existe billing admin; la
  compra B2C de packs se puede añadir luego).

## Verificación por fase
- typecheck + lint + format + test + build verdes antes de cada PR.
- Prueba manual del flujo con el usuario dev tras F-U4/F-U5.
- Cada fase: rama propia → PR a develop → CI → merge (patrón establecido).

## Riesgos
- **Turnstile en local:** sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` el captcha no
  renderiza; el form debe degradar (permitir en dev sin captcha o mostrar aviso).
- **requireEmailVerification:** un registro real exige verificar email; en dev el
  seed marca verificado. El form debe manejar el estado "pendiente de verificación".
- **createAuthClient** debe apuntar a `BETTER_AUTH_URL` correcto.
