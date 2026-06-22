# Editor de canvas usable — plan

**Objetivo:** convertir el canvas (hoy un prototipo a medio hacer) en un editor de
planos usable: seleccionar/mover/redimensionar/borrar objetos sin crear duplicados,
un catálogo de objetos colocables (muebles, sanitarios, TV…), y lienzos de ejemplo.

**Diagnóstico (verificado en el código):**
- `canvas-stage.tsx onPointerDown` **no tiene rama `select`**: cualquier clic con
  una herramienta estructural CREA un objeto. Por eso "al hacer clic se crean más"
  y "no puedo redimensionar" (nunca llegas a seleccionar).
- Los objetos son `Rect` planos de colores → "rectángulos marrones", no formas
  reconocibles.
- **No hay catálogo de muebles/objetos**: solo `wall/window/door` + `ProductRef`
  (marketplace, que además no tiene `onDrop` conectado).
- El store SÍ tiene `updateObject/removeObject/undo/redo` y un Transformer existe en
  `structure-layer` — la fontanería está, falta cablear la interacción.

## Fases (PRs independientes; el usuario decide commit/merge)

### EC-1 · Arreglar selección y edición (desbloqueante)
- `canvas-stage onPointerDown`: con `tool === 'select'`, un clic en vacío
  deselecciona; el clic en un objeto lo selecciona (ya lo hace la capa). Las
  herramientas de creación crean **una vez** y vuelven a `select` (no quedan
  "armadas" creando en cada clic).
- Verificar Transformer: con objeto seleccionado, mover/redimensionar/rotar y que
  persista (ya hay `onDragEnd/onTransformEnd` → store).
- Tecla Supr / botón "Eliminar selección" → `removeObject`.
- **Resultado:** se puede seleccionar, mover, redimensionar y borrar sin duplicar.

### EC-2 · Catálogo de objetos colocables (muebles/sanitarios/TV)
- Nuevo tipo en el modelo: `PlacedObject` (o ampliar `StructObj` con más `kind`):
  `sofa | cama | mesa | silla | inodoro | lavabo | ducha | tv | nevera | …`, con
  `x/y/width/height/rotation` (editable, igual que los estructurales).
- `serialize`/`deserialize` extendidos (subir `schemaVersion` a 2, con migración
  que no rompe proyectos guardados).
- **Paleta de objetos** en la toolbar/lateral: categorías (Estructura · Sanitarios ·
  Mobiliario · Electrónica) con iconos; clic o arrastrar para colocar.
- Render reconocible: icono/emoji o forma simple por tipo (no solo rectángulos).

### EC-3 · Lienzos de ejemplo
- Seed dev: 2-3 proyectos con lienzos YA montados (p. ej. "Salón ejemplo",
  "Baño ejemplo") con muros, puerta, ventana y algún mueble colocados con sentido,
  para que el usuario vea el resultado esperado y tenga punto de partida.
- Botón "Empezar desde una plantilla" al crear proyecto (opcional).

### EC-4 · Pulido de interacción (si se aprueba)
- Snapping a rejilla y a otros objetos; cursor por herramienta; zoom/pan; cotas.
- Conectar marketplace drop (`onDrop` en el stage → `productDropToRef` → store),
  que hoy está declarado pero sin cablear.

## Decisiones tomadas (usuario)
- **Catálogo AMPLIO por categorías**: Estructura · Sanitarios · Cocina · Mobiliario ·
  Electrónica · Iluminación, con varios objetos por categoría.
- **Formas vectoriales por tipo** (vista de planta arquitectónica), no iconos/emoji.
- **EC-4 incluido** en esta tanda (snapping a rejilla, zoom/pan, drop del marketplace).

Orden de ejecución verificado por fase (pruebo cada una en el navegador):
EC-1 (selección/edición) → EC-2 (catálogo + formas vectoriales) → EC-4
(snapping/zoom/drop) → EC-3 (lienzos de ejemplo, al final para mostrar todo junto).

## Fuera de alcance
- Edición 3D, importación de planos CAD, medidas reales a escala arquitectónica.

## Verificación
- Pruebo cada fase YO en el navegador (Chrome DevTools MCP) antes de darla por buena.
- typecheck + lint + build verdes por fase.
