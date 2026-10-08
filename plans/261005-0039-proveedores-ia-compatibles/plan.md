# Proveedores de IA compatibles con OpenAI (texto y visión)

Estado: implementado sin commit · 2026-10-05 (tests en `tests/admin/custom-providers.test.ts`; guía en `docs/site/src/content/docs/admin/proveedores-ia.md`). Pendiente: probar con una clave real de APIMart.

## Objetivo
Desde Administración → Modelos, añadir proveedores con API compatible con OpenAI (URL base + API key), habilitar sus
modelos de texto y visión con nombre, usos y precio, y elegirlos en las rutas de cada uso. APIMart viene preconfigurado
(`https://api.apimart.ai/v1`); NodeClub.ai u otros se añaden con su URL.

## Límites
- Solo texto y visión (chat completions). Imágenes (render, edición) quedan para otra fase.
- Garantías que se mantienen: la clave de un proveedor solo va a su URL (https; cambiar la URL exige clave nueva),
  techo de precio por uso, auditoría y coste por llamada (estimado con el precio declarado si el proveedor no lo da).

## Fases
1. Prisma: `AiCustomProvider` (id, label, baseUrl) y `AiCustomModel` (providerId, model, label, actions, priceUsdPerUnit).
2. Servidor: registro en caché (`custom-ai-providers.ts`), allowlist y rutas dinámicas, operaciones del panel con
   validación y auditoría, coste estimado.
3. Panel: sección de proveedores (alta, clave, probar conexión con `/models`, modelos) y opciones en las rutas.
4. Tests y documentación (técnica y de administración, con APIMart).

## Criterios de aceptación
- Un proveedor añadido con su clave aparece en el panel; «Probar conexión» lista sus modelos o explica el fallo.
- Un modelo habilitado para «vision» se puede elegir como principal o respaldo y las llamadas van a su URL.
- Un precio por encima del techo del uso o una URL no https se rechazan.
