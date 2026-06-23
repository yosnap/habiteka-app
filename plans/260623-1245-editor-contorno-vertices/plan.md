---
title: Editor de contorno por vértices (ortogonal)
description: ''
status: pending
priority: P1
branch: feat/canvas/editor-contorno
tags: []
source: feedback-usuario + predict
created: '2026-06-23T12:45:00.000Z'
---

# Editor de contorno por vértices (ortogonal)

## Objetivo

Permitir AJUSTAR la forma/medidas de la sala arrastrando los VÉRTICES de su contorno, y
añadir/quitar vértices, manteniendo coherentes los muros (2D), el suelo (3D) y la
persistencia. Resuelve el feedback: "si quiero ajustar una medida, que el editor de
contorno funcione bien" sin romper el contorno (el problema de arrastrar muros sueltos).

## Alcance (CERRADO — usuario + predict)

- **Poligonal LIBRE**: añadir / quitar / mover vértices; cualquier nº de vértices.
- **ORTOGONAL en este PR**: el contorno se mantiene en ángulos rectos. Mover un vértice
  arrastra las dos aristas axis-aligned que lo tocan. **Ángulos libres (diagonales) =
  PR FUTURO** (el predict los marcó como el 90% del riesgo: exigen muros rotados + inglete
  de esquinas + revalidar el pivote 2D↔3D).
- **Grosor de muro fijo** (cambiarlo = mejora aparte).

## Contexto técnico (scout + predict — verificado, no re-investigar)

- `doc.floorOutline: FloorVertex[]` (px, polígono cerrado horario) ES la fuente de verdad
  del contorno; ya se PERSISTE (`serialize.ts`) y el suelo 3D lo consume
  (`doc-to-scene.ts` → shapeGeometry). Los muros (`StructObj kind:'wall'`) se REGENERAN
  desde el contorno con `outlineToWalls` (un muro por arista; cierra esquinas convexas y
  cóncavas correctamente para contornos ortogonales — ya arreglado).
- NO hay relación vértice↔muro almacenada: editar un vértice ⇒ regenerar TODOS los muros.
- Store: `mutate()` con historial (50) + `updateObjects`. Falta `setFloorOutline`.
- NO hay capa de handles de vértices; hay que crearla. Capas en
  `src/components/canvas/layers/`.
- `autofurnish` ya devuelve [] en no-rect (se amuebla a mano): sin cambios.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Acción de store setFloorOutline + regenerar muros](./phase-01-store-set-floor-outline.md) | Pending |
| 2 | [Capa de edición de vértices (handles arrastrables, ortogonal)](./phase-02-capa-vertices.md) | Pending |
| 3 | [Añadir / quitar vértices + validación de polígono](./phase-03-anadir-quitar-validar.md) | Pending |

## Acceptance criteria (global)

- [ ] Modo "Editar contorno": se ven handles en los vértices del contorno.
- [ ] Arrastrar un vértice ajusta el contorno (ortogonal), regenera muros y suelo 3D, con
      cota en vivo; sin huecos ni desbordamientos en las esquinas.
- [ ] Doble-clic en una arista añade un vértice; en un vértice lo quita (si el polígono
      resultante sigue siendo válido).
- [ ] El cambio entra en el historial (undo/redo) y se persiste (recargar lo conserva).
- [ ] El suelo 3D sigue SIEMPRE el contorno editado.
- [ ] Lógica de contorno cubierta por tests puros; suite verde; tsc+eslint+build limpios.
- [ ] Verificado en navegador: ajustar una sala L moviendo un vértice → 2D y 3D coherentes.

## Fuera de alcance (PR futuros)

- Ángulos libres / paredes en diagonal (motor de inglete + pivote 3D).
- Grosor de muro editable.
- Auto-amueblado de formas no rectangulares.

## Dependencies

<!-- Reusa floorOutline (ya persiste + 3D), outlineToWalls (ortogonal, ya cierra esquinas),
     mutate()/historial. Sin deps nuevas. -->
