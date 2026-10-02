---
title: "Fase 1: Pipeline de activos"
status: todo
---

# Fase 1: Pipeline de activos

## Contexto

Hoy el manifiesto (`public/models/cc0/manifest.json`) guarda procedencia y hash, pero las cotas
y el eje frontal viven codificados en `src/lib/editor-document/furniture-assets.ts:8-45,69-71`.
`prepareFurnitureModel` (`src/canvas/editor-v2/scene/furniture-model-transform.ts:6-32`) clona
la escena por instancia y escala **no uniforme** a las cotas del catálogo. `useGLTF(url, false,
true)` (`furniture-model.tsx:18`) ya activa meshopt; no hay KTX2, LOD, instanciado ni
presupuesto. El comentario de `src/canvas/3d/furniture-models.ts:8` dice que los GLB se
comprimieron con `@gltf-transform/cli`, pero no está en `package.json`.

## Requisitos

- Un solo manifiesto por activo con: `file, kind, source, author, license, attributionRequired,
  sha256, widthMm, depthMm, heightMm, front ('+z'|'-z'|'+x'|'-x'), triangles, bytes, textures
  ('ktx2'|'webp'), lod1File?, emissiveMaterials?, tintMaterialNames?, tags[]`.
- Script reproducible que optimiza cualquier GLB de entrada a ese estándar y rechaza lo que
  supere presupuesto.
- Cargador con KTX2 + meshopt, LOD por distancia, geometría compartida entre instancias del mismo
  activo, carga progresiva (placeholder → LOD1 → LOD0) y precarga por estancia visible.
- Escala uniforme por defecto; si el usuario cambia cotas, escala no uniforme solo dentro de ±15 %
  y aviso en la ficha (`furniture-context-panel.tsx` ya muestra cotas).

## Archivos

- `package.json`: devDependencies `@gltf-transform/cli`, `@gltf-transform/core`,
  `@gltf-transform/functions`, `@gltf-transform/extensions`; dependencia `three` ya trae
  `KTX2Loader` y `MeshoptDecoder` (`three/examples/jsm/loaders/KTX2Loader.js`).
- `public/basis/**`: transcoders KTX2 de three (copiar de `node_modules/three/examples/jsm/libs/basis`).
- Nuevo `scripts/optimize-models.mjs` (≤ 200 líneas): `node scripts/optimize-models.mjs
  <in.glb> --kind <kind> --source <url> --author <a> --license <spdx> [--front +z]` →
  dedup, prune, weld, `simplify` para LOD1 (ratio .35), `textureCompress` KTX2 (o WebP con
  `--webp`), resize ≤ 1024, `meshopt`; mide cotas/triángulos/bytes y añade/actualiza la entrada en
  `manifest.json`; falla si triángulos > 15 k o bytes > 2 MB.
- Nuevo `scripts/validate-model-manifest.mjs`: recorre manifiesto, comprueba que cada fichero
  existe, hash coincide, licencia ∈ {CC0-1.0, CC-BY-4.0, custom-habiteka}, campos obligatorios y
  que no existan GLB huérfanos; se añade al script `check` de `package.json`.
- `src/lib/editor-document/furniture-assets.ts`: eliminar la tabla `definitions` y derivar
  `ASSET_CATALOG` del manifiesto (cotas, `front`, etiqueta `label` nueva en manifiesto); mantener
  `furnitureAsset()` y los ids `habiteka:asset:<kind>` para no romper documentos guardados.
- Nuevo `src/components/editor-v2/scene/model-loaders.ts` (≤ 80 líneas): singleton de
  `KTX2Loader` (detectSupport con el renderer) y `MeshoptDecoder`; función `extendGltfLoader`
  para el 4.º parámetro de `useGLTF` [VERIFICAR firma en drei 10.7.7: `useGLTF(path, useDraco,
  useMeshOpt, extendLoader)`].
- `src/canvas/editor-v2/scene/furniture-model-transform.ts`: escala uniforme por cota mayor,
  centrado, `front`; no clonar geometría (compartida), clonar solo materiales cuando haya tinte.
- `src/components/editor-v2/scene/furniture-model.tsx`: usar `model-loaders`, `<Detailed>` de
  drei con LOD1 a > 8 m, precarga por estancia (`useGLTF.preload` de los `catalogId` de la
  planta activa), placeholder actual mientras carga.
- Tests: `tests/editor-document/furniture-assets.test.ts` (ya existe: adaptar a manifiesto),
  nuevo `tests/editor-v2/furniture-model-transform.test.ts` (escala uniforme, `front`, tolerancia
  ±15 %), nuevo `tests/scripts/validate-model-manifest.test.ts` (manifiesto de ejemplo válido e
  inválido).

## Pasos

1. Instalar dependencias; escribir `optimize-models.mjs` y `validate-model-manifest.mjs`.
2. Re-optimizar los 38 GLB actuales con el script (misma fuente, hash nuevo) y ampliar sus
   entradas del manifiesto con cotas medidas, `front`, triángulos y bytes. Confirmar que las cotas
   medidas coinciden ±5 % con la tabla `definitions` antes de borrarla; documentar discrepancias.
3. Derivar `ASSET_CATALOG` del manifiesto; ejecutar `tests/editor-document/furniture-assets*.test.ts`.
4. `model-loaders.ts` + cambios en `furniture-model.tsx` y `furniture-model-transform.ts`.
5. Ejecutar la prueba de referencia (fase 0): la puntuación no puede bajar y `metrics.json` debe
   mostrar menos bytes y mismas o menos draw calls.

## Validación

- `node scripts/validate-model-manifest.mjs` verde; `bun run test tests/editor-document
  tests/editor-v2` verde; `pnpm build` verde.
- En Chrome, un proyecto con 35 muebles carga sin «Modelo no disponible» y los modelos mantienen
  proporciones (comparar C4-C9 de la fase 0 con la línea base).
- Documentos antiguos con `catalogId` `habiteka:asset:*` siguen abriéndose (test de fixture).

## Riesgos

- KTX2 en Safari/iOS: `detectSupport` elige transcodificación; si falla, `--webp` como
  alternativa por activo (decisión abierta 3).
- Cambiar de escala no uniforme a uniforme altera el aspecto de documentos guardados cuyas cotas
  no coincidan con el modelo → migración: al cargar, si `|cota doc − cota modelo| > 15 %`,
  conservar el comportamiento antiguo (no uniforme) y marcar el mueble en la ficha.
- `useGLTF` cachea por URL; el hash en el nombre de fichero (`<kind>.<hash8>.glb`) evita caché
  obsoleta en producción.

## Rollback

Los GLB antiguos quedan en git; revertir el commit de la fase restaura manifiesto, tabla
`definitions` y cargador. Sin migración de BD.
