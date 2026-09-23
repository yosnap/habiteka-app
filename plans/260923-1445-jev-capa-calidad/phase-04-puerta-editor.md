---
phase: 4
title: "Puerta previa a generar desde el editor (render, 3D, recorrido)"
status: pending
priority: P2
effort: "1d"
dependencies: [1]
---

# Phase 4: Puerta previa en el editor (esbozo, se detalla al empezar)

## Goal
Antes de cualquier generación de pago desde el editor v2 (`generateConceptRenderFromEditor`,
`generateViewFrom3D`, `proposeNativeDesignFromEditor` y el futuro recorrido/vídeo), Jev puntúa
la salud estructural del documento y bloquea o avisa si el plano sigue mal.

## Evidencia prevista
Estancias cerradas, uniones de muro, huecos apoyados en muros, escala conocida, suelos y
plataformas coherentes, número de elementos del contrato estructural (`structuralAudit`).
Cachear por `evidenceHash` para no reevaluar un documento sin cambios.

## Scout pendiente
Puntos exactos de entrada en `src/app/(app)/projects/[id]/_actions/agent-actions.ts` y
`src/server/agent/editor-v2/*`; dónde se muestra el aviso en `src/components/editor-v2/editor-generate-dialog.tsx`.
