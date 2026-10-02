---
title: "Fase 7: Gemelo 3D de producto con stock"
status: todo
---

# Fase 7: Gemelo 3D de producto con stock

## Contexto

Habiteka venderá muebles de tiendas físicas conectados a su stock. `CatalogItem`
(`prisma/schema/catalog.prisma:6-38`) ya tiene `modelKey`, `widthM/depthM/heightM`, `storeSlug`,
`storeProductId`, `storePrice`, `storeProductUrl`; la ruta `/api/catalog/[kind]/model`
(`src/app/api/catalog/[kind]/model/route.ts:26-44`) sirve el GLB por redirección presignada con
anti-IDOR; la subida (`POST /api/catalog/upload`, restructuración fase 1) valida solo magic bytes y
25 MB. La fase 7 del plan integral define la **ficha comercial** (feed, precio, stock, enlaces).
Esta fase define el **lado de activo**: cómo se produce, valida, versiona y etiqueta el gemelo 3D
de un SKU. No bloquea la biblioteca genérica (fases 2-6) ni depende del socio piloto para
construirse; sí lo necesita para probarse con productos reales.

## Vías de producción (por prioridad de coste/calidad)

| Vía | Cuándo | Coste orientativo (informe) | Licencia de salida |
|---|---|---|---|
| GLB del fabricante | Marca lo facilita (BIM/GLB) | 0 | Contrato con el fabricante/tienda: uso en app web, extraíble por el usuario |
| Encargo a modelador | Piezas clave/hero del piloto | por negociar (contrato de cesión) | Propiedad Habiteka |
| IA foto/ficha → 3D (Meshy/Tripo/Rodin) | Volumen medio, formas simples | ~15-25 $/mes por plan; 20-35 créditos por modelo | Plan de pago: propiedad del cliente (verificar el día de contratar) |
| Fotogrametría (Polycam/RealityScan) | Producto físico disponible, formas orgánicas | plan ~7-20 $/mes | Verificar propiedad en plan usado |
| Aproximación (perfil de cajas o activo genérico similar) | Sin activo | 0 | Etiquetado obligatorio «aproximación» |

## Requisitos

- Extensión de `CatalogItem` (migración acotada): `sku`, `variantLabel`, `assetVersion Int`,
  `assetOrigin` (`manufacturer|commissioned|ai-generated|photogrammetry|approximation`),
  `assetLicense` (texto/SPDX + URL del acuerdo), `qcStatus` (`pending|approved|rejected`),
  `qcReport Json`, `triangleCount`, `modelBytes`, `frontAxis`, `emissiveMaterials Json`,
  `tintMaterialNames Json`, `stockStatus`, `stockCheckedAt`. Versiones anteriores del GLB se
  conservan (`modelKey` con sufijo de versión) para que un diseño aprobado siga apuntando a la
  versión que usó (plan integral: «el diseño aprobado no cambia si el feed se actualiza»).
- QC automático en servidor al subir (`src/server/catalog/model-qc.ts`, `@gltf-transform/core`):
  glTF válido, cotas medidas vs declaradas ±3 %, triángulos ≤ 15 k (LOD0) / ≤ 60 k con LOD1
  generado, texturas ≤ 2048² y ≤ 4 MB total, sin extensiones no soportadas, `front` detectado
  por bbox/heurística y confirmado a mano, materiales PBR con nombre (para tintes), sin luces ni
  cámaras embebidas. Optimización con el mismo pipeline de la fase 1 (meshopt + KTX2/WebP).
- Revisión manual en admin: vista R3F con 4 cámaras + fotos oficiales del producto al lado;
  botones aprobar/rechazar con motivo; solo `approved` se muestra como «producto exacto» en
  editor, visita y vídeo; `pending/rejected` cae a aproximación etiquetada.
- Vinculación con stock: `stockStatus` y `stockCheckedAt` se refrescan desde el adaptador de la
  fase 7 del plan integral (feed/CSV/API); esta fase solo expone los campos y su caducidad.
- El editor v2 ya carga `custom_*` por `/api/catalog/<kind>/model`; extender para
  `assetVersion` (`/api/catalog/<kind>/model?v=N`) y para `store` (org null) con las mismas
  reglas anti-IDOR.

## Archivos

- `prisma/schema/catalog.prisma` + migración `catalog_item_asset_qc`.
- Nuevo `src/server/catalog/model-qc.ts` (≤ 200 líneas) + `src/server/catalog/model-optimize.ts`
  (reutiliza funciones de `scripts/optimize-models.mjs` movidas a `src/server/catalog/gltf-pipeline.ts`
  para no duplicar; el script CLI importa de ahí).
- `src/app/api/catalog/upload/route.ts` (existe): llamar QC + optimización; guardar `qcReport`.
- `src/app/api/catalog/[kind]/model/route.ts`: parámetro `v`, `qcStatus` y scope `store`.
- Nuevo `src/app/api/catalog/[kind]/qc/route.ts`: `POST` aprobar/rechazar (rol admin).
- Nuevo `src/components/admin/catalog-qc/` (`qc-list.tsx`, `qc-preview.tsx`, `qc-decision.tsx`).
- `src/lib/editor-document/furniture-assets.ts`: `furnitureAsset()` resuelve items de BD por
  `catalogId` (`db:<id>`) además del manifiesto estático (un solo punto de resolución).
- Etiquetado en UI: `furniture-context-panel.tsx` muestra «Producto exacto (v3, aprobado)» o
  «Aproximación».
- Tests: `tests/server/catalog/model-qc.test.ts` (GLB de fixture válido, deformado, pesado),
  `tests/server/catalog/model-route.test.ts` (versión, anti-IDOR, `qcStatus`), Prisma en BD de
  tests `habiteka_test_editor_v2`.

## Pasos

1. Migración + tipos; `gltf-pipeline.ts` compartido con el script de la fase 1.
2. `model-qc.ts` con fixtures; integrar en upload.
3. Ruta de modelo versionada + QC; admin QC.
4. Resolución en `furniture-assets.ts` y etiquetado en el panel.
5. Prueba de extremo a extremo con 3 productos de muestra (1 GLB propio, 1 generado por IA con
   plan de pago, 1 aproximación): subir → QC → aprobar → colocar → capturar → etiqueta correcta.

## Validación

- Tests de servidor verdes en BD de pruebas; `pnpm build`.
- Un GLB con cotas fuera de ±3 % se rechaza con informe legible; uno válido queda `pending` hasta
  revisión manual.
- Diseño aprobado con `assetVersion 1` sigue mostrando v1 tras subir v2.

## Riesgos

- Licencias: un GLB del fabricante puede prohibir extracción por el usuario final igual que los
  marketplaces (informe, sección 2) → el acuerdo con la tienda debe cubrir «distribución en app
  web»; campo `assetLicense` obligatorio con URL del acuerdo.
- QC en servidor con GLB grandes (25 MB) → límite de tiempo 30 s ya previsto; ejecutar en cola si
  supera.
- Calidad IA irregular → revisión manual obligatoria; nada `approved` sin humano.

## Rollback

Migración aditiva (campos opcionales con defaults); revertirla no borra GLB. Sin `qcStatus`, la
ruta se comporta como hoy.

## Decisiones para Paulo

- Vía preferente y presupuesto por SKU (decisión 4).
- Quién revisa (rol admin) y si el socio piloto puede subir directamente sus GLB.
