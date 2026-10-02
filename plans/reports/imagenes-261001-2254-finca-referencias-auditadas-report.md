# Revisión real de referencias para construcción

## Autorización y ámbito

El usuario confirmó la propuesta de cinco referencias del proyecto FInca, revisión 156: Cenital, Frontal, Trasera, Izquierda y Exterior terminado. Máximo nuevo autorizado: $0.60 para KIE y verificación OpenRouter; sin generar otro vídeo. Iluminación Atardecer, libertad controlada, fijos protegidos, 12 zonas seleccionadas iguales a las de la preparación. No se transfirió ortofoto ni geolocalización en estas referencias aisladas.

Lote: `7aaa64a7-3e2b-472c-802c-3889184d1105`.

## Ejecución y resultados

Un solo inicio de lote desde la interfaz. Cuatro generaciones KIE `gpt-image-2-5-flare-image-to-image`, cuatro auditorías OpenRouter `google/gemini-3.7-flash`. Todos los intentos usaron el proveedor primario, sin respaldo ni reintento. El exterior se bloqueó antes de llamar a IA.

| Vista | Resultado | Revisión |
|---|---|---|
| Cenital | Descartada por la auditoría; no publicada como diseño | La inspección del candidato muestra que la placa de la isla se convierte en bandeja decorativa. La captura original conserva la placa. |
| Frontal | Guardada | Conserva los volúmenes, cubiertas, pérgolas y acceso visibles. |
| Trasera | Guardada | Conserva la separación de habitaciones y las cuatro camas visibles del dormitorio. |
| Izquierda | Guardada por la auditoría; descartada en revisión posterior | Convierte las cuatro camas en butacas. Se registró el motivo y se bloqueó su reutilización. |
| Exterior terminado | No generado, sin coste de generación/auditoría | Falta una cenital válida del mismo ámbito y permisos para fijar la identidad. |

El motivo textual original de la auditoría cenital fue sustituido en pantalla por el error posterior del exterior; no se conservó su veredicto detallado. La sustitución de la placa es una observación visual posterior, no una transcripción del veredicto. Se corrigió la pérdida de avisos por vista para futuras tandas.

La captura izquierda muestra las camas desde sus pies; la trasera generada conserva camas y la izquierda generada muestra butacas. Es un error de interpretación de la generación de imagen que la auditoría dejó pasar. No procede del plano ni de una nueva generación de vídeo.

La revisión de recortes confirma que las nuevas referencias laterales ocultan solo muros exteriores: frontal 1, trasera 6, izquierda 3; no se registran tabiques interiores ocultos. Esto verifica metadatos y distribución visible, no todos los detalles de cada píxel ni la coherencia completa de un vídeo futuro.

## Gasto y límite

- Cuatro imágenes: **$0.32 estimados**, según la tarifa configurada; no importe conciliado de factura KIE.
- Cuatro auditorías: **$0.02027925 confirmados** en las respuestas de OpenRouter.
- Total registrado: **$0.34027925**, dentro de $0.60. El descarte cenital y la izquierda consumieron su generación y auditoría.
- Límite global: **0 → 0.94 → 0**, con actualizaciones condicionadas al valor previo y AuditLog. Gasto previo de la ventana: $0.34 del piloto H3 anterior.
- Límite restaurado inmediatamente al terminar el lote, antes de la revisión y correcciones. Valor 0 comprobado de nuevo al concluir.
- La suma de costes de imágenes/auditorías vive en `AiRequestCost`; `aggregateSpendUsd` solo suma `UsageEvent`, por lo que no se usó como prueba del gasto nuevo del lote.
- No se generó otro H3 ni se alteró el vídeo anterior.

## Correcciones sin nuevas llamadas de pago

- Avisos de lote: se conservan todos los fallos por cámara, aunque otro error detenga la tanda.
- Prompt de imagen v15 y auditoría protegen explícitamente la función del mobiliario y la placa de cocina. No se acredita todavía su efecto sobre nuevas imágenes: no se han generado con v15.
- `generation.review` registra un descarte posterior con motivo y fecha. El render izquierdo se conserva en la galería, pero queda bloqueado para construcción, montaje y anclas de futuras vistas.
- El estudio muestra **Izquierda — No válida para construcción**, casilla desactivada y motivo. Frontal y Trasera siguen disponibles; **Preparar prueba H3** está desactivado por falta de cenital/exterior de la tanda.
- Documentación pública y técnica actualizada. La revisión posterior no tiene aún botón en la galería; no se anuncia como tal.

## Archivos y trazabilidad

Referencias guardadas:

- Frontal: `del-cmu7nm84n0001evmsi8nyt1ee-render3d-d8d6dc1c-d5f3-40be-b3ae-e45ed374cfdf`.
- Trasera: `del-cmu7nm84n0001evmsi8nyt1ee-render3d-3d928ac5-fe6c-464e-a512-b2b82de0dd60`.
- Izquierda descartada: `del-cmu7nm84n0001evmsi8nyt1ee-render3d-a3356f2d-96c5-4c39-bdaa-be7e0db532d3`.

Copias de Frontal y Trasera disponibles en `/Users/paulo/Downloads/habiteka-finca-frontal-revision156.png` y `/Users/paulo/Downloads/habiteka-finca-trasera-revision156.png`.

Evidencia local: `/tmp/habiteka-h3-pilot/new-image-costs.json`, `new-image-deliverables.json`, `new-provider-assets.json`, `candidate-top.png`, `new-front.png`, `new-back.png`, `new-left.png`. Los candidatos completos anteriores a la máscara se recuperaron del almacenamiento propio, sin regenerarlos.

## Verificación y pendiente

48 pruebas en seis archivos, TypeScript, ESLint de archivos afectados y `git diff --check`: correctos. `docs:updates` correcto y documentación Astro construida: 17 páginas, sin errores.

La tanda no está lista para otro vídeo: hay que conseguir una cenital fiel, una izquierda que conserve las camas y el exterior terminado del mismo diseño, y revisar su continuidad. No se consideran corregidos los resultados anteriores por cambiar un prompt. No se hicieron llamadas adicionales para reintentar los descartes.
