# F1 — Boceto → geometría estructurada

> **Estado 2026-07-11: núcleo implementado.** Decisiones tomadas sobre lo planificado:
> - No se creó contrato `SketchGeometry`: la salida es el `Plano2dPayload` existente (DRY).
> - No se añadió rol de modelo nuevo: se reutiliza la acción `vision` (ya configurable en
>   admin) y se evita una migración de Prisma. Si el bench pide un modelo distinto para
>   bocetos, se añade el rol entonces.
> - Implementado: `sketch-types.ts`, `extract-sketch-geometry.ts` (schema+prompt+validador),
>   `normalize-geometry.ts` (grafo de vértices: snap + restricciones de ortogonalidad con
>   union-find), Server Action `extractPlanFromSketch` en agent-actions.ts, 16 tests.
> - Pendiente: bench con 5–10 bocetos reales (necesita API key / lo lanza Paulo) y la UI de
>   entrada (aterrizará con la conversión a doc editable de F2).

**Objetivo:** una foto de un boceto mal dibujado (papel, pizarra, servilleta) se convierte en
un JSON de geometría validado: muros como segmentos, aberturas (puertas/ventanas) ancladas a
muros, habitaciones etiquetadas y escala estimada.

## Contexto

- Patrón base existente: `src/server/agent/phases/deteccion-layout.ts` (visión → JSON con
  schema estricto + validador que descarta lo inválido sin fallar). Se extiende, no se duplica.
- Diferencia clave con la detección actual: aquella devuelve bboxes de OBJETOS; F1 necesita
  TOPOLOGÍA de muros (segmentos p1–p2 conectados, grosor, aberturas con offset sobre el muro).
- Cliente OpenRouter ya resuelto: `src/server/ai/client/gateway-client.ts` + structured output
  vía `chat-vision-adapter`.

## Requisitos

1. Contrato nuevo `SketchGeometry` en `src/lib/contracts/`: muros (segmentos), aberturas
   (tipo, muro, offset, ancho), habitaciones (polígono o referencia a muros, etiqueta), escala.
2. Prompt de extracción + schema JSON para el modelo de visión (configurable en admin, rol
   nuevo p. ej. `sketchVision`; NO hardcodear — deuda registrada del pipeline designRender).
3. Normalización geométrica determinista (código, sin IA):
   - ortogonalizar segmentos casi horizontales/verticales (tolerancia angular),
   - snap de vértices cercanos (cerrar esquinas),
   - unificar grosor de muro,
   - escalar a metros con la escala estimada o valor por defecto.
4. Validador frontera de confianza: descartar segmentos degenerados, aberturas fuera de rango.

## Archivos

- Crear: `src/lib/contracts/sketch-geometry.ts`
- Crear: `src/server/ai/sketch/extract-sketch-geometry.ts` (llamada visión + parseo)
- Crear: `src/server/ai/sketch/normalize-geometry.ts` (puro, testeable sin red)
- Modificar: config de roles de modelo en admin (`model-defaults.ts`, `model-config-loader.ts`)

## Validación

- Tests unitarios de normalización con fixtures (esquinas abiertas, muros torcidos, escala).
- Set de 5–10 bocetos reales de prueba en `plans/260711-1018-planos-ia-boceto-y-render/reports/`
  con la salida JSON para evaluar precisión por modelo (Gemini Flash vs Pro vs alternativas).

## Riesgos

- Modelos de visión estiman mal coordenadas exactas → mitigación: la normalización corrige;
  medir con el set de prueba antes de afinar prompt.
- Bocetos en perspectiva (no cenitales) → fuera de alcance F1: exigir boceto en planta.
