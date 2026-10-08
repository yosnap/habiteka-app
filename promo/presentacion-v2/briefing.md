# Briefing — Habiteka · presentacion-v2 (variación de formato)

## Prompt del dueño (2026-10-06, segunda pasada)

El primer vídeo (`presentacion`) se parece demasiado a otros vídeos anteriores
y la música suena igual. Se pide **otra variación, con formato totalmente
distinto**:

- **No** una secuencia plana de capturas a pantalla completa.
- Piezas variadas: «fichas en tabs» → en el catálogo, **pila, detalle,
  abanico, lista y mosaico** sobre la dirección **dinámica** (fondo, posición
  y animación de título distintos en cada escena, transiciones a tempo).
- **Nueva narrativa**: hablar de la *necesidad* de una herramienta así; el
  **usuario de casa** la moldea (planifica y diseña con IA) y luego un
  **profesional/decorador** termina de dar forma a lo planificado.
- **De momento, sin audio**: solo texto (subtítulos). Se entrega además una
  copia muda del MP4 (el motor genera la mezcla por dentro; la copia se saca
  con `ffmpeg -an` solo para esta revisión).

## Decisiones del motor

- **Formato de las escenas** (todo lo que ya no fue «una captura a pantalla
  completa con cámara serena»):
  1. `gancho` — rótulo con subtítulo (oscuro o acento según la semilla).
  2. `problema` — segundo rótulo: la duda que no resuelve un plano.
  3. `casa` — **pila**: landing, proyectos y plano entran volando y se apilan.
  4. `boceto` — **detalle**: el botón «Diseñar con IA» del editor se despega
     como tarjeta flotante sobre la pantalla.
  5. `borrador` — **abanico**: plano, editor y asistente se despliegan en
     abanico 3D.
  6. `profesional` — **lista** con checks sobre la galería de diseños: el
     último paso del profesional.
  7. `resultados` — **mosaico**: ráfaga de pantallas (diseños, editor,
     plano, proyectos).
  8. `cierre` — logo con lema «Tú lo planificas. El profesional lo termina.»
     y botón «Empezar gratis».
- **Núcleo narrativo**: necesidad → el usuario de casa planifica con IA →
  el profesional da el último paso → resultados (renders, recorrido, vídeo).
  Evidencia: `docs/prd-inmueble-verificable-inmersion-video-catalogo.md`
  (sectores: inmobiliaria, interiorista, tienda de muebles; «responsable que
  aprueba»), `docs/guia-de-uso.md` (aprobación, versiones, vídeos).
- **Capturas**: las mismas que `presentacion` (proyecto demo **FInca**,
  dev-login local); la galería de diseños sin abrir el diálogo (la v2 la usa
  como rejilla, no como imagen grande). El storage (`localhost:9000`) sigue
  en `origenesPermitidos` para que las imágenes de la app carguen.
- **Sin voz**: `voz: ninguna`; el texto viaja en subtítulos. La duración la
  marcan las frases estimadas (14 caracteres/segundo).
- **Música (solo interior por ahora)**: *ambiental*, 88 bpm, Fa# menor,
  semilla 7 — distinta de las anteriores (La menor 104, Re mayor 84/124,
  Mi mayor 116). Si al final se quiere banda, se genera con la v2 ya vista.

## Credenciales (solo nombres)

- Sin variables: la sesión de captura la abre el dev-login local (enlace en
  `/acceder`), solo activo en local con `ENABLE_DEV_LOGIN=true`.
