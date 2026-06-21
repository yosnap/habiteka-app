# F5b · Borrador de decoración y materiales

**Estado: ✅ COMPLETADA.** Rama: `feat/canvas/decoracion-materiales-luces`. Etapa B.
Verificado: typecheck OK, eslint OK, tests focales (3 nuevos de `memoriaPrompt`). Code-review
agrupado con la tanda de fases de la rama.

## Objetivo

La etapa intermedia entre el plano y las vistas: la IA PROPONE materiales/acabados concretos
(suelo, paredes, tapizados…) según objetivo + estilo, aprovechando las medidas reales del plano
(escala F0) para dar cantidades cuando es posible. Reusa el entregable `memoria` que YA existe.

## Decisión de scope (KISS)

- F5b NO crea un modelo nuevo de "borrador": **enriquece el prompt del entregable `memoria`** para
  que produzca una memoria de materiales ÚTIL y estructurada, en vez del texto trivial actual
  (`"Memoria de materiales para un espacio estilo X"`).
- Aprovecha lo que ya llega a `DeliveryInput`: `estilo`, `objetivo` y, si viene del plano,
  `sketch.description` (que ya incluye medidas reales gracias a F0). No hace falta tocar contratos.
- "Que las vistas reflejen los materiales" se queda FUERA de F5b (conecta con F3/F4): aquí el foco
  es producir el borrador de materiales en sí. Anotado como futuro.

## Archivos a modificar

- `src/server/agent/phases/entrega.ts` — `memoriaPrompt(input)` pasa de una línea trivial a un
  prompt que pide una memoria estructurada (suelo, paredes, iluminación textil, tapizados, paleta)
  acorde al estilo + objetivo, e incorpora `sketch.description` (con medidas) cuando existe para
  estimar cantidades. Función pura (testeable).

## TDD / Validación

- TDD del prompt (puro): `memoriaPrompt` incluye estilo y objetivo; si hay sketch, incorpora la
  descripción del plano; pide secciones de materiales. NO se testea la calidad del texto generado
  (IA no determinista).
- Regresión: el entregable `memoria` sigue siendo `{ type:'memoria'; markdown }` (sin cambio de
  contrato); `MaterialsMemo` lo muestra igual.
- Verificación: typecheck, eslint, tests focales (`tests/agent/delivery`).

## Riesgos y rollback

- Riesgo bajo: solo cambia el texto de un prompt. Rollback = volver al prompt anterior.
- El coste no cambia (la memoria ya hacía una llamada de chat dentro del cobro de la entrega).

## Fuera de alcance (anotado)

- Que el RENDER use los materiales del borrador → conecta con F3/F4 (prompt libre/decoración).
- Un editor interactivo de materiales (elegir/ajustar paleta en UI) → futuro.
- Cantidades exactas con despiece (m² por estancia, ml de rodapié detallado) → futuro; aquí
  estimación aproximada si la escala lo permite.

## Checklist de entrega

- [x] `memoriaPrompt` enriquecido (estilo + objetivo + descripción del plano con medidas) + test puro.
- [x] Verificación: typecheck, eslint, tests focales (12 en delivery.test.ts).
