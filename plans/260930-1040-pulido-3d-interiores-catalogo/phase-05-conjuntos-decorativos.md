---
title: "Fase 5: Conjuntos decorativos reutilizables"
status: todo
---

# Fase 5: Conjuntos decorativos reutilizables

## Contexto

Lo que hace «vivida» una estancia en Planner 5D son textiles y decoración: cortinas con pliegues
y recogidas, ropa de cama con estampado, estantería con libros y figuras, cuadros, espejo,
lámpara de araña, plantas. Hoy: cortinas = cajas por cobertura (`furniture-profiles.ts:165-170`),
estantería = cajas (`:121-124`), planta = 6 cajas (`:154-158`), lámpara = 4 cajas (`:150-153`).
Las persianas/estores paramétricos (`roller`, `venetian`, `vertical-blind`, `shutter`) funcionan
bien y se conservan. `windowCoverage` (`:36-42`) controla la apertura de cortinas y debe seguir
funcionando con modelos.

## Requisitos

- Cortinas: 3 modelos (cerrada con pliegues, abierta recogida a los lados, visillo) × 4 colores
  (tinte por `tintMaterialNames`) que respetan `coverage`: se resuelve con **dos GLB por
  cortina** (paño cerrado y paño recogido) y el ancho de cada paño escala con la cobertura, sin
  deformar los pliegues verticalmente (escala solo en X).
- Ropa de cama: 4 camas vestidas (edredón liso, estampado geométrico, lino arrugado, con cojines)
  como activos `bed` con `tintMaterialNames` para el edredón.
- Estantería vestida: 3 variantes (libros, libros+figuras+plantas, cajas) como un solo GLB cada una.
- Cuadros y espejos: perfil nuevo `wall-art` y `mirror` (montaje en muro, `elevationMm` 1400 al
  centro), marco generado (caja + material) con lienzo de textura elegida de una lista de 12
  imágenes CC0 (Poly Haven no tiene; usar obras de dominio público de museos con reproducción
  libre, p. ej. Rijksmuseum/Met Open Access, registradas en manifiesto) y espejo con
  `meshPhysicalMaterial` `metalness 1, roughness 0` que refleja el entorno HDRI (fase 4).
- Lámparas: araña, colgante de cocina (3 en línea), aplique de pared; con `emissiveMaterials`.
- Plantas: monstera, ficus, pothos colgante, cactus en mesa; con `alphaTest` para hojas.
- Fuente: Poly Haven/Sketchfab CC0 primero; lo que no exista (cortinas, ropa de cama) se genera
  con Meshy/Sloyd de pago (propiedad del cliente, ver informe) o se encarga; nunca de Planner 5D.

## Archivos

- `public/models/cc0/*.glb` + `manifest.json` (fase 1) con `tags: ['conjunto']` y `parts` para las
  cortinas (`closedFile`, `openFile`).
- Nuevo `src/lib/editor-document/furniture-sets.ts` (≤ 120 líneas): definición de conjuntos
  (cortina con dos paños, estantería vestida, colgantes en línea) como `FurnitureSet { id,
  label, room, profile, parts: { assetKind, offset, scaleAxis }[] }`; función `setToVolumes` para
  el 2D y colisiones.
- `src/lib/editor-document/furniture-profiles.ts`: nuevos perfiles `wall-art`, `mirror`,
  `chandelier`; para `curtain`/`curtain-open` con activo, no generar cajas (solo volumen de
  colisión) — mantener cajas cuando no haya activo.
- `src/lib/editor-document/furniture-catalog.ts`: entradas nuevas (≈ 30) con variantes por color
  vía `variant()` existente; `FurnitureProfile` ampliado.
- `src/components/editor-v2/scene/furniture-model.tsx`: soporte de `parts` (cortina: dos
  `primitive`, ancho por `coverage`); espejo: material físico reflectante.
- `src/canvas/editor-v2/wall-back-alignment.ts` (existe): `wall-art`/`mirror` alineados al muro
  como las cortinas.
- 2D: `src/components/editor-v2/furniture-symbol.tsx` símbolos para cuadro/espejo/araña.
- Tests: `tests/editor-document/furniture-sets.test.ts` (nuevo), `furniture-bed-profile.test.ts`
  (existe), `tests/editor-v2/kitchen-run-wall-align.test.ts` (existe: no regresión), nuevo
  `tests/editor-document/wall-art-placement.test.ts`.

## Pasos

1. Perfiles nuevos + entradas de catálogo + símbolos 2D (sin modelos: caen a cajas).
2. Conseguir/generar activos por lotes: cortinas (3×), camas (4), estanterías (3), lámparas (3),
   plantas (4), espejos (2), marcos (procedural). Cada activo por `optimize-models.mjs`.
3. `furniture-sets.ts` + soporte de `parts` y `coverage` en `furniture-model.tsx`.
4. Colocar en el plano de referencia: C4 (cortinas), C5 (estantería + cuadros), C6 (cama
   vestida), C7 (espejo), C9 (colgantes).
5. Prueba de referencia: objetivo ≥ +20 en «Textiles y cortinas», ≥ +10 en «Vegetación y
   decoración», ≥ +10 en «Coherencia».

## Validación

- Tests verdes; cortina con `coverage` 0.2/0.6/1 muestra paños proporcionales sin estirar
  pliegues (captura manual C4).
- Volúmenes de colisión del paseo libre inalterados para cortinas (test existente
  `free-walk-navigation.test.ts`).
- Todos los activos nuevos con licencia en manifiesto y créditos generados.

## Riesgos

- Modelos generados por IA con topología sucia → pasar siempre por `simplify` + revisión visual;
  rechazar > 15 k triángulos.
- Hojas con `alphaTest` y sombras PCSS: usar `customDepthMaterial` o `alphaHash`; verificar coste.
- Texturas de cuadros: comprobar «dominio público + reproducción libre» por obra y guardar URL.

## Rollback

Sin activo, cada perfil vuelve a cajas; las entradas nuevas del catálogo pueden ocultarse
(`hidden`) sin borrar documentos que las usen.

## Decisiones para Paulo

- Vía para cortinas y ropa de cama: IA de pago (~60 $) vs encargo vs esperar CC0.
