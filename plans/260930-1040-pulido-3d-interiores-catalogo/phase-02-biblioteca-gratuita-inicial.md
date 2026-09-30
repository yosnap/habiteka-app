---
title: "Fase 2: Biblioteca gratuita inicial de ambientación"
status: todo
---

# Fase 2: Biblioteca gratuita inicial de ambientación

## Contexto

58 entradas de `FURNITURE_CATALOG` (`src/lib/editor-document/furniture-catalog.ts:29-87`) no
tienen GLB y se dibujan como cajas. La IA de propuesta solo coloca catálogo
(`native-design-proposal.ts:163-169`), así que la pobreza del catálogo limita el diseño
automático. Según el [informe de precios](../reports/researcher-260930-1040-precios-licencias-modelos-3d.md),
lo único seguro para servir GLB al navegador es CC0/CC-BY, propio, encargo o IA con plan de pago;
Poly Haven (115 modelos de mobiliario PBR, CC0) es la mejor base. Existe
`scripts/download-poly-pizza-models.mjs` como patrón de descarga.

## Requisitos

- Mínimo 60 activos nuevos con GLB (llegar a ≥ 95 activos con modelo), todos por
  `scripts/optimize-models.mjs`, con ficha de licencia en el manifiesto.
- Estilo coherente: prioridad Poly Haven (PBR) > Sketchfab CC0 filtrado > Quaternius/Kenney solo
  para relleno donde no haya alternativa; nunca mezclar low-poly y PBR en la misma estancia de las
  10 cámaras.
- Registro de atribución visible: página/documento de créditos generado desde el manifiesto (los
  CC-BY lo exigen; `sofa.glb` ya es CC-BY-4.0, `manifest.json` entrada 2).

## Categorías y cantidades objetivo (interior)

| Categoría | Nº | Fuentes candidatas | Sustituye perfil de cajas |
|---|---|---|---|
| Sofás, butacas, pufs | 8 | Poly Haven (sofa, armchair), Sketchfab CC0 | sofa, sofa-chaise, sofa-corner, sofa-modular |
| Mesas (centro, auxiliar, comedor, escritorio) | 8 | Poly Haven | table |
| Sillas y taburetes | 6 | Poly Haven (dining_chair, bar_stool, office_chair) | chair |
| Camas con ropa de cama | 4 | Sketchfab CC0 / generado IA (fase 5) | bed |
| Almacenaje (armario, cómoda, aparador, mueble TV, mesita) | 8 | Poly Haven (wardrobe, drawer, cabinet) | cabinet |
| Estanterías (vacías y vestidas) | 4 | Poly Haven (bookshelf), Sketchfab CC0 | shelf |
| Lámparas (pie, mesa, colgante, araña, aplique) | 8 | Poly Haven (lamp, chandelier, pendant), Sketchfab CC0 | lamp + luminarias |
| Plantas de interior (maceta, colgante, árbol de interior) | 6 | Poly Haven (potted plant, monstera, ficus) | plant |
| Decoración (jarrones, libros, velas, cuencos, reloj) | 10 | Poly Haven (vase, books, bowl, candle) | decor |
| Cuadros y espejos | 6 | procedural (marco + textura) + Poly Haven (mirror) | — (nuevo perfil `wall-art`, `mirror`) |
| Baño (lavabo, inodoro, bañera, ducha, toallero, accesorios) | 6 | Poly Haven, Sketchfab CC0 | sink, toilet, bath, shower |
| Cocina (frentes, isla, electrodomésticos) | 6 | Poly Haven (kitchen), Sketchfab CC0 | kitchen, appliance |
| Cortinas y estores | 4 | fase 5 (generación/encargo); aquí solo mejora de perfil | curtain |
| Alfombras | 4 | Poly Haven (rug), textura + plano con desplazamiento | rug |

## Archivos

- `public/models/cc0/*.glb` nuevos (nombre `<kind>.<hash8>.glb`) y entradas en `manifest.json`.
- `scripts/download-polyhaven-models.mjs` (nuevo, ≤ 150 líneas): lista `WANTED` de slugs Poly
  Haven → descarga glTF 1K → llama a `optimize-models.mjs`. Reutiliza la estructura de
  `download-poly-pizza-models.mjs`.
- `src/lib/editor-document/furniture-catalog.ts`: por cada entrada sustituida por un activo con
  GLB, mantener el `id` y añadir `assetKind` (enlace al manifiesto) en vez de crear entradas
  paralelas `habiteka:asset:*`; así no se duplican sofás en el panel. Las entradas `ASSET_CATALOG`
  actuales se conservan por compatibilidad de documentos.
- `src/lib/editor-document/furniture-assets.ts`: `furnitureAsset()` resuelve también por
  `assetKind` de la entrada del catálogo.
- Nuevo `docs/creditos-activos-3d.md` generado por `scripts/validate-model-manifest.mjs --credits`
  y enlazado desde la página legal existente (`src/components/legal/**`, solo enlace).
- Tests: `tests/editor-document/catalog-additions.test.ts` (ya existe) ampliar con «toda entrada de
  las 10 cámaras tiene GLB»; `tests/editor-document/furniture-assets-review.test.ts` (existe)
  ampliar con licencia y atribución obligatoria.

## Pasos

1. Curar lista (hoja en `plans/reports/referencia-interiores/curacion-activos.md`: slug, licencia
   verificada con URL y fecha, cotas, categoría, perfil que sustituye).
2. Descargar + optimizar por lotes de 10; revisar en el editor: orientación (`front`), escala,
   materiales, sombras; corregir en el manifiesto.
3. Vincular entradas del catálogo (`assetKind`); rebajar a «solo caja» las que no tengan sustituto.
4. Generar créditos; comprobar que los CC-BY aparecen.
5. Prueba de referencia: objetivo ≥ +15 puntos en «Fidelidad de objetos» y «Vegetación y
   decoración» respecto a la línea base; `metrics.json` dentro de presupuesto.

## Validación

- `validate-model-manifest.mjs` verde; total `public/models` ≤ 40 MB (≈ 95 activos × ~400 KB).
- Panel de catálogo (`catalog-panel.tsx`) sin entradas duplicadas del mismo mueble.
- Proyecto «FInca»: los 35 objetos sin GLB pasan a tener modelo o quedan listados en el informe.

## Riesgos

- Licencia mal leída en Sketchfab (CC-BY-NC) → exigir captura de la página de licencia por activo
  en la hoja de curación; `attributionRequired` obligatorio si CC-BY.
- Mezcla de estilos → regla de «una fuente por estancia» en las cámaras de referencia.
- Tiempo de curación humana: 2-4 h por lote de 10; es la mayor parte del esfuerzo.

## Rollback

Retirar GLB + entradas de manifiesto + `assetKind`; los documentos vuelven al perfil de cajas
sin error (comportamiento actual de `FurnitureModel` cuando no hay activo).

## Decisiones para Paulo

- Presupuesto inicial: 0 € (solo CC0) o hasta 150-200 € (Meshy/Sloyd 2-3 meses + licencias custom
  puntuales) según el informe.
- ¿Aceptas CC-BY con página de créditos, o solo CC0?
