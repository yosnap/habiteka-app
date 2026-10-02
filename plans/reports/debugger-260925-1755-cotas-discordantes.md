# Diagnóstico: bloqueo por `cotas-generales-discordantes`

Fecha: 2026-09-25 · Rama develop, sin cambios en `src/`.

> **Rectificación posterior:** el resumen `ajustesAplicados:0` y
> `desviacionCotasPct:null` no prueba que las medidas de las estancias encajen.
> `fitPlanToDimensions` solo registra correcciones de restricciones activas;
> también puede no encontrar muros aplicables o saltarse un contorno. La
> desviación se calcula solo sobre esas correcciones, así que `null` significa
> «sin residuo medido», no «residuo cero». Las inferencias de consistencia local
> y la recomendación de ignorar la cota general que figuran abajo quedan
> **descartadas** hasta conservar el JSON crudo y medir cobertura por estancia.

## Dónde se genera (hallazgo 1)

`cotas-generales-discordantes` **no la decide Jev**. Es una comprobación determinista en
`src/server/plan/build-plan-import.ts:199-220` (`generalDimensionsMismatch`):

- Compara `raw.anchoMetros/altoMetros` (cotas generales que el modelo de visión dice haber
  leído) contra el bounding box de los polígonos de habitaciones que el mismo modelo devolvió,
  convertido a mm con `prepared.scale` (`src/server/ai/sketch/reliable-scale.ts`).
- Tolerancia: **5 %** (`best.error <= 0.05`, línea 214) sobre el lado peor (ancho o alto).
- Si se supera, añade el warning con el código `cotas-generales-discordantes`.

Ese código está en la lista dura de `blockingPlanImportWarning`
(`src/lib/plan-quality.ts:31-37`). En `src/server/plan/import-plan-from-image.ts:76-82`,
si aparece cualquiera de esos códigos, **se corta antes de llamar a Jev**: `decision:'block'`,
`score:null`, y **`evaluateCheckpoint` nunca se ejecuta, así que nunca se escribe en
`ai_quality_evaluation`**. Es un gate de código, no un juicio de Jev, y es invisible en la BD
histórica.

(Hay una señal distinta y real de Jev sobre cotas: la pregunta que usa
`evidence.desviacionCotasPct` — comparación post-ajuste con tolerancia ~10 % en
`src/server/quality/checkpoints.ts:79-125` — que sí pasa por Jev y sí se guarda. No hay que
confundirlas.)

## Causa con los datos reales (hallazgo 2)

El script de la prueba (`run.ts`) no persistió el JSON crudo (`anchoMetros`/`altoMetros`/
polígonos), solo el resumen de evidencia agregado (`avisosPorTipo` por código, sin el texto del
warning con los números). No puedo dar la tabla numérica pedida sin una llamada nueva al modelo
de pago, que las restricciones prohíben (marco esto como pregunta abierta, no como bloqueo del
diagnóstico).

Lo que sí se prueba con el código y la evidencia agregada:

| Imagen | cotasEscritas | escalaEstimada | ajustesAplicados | desviacionCotasPct | blocking |
|---|---|---|---|---|---|
| kie/caade486 | 0 | true | 0 | null | (2048: sin bloqueo; 1280: `muro-solo-modelo`) |
| studio/94326743 (2048 y 1280) | 5 | false | 0 | null | `cotas-generales-discordantes` |
| studio/dc2df084 (2048 y 1280) | 11–13 | false | 0 | null | `cotas-generales-discordantes` |
| studio/ef18df8e (2048 y 1280) | 11 | false | 0 | null | `cotas-generales-discordantes` |
| studio/9cc5e26f (1280) | 0 | false | 0 | null | `ajuste-desplaza-muros` |

Lectura: en las 3 imágenes bloqueadas por esta causa, el modelo devolvió 5–13 cotas
por estancia. La ausencia de ajustes y de residuo medido no dice si esas cotas
encajan: podrían estar ya dentro de tolerancia o no haberse podido aplicar.
La cota general podría corresponder a una referencia distinta (interior,
ejes o extremos exteriores), estar mal leída o señalar geometría incompleta.
Con este agregado no se puede distinguir entre esas causas.

**Pregunta que necesita el JSON crudo (o una llamada nueva) para cerrarse del todo**: confirmar
viendo la imagen si `anchoMetros/altoMetros` corresponden a una cota real rotulada o si el
modelo la infirió/alucinó. No se ha hecho esa llamada (regla de no gastar en modelos de pago).

## Frecuencia histórica (hallazgo 3)

`ai_quality_evaluation`, checkpoint `plan_extraction`, 24 filas: 9 `block`, 8 `confirm`,
7 `proceed`. **Ninguna fila puede llevar el motivo `cotas-generales-discordantes` literal**,
porque ese código nunca llega a Jev ni a la BD (ver hallazgo 1) — es un punto ciego de
observabilidad, no que la causa sea rara. La señal más cercana medible en BD es la pregunta de
Jev sobre cotas (`desviacionCotasPct`): su reason "Las medidas calculadas no cuadran con las
cotas escritas en el plano." aparece en **8 de 24** filas (33 %), todas con `decision:block`
(scores 35–39 y 55). Los otros motivos de `block` frecuentes en esas mismas filas: "La lectura
del plano no reproduce con fidelidad la imagen original.", "Alguna estancia no ha quedado
cerrada...", "Los muros medidos en la imagen y los leídos por el modelo no coinciden.".

## Opciones de arreglo (sin implementar)

1. **Relajar la tolerancia y/o degradar a Jev en vez de bloqueo duro.** Subir el 5 % (p. ej. a
   10-15 %, alineado con el umbral que ya usa la pregunta de Jev sobre `desviacionCotasPct`) y/o
   sacar `cotas-generales-discordantes` de `blockingPlanImportWarning` para que sea una señal
   más que Jev pondera, no un corte automático. Pros: menos falsos bloqueos, una sola vía de
   decisión. Contras: pierde el "nunca generar con cotas mal leídas" duro que probablemente se
   quiso a propósito. Ficheros: `src/server/plan/build-plan-import.ts`, `src/lib/plan-quality.ts`.
2. **Medir cobertura y referencia de las cotas locales.** Contar cuántas cotas
   escritas pudieron contrastarse con muros y registrar su residuo, incluso
   cuando no hubo corrección. Solo entonces comparar la cota general con el
   perímetro según su referencia (interior, ejes o extremos exteriores).
   `ajustesAplicados === 0` no basta para ignorar la cota general. Ficheros:
   `build-plan-import.ts`, `fit-to-dimensions.ts`, `plan-evidence.ts`.
3. **Añadir observabilidad al camino de bloqueo duro.** Aunque no se cambie el umbral, registrar
   (sin gastar en Jev) estos bloqueos deterministas en la misma tabla o en logs, para poder medir
   su frecuencia real en producción — hoy es invisible (hallazgo 3). Pros: barato, no cambia
   comportamiento. Contras: no arregla el bloqueo en sí, solo lo hace medible. Ficheros:
   `src/server/plan/import-plan-from-image.ts`, quizá `src/server/quality/result-repo.ts`.

Recomendación revisada: mantener el bloqueo mientras faltan los datos crudos;
instrumentar la opción 3 y la cobertura de cotas locales antes de modificar el
umbral. La causa exacta en las tres imágenes sigue sin estar demostrada.

## Preguntas sin resolver

1. Sin ver el JSON crudo de extracción (no persistido por `run.ts`) no puedo confirmar, imagen
   por imagen, si `anchoMetros/altoMetros` es una alucinación del modelo o una cota real mal
   asignada — requeriría una llamada de pago o repetir la prueba guardando el `RawSketch`
   completo.
2. La cota general también entra en `fitPlanToDimensions` como restricción de
   peso menor cuando la desviación es moderada. Ignorarla modificaría el ajuste,
   además del bloqueo.

Status: DONE_WITH_CONCERNS
