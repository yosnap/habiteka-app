---
title: Menú contextual flotante sobre el objeto seleccionado
description: ''
status: completed
priority: P1
branch: feat/canvas/menu-flotante-objeto
tags: []
blockedBy: []
blocks: []
created: '2026-06-22T23:46:00.000Z'
createdBy: 'manual'
source: roadmap-planner5d
---

# Menú contextual flotante sobre el objeto seleccionado

## Overview

Tier 1.4 del roadmap competitivo Planner5D
([referencia-planner5d-y-gaps.md](../260622-1142-referencia-planner5d/referencia-planner5d-y-gaps.md#L402)).
Planner5D ancla las acciones frecuentes (material, duplicar, borrar, rotar) en un **menú flotante
de iconos ENCIMA del objeto seleccionado**, no solo en clic derecho. Habiteka hoy solo tiene el
menú de clic derecho ([context-menu.tsx](../../src/components/canvas/context-menu.tsx)) posicionado
en el punto del clic. Objetivo: una barra/menú flotante de iconos que aparece automáticamente al
seleccionar un objeto, anclada sobre su bounding box y que sigue al objeto con el zoom/pan.

**Alcance acotado (YAGNI):** las acciones más usadas — Duplicar, Girar 90°, Voltear, Eliminar.
NO se añade "cambiar material/resize" (no hay UI de material por objeto hoy; sería scope creep).
Reusa las acciones del store que ya existen (`duplicateObjects`, `rotate90`, `flipSelection`,
`removeObjects`). El clic derecho se mantiene intacto.

## Contexto (scout hecho — no re-investigar)

- **El viewport (zoom/pan) vive en `canvas-stage.tsx`** como estado local `view = {scale, x, y}`
  (`canvas-stage.tsx:64`), NO en el workspace ni en el store. Por eso el menú flotante debe
  renderizarse desde dentro de `CanvasStage` (o recibir `view` por callback): necesita convertir
  coordenadas de MUNDO (las del objeto en el doc) a coordenadas de PANTALLA.
  Fórmula: `screenX = worldX * view.scale + view.x` (+ el offset del contenedor para overlay HTML).
- **Selección:** `doc.selection` = `{ type:'object', objectIds }` (`types.ts:120`). El menú flotante
  solo aplica a `type:'object'` con ≥1 id. Para zona (`type:'zone'`) NO se muestra (fuera de alcance).
- **Bounding box de la selección:** los objetos son `StructObj` con `x/y/width/height/rotation`.
  Hay math de selección en [selection-math.ts](../../src/canvas/selection-math.ts) (revisar si ya
  hay un helper de bbox; si no, calcular el AABB de los ids seleccionados — OJO con `rotation`,
  reusar el mismo criterio AABB que `doc-to-scene` para no reintroducir el bug de pivote ya resuelto).
- **Acciones reutilizables del store** (`canvas-store.ts`): `duplicateObjects(ids)` (:39),
  `rotate90(ids)` (:52), `flipSelection(ids)` (:54), `removeObjects(ids)` (:37). Mismas que usa
  `buildMenuItems` en `canvas-workspace.tsx:209`.
- **El menú HTML flotante existente** (`context-menu.tsx`) es buen patrón de base (posición fixed,
  cierre por Escape/click-fuera) pero está pensado para clic derecho. El nuevo es un componente
  distinto: barra horizontal de iconos anclada al bbox, sin cierre por click-fuera (se oculta al
  deseleccionar). NO modificar el de clic derecho.
- **`useMountEffect`** es el wrapper permitido (regla no-use-effect del proyecto): usarlo, no
  `useEffect` directo.

## Restricciones / invariantes

- Sin `useEffect` directo (regla del proyecto): derivar la posición del render, o usar
  `useMountEffect` para listeners. La posición del menú es ESTADO DERIVADO de (selección + view +
  geometría), no un efecto.
- El menú flotante NO sustituye al clic derecho: ambos coexisten. Reusar las MISMAS acciones del
  store (DRY) — no duplicar lógica de duplicar/rotar/borrar.
- Solo para selección de objetos (`type:'object'`). Multi-selección: el menú se ancla al AABB del
  conjunto y las acciones operan sobre todos los ids (igual que el clic derecho ya hace).
- El menú no debe tapar el objeto pequeño ni salirse del lienzo: posicionar arriba del bbox; si no
  cabe arriba, abajo (clamp al área visible del canvas).
- El menú debe seguir al objeto al hacer zoom/pan y al mover/redimensionar el objeto (posición
  derivada, se recalcula en cada render del stage).
- **Durante un drag/pan ACTIVO el menú se OCULTA** y se reposiciona al soltar (patrón Planner5D).
  Evita el coste de recalcular el AABB en cada `onPointerMove` y reduce ruido visual (predict).
- **Escape también deselecciona** desde el menú flotante (coherente con el clic derecho).
- El clamp se hace contra el área del canvas Y evita solapar los controles de zoom/toolbar (predict).
- Iconos accesibles: cada botón con `title`/`aria-label`. Tamaño táctil mínimo.
- Cero regresiones: la suite verde actual debe seguir verde; añadir test del cálculo de anclaje
  (lógica pura mundo→pantalla + clamp) en un helper testeable sin React.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Anclaje del menú: math pura mundo→pantalla + bbox](./phase-01-anclaje-math-pura.md) | Completed |
| 2 | [Componente del menú flotante (UI) integrado en el stage](./phase-02-componente-menu-flotante.md) | Completed |
| 3 | [Verificación y cierre](./phase-03-verificacion-y-cierre.md) | Completed |

## Acceptance criteria (global)

- [x] Al seleccionar un objeto aparece una barra flotante de iconos anclada SOBRE su bounding box.
- [x] Acciones: Duplicar, Girar 90°, Voltear, Eliminar — reusan el store, mismo efecto que el clic
      derecho.
- [x] El menú sigue al objeto con zoom/pan y al moverlo/redimensionarlo; se oculta al deseleccionar.
- [x] Multi-selección: el menú se ancla al AABB del conjunto y opera sobre todos los ids.
- [x] El menú se mantiene dentro del área visible (clamp arriba/abajo, no se sale del canvas).
- [x] El clic derecho sigue funcionando igual (sin regresión).
- [x] Lógica de anclaje (mundo→pantalla + clamp) cubierta por tests puros; suite verde; tsc +
      eslint + build limpios.
- [x] Verificado en navegador real (Playwright, dev-login, proyecto "Piso Algete"): seleccionar
      encimera → menú anclado encima (dentro del canvas) → Duplicar/Girar 90°/Voltear/Eliminar
      funcionan → tras girar y zoom 115% el menú sigue anclado al objeto rotado → Escape y Eliminar
      ocultan el menú → 0 errores de consola.

## Dependencies

<!-- Construye sobre F7 (Draw Walls/selección) y el modelo de datos existente. Sin dependencias nuevas. -->
