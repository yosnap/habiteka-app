# F3 · Prompt libre + IA que explica sus propuestas

**Estado: ✅ COMPLETADA.** Verificado: typecheck OK, eslint OK, tests focales verdes (incl. 2 del
orchestrator: degradación de la explicación y render-only). Code-review sin críticos/altos; M1/L1
resueltos. Rama: `feat/canvas/f2-vistas-por-imagen`. Etapa B/C. Núcleo de interactividad.

**Decisión de cobro (con el usuario):** la 2ª llamada de chat (explicación) queda FUERA del cobro
(no contabilizada). Es un extra barato y degradable; el render ya está cobrado por el hold de
`runDelivery` (estimateCredits=1000, con margen). Coherente con que las llamadas de chat internas
de memoria/plano2d tampoco se cobran por separado. Si en el futuro se afina la facturación de IA,
revisar de forma transversal, no solo aquí.

## Objetivo

1. **Prompt libre:** el usuario escribe en lenguaje natural ("haz la sala más cálida", "añade
   plantas"). Se combina con la descripción estructurada del plano REFORZANDO que respete las
   posiciones (patrón de fidelidad CRL-4).
2. **IA explica:** además del render, la IA devuelve un TEXTO breve con lo que propuso y por qué
   ("centré el sofá para dejar paso a la puerta"). Llega a la UI tras generar.

## Decisiones tomadas con el usuario

- **Explicación = 2ª llamada de chat** tras el render (el modelo de imagen no devuelve texto útil
  — confirmado en F2). La llamada de chat es mucho más barata que la de imagen.
- **La explicación vive en `AgentOutcome` (efímero):** campo `explanation?: string`. NO se persiste
  con el deliverable (no toca el esquema). Si se recarga, se vuelve a ver al generar de nuevo.
- El prompt libre viaja por el mismo camino que `objetivo` (que añadió F1): input → ready →
  renderPrompt.

## Archivos a modificar

- `src/server/agent/orchestrator.ts` — `AgentInput['generate-from-canvas']` gana `promptLibre?:
  string`; `AgentOutcome` gana `explanation?: string`. `handleGenerateFromCanvas` pasa el prompt
  libre a la entrega y, tras generar el render, pide la explicación y la incluye en el outcome.
- `src/server/agent/phases/entrega.ts` — `renderPrompt(input)` incorpora el `promptLibre`
  reforzando respetar posiciones. Nueva función pura `explanationPrompt(input)` para la 2ª llamada.
  `runDelivery`/`DeliveryInput` transportan el `promptLibre` y, opcionalmente, devuelven la
  explicación (o se genera en el orchestrator tras runDelivery — decidir el punto más limpio).
- `src/lib/contracts/agent-state.ts` y el tipo de input que use la Server Action — propagar
  `promptLibre`.
- `src/app/(app)/projects/[id]/_actions/agent-actions.ts` — la Server Action acepta `promptLibre`
  (acotado en longitud, p. ej. 500) y lo pasa al `advance`.
- `src/components/canvas/generate-from-canvas-dialog.tsx` — textarea de prompt libre; mostrar la
  `explanation` devuelta tras generar.

## Diseño del prompt (fidelidad)

`renderPrompt` con prompt libre = descripción estructurada del plano (posiciones, que NO se deben
mover) + la instrucción libre del usuario como AJUSTE de estilo/ambiente. Orden: primero la
disposición estricta, luego "Además, el usuario pide: <promptLibre>. Respeta la disposición
anterior; el ajuste es de estilo/decoración, no de posiciones."

## TDD / Validación

- TDD para piezas PURAS: `renderPrompt` con/sin promptLibre (sin prompt libre = salida actual;
  con prompt libre = incluye la instrucción + el refuerzo de no mover posiciones). `explanationPrompt`
  determinista. NO se testea la calidad del texto generado (es IA → no determinista).
- Regresión: generar sin promptLibre = comportamiento actual (campo opcional). El outcome sin
  explanation sigue válido.
- Verificación: typecheck, eslint, tests focales (`tests/canvas/`, `tests/agent/orchestrator`).
  Suite completa solo al final (ya no borra el admin tras el fix de resetDb).

## Riesgos y rollback

- **Coste extra (+1 llamada de chat):** asumido y aceptado. La explicación solo se pide si hay
  render3d entre los entregables (no para plano2d/memoria).
- Campos `promptLibre`/`explanation` aditivos y opcionales → rollback = ignorarlos.
- La 2ª llamada de chat puede fallar sin tumbar el render: si la explicación falla, se devuelve el
  render igual y `explanation` queda ausente (degradación elegante).

## Fuera de alcance (anotado)

- Decoración recomendada como OBJETOS del plano (aceptar/rechazar) → F4.
- Materiales/acabados → F5b.
- Persistir la explicación en el historial → futuro (hoy efímera por decisión).

## Checklist de entrega

- [x] `promptLibre` en el input + propagación (Server Action acota a 500 con coerción → advance → sketch → renderPrompt).
- [x] `renderPrompt` combina prompt libre reforzando posiciones (+ tests puros en delivery.test.ts).
- [x] 2ª llamada de chat para la explicación; `explanation?` en AgentOutcome (try/catch degrada si falla; solo si hay render3d).
- [x] UI: textarea de prompt libre + mostrar la explicación tras generar (botón "Ver diseño").
- [x] Verificación: typecheck, eslint, tests focales (incl. 2 del orchestrator); code-review sin críticos.
