# F2 — Geometría → plano profesional (estilo CAD)

**Objetivo:** a partir de `SketchGeometry` normalizada (o de un doc del editor 2D actual),
generar un plano vectorial con aspecto de plano técnico de arquitectura: muros con doble
línea/relleno, puertas con arco de barrido, ventanas con símbolo estándar, cotas exteriores,
etiquetas de habitación con superficie en m².

## Contexto

- 100 % determinista: mismo input → mismo plano. Sin IA en esta fase.
- Salida primaria SVG (server-safe, exportable a PNG para F3). El editor Konva puede consumir
  la misma geometría después; no acoplar el renderer al editor.
- Convenciones de dibujo: grosor de muro real a escala, cotas encadenadas por fachada,
  simbología estándar (puerta = hueco + arco 90°, ventana = triple línea).

## Requisitos

1. Módulo `src/server/plan/` (o `src/lib/plan-render/` si debe ser isomorfo):
   - `geometry-to-svg.ts`: renderer principal.
   - `dimension-lines.ts`: cálculo de cadenas de cotas por lado.
   - `architectural-symbols.ts`: puertas, ventanas, escaleras.
2. Estilos: línea negra sobre blanco, tramas opcionales, tipografía técnica; parámetros en un
   objeto de tema (sin hardcodear colores por todo el código).
3. Conversión `SketchGeometry` → doc del editor 2D (aterrizar en canvas como muros editables),
   reutilizando tipos de `src/canvas/types.ts` y UUIDs (`crypto.randomUUID()`, convención ya fijada).
4. Rasterizado SVG → PNG server-side para alimentar F3 (ver `rasterize-canvas-doc.ts` existente
   como referencia/reuso).

## Archivos

- Crear: `src/server/plan/geometry-to-svg.ts`, `dimension-lines.ts`, `architectural-symbols.ts`
- Crear: `src/canvas/sketch-to-doc.ts` (geometría → documento editable)
- Reusar/extender: `src/server/agent/canvas/rasterize-canvas-doc.ts`

## Validación

- Tests con snapshots SVG de fixtures geométricas (sala rectangular, L, con aberturas).
- Comprobación visual: el plano de un boceto del set F1 debe leerse como plano técnico.
- Cotas: suma de cadenas parciales = cota total por fachada (test aritmético).

## Riesgos

- Geometría no ortogonal residual rompe cotas encadenadas → cotas solo sobre tramos
  ortogonales en v1; diagonales con cota simple punto a punto.
