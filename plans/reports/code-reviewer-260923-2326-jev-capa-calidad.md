# Revisión de código — `feat/jev-capa-calidad` vs `develop`

Fecha: 2026-09-23 23:26 (Europe/Madrid) · Diff: `git diff develop...feat/jev-capa-calidad`
Alcance: 211 ficheros, +16.028 / −1.092. Revisión de solo lectura.

## Verificaciones ejecutadas

- `npx tsc --noEmit`: **limpio**, sin errores.
- Tests: **no ejecutados**. `vitest` aborta en el arranque (`Error: Destino de pruebas no autorizado`),
  la configuración exige la BD local de pruebas (`habiteka_test_editor_v2`), que no está disponible
  en esta sesión. Antes de mergear conviene correr la suite completa en local.
- Reglas del repo: sin ficheros > 1000 líneas entre los tocados (máximo `editor-shell.tsx`, 889);
  **0** `useEffect` nuevos añadidos en el diff; textos de usuario en castellano peninsular.

## Veredicto

Ningún hallazgo BLOQUEANTE de seguridad, integridad de datos ni compatibilidad. Sí hay una
**precondición de despliegue** que, si no se cumple, degrada toda la experiencia de generación
(ver B1), y tres riesgos de coste/estado que conviene arreglar pronto.

---

## 1. Seguridad / IDOR — correcto

Revisado uno a uno; no se ha encontrado ningún hueco:

- `editor-quality-actions.ts:31-35` — `requireOrgContext` + `withOrg(ctx).projects.findById` antes
  de evaluar, y tope de 4 MB del documento serializado.
- `deliverable-actions.ts:31-34, 63-66, 143-146` — `assertProjectInOrg` + `loadDeliverable` acotado
  por `organizationId` + comprobación explícita `deliverable.projectId !== projectId`.
  `startDesignVariant` valida además la zona contra `withOrg(ctx).zones.list(projectId)`
  (cierra el hueco de scope de zona que arrastraban otras acciones).
- `assistant-plan-actions.ts:38` — la pertenencia la impone `loadStudio(ctx, projectId)`; además
  `assertConsent` + `assertTosAccepted` antes de persistir imagen.
- `agent-actions.ts` — todos los puntos de entrada nuevos mantienen `assertProjectInOrg` y
  `assertZoneInProject`.
- `src/app/api/admin/quality/export/route.ts:17-21` — `requireAdmin()` con `ForbiddenAdminError` → 403;
  `quality-actions.ts:8` revalida RBAC en la acción de lectura. `requireAdmin` exige `role === 'admin'`
  de la sesión del servidor (`src/server/admin/guard.ts:26-32`).
- `quality-queries.ts` — todo `$queryRaw` es **parametrizado** (`Prisma.join` sobre constantes
  internas, nunca sobre entrada del usuario). Los filtros solo aceptan rango de fechas.
- `api/iterations/route.ts:75-93` — mejora real: `failureResponse` deja de filtrar `err.message`
  de BD/proveedor/storage (404 / 422 `UserFacingError` / 500 genérico con log en servidor).
- `render-asset-reader.ts` — conserva `assertSafeImportUrl`, `redirect: 'error'`, tope de bytes por
  streaming y saneado por bytes; el cambio a `sanitizeOwnRenderBuffer` solo reescala imágenes propias.

## 2. Migraciones Prisma — correctas

`20260923150000_ai_quality_evaluation` y `20260923160000_ai_quality_evidence_index` son puramente
aditivas: una tabla nueva sin FKs y un índice `IF NOT EXISTS`. Ningún `ALTER`/`DROP` sobre tablas
existentes, sin pérdida de datos y compatibles con `prisma migrate deploy`.

**MENOR (deriva de esquema):** la migración añade tres `CHECK` (`decision`, `score`, `inputTokens`)
que no existen en `prisma/schema/admin.prisma:184-210`. Prisma no modela `CHECK`, así que el próximo
`prisma migrate dev` generará una migración que **los elimina** silenciosamente. Documentarlo en el
modelo (comentario) o asumir la pérdida conscientemente.

---

## Hallazgos

### B1 — IMPORTANTE (precondición de despliegue): sin credencial `typesafe`, TODA generación pide confirmación

`jev-client.ts:71` → `resolveProviderKey('typesafe')`, que **lanza** si no hay credencial habilitada
(`src/server/ai/provider-key-resolver.ts:12-14`). `evaluate.ts:75-88` traga el error y devuelve
`unavailable()` → `decision: 'confirm'`, `failOpen: false`. Esa decisión **no se cachea**
(`evaluateCheckpointCached` solo reutiliza filas con `failOpen: true`, `evaluate.ts:145`), así que
cada intento vuelve a fallar y a insertar una fila en `ai_quality_evaluation`.

Efecto en producción con la BD actual (sin claves de IA cargadas en el panel, según el estado
conocido del despliegue): render de concepto, propuesta editable, vista 3D, cenital del estudio,
cenital del plano e iteraciones exigen **marcar la casilla de confirmación en cada generación**,
con el mensaje «No se pudo evaluar la calidad con Jev». No hay pérdida de datos ni riesgo de gasto
—es fail-closed, como pide el plan—, pero es un cambio de experiencia notable en el primer arranque.

Acción antes de desplegar v0.3.0: cargar la clave de TypeSafe en el panel de admin
(`Config → IA → TypeSafe`, `adminUpdateTypesafeProvider`) y verificar con `scripts/jev-smoke.ts`.

### B2 — IMPORTANTE: el timeout de captura rompe la serialización de la cola (3D)

`editor-scene-view.tsx:128` envuelve el trabajo en `withTimeout(...)` y **la cola encadena la
promesa acotada**, no la tarea real: `captureQueue.current = job.catch(() => undefined)`
(línea ~228). `withTimeout` documenta explícitamente que la tarea original sigue su curso
(`src/lib/async-wait.ts:41-44`).

Consecuencia: si una captura agota los 45 s, la siguiente entra mientras la anterior sigue dentro
del `try` moviendo cámara, `overrideMaterial`, `clippingPlanes` y visibilidad de muros/luces. El
`finally` de la primera restaurará el estado **encima** de la segunda. Resultado posible: captura
negra, máscara de zonas desalineada o muros que no debían salir — y todo ello alimenta una
generación de pago. Es justo el fallo que la cola existía para evitar.

Arreglo sugerido: encadenar la cola a la tarea interna (`captureQueue.current = inner.catch(…)`) y
usar `withTimeout` solo para lo que devuelve el llamador.

### B3 — IMPORTANTE: render por zonas paga dos generaciones y puede quedarse sin entregable

`zone-composite-render.ts:63-73`:

```ts
const [base, design] = await Promise.all([input.image.generate(input.base), input.image.generate(input.design)]);
```

1. Si una de las dos pasadas falla, `Promise.all` rechaza pero **la otra ya se ha pagado** y su
   resultado se descarta: coste sin entregable. Lo mismo si falla `readRenderReference`,
   `compositeZoneImages` (sharp) o el `storage.put` posterior: dos generaciones cobradas, cero
   imágenes para el usuario.
   Sugerencia mínima: ante fallo de composición, persistir el render de diseño ya generado en vez
   de tirarlo (`allSettled` + degradación a `design_only`).
2. El comentario «Misma semilla en las dos pasadas» no se cumple con el proveedor de render real:
   `seed` existe en el contrato (`src/lib/contracts/image-adapter.ts:22,31`) pero el **único**
   proveedor que lo usa es `src/server/ai/image/providers/flux.ts`. Con KIE (el baseline de
   `render3d`) las dos pasadas tendrán iluminación y acabados distintos y la costura del
   `blur`/`lerp` se notará. Hay que verificarlo antes de vender la función, o restringirla al
   proveedor que honra `seed`.
3. El coste estimado que se muestra (`estimateConceptRenderFromEditor`, `agent-actions.ts:618`)
   multiplica precio × nº de vistas y **no** contempla el x2 del modo compuesto.

### B4 — IMPORTANTE: el veredicto del plano del estudio se queda obsoleto tras redibujar

`studio-actions.ts:63` (`redrawStudio`) y `:81` (`selectRedrawStudio`) guardan `{ ...state, plan: … }`
conservando `state.quality` (y `state.planImport`) aunque el plano de trabajo sea **otra imagen**.
`selectRedrawStudio` limpia `plano` y `cenital` pero no `quality`.

`assertStudioPlanQuality` devuelve directamente `state.quality` si existe
(`studio-plan-gate.ts:36`), de modo que un plano recién redibujado —nunca leído por el pipeline—
puede pasar la puerta con el `proceed` de la extracción anterior. Es una fuga en dirección permisiva
de la propia puerta que justifica la fase.

Arreglo: invalidar `quality` (y `planImport`) en los `saveStudio` que cambian la imagen de trabajo.

### B5 — MENOR: zonas permitidas ignoradas en silencio si la petición no trae captura

`agent-actions.ts:530-536` solo exige la máscara cuando hay `capture`:
`if (zoneCompositeActive(options) && capture) { … fail('Falta la máscara…') }`. Una petición con
`regions` y sin captura (posible desde el diálogo, ver `editor-generate-dialog.tsx:360`) genera una
única pasada **sin restricción de zona**: el usuario paga y recibe algo distinto de lo pedido, sin
aviso. Debería fallar explícitamente (`zoneCompositeActive(options) && !capture` → `fail`).

### B6 — MENOR: idempotencia por `countIterations` en el endpoint del lienzo

`feedback-orchestrator.ts:73-76`: sin `attemptId`, la clave de cobro usa el número de iteraciones
ya registradas. Dos peticiones simultáneas leen el mismo contador → misma clave → la segunda se
deduplica en el cobro pero **sí** ejecuta su generación: coste sin debitar. La ruta de Server Action
usa `randomUUID()` y no tiene el problema; el endpoint `/api/iterations` no lo pasa.

### B7 — MENOR: Server Actions muertas con puerta y sin `runAction`

`generateDesignFromEditor` (`agent-actions.ts:284`), `generateCenitalFromRedrawn` (:882) y
`generateCenitalFromPlano` (:922) **no tienen ningún llamador en `src/`** (verificado por grep) y
además no están envueltas en `runAction`, así que los nuevos `fail()` de la puerta (bloqueo /
confirmación) se propagarían como un 500 opaco en lugar del mensaje redactado. Siguen expuestas como
endpoints de Server Action. O se envuelven en `runAction`, o se borran.

### B8 — MENOR: rendimiento del panel de eficacia

`quality-queries.ts` → `rehecho AS (SELECT DISTINCT "deliverableId" FROM "iteration")` recorre la
tabla `iteration` completa sin filtro de fecha. Hoy es barato; crecerá sin límite. Acotarlo por el
rango consultado.

### B9 — MENOR: latencia añadida por puerta

Cada generación encadena hasta dos llamadas a Jev (`assertEditorQuality` + `assertFreePromptQuality`),
cada una con 30 s de timeout y hasta 2 reintentos (`jev-client.ts:22-24, 76-80`). En el peor caso
son ~3 min antes de empezar a generar. Con Jev sano son <1 s, pero conviene bajar el timeout o
paralelizar las dos puertas (no dependen entre sí).

---

## Puntos correctos que conviene no perder

- El orden **puerta → adaptador de pago** se cumple en todos los caminos revisados: `studio-actions.ts:135`
  (antes de `getImageAdapterForAction`), `agent-actions.ts:501-516`, `:409-424`, `:893`, `:932`,
  `deliverable-actions.ts:70-77` (antes de `buildFeedbackDeps`/reserva de créditos),
  `api/iterations/route.ts:52-60` (antes del `hold`).
- Fail-closed correcto: `evaluate.ts:75-88` + `unavailable()` nunca devuelven `proceed`, y ni
  `assertEditorQuality` ni `assertStudioPlanQuality` ni `assertInstructionQuality` aceptan el
  veredicto del cliente: solo el `ack` booleano, revalidando en servidor.
- La evaluación posterior a la entrega/iteración nunca rompe la entrega (`result-gate.ts:64-80`,
  `iteration-result-gate.ts:33-57`), con presupuesto total acotado.
- `renderZoneMask` (`zone-mask.ts:97-115`) restaura `background`, `overrideMaterial` y `clearColor`
  en `finally`; el `finally` de la captura restaura cámara, fov, controles, selección, muros
  (`hideWallsFacingCamera`), iluminación (`revealHiddenLighting`) y `clippingPlanes` aun si falla.
  El único agujero de estado es el de B2.

## Acciones recomendadas antes de mergear/desplegar

1. Cargar la credencial de TypeSafe en producción y comprobar con `scripts/jev-smoke.ts` (B1).
2. Ejecutar la suite completa en local con la BD de pruebas (no se ha podido aquí).
3. Arreglar B2 (cola de capturas) y B4 (veredicto obsoleto tras redibujar): son baratos y tocan
   estado que alimenta gasto.
4. Decidir sobre B3: al menos degradar a `design_only` cuando falle la composición, y verificar el
   soporte de `seed` del proveedor de `render3d` antes de anunciar «zonas garantizadas».
5. B5–B9 pueden ir en un seguimiento.

## Preguntas abiertas

- ¿El proveedor de `render3d` en producción es KIE? De serlo, la coherencia entre las dos pasadas
  del render por zonas no está garantizada (B3.2).
- ¿Se asume que el x2 de coste del modo compuesto no se muestra al usuario, o falta reflejarlo en
  la estimación?

Status: DONE_WITH_CONCERNS
Summary: Es mergeable —sin fallos de seguridad, migraciones aditivas y puertas antes del gasto—, pero antes de desplegar v0.3.0 hay que cargar la clave de TypeSafe (si no, toda generación pedirá confirmación), correr la suite local y arreglar la cola de capturas del 3D y el veredicto obsoleto del estudio tras redibujar.
