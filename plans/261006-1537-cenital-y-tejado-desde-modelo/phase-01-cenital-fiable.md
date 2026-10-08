---
phase: 1
title: "Cenital fiable: prompt corto, muebles por importancia, modo Controlado e imágenes que no se pierden"
status: completed
priority: P1
effort: "3h"
dependencies: []
---

# Fase 1: cenital fiable

## Objetivo

La cenital vuelve a generarse con gpt-image-2 (y cabe en Flux), nombra los muebles que importan, respeta Estricto, Controlado y Libre, y una imagen ya cobrada no se pierde si falla la revisión visual.

## Contexto

- El commit `854759a` cambió `habiteka-plan-simple-v3` por `v4`, que añade `exteriorPlanRule` y `criticalFixtureRule` con JSON en bruto. El prompt pasa a 21 444 caracteres en el proyecto Test 6. Con la v3, la cenital pasó la auditoría con gpt-image-2. Con la v4, KIE da `api_500`, Flux supera su límite de 5000 caracteres y Gemini reinventa la distribución.
- `MAX_ITEMS_PER_ROOM = 6` (`furniture-views.ts`) recorta por orden del documento: deja fuera la chimenea, el mueble de TV, las sillas y los taburetes y conserva la cafetera.
- En la cenital, el prompt de Controlado es idéntico al de Libre.
- `reviewRenderFidelity` relanza los errores del proveedor y la imagen pagada no se guarda.
- Informe: `plans/reports/diagnostico-261006-1726-generacion-imagenes-cenital-y-cubiertas.md`.

## Ficheros

- Crear: `src/server/agent/editor-v2/plan-prompt-inventory.ts`, con resúmenes breves del exterior y de los sanitarios y la placa para la cenital.
- Modificar: `src/server/agent/editor-v2/simple-plan-prompt.ts` (versión `habiteka-plan-simple-v5`, usa los resúmenes y la regla por libertad).
- Modificar: `src/server/agent/editor-v2/furniture-views.ts` (orden por importancia, sin piezas apoyadas sobre otras, sin el sufijo «· modelo 3d»).
- Modificar: `src/server/agent/editor-v2/rasterize-editor-document.ts` (exportar los límites del plano para situar el exterior en tercios de la imagen).
- Modificar: `src/server/agent/editor-v2/prepare-render-image-request.ts` (pasar los límites).
- Modificar: `src/app/(app)/projects/[id]/_actions/agent-actions.ts` (si la revisión falla por el proveedor, guardar la imagen como descartada con un motivo claro).
- Tests: `tests/agent/furniture-views.test.ts` y un test nuevo `tests/agent/plan-prompt-inventory.test.ts`.
- Docs: la página del Estudio de diseño en `docs/site/src/content/docs/` y las novedades.

## Pasos

1. `plan-prompt-inventory.ts`:
   - `exteriorPlanSummary(elements, bounds)` agrupa superficies por material, setos por tipo y altura (número de tramos), vegetación por tipo (recuento) y equipamiento y vehículos por nombre, con su posición en tercios de la imagen (arriba, abajo, izquierda, derecha, centro). Va precedido de una regla corta: conserva el exterior, cada vehículo sigue siendo un vehículo del mismo tipo y orientación, y no se añade paisaje.
   - `fixturePlanSummary(groups, rooms)` da por estancia (con su posición para distinguir dos «BAÑO») los recuentos en castellano (inodoros, lavabos, bidés, bañeras, duchas, fregaderos, placas de cocción) y la regla de no duplicar ni omitir.
   - Los dos resúmenes tienen tope de longitud, sin UUID ni coordenadas.
2. `furniture-views.ts`: agrupar por etiqueta y ordenar por niveles. Primero camas y sofás, luego muebles grandes y fijos (armarios, chimenea, mesas, mueble de TV, sanitarios), luego asientos y, al final, electrodomésticos, pantallas, lámparas y plantas. Dentro de cada nivel, por superficie total. Se omiten las piezas con `elevationMm > 0` (televisor sobre su mueble, lámpara sobre la mesita, campana). Se limpia el sufijo «· modelo 3d», y el tope pasa a 10 grupos por estancia.
3. `simple-plan-prompt.ts`:
   - Sustituir `exteriorPlanRule` y `criticalFixtureRule` por los resúmenes.
   - Regla por libertad: Estricto «conserva solo el mobiliario dibujado»; Controlado «solo puedes añadir: …», o «no añadas objetos» si no hay categorías; Libre «completa la decoración según su uso, sin construir».
   - Subir la versión a `habiteka-plan-simple-v5`.
4. `agent-actions.ts`: envolver `reviewRenderFidelity`. Si lanza un `AiError` de proveedor (timeout, caída, saldo, saturación), se persiste el entregable con `review: { status: 'rejected', reason }`. El motivo explica que la revisión visual no se completó, qué modelos fallaron y que la imagen puede revisarse con «Revisar un PNG externo». Los demás errores siguen lanzándose.
5. Tests: longitud del prompt menor de 5000 con un documento grande (11 estancias, 4 vehículos, 6 sanitarios por baño). Comprobar que la chimenea y las sillas entran y la cafetera queda detrás, que Controlado lista sus categorías y Estricto no permite añadir, y que no aparecen UUID.
6. Documentar en la guía de usuario: cenital, libertades y revisión que no pudo completarse.

## Verificación

- `npx vitest run tests/agent/furniture-views.test.ts tests/agent/plan-prompt-inventory.test.ts tests/agent/render-image-request.test.ts tests/agent/exterior-render-fidelity.test.ts`
- `npx tsc --noEmit -p .` y `npm run lint`
- Reconstruir el prompt de Test 6 (revisión 49): menos de 5000 caracteres y con la chimenea, las sillas, los vehículos y los recuentos de sanitarios.

## Riesgos

- Un prompt más corto da menos pistas que el JSON. Se compensa porque el plano 2D dibuja cada elemento y la auditoría sigue usando el inventario completo.
- Cambiar el orden de los muebles cambia el texto de la cenital, pero no las secciones, que usan la lectura de la cenital aceptada.
