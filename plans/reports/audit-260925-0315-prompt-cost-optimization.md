# Auditoría de prompts y optimización de coste — `src/server/ai`

Fecha: 2026-09-25. Rama: `develop`. Plataforma: **OpenRouter** (SDK `openai` npm, `baseURL: https://openrouter.ai/api/v1`), no la API nativa de Anthropic. Modelo objetivo de la auditoría de prompts: **`anthropic/claude-sonnet-5`** (el más reciente al que apunta el propio código — `MODEL_DEFAULTS` en `src/server/ai/model-defaults.ts`, acciones `chat`, `plano2d`, `memoria`; `vision` usa `google/gemini-3.7-flash` con Sonnet 5 como fallback; `render3d`/`inpaint` usan `google/gemini-3.1-flash-image`, un modelo de imagen que no es Claude).

**Importante sobre el alcance real de las palancas.** Al no usar el SDK/Beta de Anthropic, no están disponibles: `cache_control` explícito garantizado (OpenRouter puede o no trasladarlo al proveedor subyacente — no verificado, el código actual no lo envía en ningún punto), `thinking`/`effort` adaptativo, `task_budget`, Admin API de uso/coste de Anthropic, ni Batch API de Anthropic. Sí están disponibles y se han auditado: higiene de prompts, `response_format: json_schema` (salida estructurada, ya en uso), higiene de bucle/imagen, y el modelo/proveedor por acción vía la capa de configuración en BD.

---

## Auditoría de prompts

### Paso 0 — Alcance y modelo objetivo

- **Alcance**: todo `src/server/ai/**` + puntos de entrada que arman prompts fuera de esa carpeta: `src/server/agent/**` (orquestador, fases, feedback, editor-v2) y las Server Actions en `src/app/(app)/projects/[id]/_actions/*.ts` (se comprobó que estas últimas NO contienen texto de prompt — solo componen `promptLibre`/parámetros y delegan la construcción a `server/agent` y `server/ai/design`).
- **Modelo objetivo**: `anthropic/claude-sonnet-5` para las llamadas de texto/estructura (`chat`, `plano2d`, `memoria`, fallback de `vision`). Los prompts de `render3d`/`inpaint` (imagen→imagen, Gemini) se han inventariado pero se marcan explícitamente **fuera del objetivo de auditoría Claude**: sus mayúsculas y prohibiciones no se juzgan contra "cómo sigue instrucciones Claude Sonnet 5", sino que documentan fallos observados en generación de imagen con modelos Gemini (ver Paso 2).

### Paso 1 — Inventario del superficie de prompt

| Archivo | Contenido | Modelo destino |
|---|---|---|
| `src/server/ai/design/room-prompt-builder.ts` | Prompt del render cenital/maqueta (imagen) | Gemini imagen |
| `src/server/ai/design/redraw-plan-pipeline.ts` | `planFidelityRules()`, `redrawPlanPrompt()` (imagen→imagen) | Gemini imagen |
| `src/server/ai/sketch/extract-sketch-geometry.ts` | `sketchPrompt()`, `planPrompt()` + `SKETCH_SCHEMA` (json_schema) | Gemini vision (fallback Sonnet 5) |
| `src/server/agent/phases/ingesta.ts` | Prompt de conteo de elementos estructurales + `ELEMENTS_SCHEMA` | vision |
| `src/server/agent/phases/deteccion-layout.ts` | `detectionPrompt()` + `DETECTED_SCHEMA` | vision |
| `src/server/agent/editor-v2/native-design-proposal.ts` | `nativeDesignPrompt()` + `NATIVE_DESIGN_SCHEMA` | chat (Sonnet 5) |
| `src/server/agent/editor-v2/selected-view-prompt.ts`, `interior-prompt-scope.ts`, `concept-render-prompt` (vía `agent-actions.ts`) | Prompts de render de vista interior/exterior | Gemini imagen |
| `src/server/agent/feedback/feedback-deps.ts` | Prompt de reescritura de memoria de materiales + prompt de edición de zona de plano | chat/plano2d (Sonnet 5) |
| `src/server/agent/feedback/directed-inpaint.ts` | Prompt de inpaint dirigido | Gemini imagen |
| `src/server/agent/phases/entrega.ts`, `decoracion.ts` | Prompts/`STRUCTURAL_RENDER_SCHEMA` de fase de entrega | mixto |
| `src/server/quality/*` (Jev) | Preguntas de checkpoint de calidad enviadas a Jev (juez externo vía `jev-client.ts`) | fuera de alcance: no es OpenRouter/Claude, es el servicio Jev (MCP `ask_jev`) |

No hay: `<scratchpad>`/`<thinking>` tags, prefill de turno assistant, `stop_sequences`, bucles `json.loads` con reintento manual (el parseo de JSON en `chat-vision-adapter.ts` usa candidatos progresivos, no un bucle de reintento contra el proveedor), `tool_choice: {type:"any"|"tool"}` forzado, ni `budget_tokens`/`temperature` no-default salvo dos usos explícitos y justificados (`temperature: 0` para ediciones deterministas de plano/memoria, `temperature: 0.2` para la propuesta de diseño nativo).

### Paso 2 — Procedencia

Sin `git blame` exhaustivo por límite de tiempo, pero las cabeceras de los propios archivos documentan la razón de cada regla ("Cada punto responde a un fallo observado en renders reales: puertas leídas como huecos anchos, ventanas inventadas..." en `redraw-plan-pipeline.ts`). Esto es exactamente la procedencia que el Paso 2 pide: las mayúsculas/prohibiciones de los prompts de imagen tienen una razón declarada y verificable, no son arrastre sin dueño.

### Paso 3–4 — Clasificación y grupos de anti-patrones

**Hallazgo general: la superficie está limpia.** Es un codebase con prompts cortos, construidos por función pura, casi siempre con `response_format: json_schema` en vez de scaffolding de JSON por texto, sin coreografía "STEP 1/STEP 2", sin bloques de ejemplos dorados, sin recordatorios repetidos por turno (no hay bucles multi-turno con reinyección de instrucciones: cada llamada de fase es de una sola vuelta). No se encontró ningún patrón de Grupo 1b (scaffolds sustituibles por features de API) ni de Grupo 4 salvo el punto de caché (más abajo, que es más una palanca de coste que un fósil).

Tabla de hallazgos (ordenada por confianza):

| Location | Evidence | Pattern | Why obsolete | Confidence | Action |
|---|---|---|---|---|---|
| `src/server/ai/sketch/extract-sketch-geometry.ts:178` | `'MUY IMPORTANTE: los ARCOS DE BARRIDO de las puertas...'` | 1a — marcador de énfasis único en un prompt por lo demás sobrio | Es una única línea de énfasis (no un cluster) sobre una confusión real y recurrente (arco de barrido confundido con muro); el propio contrato (json_schema) ya obliga a la forma de salida, así que el riesgo de "sobre-disparo" es bajo, pero en Sonnet 5 el marcador no aporta sobre una frase declarativa | Baja | flag (no se propone reescritura: la regla en sí es correcta, solo el envoltorio "MUY IMPORTANTE" es candidato a normalizar) |
| `src/server/ai/design/room-prompt-builder.ts` (todo el archivo) | `'LOS MUROS SON SAGRADOS'`, `'PROHIBIDO'`, `'JAMÁS'`, `'SOLO puede haber'` | 1a/1e — lenguaje de presión y prohibiciones | Objetivo real: modelo de **imagen** (Gemini), no Claude. La auditoría de prompt-audit.md está calibrada para el seguimiento de instrucciones de Claude; no se puede afirmar que estas fórmulas sean obsoletas para un modelo de generación de imagen sin evidencia propia. Las prohibiciones tienen razón declarada (evitar sanitarios en el recibidor, evitar tabiques inventados) | Baja (fuera de objetivo modelo) | flag — no se incluye en el diff; si en el futuro el pipeline de render pasa a usar Claude para describir la escena, re-auditar con el objetivo correcto |
| `src/server/ai/design/redraw-plan-pipeline.ts` (todo el archivo) | `'PROHIBIDO'` × 5, `'EXACTAMENTE'` | 1e | Mismo caso: destino Gemini-imagen, con razón declarada por fallo observado ("verificado con planos reales"). Cumple la lista "qué no marcar" (ítem 5: prohibiciones con procedencia sobre fallos demostrados se mantienen) | Baja (fuera de objetivo modelo; y si fuera Claude, entraría en la lista de excepciones "keep") | flag |
| `src/server/agent/editor-v2/selected-view-prompt.ts:43,65` | `'PROHIBIDO convertirla en una foto de interior...'` | 1e | Mismo caso: destino imagen | Baja | flag |
| `src/server/ai/call-limits.ts:11-13` | `DEFAULT_MAX_OUTPUT_TOKENS = 4096`, `HARD_MAX_OUTPUT_TOKENS = 8192` | Grupo 4 — `max_tokens` dimensionado | No es un fósil de modelo antiguo (no hay error de API), es un tope de coste deliberado y documentado ("defensa en profundidad"). Pero **si Sonnet 5 en OpenRouter aplica razonamiento extendido por defecto en algún momento**, un tope de 4096–8192 puede truncar una respuesta con razonamiento antes de completar el JSON (exactamente el motivo por el que `extract-sketch-geometry.ts:413` ya sube `maxTokens` a 8192 con el comentario "los modelos con razonamiento gastan parte del presupuesto en pensar") | Media | flag — no es cruft para eliminar, es una decisión de producto documentada; se traslada como hallazgo también a la sección de coste (Palanca 2.4) |

**No se propone ningún diff de eliminación.** Ninguno de los hallazgos anteriores alcanza el umbral de confianza alta/media con una acción `remove`/`rewrite` clara: los candidatos de Grupo 1a/1e detectados apuntan a prompts de generación de imagen (fuera del modelo objetivo Claude Sonnet 5) y llevan procedencia documentada (excepción de la lista "qué no marcar", punto 5). El único hallazgo de confianza media (`max_tokens`) es una decisión de producto vigente, no un fósil — se traslada íntegro a la optimización de coste como una palanca a vigilar, no a "arreglar".

**Paso 6 (diff propuesto): vacío.** Según la propia guía: *"un audit que no encuentra nada no debe cambiar nada — una superficie limpia es un resultado válido, y un diff vacío es mejor que uno fabricado."* No se aplica ningún cambio.

**Paso 7 (verificación)**: no aplica al no haber hallazgos con acción de edición.

---

## Optimización de coste

### Paso 0 — Alcance, barra de calidad, baseline

- **Alcance**: todo `src/server/ai/**`, clases de tráfico distintas: `vision` (extracción de geometría/conteo, interactivo), `chat`/`plano2d`/`memoria` (edición conversacional puntual, interactivo), `render3d`/`inpaint` (generación de imagen, interactivo, el más caro).
- **Plataforma**: OpenRouter (multi-proveedor: Anthropic, Google, y `kie` para algunos modelos de imagen). No hay Admin API de Anthropic disponible (no se usa el SDK de Anthropic en ningún punto del código).
- **Barra de calidad**: existe una puerta de calidad real, pero no es un "eval" en el sentido de prompt-audit/cost-optimization (conjunto congelado de casos + checker automático de precisión). Es el sistema **Jev** (`src/server/quality/*`, `askJev` en `jev-client.ts`): antes de cualquier generación de pago (render, diseño, propuesta nativa), Jev puntúa 0–100 la salud estructural del documento del editor y decide `proceed`/`confirm`/`block`; política fail-closed (sin Jev disponible, nunca deja pasar solo). Es una puerta de **negocio** (evita gastar en un plano roto), no una puerta de **regresión de prompt** (no compara la salida del modelo contra un golden set). Además hay 27 archivos en `tests/ai/` y 24 en `tests/quality/`, pero son tests deterministas de la geometría pura (parseo, snapping, normalización) — ninguno mide precisión de la salida del modelo en sí.
  - **Corrección (2026-09-25)**: además de la puerta previa, Jev puntúa **cada entregable después de generarse** (`src/server/quality/result-gate.ts`, checkpoints `plan_result`, `render_result`, `memoria_result` en `checkpoints-results.ts`) y lo persiste en `AiQualityEvaluation` (score, motivos, fecha, `refId`). `plan_result` juzga justo la calidad de la extracción de geometría: estancias dibujables, huecos anclados a muros, nombres y cotas. No es un golden set con respuestas conocidas, pero sí una señal de resultado automática, histórica y ya en marcha.
  - **Conclusión**: hay una barra de calidad utilizable. Las palancas que afectan a `vision`/`plano2d` (downscale de imagen, cambio de modelo) se validan comparando la distribución de `plan_result` antes/después del cambio; siguen siendo propuestas hasta hacer esa comparación.
- **Baseline — datos reales, no estimados.** El usuario confirmó que hay logs de coste reales; se localizó la tabla Prisma `ai_request_cost` (`prisma/schema/admin.prisma:155-183`, alimentada por `recordAiAttempt` en `src/server/analytics/ai-cost-recorder.ts`) y se consultó con una `SELECT` de solo lectura contra la BD de **desarrollo local** (`postgresql://habiteka:***@localhost:5440/habiteka_dev`, de `.env.local` — nunca se tocó producción, ninguna escritura).

### Paso 1 — Perfil de tokens (medido, BD local, 2026-09-15 → 2026-09-25, 235 filas)

Agregado por acción (`SELECT action, sum(costUsd), count(*) FROM ai_request_cost GROUP BY action`):

| Acción | Coste USD (10 días, dev) | Nº llamadas | % del gasto total |
|---|---|---|---|
| `render3d` | 8.3600 | 170 (72 éxito, 98 error) | 87.3% |
| `vision` | 1.1099 | 53 | 11.6% |
| `plano2d` | 0.0438 | 1 | 0.5% |
| `chat` | 0.0304 | 10 | 0.3% |
| `memoria` | 0.0122 | 1 | 0.1% |
| **Total** | **9.5563** | 235 | 100% |

Esto es **medido**, no estimado, pero es una muestra de desarrollo (10 días, tráfico de pruebas, no producción) — los porcentajes son indicativos de dónde vive el gasto en este pipeline, no una proyección de factura real. Nota llamativa: **98 de 170 llamadas de `render3d` son error** (`kie/flux-2/*-image-to-image` con 31+31 fallos y `costType: unknown`, es decir, sin coste registrado porque el proveedor no llegó a facturar). Esto es una señal de fiabilidad del proveedor `kie`, no directamente una palanca de coste de prompt, pero cada reintento consume una llamada de red y latencia (avg 4.6s en los fallos) — merece investigarse aparte (fuera del alcance de este informe).

Desglose de tokens por acción de texto (columna `units` de `ai_request_cost`, ejemplo real de `vision`):

```
{"promptTokens": 11827, "completionTokens": 1544}
{"promptTokens": 11827, "completionTokens": 1193}
{"promptTokens": 3416,  "completionTokens": 6299}
{"promptTokens": 3416,  "completionTokens": 7626}
```

- El **prompt** de `sketchPrompt()`/`planPrompt()` en texto puro son ~150–200 palabras (~300 tokens); los ~11.800 tokens de entrada observados en la mayoría de llamadas están dominados por la **imagen** adjunta, no por el texto del prompt. Confirmado en `src/server/ai/image/input-sanitizer.ts`: el único límite es `MAX_IMAGE_DIMENSION = 2048` px — no hay downscale orientado a la tarea antes de enviar la imagen a visión.
- El **completion** de `vision` llega a 6.000–7.600 tokens en algunas llamadas: es la propia salida JSON de `SKETCH_SCHEMA` (muchos muros/aberturas/habitaciones/cotas/mobiliario) — dato necesario, no relleno.
- No existe ningún registro con desglose de tokens de caché (`cache_creation`/`cache_read`): confirma código-lectura — el adaptador (`toTokenUsage` en `src/server/ai/cost/usage-to-cost.ts`) solo mapea `prompt_tokens`/`completion_tokens`/`cost` del `usage` de OpenRouter; no hay ningún campo de caché ni se envía `cache_control` en ningún punto de `chat-vision-adapter.ts`.

### Ranking de palancas (por techo de ahorro)

Unidad: como hay datos reales pero de muestra pequeña y de desarrollo, se cuantifica en **% del gasto medido de la muestra**, con el USD entre paréntesis como referencia de la propia aritmética del usuario, nunca como proyección de factura.

| Palanca | Tipo | Techo estimado | Fuente del dato |
|---|---|---|---|
| Downscale de imagen a resolución de tarea (visión) | Free win (higiene de entrada) | Medio: el prompt-texto es ~2.5% de los ~11.800 tokens de entrada de `vision`; el resto es imagen. Bajar de 2048px a algo como 1280px (o menos, si la geometría sigue siendo legible) podría cortar una fracción sustancial de esos ~11.8k tokens de entrada — pero **sin verificación de que la extracción de geometría siga siendo precisa a menor resolución**, el techo real es una incógnita hasta medir | Medido (BD dev) para el tamaño de entrada; el % de ahorro es estimación de código |
| Caché de prompt / `cache_control` | Free win — **no confirmado si aplica** | Desconocido y probablemente pequeño hoy: cada llamada de `chat`/`plano2d`/`memoria`/`vision` es de una sola vuelta (no hay conversación multi-turno con historial creciente), así que no hay un prefijo que se re-envíe N veces dentro de una misma tarea. El beneficio de caché en este código sería solo entre llamadas **distintas** que comparten el mismo prompt de sistema/instrucciones fijas (p. ej. `sketchPrompt()` es idéntico en cada extracción) — un candidato real pero de bajo techo aquí, y **no verificado que OpenRouter traslade `cache_control` a Anthropic para este pipeline** (el código no lo envía en absoluto) | Código (ausencia confirmada); techo no medible sin probar |
| Reducir fallos de proveedor en `render3d` (`kie/flux-2/*`) | Free win — fuera de alcance estricto de "prompt", pero es la mayor fuga de coste operativo | 98/170 llamadas de render fallan (57%); aunque `costType: unknown` no suma a `costUsd`, cada fallo consume latencia (avg 4.6s) y probablemente reintentos de usuario que sí generan una llamada exitosa después, con su coste completo | Medido (BD dev) |
| `max_tokens` = 4096 por defecto / 8192 duro | Vigilar, no "arreglar" | Bajo: es una decisión de producto (tope de coste por llamada), no un fósil de modelo. Riesgo de corte si algún día se activa razonamiento extendido en `chat`/`plano2d` vía OpenRouter (hoy no se envía ningún parámetro de `thinking`/`reasoning`, así que Sonnet 5 corre sin razonamiento extendido por defecto en este pipeline) | Código |
| Efecto/`effort` | Tradeoff — **no aplicable directamente**: el código no expone ningún parámetro `effort`/`reasoning` a OpenRouter en ningún punto de `chat-vision-adapter.ts`. Verificar primero si OpenRouter traslada un parámetro equivalente para `anthropic/claude-sonnet-5` (p. ej. `reasoning: {effort}` de la Chat Completions API de OpenRouter) antes de prometer esta palanca | Tradeoff | No cuantificable sin eval ni verificación de soporte | — |
| Selección de modelo | Tradeoff — ya gestionada por capa de configuración en BD (`model-config-loader.ts`) editable desde el back-office; no se propone tocar el modelo por defecto sin eval | Tradeoff | No cuantificable sin eval | — |

### Paso 2 — Trabajo de las palancas en orden

**2.1 Caché de prompt.** No aplica hoy sin cambios de arquitectura: el patrón de tráfico es de llamadas independientes de una sola vuelta, no bucles agénticos multi-turno que reenvíen un prefijo creciente. El "techo" real (llamadas distintas compartiendo el mismo prompt de sistema fijo) es candidato solo si el volumen de producción crece mucho; no se propone ahora porque además no está confirmado que OpenRouter traslade `cache_control` a Anthropic para este código (el código nunca lo ha probado). **Propuesta si el usuario quiere validarlo**: una sonda mínima (una request duplicada byte-idéntica con `cache_control` en el bloque de sistema) contra OpenRouter, mirando si `usage.cost` baja en la segunda llamada — gasto real pequeño, requiere aprobación explícita antes de ejecutarla.

**2.2 Higiene de tokens de entrada.**
- *Downscale de imagen orientado a tarea* (`src/server/ai/image/input-sanitizer.ts:54` — `MAX_IMAGE_DIMENSION = 2048`): propuesta — bajar el límite de entrada para las rutas de `vision` (extracción de geometría) a un valor menor (p. ej. 1536px o 1280px), MANTENIENDO 2048px para las rutas de imagen→imagen donde el detalle visual importa para el redibujado (`render3d`/`inpaint`). **Esto es una palanca "needs an eval"**: reducir resolución puede degradar la lectura de cotas/etiquetas pequeñas en el boceto, que es precisamente lo que `sketchPrompt()`/`planPrompt()` piden leer con precisión. No se aplica sin que el usuario confirme que puede validar visualmente un lote de bocetos reales antes/después.
- *Auditoría de prompts* (§ 2.2 de la guía, sub-palanca): ejecutada arriba — superficie limpia, sin hallazgos aplicables.
- *Esquemas de herramientas*: no hay `tools` de function-calling en las rutas auditadas (`req.tools` solo se usa condicionalmente en `chat-vision-adapter.ts:109` pero no se encontró ningún llamador que pase `tools` en el código auditado) — palanca no aplicable.

**2.3 Higiene de bucle agéntico.** No aplica: cada fase (`ingesta`, `deteccion-layout`, `extractSketchGeometry`, `proposeNativeDesign`, ediciones de `feedback-deps.ts`) es una única llamada de chat sin bucle de herramientas ni acumulación de contexto entre turnos. No hay nada que recortar aquí.

**2.4 Tokens de salida.** `max_tokens` ya está acotado (4096 por defecto, 8192 duro) — es un backstop de coste correcto, no una perilla de ajuste que haya que "arreglar". Único matiz: si en el futuro se activa razonamiento extendido en Sonnet 5 vía OpenRouter para `chat`/`plano2d`/`memoria`, revisar si 4096 corta la respuesta a medio pensar (ya ocurrió y se corrigió puntualmente en `extract-sketch-geometry.ts:413`, subiendo a 8192 para esa llamada concreta).

**2.5 Batch processing.** No aplicable: todo el tráfico auditado es interactivo (el usuario espera la respuesta en la UI del editor/asistente). No hay trabajo desatendido (backfills, jobs nocturnos) en este pipeline.

**2.6 Effort y budgets.** No aplicable sin verificar primero si OpenRouter expone un parámetro de esfuerzo equivalente para `anthropic/claude-sonnet-5` en la Chat Completions API que el código no está usando hoy — no se promete esta palanca sin esa verificación, y aunque existiera, es un tradeoff que necesita el eval que hoy no existe (Paso 0).

**2.7 Selección de modelo.** Última, deliberadamente. Ya hay una capa de configuración editable en BD (`model-config-loader.ts`, panel de admin) con fallback seguro (`MODEL_DEFAULTS`). No se propone cambiar el modelo por defecto de ninguna acción sin un eval que compare calidad; el propio `MODEL_DEFAULTS` ya usa un modelo barato (`google/gemini-3.7-flash`) para `vision` con Sonnet 5 solo como *fallback*, es decir, la elección barata-primero ya está aplicada donde tiene sentido.

### Paso 3 — Aplicar, medir, mantener o revertir

No se aplicó ningún cambio de código (todas las palancas de esta sección son propuestas). No se ejecutó ningún gasto real de API nuevo: el único gasto fue cero (las consultas SQL de agregación son lecturas de la BD local, sin tocar ningún proveedor).

---

## Paso 4 — Resumen de entregables

1. **Perfil de coste**: gasto medido real en BD de desarrollo (10 días, 235 llamadas, $9.56 total): 87% del gasto es `render3d` (generación de imagen vía `kie`/OpenRouter-Gemini), 12% `vision`, resto (<1%) texto Claude Sonnet 5. El texto (`chat`/`plano2d`/`memoria`) es hoy una fracción mínima del gasto de IA de la app.
2. **Cambios propuestos**: ninguno aplicado. Dos propuestas quedan documentadas para aprobación explícita del usuario:
   - Downscale de imagen orientado a tarea para `vision` (needs an eval visual antes de aplicar).
   - Sonda de `cache_control` contra OpenRouter+Sonnet 5 para confirmar si el passthrough existe (gasto real pequeño, pide aprobación).
3. **Palancas descartadas** y por qué: caché de prompt (sin bucles multi-turno que la rentabilicen hoy), batch (todo el tráfico es interactivo), higiene de bucle agéntico (no hay bucles), `effort`/budgets (parámetro no expuesto por el código hacia OpenRouter, sin confirmar soporte), cambio de modelo (ya optimizado por acción, sin eval para ir más allá).
4. **Auditoría de prompts**: superficie limpia. Sin diff propuesto.

---

## Preguntas sin resolver

1. **¿Quieres que valide con gasto real (pequeño, bajo aprobación explícita) si OpenRouter traslada `cache_control` a `anthropic/claude-sonnet-5`?** Sin esa sonda, la palanca de caché queda como "candidata sin verificar", no como ahorro prometido.
2. **¿Apruebas medir el downscale de imagen (1536px o 1280px) para las llamadas de `vision` con un lote real de bocetos, comparando la geometría extraída antes/después?** Es la palanca con mayor techo teórico de esta sección, pero toca precisión de lectura de cotas y necesita tu revisión visual (no hay eval automático de esto hoy).
3. **La fiabilidad del proveedor `kie` para `render3d` (57% de fallos en la muestra de desarrollo) es un hallazgo colateral de esta auditoría, no su objeto.** ¿Quieres que se investigue aparte (otra tarea) el motivo de esos fallos (`flux-2/flex-image-to-image`, `flux-2/pro-image-to-image`)?
4. ~~Eval mínimo~~ Resuelto: `plan_result`/`memoria_result` de Jev (tabla `AiQualityEvaluation`) sirven como señal de calidad para comparar antes/después.
5. La muestra de coste usada es de **BD de desarrollo**, no de producción. Si quieres un perfil con datos de producción, dime cómo acceder de forma segura (solo lectura) o pídeme que relaye la petición al panel de Dokploy/admin de costes que ya existe en la app (`src/server/analytics/ai-cost-queries.ts`).
