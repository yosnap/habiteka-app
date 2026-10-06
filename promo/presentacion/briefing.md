# Borrador de briefing — Habiteka · presentacion

Este material prepara una presentación; todavía no constituye un vídeo revisado
y aprobado. Las capturas del editor muestran la preparación geométrica y los
resultados finales deben proceder de diseños IA aceptados. La visita libre
sobre esos diseños sigue pendiente y no se anuncia como función disponible.

## Prompt del dueño

Vídeo de presentación de Habiteka, «más o menos de un minuto», en el que se miren
**todas las capacidades** de lo que se puede hacer con él: **todos los puntos
positivos, los procedimientos y ciertos resultados**. Cambiar todas las URLs de
`localhost` por `habiteka.app`.

## Respuestas del dueño (2026-10-06)

- Público: **A** — profesionales (inmobiliarias/promotoras, interioristas, comercios de muebles).
- Estilo visual: **A** — *navegador limpio*.
- Música: **A** — corporativa contemporánea, tempo medio, **pero no el mismo tema
  usado en otros vídeos** → `caracter: energetica, bpm: 116, tonalidad: Mi mayor,
  semilla: 4` (los anteriores usaban La menor 104, Re mayor 84 y Re mayor 124).
- Formato y voz: **A** — un solo MP4 1920×1080 (~55-60 s) **con voz** en español.
- Capturas: la app local en `http://localhost:3040` con el dev-login
  (`/api/dev/login`, cuenta `admin@habiteka.dev`); cualquier `localhost` visible
  se sustituye por `https://habiteka.app` (`sustituirTextos`).

## Decisiones del motor

- **Proyecto de demostración**: `FInca` (`cmu7nm84n0001evmsi8nyt1ee`), el más
  completo de la cuenta: 79 diseños, 2 recorridos y 21 vídeos.
- **Marca**: leída de la app (monocromo + Geist) y del CSS del landing
  (`--color-brand-500` ≈ `#d35d31`, el CTA terracota visible en el hero).
- **Voz**: `SDVJaMLoJa7wc3s2sn7d` (la validada en la presentación anterior de
  *navegador-limpio*), modelo `eleven_multilingual_v2`.
- **Guion en tres actos** (problema → producto → CTA):
  1. Gancho con el eslogan real del landing («Imagina tu reforma antes de empezar»).
  2. Procedimiento completo con capturas reales: landing → proyectos → importar
     plano → editor 3D → asistente → resultados.
  3. Cierre con lista de capacidades sobre la galería de diseños y CTA
     «Empezar gratis» en `habiteka.app`.
- **Resultados**: la escena `resultados` usa la pieza *lista* sobre la captura de
  Diseños (79 renders) para marcar las capacidades con checks.
- **Revisión de plano**: la escena `editor` pulsa «Modelo 3D» para mostrar la
  vista tridimensional del proyecto.
- Cada afirmación del guion tiene evidencia: rutas y textos de `habiteka-app`
  (landing, `/proyectos`, guía de uso `docs/guia-de-uso.md`, PRD
  `docs/prd-inmueble-verificable-inmersion-video-catalogo.md`).

## Credenciales (solo nombres)

- `HABITEKA_USUARIO` / `HABITEKA_CLAVE`: no necesarios; la sesión de captura la
  abre el dev-login local (enlace «Entrar como admin (modo desarrollo)» en
  `/acceder`), que solo existe con `NODE_ENV != production` y
  `ENABLE_DEV_LOGIN=true`.
