# F4 · Decoración interactiva con recomendaciones de IA

**Estado: ✅ COMPLETADA.** Rama: `feat/canvas/decoracion-materiales-luces`. Etapa B.
Verificado: typecheck OK, eslint OK, 8 tests de `decoracion`. Code-review agrupado con la tanda.

## Objetivo

La IA RECOMIENDA decoración según objetivo + estilo + lo que ya hay en el plano ("para una sala
acogedora, te sugiero una alfombra bajo la mesa"). El usuario ACEPTA o RECHAZA cada sugerencia; al
aceptar, el elemento se añade como OBJETO real del plano (editable), reusando el catálogo (F-CAT).

## Decisiones tomadas con el usuario

- **Materialización = objetos del catálogo, editables.** La IA recomienda un `kind` del catálogo +
  posición; aceptar añade el objeto al store (reusa `addObject` y las formas de F-CAT). Quedan
  editables y entran en el render por el flujo normal. (No "solo prompt".)
- **Disparador = botón explícito "Sugerir decoración"** en el editor del plano. Control claro del
  usuario y del coste (1 llamada de chat por clic).

## Diseño

- **Contrato** `src/lib/contracts/decor-recommendation.ts`:
  `DecorRecommendation = { kind: StructKind; x: number; y: number; motivo: string }`.
- **Server Action** `recommendDecoration(projectId, rawDoc, estilo, objetivo)`:
  - Acota por org (IDOR) como `generateDesignFromCanvas`.
  - Deserializa el doc, lo describe (serializeDocToPrompt) y pide al chat (responseSchema) una
    lista de recomendaciones.
  - VALIDA cada `kind` contra `CATALOG_BY_KIND` (descarta los desconocidos) y acota la posición a
    números finitos. Devuelve `DecorRecommendation[]`.
- **UI** `decor-suggestions-dialog.tsx`: botón en el workspace abre el diálogo; lista cada
  sugerencia con su motivo y botones aceptar/rechazar. Aceptar → `store.addObject` con el tamaño
  por defecto del catálogo en la posición sugerida.

## Archivos a crear/modificar

- crear `src/lib/contracts/decor-recommendation.ts` (tipo) + export en `contracts/index.ts`.
- modificar `src/server/agent/...` — función pura `decorRecommendationPrompt` + schema; lo más
  limpio: un módulo `phases/decoracion.ts` (recomendación), no mezclar con entrega.
- crear Server Action `recommendDecoration` en `_actions/agent-actions.ts`.
- crear `src/components/canvas/decor-suggestions-dialog.tsx`.
- modificar `canvas-workspace.tsx` (botón + prop `recommendAction`) y `page.tsx` (cablear la action).

## TDD / Validación

- TDD piezas puras: `decorRecommendationPrompt` (incluye estilo/objetivo/plano); el VALIDADOR de
  recomendaciones (descarta kinds fuera del catálogo, posiciones no finitas). NO se testea la
  calidad de la sugerencia (IA).
- Regresión: el flujo de generar diseño no cambia; añadir objeto reusa el store ya testeado.
- Verificación: typecheck, eslint, tests focales.

## Riesgos y rollback

- Riesgo medio: nueva Server Action (superficie). Mitigado: acota por org (IDOR), valida kinds
  contra el catálogo (no inserta basura), acota posiciones. 1 llamada de chat por clic (coste
  acotado y explícito).
- Rollback: quitar el botón + action; el resto del editor no cambia.

## Fuera de alcance (anotado)

- Recomendaciones de elementos SIN forma en el catálogo (cortinas, cuadros) → quedarían para el
  prompt del render (F3) o ampliar el catálogo (F-CAT); aquí solo kinds existentes.
- Colocación inteligente que evite solapes → primera versión coloca en la posición sugerida; el
  usuario reposiciona si hace falta (el plano es editable).

## Checklist de entrega

- [x] Contrato `DecorRecommendation` + export.
- [x] `decorRecommendationPrompt` + schema + validador `parseRecommendations` (8 tests puros).
- [x] Server Action `recommendDecoration` (IDOR vía assertProjectInOrg + validación de kinds/posición).
- [x] UI: botón "Sugerir decoración" + diálogo aceptar/rechazar → addObject (id con randomUUID).
- [x] Verificación: typecheck, eslint, tests focales.
