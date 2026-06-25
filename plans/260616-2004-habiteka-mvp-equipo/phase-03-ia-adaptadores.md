# F3 — Adaptadores de IA: OpenRouter + Imagen (IA Engineer)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md) · contratos: [phase-00](phase-00-arq-setup-contratos.md)

## Overview
- **Rol primario:** IA Engineer
- **Prioridad:** P1 (cuello de botella: F5 agente depende de esto)
- **Estado:** Completado (PR #9)
- **Depende de:** F0 (contratos congelados)
- **Paralela con:** F1, F2, F11
- **Descripción:** Implementa las dos clases concretas que satisfacen los contratos de F0: `OpenRouterChatVisionAdapter` (OpenAI SDK con `baseURL` OpenRouter — streaming, tool-calling, structured outputs `json_schema`, routing/fallback de modelos) y `ProviderImageAdapter` (render 3D + inpainting). Claves SOLO server-side. Cada operación reporta coste→créditos.

## Key Insights
- **OpenRouter usa la Chat Completions API**, NO la Responses API de OpenAI → usar `client.chat.completions.create(...)`, no `client.responses.*` (arquitectura §6, decisión de stack).
- OpenAI SDK oficial apuntando a `baseURL: https://openrouter.ai/api/v1` — NO el SDK beta de OpenRouter.
- **Mapeo acción→modelo es DATO EN BD, no constante:** la tabla `tarea/acción → {primaryModel, fallbacks, enabled}` se LEE de `ModelConfig` (declarado por F2, editado por el panel de config) vía un `model-config-loader` con caché en memoria. El adaptador NO hardcodea el mapa; resuelve modelo+fallbacks en runtime por acción (`vision|chat|plano2d|render3d|inpaint|memoria`). **Default seguro:** si la tabla está vacía o falla la lectura, usa un mapa de defaults en código (arranque/seed) → la IA nunca queda sin modelo. La UI de edición vive en el back-office (config de modelos); F3 solo **lee**.
- **Fallback de modelos** vía `extra_body: { models: [...] }` (máx 3; no combinar con un `model` que también liste varios). OpenRouter intenta en orden ante error de proveedor.
- **Fallback de GATEWAY/proveedor (OpenRouter es SPOF):** el fallback de modelos NO cubre la caída del propio OpenRouter. El `model-config-loader` resuelve también `{provider, baseURL}` por acción; el adaptador se construye sobre una abstracción que permite conmutar a un **segundo gateway o proveedor directo** si el primario falla (error de red/5xx del gateway). MVP: dejar la abstracción lista + **un proveedor secundario configurable** (env), con un test que verifique la conmutación. La key admin nunca apunta a un baseURL arbitrario: el provider sale de una **allowlist** (ver F16).
- **Structured outputs:** `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }`. Strict exige `additionalProperties:false` y todos los campos `required` (opcionales → `type: [..., 'null']`).
- **Visión:** mensajes multimodales con `content: [{type:'text'}, {type:'image_url', image_url:{url}}]` (base64 o URL) para la fase de Ingesta.
- **Coste:** la respuesta trae `usage` (tokens nativos del modelo). El adaptador devuelve `TokenUsage`/`ProviderCost`; el mapeo a débito de créditos lo hace BE en F8.
- Proveedor de imagen concreto (FLUX vs Nano Banana vs Imagen) es **decisión abierta** (§9.1) → adaptador con `IMAGE_PROVIDER` conmutable por env; implementar el primer proveedor y dejar el resto stub.
- **Protección del saldo OpenRouter:** pagamos al proveedor ANTES de debitar al usuario → un abuso (bucle, prompt masivo) puede vaciar el saldo. Necesario: rate-limiting por usuario/org, **cap diario de gasto** y **circuit-breaker**. (El cap GLOBAL agregado de plataforma —anti-sybil multi-cuenta— vive en F8; F3 expone los puntos de medición.)
- **Techo por-llamada (defensa en profundidad, antes de tocar al proveedor):** el adaptador fuerza un **límite de salida por llamada** — `max_tokens` (o `max_completion_tokens`) en chat para acotar el coste de una sola respuesta — y un **límite de tamaño/dimensiones de imagen por request** en generate/inpaint. Un prompt que pida "10000 tokens" o una imagen gigante no puede disparar coste ilimitado en una sola llamada, independientemente del cap diario/global.
- **Upload/visión seguro:** validar imagen por **magic bytes** (no solo MIME declarado), límite de dimensiones (anti decompression-bomb) y **strip EXIF**. **Prohibir `image_url` arbitraria del usuario** (riesgo SSRF: el proveedor fetchea la URL) → solo se envía un asset propio re-encodeado server-side (base64 o URL firmada nuestra).
- **Coste por imagen:** el render/inpaint se factura por imagen, no por tokens → la `pricing-table` debe cubrir coste-por-IMAGEN además de tokens de chat.

## Requirements
**Funcionales**
- `chat()` y `chatStream()` funcionando contra OpenRouter (texto, visión, tool-calling, json_schema).
- Routing primario + fallback (≤3 modelos) resuelto por acción **leyendo `ModelConfig` desde BD** (no hardcode), con caché e invalidación al cambiar la config; default seguro si la tabla está vacía.
- `ImageAdapter.generate()` (render 3D) y `inpaint()` (Fase Feedback) contra el proveedor elegido.
- Toda respuesta expone `usage`/`cost` para créditos (incl. **coste por imagen** en render/inpaint).
- Mapa de modelos por acción centralizado en BD (`ModelConfig`) y editable desde el panel; F3 lo consume vía `model-config-loader`.
- **Rate-limit global + cap diario de gasto + circuit-breaker** previos a toda llamada IA (protección del saldo OpenRouter).
- **Sanitizado de imagen de entrada:** validación por magic bytes, límite de dimensiones, strip EXIF, re-encode server-side; prohibida `image_url` arbitraria del usuario (anti-SSRF).

**No funcionales**
- Claves leídas solo de `process.env` en servidor; nunca enviadas al cliente.
- Timeouts + reintentos con backoff; errores tipados (rate-limit, refusal, schema-invalid, provider-down).
- Sin estado global mutable por request (instancias seguras entre peticiones concurrentes).
- Archivos ≤200 líneas; un fichero por responsabilidad.

## Architecture
```
src/server/ai/
  client/gateway-client.ts        # crea OpenAI SDK por {provider, baseURL, apiKey}; abstracción que permite primario+secundario
  client/gateway-fallback.ts      # conmuta a gateway/proveedor secundario si el primario cae (5xx/red); orden configurable
  chat-vision-adapter.ts          # OpenRouterChatVisionAdapter implements ChatVisionAdapter (vía gateway-fallback)
  image/provider-image-adapter.ts # ProviderImageAdapter implements ImageAdapter
  image/providers/<flux|nano|imagen>.ts  # impl por proveedor; selección por IMAGE_PROVIDER
  model-routing.ts                # resuelve acción→{modelo+fallbacks, provider, baseURL} consultando model-config-loader (BD), NO hardcode
  model-config-loader.ts          # lee ModelConfig de BD (incl. provider/baseURL) + caché + invalidate(); default seguro si vacío
  model-defaults.ts               # mapa de defaults en código (fallback de arranque/seed)
  call-limits.ts                  # techo por-llamada: max_tokens (chat) + límite tamaño/dimensiones imagen (request)
  schema/*.ts                     # JSON schemas reutilizables (elementos estructurales, requisitos, plano2d)
  guard/spend-guard.ts            # rate-limit por user/org + cap diario de gasto + circuit-breaker (previo a IA)
  image/input-sanitizer.ts        # magic bytes + límite de dimensiones + strip EXIF + re-encode (anti-SSRF/bomb)
  cost/usage-to-cost.ts           # TokenUsage/ProviderCost → estructura neutra (tokens Y coste-por-imagen)
  errors.ts                       # AiError tipado (rate_limit|spend_cap|call_limit|refusal|schema|provider_down|gateway_down|timeout)
  index.ts                        # factories: getChatVisionAdapter(), getImageAdapter()
```
**Flujo chat structured:** request del agente (F5) → `model-routing` pide a `model-config-loader.get(action)` (caché de `ModelConfig`; default si vacío) → modelo+fallbacks → `chat.completions.create` con `response_format json_schema` → parse + validación → `ChatResult { structured, usage }`. **Config dinámica:** el panel de back-office edita `ModelConfig` y llama a `model-config-loader.invalidate()` (interfaz pública de F3) → la siguiente llamada IA usa el modelo nuevo sin redeploy. **Flujo stream:** `chatStream` itera deltas (`AsyncIterable<ChatDelta>`) para el chat de cualificación en UI (F6). **Flujo imagen:** `generate`/`inpaint` → proveedor → sube asset → `ImageResult { assetUrl, cost }`.

## Related Code Files
**A crear (owner IA — `src/server/ai/**`):** todos los ficheros del árbol anterior.
**Lee (no edita):** `src/lib/contracts/**` (interfaces de F0); tipos Prisma `ModelConfig` y cliente `prisma` de F2 (para leer la config; no escribe `prisma/**`).
**Expone (consumido por el back-office):** `model-config-loader.invalidate()` — el panel de config lo llama tras editar `ModelConfig`. La UI de edición NO vive aquí (es del back-office); F3 solo lee.
**NO tocar:** `src/server/agent/**` (es F5), `src/server/{auth,billing}/**` (F2/F8), `prisma/**`, `src/app/**`, `src/components/**`.

## Implementation Steps
1. `client/gateway-client.ts`: instancia OpenAI SDK por `{provider, baseURL, apiKey}` (key del `process.env` correspondiente; OpenRouter añade headers `HTTP-Referer`/`X-Title`). Fail-fast si falta la key del primario. `client/gateway-fallback.ts`: envuelve la llamada y conmuta al gateway/proveedor **secundario** si el primario devuelve 5xx/error de red (OpenRouter es SPOF); orden configurable por env.
2. `model-config-loader.ts`: `getModelConfig(action)` lee `ModelConfig` de BD (modelo+fallbacks **+ provider/baseURL**) con caché + `invalidate()`; si vacía/falla, devuelve `model-defaults.ts`. `model-routing.ts`: resuelve `{primary, fallbacks[], provider, baseURL}` por acción consultando el loader (NO hardcode); valida fallbacks ≤3 y que el provider/baseURL salga de la **allowlist** (no un baseURL arbitrario). Exponer `invalidate()` para el panel de config.
3. `chat-vision-adapter.ts`: `chat()` + `chatStream()` sobre `gateway-fallback`. Soportar `tools`, `responseSchema`→`response_format json_schema strict`, `fallbackModels`→`extra_body.models`. **Aplicar `call-limits` (`max_tokens`)** en cada llamada. Construir `MessagePart` multimodal para visión.
4. `errors.ts`: normalizar errores HTTP/SDK a `AiError`; mapear refusal y json inválido a errores propios.
5. `cost/usage-to-cost.ts`: extraer `usage` (chat) y **coste-por-imagen** (render/inpaint) → `TokenUsage` + `ProviderCost` neutro (NO créditos; eso es F8). El `ProviderCost` debe distinguir unidad token vs imagen para que la `pricing-table` de F8 cubra ambos.
6. `guard/spend-guard.ts`: rate-limit por user/org, cap diario de gasto y circuit-breaker; invocado por las factories antes de toda llamada IA; lanza `AiError(rate_limit|spend_cap)` sin consumir proveedor.
7. `image/input-sanitizer.ts`: validar magic bytes, limitar dimensiones, strip EXIF, re-encode server-side; rechazar `image_url` arbitraria del usuario (solo asset propio). Usado por la visión y por F7 antes de inpaint.
8. `call-limits.ts`: `max_tokens` por llamada de chat + límite de tamaño/dimensiones de imagen por request (generate/inpaint); rechaza con `AiError(call_limit)` antes de tocar al proveedor.
9. `image/providers/<elegido>.ts`: `generate` + `inpaint`; selección por `IMAGE_PROVIDER`. Stubs tipados para los otros 2 proveedores.
10. `image/provider-image-adapter.ts`: fachada que delega al proveedor activo, **aplica `call-limits` (dimensiones/tamaño)** y normaliza `ImageResult`.
11. `index.ts`: factories singleton-por-proceso seguras (sin estado por request), que cablean `spend-guard` antes de cada llamada IA.
12. Tests unitarios con SDK mockeado (HTTP interceptado): json_schema válido, fallback al 2º modelo, parse de `usage`/coste-imagen, error de refusal, cap de gasto dispara circuit-breaker, sanitizer rechaza magic bytes inválidos / `image_url` externa. Smoke test real opcional tras una key de dev (no en CI).
13. `bun run typecheck` + `bun run build` verdes.

## Todo List
- [x] `gateway-client` (baseURL+key server-side, fail-fast) + `gateway-fallback` (conmuta a secundario si primario cae; OpenRouter es SPOF)
- [x] `model-config-loader` lee `ModelConfig` de BD (modelo+fallbacks **+ provider/baseURL**) + caché + `invalidate()` + default seguro si vacío
- [x] `model-routing` resuelve por acción consultando el loader (no hardcode); fallbacks ≤3; provider/baseURL desde allowlist
- [x] `call-limits` (techo por-llamada: `max_tokens` chat + tamaño/dimensiones imagen)
- [x] `chat()` + `chatStream()` con tools + json_schema strict (aplica `call-limits`)
- [x] Soporte de visión (image_url / base64)
- [x] Errores tipados (`AiError`, incl. `spend_cap`, `call_limit`, `gateway_down`)
- [x] `usage`→coste neutro (tokens Y coste-por-imagen)
- [x] `spend-guard` (rate-limit + cap diario + circuit-breaker) previo a IA
- [x] `input-sanitizer` (magic bytes + dimensiones + EXIF + re-encode, anti-SSRF)
- [x] `ImageAdapter` generate + inpaint (proveedor activo + stubs)
- [x] Factories sin estado por request (cablean spend-guard)
- [x] Tests unitarios con SDK mockeado verdes (incl. cap de gasto y sanitizer)

## Success Criteria
- `getChatVisionAdapter().chat({ responseSchema })` devuelve objeto validado contra el schema o `AiError` claro.
- Fallback: si el modelo primario falla, responde con el 2º (verificado en test).
- `getImageAdapter().generate(...)` retorna `assetUrl` + `cost`.
- Toda respuesta IA incluye `usage`/`cost` consumible por F8.
- Cero referencias a `OPENROUTER_API_KEY`/`IMAGE_PROVIDER_KEY` fuera de `src/server/**`.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Modelo no soporta strict json_schema en OR | Media | Alto | Routing solo a modelos compatibles; fallback a json_object + validación Zod manual |
| Refusals/schema inválido rompen el agente | Media | Alto | `AiError` tipado + reintento con prompt de reparación 1 vez |
| Coste real ≠ estimado (tarifas) | Media | Medio | Usar `usage` nativo de la respuesta, no estimaciones; calibrar créditos en F8 (§9.3) |
| Proveedor de imagen indefinido bloquea render 3D | Media | Alto | Adaptador conmutable; implementar 1 proveedor ya, comparar calidad/coste después (§9.1) |
| Abuso vacía saldo OpenRouter (pagamos antes de debitar) | Media | Alto | `spend-guard`: rate-limit + cap diario + circuit-breaker antes de cada llamada; cap **global** anti-sybil en F8 |
| Una sola llamada dispara coste ilimitado (prompt "10k tokens" / imagen gigante) | Media | Alto | `call-limits`: `max_tokens` por llamada + límite tamaño/dimensiones imagen, aplicado antes del proveedor |
| Caída de OpenRouter (SPOF) corta toda la IA | Media | Alto | `gateway-fallback`: conmuta a gateway/proveedor secundario configurable; provider/baseURL desde allowlist (no arbitrario) |
| SSRF vía `image_url` arbitraria / decompression bomb | Media | Alto | `input-sanitizer`: magic bytes + límite de dimensiones + strip EXIF + re-encode; prohibida URL externa del usuario |
| Claves filtradas al bundle cliente | Baja | Crítico | Solo `src/server/**`; lint rule contra `process.env.*_KEY` en código cliente |

## Security Considerations
- Claves exclusivamente server-side (`process.env`); nunca en RSC payload, props ni respuestas a cliente.
- Validar imágenes de entrada por **magic bytes** (no solo MIME), limitar dimensiones, **strip EXIF** y re-encodear server-side; **prohibida** `image_url` arbitraria del usuario (anti-SSRF: solo asset propio).
- `spend-guard` protege el saldo OpenRouter: rate-limit por user/org, cap diario de gasto, circuit-breaker (pagamos al proveedor antes de debitar al usuario).
- No loggear contenido de prompts con datos sensibles; loggear solo metadatos (modelo, tokens, latencia).
- El control de licencia fair-code (la key como cuello de botella, §8) se materializa en F13; este adaptador es el punto único de acceso a IA que F13 protegerá.

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor), unit/Vitest con **HTTP de OpenRouter interceptado** (el SDK no toca red):
- **Structured output válido**: `chat({ responseSchema })` arma `response_format json_schema strict` y parsea/valida la respuesta del fake; refusal o JSON inválido → `AiError` tipado. Rojo sin adaptador.
- **model-config-loader (integration, Postgres efímero)**: con `ModelConfig` sembrado, `getModelConfig('chat')` devuelve el modelo guardado; segunda lectura usa caché (no recarga BD); tras `invalidate()` relee el valor actualizado. **Tabla vacía → devuelve defaults de código**, no error (la IA nunca queda sin modelo). Rojo sin loader.
- **Fallback de modelos**: con el primario "caído" (fake error), responde con el 2º vía `extra_body.models`. Verde al cablear el routing.
- **Fallback de gateway (SPOF)**: con el gateway **primario** devolviendo 5xx/error de red, `gateway-fallback` conmuta al **secundario** configurado y responde. Rojo sin la abstracción de gateway.
- **call-limits**: una llamada de chat sin `max_tokens` recibe el techo por defecto; una imagen sobre el límite de dimensiones/tamaño → `AiError(call_limit)` SIN tocar al proveedor. Rojo sin `call-limits`.
- **input-sanitizer (anti-SSRF/bomb)**: rechaza magic bytes inválidos, dimensiones excesivas e `image_url` externa del usuario; acepta asset propio re-encodeado. Rojo sin sanitizer.
- **spend-guard**: al superar el cap diario / rate-limit, lanza `AiError(spend_cap)` SIN llamar al proveedor (circuit-breaker). Verde al implementar el guard.
- **usage→coste**: parsea `usage` (tokens) y coste-por-imagen a `ProviderCost` con unidad distinguible.
- **Mock:** se mockea la API de OpenRouter y del proveedor de imagen (fakes deterministas, cero red en CI). NO se mockea el sanitizer, el routing, el spend-guard ni el `model-config-loader` (lógica propia bajo prueba); el loader corre contra **Postgres efímero** (no mock de Prisma). Smoke real opcional, fuera del pipeline.

## Next Steps
Desbloquea **F5** (agente intérprete de 5 fases) y aporta el `inpaint`/`generate` que consume **F7** (feedback + render 3D). El `usage`/`cost` alimenta **F8** (créditos). Punto de control único que **F13** envuelve para la licencia. El `model-config-loader` (y su `invalidate()`) lo consume el **panel de config de modelos** del back-office, que edita `ModelConfig` en BD; F3 solo lee.
