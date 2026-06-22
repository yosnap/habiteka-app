---
title: F7 Wizard de diseno guiado tipo Planner5D
description: ''
status: pending
priority: P2
branch: feat/canvas/f6-3d-navegable
tags: []
blockedBy: []
blocks: []
created: '2026-06-22T13:03:12.227Z'
createdBy: 'ck:plan'
source: skill
---

# F7 Wizard de diseno guiado tipo Planner5D

## Overview

Lleva el editor de planos hacia el flujo de **Planner5D**: dibujar muros a mano como
líneas rectas con **cota (medida) en vivo** y snap, un **wizard guiado** de inicio
(forma→dimensiones→amueblar→3D), **auto-amueblado procedural** (sin IA), **orientación
inteligente** de muebles en 3D, y **modelos/disposición** coherentes. Construye sobre F6
(3D navegable, COMPLETO) reusando el modelo de datos y `doc-to-scene.ts` (no rehace nada).

**Tipo:** XL (semanas), por fases; cada fase = PR con verificación. **Corte de entrega
(red-team):** F7 se entrega en DOS bloques separables — **F7a = núcleo (fases 1–3): Draw
Walls + medidas en vivo**, entregable y verificado SOLO; **F7b = fases 4–8 (wizard,
autofurnish, orientación, modelos, pulido)**, que se planifican/ejecutan DESPUÉS de validar
F7a en navegador. El núcleo no queda rehén de las features posteriores.

**⚠️ Prerrequisito bloqueante del núcleo (red-team, Critical):** hoy 2D y 3D NO coinciden para
objetos rotados — Konva rota el objeto sobre su **esquina** (`structure-layer.tsx:82-89`, sin
`offsetX/Y`) pero `docToScene` posiciona/rota sobre el **centro del AABB**
(`doc-to-scene.ts:184-186, 281-286`). Con `rotation=0` (todo lo actual: examples.ts) coincide;
Draw Walls introduce muros rotados → se desplazarían en 3D. **La fase 1 DEBE incluir un caso
rotado para exponerlo, y la fase 2 DEBE corregir el contrato de rotación (alinear pivote 2D/3D)
antes de dar el núcleo por bueno.** Es el trabajo real, no "sin cambios en 3D".

## Contexto (no re-investigar — research hecho jun-2026)
- El modelo de datos YA basta: `StructObj` (x/y/width/height/rotation/flipX/heightM/light),
  `CanvasDoc` (objects/scale.pxPerMeter/ceilingHeightM). `strokes` NO van a 3D.
- Editor Konva: `Tool = 'select'|'pan'|'zoom'|'freehand'|'zone'|StructKind` (canvas-toolbar.tsx:18);
  stage en canvas-stage.tsx (crea objeto al clic, centrado, tamaño de catálogo);
  **grid 20px + `snap()`** en grid-layer.tsx (solo on-drag, NO al crear); store zustand
  (canvas-store.ts: addObject/updateObjects/insertObjects + undo/redo); escala pura en scale.ts
  (pxToMeters/metersToPx, deriveScaleFromKnownLength). El trazo libre (use-freehand.ts) NO crea muros.
- 3D: `docToScene` (doc-to-scene.ts) ya separa walls/furniture/lights y mapea ejes; orientación
  de muebles = solo rotación del 2D (no "frente"/anclaje). Mapa kind→glTF: solo silla/lampara/sofa
  (lampara = Lantern/farola, a corregir); resto placeholder.
- Referencia: `plans/260622-1142-referencia-planner5d/referencia-planner5d-y-gaps.md` (Draw Walls
  con cota en vivo = gap más valorado; auto-amueblado procedural; menú contextual flotante).

## Decisiones (del usuario, jun-2026)
- **Núcleo = Draw Walls + medidas en vivo primero** (fases 2–3), verificado antes de continuar.
- **Wizard guiado** paso a paso (fase 4).
- **Auto-amueblado = procedural** (sets por reglas, sin IA cara) (fase 5).
- **Medidas al dibujar:** la fase 3 decide teclear-al-trazar vs editar-tras-dibujar (la 2 ya
  muestra la cota en vivo; la 3 añade entrada de valor exacto + snap).

## Acceptance (F7 "hecho")
- Dibujar muros como líneas rectas con cota en vivo y snap; cierran en sala; se ven en 3D.
- Wizard guiado funcional desde proyecto vacío (forma→dims→amueblar→3D).
- Auto-amueblado procedural por tipo de sala, determinista.
- Muebles orientados con sentido en 3D (frente/anclaje a pared).
- Modelos por kind coherentes (lámpara ≠ farola); placeholders honestos.
- `bunx tsc` + eslint + `bunx vitest run` verdes. Verificado en navegador con proyecto NUEVO.
- Sin regresiones en el editor 2D ni en F6.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Verificacion del flujo base](./phase-01-verificacion-del-flujo-base.md) | Completed |
| 2 | [Draw Walls con cota en vivo](./phase-02-draw-walls-con-cota-en-vivo.md) | Completed |
| 3 | [Medidas y snap al dibujar](./phase-03-medidas-y-snap-al-dibujar.md) | Completed |
| 4 | [Wizard guiado paso a paso](./phase-04-wizard-guiado-paso-a-paso.md) | Completed |
| 5 | [Auto-amueblado procedural](./phase-05-auto-amueblado-procedural.md) | Completed |
| 6 | [Orientacion de muebles 3D](./phase-06-orientacion-de-muebles-3d.md) | Completed |
| 7 | [Modelos correctos y disposicion](./phase-07-modelos-correctos-y-disposicion.md) | Pending |
| 8 | [Verificacion y pulido](./phase-08-verificacion-y-pulido.md) | Pending |

## Dependencies

Construye sobre F6 (3D navegable, completo). Sin dependencias bloqueantes de otros planes abiertos.

## Red Team Review

### Sesión — 2026-06-22
**Revisores:** 4 (Scope/Complexity, Assumption Destroyer, Failure Mode, Security Adversary).
**Hallazgos:** 13 aceptados (todos con evidencia file:line). **3 Critical, 6 High, 4 Medium.**

| # | Hallazgo | Sev | Disp | Aplicado a |
|---|----------|-----|------|-----------|
| 1 | Rotación 2D↔3D no coincide (Konva esquina vs docToScene centro AABB) | Critical | Accept | Completed |
| 2 | Usar `getRelativePointerPosition` (worldPointer), NO `getPointerPosition` de freehand | Critical | Accept | Completed |
| 3 | Pérdida del doc del wizard: `load()` borra historial + autosave se cancela al navegar | Critical | Accept | Completed |
| 4 | Partir F7 en núcleo (1–3) entregable vs resto (4–8) | High | Accept | Completed |
| 5 | Colisión draw-wall vs botón "Muro" de la paleta (dos formas de crear wall) | High | Accept | Completed |
| 6 | autofurnish asume sala rectangular axis-aligned (rompe con muros dibujados/L) | High | Accept | Completed |
| 7 | Seed de Phase 1 contamina la BD dev compartida (package.json:14, sin teardown) | High | Accept | Phase 1 |
| 8 | Snap 20px destruye grosor real (0,15 m) y la longitud exacta tecleada | High | Accept | Phase 3 |
| 9 | Muros degenerados (longitud 0) y suelo por bbox de muro diagonal | Medium | Accept | Phase 2 + Phase 8 |
| 10 | Claim lámpara: el mapa apunta a `lampara.glb` (=Lantern renombrado), no "→Lantern" | Medium | Accept | Phase 7 |
| 11 | Rama e2e Playwright de Phase 1 es frágil y el propio plan la descarta → eliminarla | Medium | Accept | Phase 1 |
| 12 | Assets glTF de terceros sin manifiesto de procedencia/hash/licencia ni validate | Medium | Accept | Phase 7 |
| 13 | `baseImage.url` sin validar esquema (data:/externas) + sin cota de nº de objetos | Medium | Accept | Phase 1 + Phase 5 |

**Decisiones de diseño derivadas:**
- **Pivote de rotación:** alinear 2D y 3D. Decisión a fijar en Phase 2: o `segmentToWall` produce
  muros cuyo (x,y,width,height,rotation) casa con el pivote-centro de `docToScene`, o se corrige
  `docToScene`/`structure-layer` para usar el mismo origen. Test puro que afirme "muro a 90° cae en
  el mismo punto físico en 2D y 3D".
- **Draw Walls REEMPLAZA** el botón "Muro" de la paleta (no coexisten dos semánticas de 'wall').
- **autofurnish** solo sobre salas rectangulares del wizard en v1 (no invocable sobre salas arbitrarias).
- **Seed verificación** idempotente (upsert por slug fijo) o efímero con limpieza; no acoplar a dev-seed.

### Whole-Plan Consistency Sweep
- Corregido en todas las fases el claim "lampara → Lantern": el mapa real es `lampara → /models/cc0/lampara.glb`
  (furniture-models.ts:23) y el .glb es el modelo Lantern renombrado.
- Corregida la ruta de `grid-layer.tsx`/`snap()`: está en `src/components/canvas/layers/grid-layer.tsx`.
- Corregido el supuesto "sin cambios en 3D" de Phase 2 → ahora es un prerrequisito de corrección de pivote.
- Eliminada la rama Playwright de Phase 1 (contradicción interna con su propio Risk Assessment).
