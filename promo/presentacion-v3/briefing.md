# Briefing — Habiteka · presentacion-v3 (historia del dolor con fotografías)

## Prompt del dueño (2026-10-06, tercera pasada)

«Ya no solamente pantallas: quiero **fotografías** de lo que le pasa al usuario:
cuando quiere hacer un diseño, tiene que llamar a alguien / contratar a alguien;
cuando quiere construir, necesita un plano antes; para hacer el plano necesita
un arquitecto que lo valide; y no puede previsualizarlo a menos que le hagan
una maqueta. Hay que **contar todo eso**, crear ese dolor, y en la solución
entra Habiteka. De momento sin audio, solo texto.»

Además (decisión del dueño): las fotografías se **generan con KIE** (el
proveedor de imagen de la propia app), no con OpenRouter.

## Decisiones del motor

- **Fotografías generadas con KIE** (modelo `google/nano-banana`, la clave
  cifrada de la app): 4 imágenes 1344×768 (16:9) en `presentacion-v3/fotos/`:
  - `llamada.png` — dueña en el sofá, llamada, cara de duda.
  - `plano.png` (id `bocetos`) — mesa con planos y bocetos apilados.
  - `arquitecto.png` — reunión con el arquitecto ante unas láminas.
  - `maqueta.png` — maqueta a escala sobre la mesa, mirada incierta.
  El generador fue `scripts/tmp-promo-fotos.ts` (temporal, de la app; no se
  commitea). Estilo común a las cuatro: fotorealista, luz cálida, película
  35 mm, 16:9 — coherencia entre escenas.
- **Nueva pieza del catálogo: `foto`** (trabajo del motor, según las reglas):
  descriptor en `motor/piezas.mjs`, sección `fotos` en `esquema.mjs`,
  copia a `publico/fotos/` en `scripts/lib/compilar.mjs`, componente en
  `remotion/composiciones/foto.tsx`, ficha en el Studio (`ficha-foto`) y
  prueba de render de un fotograma en `tests/remotion.test.mjs`.
- **Guion en dos actos** (dolor → solución):
  1. Dolor (5 escenas): gancho «La reforma, sin sorpresas» → *llamada* →
     *bocetos/plano* → *arquitecto* → *maqueta*.
  2. Solución (4 escenas): rótulo «Hasta que existió Habiteka» → **pila**
     (landing, proyectos, plano: importas y lo conviertes) → galería de
     diseños (diseñas con IA, apruebas, el profesional da el último paso) →
     cierre con lema «Tú lo planificas. El profesional lo termina.» +
     habiteka.app.
- **Capturas de la app**: solo 4 (landing, proyectos, plano, galería de
  diseños del proyecto demo **FInca**); el storage `localhost:9000` en
  `origenesPermitidos` para que las imágenes de la app carguen.
- **Sin voz de momento**: `voz: ninguna`; texto en subtítulos. La música se
  genera por dentro del motor (exigida por el pipeline); se entrega además
  una **copia muda** (`ffmpeg -an`) para la revisión: la decisión de banda
  queda para cuando el guion y el formato se aprueben.
- **Estilo**: dirección **dinámica** (fondo/posición/animación distintos por
  escena, transiciones a tempo), semilla 9; música interior provisional:
  ambiental, 92 bpm, Re menor (nueva).

## Credenciales (solo nombres)

- Sin variables nuevas: el dev-login local abre la sesión de las capturas;
  KIE usa la clave que ya está cifrada en la base de datos de la app.
