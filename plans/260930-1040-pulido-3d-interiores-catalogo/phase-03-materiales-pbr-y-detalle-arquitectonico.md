---
title: "Fase 3: Materiales PBR y detalle arquitectónico"
status: todo
---

# Fase 3: Materiales PBR y detalle arquitectónico

## Contexto

`SurfaceMaterial` (`src/components/editor-v2/scene/surface-material.tsx:14-45`) usa
color+normal+roughness JPG 1K de Poly Haven (`public/materials/polyhaven/manifest.json`, 62
materiales, 110 MB), sin AO y sin compresión GPU. Muros (`src/canvas/editor-v2/scene/wall-meshes.ts`),
suelos (`floor-meshes.ts`) y huecos (`opening-meshes.ts`) no tienen zócalos, marcos ni alféizares
(grep vacío). `BoxMesh` (`scene-meshes.tsx:14-39`) ya soporta `topMaterialId`, `bodyMaterialId`,
`sideMaterials`.

## Requisitos

- Materiales con AO (`aoMap`, con UV2 = UV en superficies generadas) y, cuando el material lo
  tenga, `displacement` desactivado (coste) → solo normal.
- Texturas en KTX2 (o WebP) a 1K, con `scripts/download-surface-materials.mjs` ampliado para
  descargar `ao` y convertir; `public/materials` ≤ 45 MB tras la conversión.
- 12 materiales nuevos orientados a interiores de referencia: mármol claro y oscuro, azulejo
  metro, microcemento, parquet roble claro/nogal, terrazo, papel pintado liso y con estampado
  sutil, tela de sofá, pintura mate (blanco, tonos tierra).
- Zócalo por estancia (alto 80 mm, saliente 12 mm, color/material propio) generado a partir del
  perímetro de cada estancia (`deriveRoomsSafe`, `src/lib/editor-document/rooms.ts`) restando
  huecos de puertas.
- Marcos de puerta y ventana (jamba 60 mm, saliente 15 mm), alféizar interior (200 mm de fondo)
  y cornisa opcional (perfil 60 mm) en `opening-meshes.ts`.

## Archivos

- `scripts/download-surface-materials.mjs`: añadir mapa `ao`, `--ktx2|--webp`, actualizar manifiesto.
- `public/materials/polyhaven/manifest.json`: campo `maps.ao` y `format`.
- `src/components/editor-v2/scene/surface-material.tsx`: cargar `ao`; `KTX2Loader` desde
  `model-loaders.ts` (fase 1) mediante `useLoader`/`useTexture` según formato; mantener la API
  de props (`fabricSheen`, `useColorMap`, `tileSizeMm`).
- `src/lib/editor-document/schema.ts`: en la estancia/`FloorFinish`, campo opcional
  `trim?: { skirtingHeightMm: number; skirtingMaterialId?: string; skirtingColor: string;
  cornice: boolean }` con default zod (`skirtingHeightMm: 80`, `cornice: false`).
- Nuevo `src/canvas/editor-v2/scene/trim-meshes.ts` (puro, ≤ 150 líneas): a partir de una
  estancia y sus huecos devuelve segmentos de zócalo/cornisa `{ from, to, heightMm, depthMm }`
  y marcos por hueco; test unitario con estancia en L y una puerta.
- Nuevo `src/components/editor-v2/scene/trim-meshes.tsx` (≤ 120 líneas): renderiza esos
  segmentos como `boxGeometry` instanciada por estancia (una `InstancedMesh` por material),
  `castShadow`, `userData.cutawayWallId` heredado para que `CutawayWall` los oculte con su muro.
- `src/canvas/editor-v2/scene/opening-meshes.ts`: marcos y alféizar (mismo patrón de cajas).
- `src/components/editor-v2/scene/editor-scene-view.tsx`: una línea, montar `<TrimMeshes>` junto
  a `scene.polygons`.
- Panel: `src/components/editor-v2/floor-finish-panel.tsx` añade sección «Zócalo» (alto,
  color/material, cornisa) usando `ModernSelect` y `decimal-stepper.tsx` existentes.
- Tests: nuevos `tests/editor-v2/trim-meshes.test.ts`, `tests/editor-document/trim-commands.test.ts`
  (comando de cambio de zócalo con deshacer, siguiendo `commands.test.ts`).

## Pasos

1. Ampliar script de materiales; convertir los 62 existentes y añadir los 12 nuevos; verificar
   `sizeMm` real.
2. `surface-material.tsx` con AO + KTX2; comprobar `RoomEnvironment` + AO en C7 (baño) y C8.
3. Esquema `trim` + comando + panel.
4. `trim-meshes.ts` (+ test) → `trim-meshes.tsx` → montar en escena; comprobar recorte de muros
   (`cutaway-wall.tsx:113-134`) y captura por zona (plan integral, fase 3: el recorte por
   polígono debe descartar zócalos fuera de la zona igual que muros).
5. Marcos y alféizares en `opening-meshes.ts`; verificar que `door-sweep-placement` y las
   colisiones del paseo (`free-walk-*`) no cambian (los marcos no entran en colisión).
6. Prueba de referencia: objetivo ≥ +10 en «Materiales» y ≥ +15 en «Detalle arquitectónico»
   (C10 es la cámara de control).

## Validación

- Tests nuevos y existentes de `tests/editor-v2` y `tests/editor-document` verdes.
- `metrics.json`: draw calls no crecen más de +40 por planta con zócalos instanciados.
- Documentos existentes se abren con zócalo por defecto solo si Paulo lo decide (decisión 5); si
  no, `skirtingHeightMm: 0` por defecto y activación por estancia.

## Riesgos

- `aoMap` exige `uv2`/`uv1` en geometrías generadas (`shapeGeometry`, `extrudeGeometry`): copiar
  atributo `uv` a `uv1` al crear la malla (three ≥ r151 usa `uv1` para AO). Verificar en r184.
- Estancias no cerradas o polígonos con muros curvos (`curved-wall-meshes.ts`): zócalo solo en
  segmentos rectos en esta fase; curvos como mejora posterior anotada.
- KTX2 + `useTexture` de drei: si no soporta `KTX2Loader`, usar `useLoader(KTX2Loader, ...)`
  directamente en `surface-material.tsx`.

## Rollback

Campo `trim` opcional (documentos sin él siguen válidos); `TrimMeshes` se desmonta quitando una
línea; materiales antiguos JPG quedan en git hasta el commit de limpieza final de la fase.

## Decisiones para Paulo

- Zócalos por defecto en proyectos existentes (decisión 5).
- KTX2 vs WebP (decisión 3).
