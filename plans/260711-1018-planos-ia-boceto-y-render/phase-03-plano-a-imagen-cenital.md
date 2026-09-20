# F3 — Plano → imagen cenital avanzada

**Objetivo:** del plano técnico (F2 o editor actual) generar una imagen cenital fotorrealista
("dollhouse top-down" como hacen Planner5D/Homestyler/renders IA actuales) que RESPETE la
disposición: mismas habitaciones, aberturas y proporciones.

## Contexto — por qué falló antes

El pipeline designRender previo (Gemini Vision → Flux 1.1 Pro Ultra) describía el plano en
TEXTO y Flux generaba desde cero → el modelo inventaba la disposición (cocina donde iba un
dormitorio, etc.). Fix arquitectónico: el modelo de imagen debe recibir el plano como IMAGEN
de condicionamiento (image-to-image / edición), no como descripción textual.

## Requisitos

1. Pipeline en `src/server/ai/design/` (sustituye al designRender hardcodeado):
   - Entrada: PNG del plano (raster F2) + metadatos (etiquetas de habitación, estilo elegido).
   - Paso 1: prompt estructurado por habitación (tipo, mobiliario esperado, materiales) generado
     desde los datos del doc — NO pedir a un modelo que "adivine" el plano.
   - Paso 2: generación image-to-image con el raster como referencia. Candidatos OpenRouter:
     Gemini image (nano-banana, ya hay provider), y evaluar alternativas con soporte de imagen
     de entrada. Flux text-only queda descartado para este paso.
2. Modelos configurables vía admin (rol `designRender` conectado a `model-config-loader.ts`),
   cerrando la deuda del hardcodeo temporal.
3. Integración con deliverable `render3d`→ renombrar/añadir tipo semántico si procede
   (p. ej. `cenital`) sin romper el contrato `DeliverableType` existente salvo acuerdo.
4. Bench de fidelidad: mismo plano → N modelos → tabla comparativa (respeto de layout,
   calidad, coste por imagen) en `reports/`.

## Archivos

- Crear: `src/server/ai/design/cenital-pipeline.ts`, `room-prompt-builder.ts`
- Modificar: `src/server/ai/image/providers/nano-banana.ts` (asegurar paso de imagen de entrada),
  `provider-image-adapter.ts`, config admin de roles.
- Reusar: spend-guard, costes, asset storage.

## Validación

- Test de contrato del pipeline con provider stub (sin red).
- Bench manual con 3+ planos distintos; criterio: disposición reconocible al superponer
  mentalmente plano e imagen (habitación por habitación).

## Riesgos

- Ningún modelo respeta el layout al 100 % → medir primero; si hace falta, generar por
  habitación y componer, o bajar la exigencia a "cenital estilizado" en v1.
- Coste por iteración → spend-guard ya existente; límites por proyecto.
