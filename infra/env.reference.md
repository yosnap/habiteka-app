# Catálogo de variables y secrets por entorno

> Nombres, sin valores. Los valores se configuran en **Easypanel** (env del
> servicio App) y en **GitHub Environments** (los que consume el deploy).
> Fuente de los nombres de aplicación: [`.env.example`](../.env.example).

## Dónde vive cada secret

| Ámbito | Dónde se configura |
|---|---|
| Runtime de la app | Easypanel → servicio App → Environment |
| Disparo de deploy desde CI | GitHub → Settings → Environments (`staging`, `production`) |

## Secrets de la aplicación (runtime — Easypanel)

| Variable | Tipo | Notas |
|---|---|---|
| `DATABASE_URL` | secret | Apunta al servicio Postgres de Easypanel del mismo entorno |
| `BETTER_AUTH_SECRET` | secret | Distinto por entorno |
| `BETTER_AUTH_URL` | config | URL pública del entorno (staging/prod) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | secret | OAuth Google |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | secret | OAuth Meta |
| `TURNSTILE_SECRET_KEY` | secret | CAPTCHA server-side |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | público | Expuesto al cliente |
| `EMAIL_PROVIDER` | config | `resend` (por defecto) o `smtp` |
| `RESEND_API_KEY` | secret | Si `EMAIL_PROVIDER=resend` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | secret | Si `EMAIL_PROVIDER=smtp` |
| `OPENROUTER_API_KEY` | secret | Chat/visión |
| `IMAGE_PROVIDER` | config | `flux` / `nano-banana` / `imagen` |
| `IMAGE_PROVIDER_KEY` | secret | Render 3D / inpainting |
| `POLAR_ACCESS_TOKEN` / `POLAR_WEBHOOK_SECRET` / `POLAR_ORGANIZATION_ID` | secret | Pagos |
| `STORAGE_ENDPOINT` / `STORAGE_REGION` / `STORAGE_BUCKET` | config | Apunta al MinIO de Easypanel |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | secret | Credenciales MinIO |
| `PORT` | config | Puerto que sirve el contenedor (p. ej. 3000); el proxy mapea |
| `NODE_ENV` | config | `production` |

## Secrets de despliegue (GitHub Environments)

| Variable | Ámbito | Notas |
|---|---|---|
| `EASYPANEL_DEPLOY_WEBHOOK` | secret (por environment) | Webhook de deploy del servicio App en Easypanel |
| `APP_BASE_URL` | variable (por environment) | URL base para el smoke test `/api/health` |

## Reglas

- **Nunca** se commitea un valor real; `.env*` está en `.gitignore` y `.dockerignore`.
- Los secrets se inyectan en **runtime**, nunca como build args (no quedan en
  capas de la imagen).
- Los workflows de CI **no** reciben secrets de IA/pagos: el job de calidad usa
  un `BETTER_AUTH_SECRET` de relleno y una Postgres efímera (cero red real).
- Producción es un **protected environment**: el deploy requiere aprobación.
