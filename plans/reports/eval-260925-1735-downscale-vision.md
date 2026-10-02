# Evaluación: bajar la imagen de `vision` de 2048 px a 1280 px

Fecha: 2026-09-25 · Rama: develop (sin cambios en la app) · Script y datos crudos: `scratchpad/downscale-eval/` (`run.ts`, `results.json`, `run.log`)

## Método

- **Modelo**: ruta primaria de la acción `vision` en la BD local → `google/gemini-3.7-flash` vía OpenRouter. Se usó solo esa ruta, sin failover.
- **Pipeline**: el mismo que `importPlanFromImage` con `source='plano'`: `extractSketchGeometry` (mismo prompt, `SKETCH_SCHEMA`, `maxTokens` 8192) → `extractPlanSymbols` cuando `needsSymbolPass` lo pide (normalmente 3 llamadas más) → `buildPlanImport` → `buildPlanEvidence` → `askJev` con las preguntas de `plan_extraction`, combinadas con `combineAnswers` y `decide` con los umbrales por defecto (85/60). También se aplica `blockingPlanImportWarning`, igual que en producción.
- **Llamada**: `OpenRouterChatVisionAdapter`, envuelto en un medidor, por debajo de `recordAiAttempt`. Jev se llamó con `askJev` directamente. **No se ha escrito nada en la BD.**
- **Downscale**: `sharp().resize({fit:'inside', withoutEnlargement:true})` a 2048 y a 1280 px, seguido de `sanitizeImageBuffer` (PNG sin metadatos). La detección raster de muros se hizo siempre sobre el original, así que entre las dos pasadas solo cambia la imagen que recibe el modelo, también en los recortes del pase de símbolos.
- **Imágenes**: hay 20 claves en la BD (refId de `ai_quality_evaluation` más `studioState.source` y `planImport.image`). **15 tienen el lado mayor ≤ 1280 px**, así que sus dos variantes serían idénticas y se descartaron. **Solo quedan 5 imágenes comparables** (4 de `studio/` y 1 de `renders/kie/`), menos de las 15 que se pedían.

## Resultados por imagen

"in" son los tokens de entrada de la llamada principal. El coste suma todas las llamadas de visión de la pasada. El score es el de Jev (0–100); entre paréntesis va la decisión de producción.

| Imagen (orig.) | in 2048 | in 1280 | Coste 2048 | Coste 1280 | Score 2048 | Score 1280 | Δ score |
|---|---|---|---|---|---|---|---|
| kie/caade486 (3312×2480) | 4164 | 4164 | 0,0563 $ | 0,0690 $ | 79 (confirm) | 78 (block: muro-solo-modelo) | −1 |
| 94326743 (768×1376) | 4200 | 4156 | 0,0570 $ | 0,0556 $ | 66 (block) | 65 (block) | −1 |
| 9cc5e26f (1448×1086) | JSON falló | 4164 | 0 $ (no informado) | 0,0574 $ | — | 77 (block) | n/a |
| dc2df084 (1448×1086) | 4164 | 4164 | 0,0592 $ | 0,0602 $ | 65 (block) | 66 (block) | +1 |
| ef18df8e (1448×1086) | 2184 | 2184 | 0,0237 $* | 0,0626 $ | 65 (block) | 65 (block) | 0 |

\* En la pasada a 2048, el pase de símbolos falló al parsear y se usó la extracción base, que es el comportamiento de producción. Por eso el coste sale más bajo.

## Resumen

- **Tokens de entrada: ahorro prácticamente nulo (≈ 0,3 %).** Gemini 3.7 Flash cobra la imagen por un número fijo de tokens, sea cual sea la resolución: 4164 tokens tanto a 3312→2048 como a 1280. La única diferencia fue de 44 tokens en una imagen.
- **Coste por pasada**: el ~80 % lo generan los tokens de salida (5–7k en la principal, contando el razonamiento), y varían al azar entre ejecuciones. Media en las 4 parejas completas: 2048 = 0,049 $ y 1280 = 0,062 $. La diferencia es ruido y viene del pase de símbolos, no de la imagen.
- **Score**: delta medio −0,25 puntos en las 4 parejas válidas (−1, −1, +1, 0). **Ninguna imagen empeoró más de 10 puntos.**
- **Fallos de JSON**: 2 a 2048 (1 en la llamada principal y 1 en el pase de símbolos) y 0 a 1280. Con n = 5 eso es ruido del modelo, no efecto de la resolución.
- **Decisiones**: en 4 de las 5 parejas, la decisión de producción es `block` por avisos bloqueantes (`cotas-generales-discordantes` y otros) en las dos variantes. En kie/caade486, a 1280 apareció `muro-solo-modelo` y pasó de `confirm` a `block`. Un solo caso no es concluyente.

## Veredicto: **no aplicar**

Con el modelo actual, bajar a 1280 px no ahorra tokens de entrada, porque la imagen cuesta lo mismo a cualquier resolución, y el coste lo marca la salida. La calidad no cambia de forma medible, aunque con n = 4–5 no se descartarían diferencias de unos pocos puntos. Además, el 75 % de las imágenes que se suben ya miden ≤ 1280 px, así que el cambio apenas tocaría el tráfico real. Si se quiere abaratar `vision`, hay que atacar los tokens de salida y de razonamiento, y el pase de símbolos, que añade unas 3 llamadas por plano.

## Gasto real

- Visión (`usage.cost` informado por OpenRouter): **0,501 $**.
- Jev: **0,0003 $**.
- Hay 2 llamadas que fallaron al parsear y no informaron coste. Además, la primera ejecución se cortó a mano después de la primera pareja, con una llamada que quizá estaba en curso. Ese gasto no informado se estima en ≤ 0,08 $.
- **Total: ≈ 0,50–0,58 $**, por debajo del tope de 1,50 $.

## Preguntas sin resolver

1. ¿La ruta de `vision` en producción es el mismo modelo? Si es otro que sí cobre por tiles o píxeles (familias de OpenAI o Anthropic), la conclusión sobre tokens no se aplica y habría que repetir la prueba.
2. ¿Se debe revisar el `media_resolution` de Gemini? Bajarlo sí reduciría tokens de entrada, pero la entrada es solo ~20 % del coste.
3. Casi todas las evaluaciones acaban en `block` por `cotas-generales-discordantes`. Eso limita lo que el score de Jev puede discriminar en esta prueba y merece revisarse aparte.
