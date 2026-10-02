---
title: "Pulido del 3D de interiores y catálogo de ambientación"
description: "Igualar o superar el aspecto del 3D de Planner 5D en interiores con activos libres/comprados, PBR, iluminación y un pipeline de gemelos 3D de producto con stock."
status: pending
priority: P2
effort: 14-19 días de implementación + compras opcionales
branch: feat/diseno-aprobado-visita-video
tags: [3d, catalogo, render, assets, editor-v2]
created: 2026-09-30
---

# Pulido del 3D de interiores y catálogo de ambientación

**No se implementa todavía.** Se retoma cuando termine la generación de vídeo (fase 5 del
[plan integral](../260924-1459-flujo-integral-plano-diseno-inmersion-video/plan.md)). Modelo de
implementación previsto: Sonnet 5.5. Referencia a batir: 3D de Planner 5D (techo quitado, muros
recortados). Sus modelos/texturas son propietarios: **nada de este plan copia ni extrae activos de
Planner 5D**; solo CC0/CC-BY con uso comercial claro, compras con licencia compatible con SaaS o
activos producidos por Habiteka.

Informe de precios y licencias: [researcher-260930-1040-precios-licencias-modelos-3d.md](../reports/researcher-260930-1040-precios-licencias-modelos-3d.md).

## Diagnóstico de la brecha (código verificado 30-09-2026)

| Categoría | Habiteka hoy (ruta:línea) | Planner 5D | Brecha |
|---|---|---|---|
| Objetos | 36 GLB low-poly (Quaternius/Kenney) + 5 Poly Haven, `public/models/cc0/manifest.json`; 58 entradas sin GLB caen a cajas (`src/lib/editor-document/furniture-profiles.ts:121-175`: cortina = 10 cajas, planta = 6 cajas, lámpara = 4 cajas). Cada instancia clona escena y escala **no uniforme** a las cotas del catálogo (`src/canvas/editor-v2/scene/furniture-model-transform.ts:6-32`), deformando proporciones. | Miles de modelos con detalle medio, textiles con pliegues, libros, cuadros, espejos | Alta: cantidad, detalle y coherencia de estilo |
| Materiales | 62 materiales Poly Haven JPG 1K color+normal+roughness (`src/components/editor-v2/scene/surface-material.tsx:18-45`), sin AO ni KTX2; `public/materials` = 110 MB sin comprimir | Materiales PBR coherentes por superficie, mármol/azulejo/madera | Media: falta AO, compresión y familias por estancia |
| Iluminación/render | 1 direccional con sombra 2048 + hemisférica (`scene-lighting.tsx:23-47`), `RoomEnvironment` con intensidad .15-.24 (`scene-environment.tsx:20-34`), `shadows="percentage"`, `dpr [1,1.5]`, exposición .9 (`editor-scene-view.tsx:229,601`). Sin post-procesado, sin HDRI, sin sombras de contacto, sin bloom. Luminarias emisivas ya existen (`ceiling-lighting-meshes.tsx:82-86`). | Oclusión ambiental (`web_ao_normal`), iluminación ambiental por entorno | Media-alta: es lo que más «aplana» la escena |
| Arquitectura de detalle | Sin zócalos, molduras, marcos de puerta/ventana ni alféizares (grep `skirting|zocalo|rodapie|moldura` en `src/` vacío); huecos en `src/canvas/editor-v2/scene/opening-meshes.ts` (46 líneas) | Marcos, zócalos, molduras | Media: barato de generar por geometría |
| Vegetación | 1 planta CC0 low-poly + jardinera como cajas | Plantas con hojas reales, árboles | Alta (interior: plantas; exterior: después) |
| Rendimiento | Sin medición ni presupuesto; sin LOD ni instanciado; `useGLTF(url, false, true)` = meshopt ya activo, Draco no (`furniture-model.tsx:18`) | Motor WASM propio | Media: hay que fijar presupuesto antes de subir detalle |

Duplicidad existente a respetar: hay dos mapas de modelos — `src/canvas/3d/furniture-models.ts`
(canvas v1, por `StructKind`) y `src/lib/editor-document/furniture-assets.ts` (Editor v2, por
`catalogId`, cotas y `frontRotation` codificadas a mano en `furniture-assets.ts:8-45,69-71`). Este
plan trabaja **solo** sobre Editor v2 y convierte `manifest.json` en la única fuente de verdad de
activos; el mapa v1 no se toca.

## Principios

- Un solo catálogo: entradas estáticas (`FURNITURE_CATALOG`) para ambientación genérica y
  `CatalogItem` (Prisma) para productos reales. No se crea un tercer registro.
- Cada activo lleva licencia, autor, fuente, hash, cotas reales, eje frontal y presupuesto de
  triángulos/bytes en el manifiesto; sin ficha, no entra.
- Escalado: los GLB se ajustan por escala **uniforme** a la cota mayor y las cotas del catálogo se
  toman del modelo; la deformación no uniforme queda solo para perfiles de cajas.
- Presupuesto de rendimiento fijado en fase 0 y verificado en cada fase.
- Calidad por niveles (`basic` / `standard` / `high`) seleccionable; el nivel alto solo en escritorio.
- Archivos nuevos en kebab-case, ≤ 200 líneas (`docs/code-standards.md`), sin IDs de plan en código,
  tests ni commits; revisión de código y verificación local tras cada fase; sin merge en GitHub.

## Fases

| # | Fase | Depende de | Esfuerzo | Riesgo |
|---|---|---|---|---|
| 0 | [Prueba de referencia y línea base](./phase-00-prueba-referencia-y-linea-base.md) | — | 1,5 d | Bajo |
| 1 | [Pipeline de activos](./phase-01-pipeline-de-activos.md) | 0 | 2,5 d | Medio (KTX2 en drei) |
| 2 | [Biblioteca gratuita inicial](./phase-02-biblioteca-gratuita-inicial.md) | 1 | 3 d + curación | Medio (licencias) |
| 3 | [Materiales PBR y detalle arquitectónico](./phase-03-materiales-pbr-y-detalle-arquitectonico.md) | 1 | 2,5 d | Medio |
| 4 | [Iluminación y acabado](./phase-04-iluminacion-y-acabado.md) | 0 | 2,5 d | Alto (captura + demand) |
| 5 | [Conjuntos decorativos reutilizables](./phase-05-conjuntos-decorativos.md) | 2, 3 | 2 d | Medio |
| 6 | [Composiciones por ambiente para la IA](./phase-06-composiciones-por-ambiente-ia.md) | 5 | 1,5 d | Bajo |
| 7 | [Gemelo 3D de producto con stock](./phase-07-gemelo-3d-producto-con-stock.md) | 1 (paralela a 2-6) | 3 d + acuerdos | Alto (licencias/QC) |
| 8 | [Exterior: vegetación y terreno](./phase-08-exterior-vegetacion-y-terreno.md) | 2, 4 | por estimar | — (diferida) |

Paralelismo permitido: 2 ∥ 3 ∥ 4 (archivos disjuntos, ver «Propiedad de archivos»); 7 ∥ 5-6.
Cierre de cada fase: pasar la prueba de referencia de la fase 0 sin bajar la puntuación previa
ni superar el presupuesto de rendimiento.

## Propiedad de archivos por fase (sin solapes en fases paralelas)

| Fase | Archivos que posee |
|---|---|
| 0 | `tests/fixtures/referencia-interiores/**`, `scripts/reference-capture.mjs`, `src/lib/editor-document/reference-cameras.ts`, `docs/3d-rubrica-referencia.md` |
| 1 | `scripts/optimize-models.mjs`, `scripts/validate-model-manifest.mjs`, `public/models/cc0/manifest.json` (esquema), `src/lib/editor-document/furniture-assets.ts`, `src/canvas/editor-v2/scene/furniture-model-transform.ts`, `src/components/editor-v2/scene/furniture-model.tsx`, `src/components/editor-v2/scene/model-loaders.ts` (nuevo) |
| 2 | `public/models/cc0/*.glb` (nuevos), `public/models/cc0/manifest.json` (entradas), `src/lib/editor-document/furniture-catalog.ts` (solo baja de entradas sustituidas), `docs/creditos-activos-3d.md` |
| 3 | `public/materials/**`, `src/components/editor-v2/scene/surface-material.tsx`, `src/canvas/editor-v2/scene/trim-meshes.ts` (nuevo), `src/components/editor-v2/scene/trim-meshes.tsx` (nuevo), `src/canvas/editor-v2/scene/opening-meshes.ts`, `src/lib/editor-document/schema.ts` (campo `trim` opcional) |
| 4 | `src/components/editor-v2/scene/scene-lighting.tsx`, `scene-environment.tsx`, `scene-post-processing.tsx` (nuevo), `scene-quality.ts` (nuevo), `public/hdri/**`, `src/components/editor-v2/editor-preferences.ts` (nivel de calidad) |
| 5 | `src/lib/editor-document/furniture-profiles.ts`, `furniture-catalog.ts` (entradas nuevas), `public/models/cc0/*.glb` (conjuntos), `src/lib/editor-document/furniture-sets.ts` (nuevo) |
| 6 | `src/lib/editor-document/design-sets.ts` (nuevo), `proposal-permissions.ts`, `native-design-proposal.ts`, `design-context.ts` |
| 7 | `prisma/schema/catalog.prisma` + migración, `src/server/catalog/model-qc.ts` (nuevo), `src/app/api/catalog/upload/**`, `src/app/api/catalog/[kind]/model/route.ts`, `src/components/admin/catalog-qc/**` (nuevo) |

`editor-scene-view.tsx` (785 líneas, ya por encima del límite) solo recibe una línea por fase
(montar un componente nuevo); las fases 3 y 4 la tocan en líneas distintas y se integran en
serie, nunca en paralelo.

## Criterios de aceptación globales

- [ ] La prueba de referencia (10 cámaras, rúbrica de la fase 0) da media ≥ 70/100 en Habiteka y
      ningún criterio < 2/5; diferencia frente a Planner 5D ≤ 10 puntos en las mismas cámaras.
- [ ] Presupuesto de rendimiento cumplido en el plano de referencia: escritorio ≥ 60 fps en paseo
      1080p, móvil de referencia ≥ 30 fps, primer fotograma útil ≤ 3 s en 4G simulado.
- [ ] Todo activo en `public/models` y `public/materials` figura en un manifiesto con licencia,
      autor, fuente, hash y cotas; `scripts/validate-model-manifest.mjs` sale en verde en CI local.
- [ ] Ningún objeto de las 10 cámaras se representa con cajas de perfil (`furniture-profiles`)
      salvo persianas/estores, que conservan su geometría paramétrica.
- [ ] La propuesta IA coloca conjuntos decorativos (cortina, planta, cuadros, estantería vestida)
      solo desde `FURNITURE_CATALOG` y respeta `proposal-permissions`.
- [ ] Un producto real con GLB pasa QC automático + revisión manual, queda versionado y se muestra
      como «producto exacto» solo si `qcStatus = approved`.

## Encaje con planes existentes

- Plan integral, fase 3 (catálogo común Editor v2 ↔ `CatalogItem`): este plan no adelanta esa
  unificación; añade activos al lado estático y define el lado de activo de `CatalogItem` (fase 7
  de aquí) sin duplicar la ficha comercial de su fase 7.
- Restructuración editor, fase 1 (catálogo extensible): reutiliza `CatalogItem`, `POST
  /api/catalog/upload`, ruta `/api/catalog/[kind]/model`; sustituye la validación «magic bytes +
  25 MB» por QC real.
- Referencia Planner 5D (jun-2026): confirma que el 3D nace de la geometría; este plan lo pule.

## Decisiones abiertas para Paulo

Ver sección final de cada fase; resumen:

1. **Presupuesto de compra inicial** (fase 2): ¿0 € (solo CC0) o hasta ~150-200 € en packs
   con licencia compatible con SaaS según el informe de precios?
2. **Nivel «alto» con post-procesado** (fase 4): ¿se acepta dependencia `@react-three/postprocessing`
   + N8AO solo en escritorio, o nos quedamos en PCSS + AO horneado sin post-procesado?
3. **Formato de textura**: KTX2 exige `toktx` (KTX-Software) en la máquina de build; alternativa
   WebP sin compresión GPU. ¿Aceptas instalar KTX-Software localmente?
4. **Vía preferente para gemelos de producto** (fase 7): GLB del fabricante > encargo > IA
   foto→3D > fotogrametría. ¿Presupuesto por SKU y quién hace la revisión manual?
5. **Zócalos por defecto** (fase 3): ¿activados en todas las estancias interiores existentes
   (cambia el aspecto de proyectos guardados al abrirlos) o solo en documentos nuevos?
6. **Plano de referencia**: ¿recreas tú el plano visto en Planner 5D en Habiteka (fase 0) o lo
   recrea el agente a partir de tus capturas y cotas?

<!-- slug: pulido-3d-interiores-catalogo -->
