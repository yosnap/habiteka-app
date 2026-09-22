# Catálogo de variables y secrets por entorno

> Nombres, sin valores. Los valores se configuran en **Dokploy** (aplicación →
> Environment). Fuente de los nombres de aplicación: [`.env.example`](../.env.example).

## Dónde vive cada secret

| Ámbito | Dónde se configura |
|---|---|
| Runtime de la app | Dokploy → aplicación → Environment |

No hay secrets de despliegue en GitHub: Dokploy despliega por push de la app de
GitHub instalada en el panel, sin webhook desde CI.

## Secrets de la aplicación (runtime — Dokploy)

| Variable | Tipo | Notas |
|---|---|---|
| `DATABASE_URL` | secret | Apunta al servicio Postgres de Dokploy del mismo entorno (host interno del servicio) |
| `BETTER_AUTH_SECRET` | secret | Distinto por entorno |
| `BETTER_AUTH_URL` | config | URL pública del entorno (staging/prod) |
| `ADMIN_SECRETS_KEY` | secret | Base64 de 32 bytes; cifra las credenciales de proveedores de IA guardadas en BD. Si falta, en producción se deriva de `BETTER_AUTH_SECRET` (mejor clave propia) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | secret | OAuth Google |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | secret | OAuth Meta |
| `TURNSTILE_SECRET_KEY` | secret | CAPTCHA server-side |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | público | Expuesto al cliente |
| `EMAIL_PROVIDER` | config | Solo `resend` implementado (por defecto); `smtp` está en `.env.example` pero el código aún no lo soporta |
| `RESEND_API_KEY` | secret | Sin ella, el registro no exige verificar el email (se abriría sesión sin poder enviar el correo); con ella puesta, la verificación se activa sola |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | secret | Reservadas para cuando se implemente `EMAIL_PROVIDER=smtp`; hoy no tienen efecto |
| `OPENROUTER_API_KEY` | secret | Chat/visión |
| `IMAGE_PROVIDER` | config | `flux` / `nano-banana` / `imagen` |
| `IMAGE_PROVIDER_KEY` | secret | Render 3D / inpainting |
| `POLAR_ACCESS_TOKEN` / `POLAR_WEBHOOK_SECRET` / `POLAR_ORGANIZATION_ID` | secret | Pagos |
| `STORAGE_ENDPOINT` / `STORAGE_REGION` / `STORAGE_BUCKET` | config | Apunta al storage S3-compatible (MinIO en Dokploy o S3/R2 externo) |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | secret | Credenciales del storage |
| `PORT` | config | Puerto que sirve el contenedor (p. ej. 3000); el proxy mapea |
| `NODE_ENV` | config | `production` |

## Reglas

- **Nunca** se commitea un valor real; `.env*` está en `.gitignore` y `.dockerignore`.
- Los secrets se inyectan en **runtime**, nunca como build args (no quedan en
  capas de la imagen).
- Los workflows de CI **no** reciben secrets de IA/pagos: el job de calidad usa
  un `BETTER_AUTH_SECRET` de relleno y una Postgres efímera (cero red real).
- Producción se despliega solo desde `main`: la rama es la única puerta de
  entrada al entorno en vivo.
