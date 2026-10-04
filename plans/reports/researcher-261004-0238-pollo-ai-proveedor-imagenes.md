# Pollo.ai como proveedor de imágenes para Habiteka

Fecha: 2026-10-04. Investigación documental; no se ha llamado a ninguna API ni generado imágenes.

## Conclusión

Pollo.ai no aporta un modelo distinto: revende el mismo GPT Image 2.5 (Flare y Sunburst) que Habiteka ya usa vía KIE. Su única ventaja verificada es que expone el parámetro `quality`, que KIE no expone. No compensa integrarlo como proveedor principal con la información verificable.

Hipótesis principal: que Flare parezca más realista puede deberse al nivel de calidad aplicado (no controlable en KIE) y no al modelo. Merece una prueba A/B con `quality` fijado.

## API (documentación oficial)

- Documentación pública: <https://docs.pollo.ai/llms.txt>, <https://docs.pollo.ai/openapi.json>. API lanzada el 2026-07-02.
- Base `https://pollo.ai/api/platform`, cabecera `x-api-key`.
- `POST /v1/generation/openai/gpt-image-2-5/image` con `{ input, webhookUrl }` → `{ taskId, status }`; sondeo `GET /v1/generation/{taskId}/status` (`waiting | processing | succeed | failed`), con `costUsd`.
- Webhook con firma HMAC-SHA256 y hasta 10 reintentos.
- Entradas solo por URL HTTPS (JPG/PNG); base64 prohibido. Resultados retenidos 14 días.
- Límites sin cifras: códigos `RATE_LIMIT_*` y `PARALLEL_TASK_LIMIT_REACHED`.

## Modelos con varias referencias (OpenAPI de Pollo)

| Modelo | Refs máx. | Prompt máx. | Salida | Encaje |
|---|---|---|---|---|
| GPT Image 2.5 (flare/sunburst, `quality` hasta `max`) | 16 | 32.000 | 1K/2K/4K | Candidato |
| Nano Banana Pro | 8 | 10.000 | 1K/2K/4K | Candidato |
| Nano Banana 2 | 14 | 10.000 | 0,5K–4K | Candidato |
| Seedream 5.0 Pro | 10 | 2.000 | 1K/2K | Prompt corto |
| Qwen Image 3 / 3 Pro | 3 | 4.500 | 1K/2K | Insuficiente |
| Flux Kontext / Flux 2 Max | 1 | 2.000 | — | Descartado |

## Precio

- KIE (verificado): GPT Image 2.5 a 0,03 / 0,05 / 0,08 USD en 1K / 2K / 4K, igual para Flare y Sunburst.
- Pollo: crédito a 0,06 USD; recargas desde 80 USD (≈800 imágenes, ≈0,10 USD de media, inferido). Precio por modelo no verificable (página tras Cloudflare).
- Observación del código: `src/server/ai/image/providers/kie-image.ts` registra `imageCost(0.04)` para todas las imágenes de KIE, distinto de la tarifa 4K y del precio de Sunburst en la allowlist (comprobado en el código).

## Realismo y geometría

Evidencia débil y de terceros; ninguna prueba con maquetas seccionadas. Arena sitúa Sunburst por encima de Flare en edición multimagen (1535 frente a 1501), en contra de la percepción del equipo. Afirmaciones sin pruebas de que Nano Banana Pro respeta mejor la geometría.

## Condiciones (sin verificar)

Términos, privacidad y precios devuelven 403. Según terceros: operador HIX.AI (Singapur), sin región de datos declarada ni mención al RGPD; comparte entradas con OpenAI, Google y otros. Opiniones de consumidores con quejas de cobros y soporte.

## Recomendación

1. A/B de Flare frente a Sunburst con `quality` fijado (`high`/`xhigh`) mediante OpenAI directo. Requiere parametrizar `OpenAiImageProvider` (hoy fijo a `gpt-image-2`; `src/server/ai/index.ts` ignora `route.model`) y su tamaño máximo.
2. Nano Banana Pro a 2K en KIE, ya integrado: cambiar la resolución fija `1K` de su rama en `kie-image.ts`. Candidato para el problema de la cámara.
3. Pollo solo si 1 y 2 no bastan. Integración estimada: un `pollo-image.ts` como `kie-image.ts`, URLs firmadas de MinIO, nuevo proveedor en la allowlist y en `createImageAdapter`, y gestión de límites.

## Preguntas abiertas

- ¿Hay cuenta o clave de Pollo para consultar `/estimate`?
- ¿La organización de OpenAI admite `gpt-image-2.5-*` en `images.edit` con varias referencias?
- ¿Qué `quality` aplica KIE por defecto?
- ¿Se acepta un proveedor sin región de datos declarada para planos de clientes?

## Fuentes

- Pollo: [docs](https://docs.pollo.ai/llms.txt), [OpenAPI](https://docs.pollo.ai/openapi.json), [GPT Image 2.5](https://docs.pollo.ai/openai/gpt-image-2-5.md), [estado de tarea](https://docs.pollo.ai/task/get-task-status.md), [webhooks](https://docs.pollo.ai/webhooks.md), [precios](https://docs.pollo.ai/pricing.md)
- KIE: [GPT Image 2.5](https://kie.ai/gpt-image-2-5), [Sunburst imagen a imagen](https://docs.kie.ai/market/gpt/gpt-image-2-5-sunburst-image-to-image.md), [Nano Banana Pro](https://docs.kie.ai/market/google/pro-image-to-image.md)
- OpenAI: [Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare), [Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst), [guía de imágenes](https://developers.openai.com/api/docs/guides/image-generation)
- Terceros: [Carat](https://carat.im/ru/curated/gpt-image-2-5-guide), [EvoLink](https://evolink.ai/blog/gpt-image-2-5-flare-vs-sunburst), [Educasium](https://educasium.com/en/blog/gpt-images-vs-nano-banana-pro-rendus-architecture), [tostracker](https://tostracker.app/document/polloai-privacy)
