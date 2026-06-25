---
title: Asistente, zonas+imágenes, vistas desde 3D y edición 3D
description: ''
status: pending
priority: P1
tags: []
source: feedback-usuario + scout
created: '2026-06-23T15:30:00.000Z'
---

# Asistente, zonas+imágenes, vistas desde 3D y edición en 3D

Plan-paraguas con 4 bloques de naturaleza distinta; cada fase es abordable y mergeable por
separado. Orden por valor/riesgo: el bug primero (desbloquea), el 3D interactivo al final
(el más grande, PR propio). Diagnóstico en
[reports/diagnostico](./reports/) y scout de la sesión.

## Decisiones (CERRADAS — usuario)

- **Modelo de zonas:** ZONA PRIMERO. El usuario crea/elige una zona y sube su imagen a esa
  zona; los diseños se generan por zona. Una imagen PRINCIPAL por zona (varias imágenes por
  zona = futuro).
- **Vistas de diseño:** usar la ESCENA 3D como fuente de vistas (capturas desde ángulos),
  fiel al plano. (No depender de que la IA "adivine" la vista.)
- **Alcance:** los 4 bloques entran, pero en fases independientes.

## Estado actual (scout — verificado, no re-investigar)

- Asistente: `qualification-chat.tsx` (pasos ingesta→cualificación→entrega→feedback). La fase
  se persiste en BD y se rehidrata al recargar (`chat/page.tsx`).
- **BUG:** si la generación de entregables falla, `orchestrator.ts:~75` captura el error pero
  NO revierte ni avanza la fase → el usuario queda atascado / "vuelve a salir" el paso.
- Zonas: `ProjectZone`, `SourceImage` (zoneId nullable), `Deliverable` (zoneId + sourceImageId
  nullable) YA existen en el esquema (`prisma/schema/project-canvas.prisma`). Falta el FLUJO/UI:
  no hay asignación imagen→zona al subir, ni subir imagen "a una zona nueva".
- Crear zona: `zone-actions.ts` (`createZone`) + ZoneSwitcher ("+ Zona"), manual.
- Render de diseño: `entrega.ts:~194` arma un prompt SIN especificar vista → el modelo usa su
  default (cenital). `render3d-viewer.tsx` muestra la imagen.
- 3D navegable: `Plan3DView`/`docToScene` ya existen (suelo, muros, muebles, luces). Hay clic
  derecho/menús en 2D pero NO interacción de edición en 3D.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Fix: el asistente no se atasca si la generación falla](./phase-01-fix-asistente-atasco.md) | ✅ HECHO (PR #40) |
| 2 | [Flujo zona→imagen: subir imagen a una zona, gestionar zonas](./phase-02-flujo-zona-imagen.md) | ✅ HECHO (PR #40) |
| 3 | [Vistas de diseño desde la escena 3D (capturas por ángulo)](./phase-03-vistas-desde-3d.md) | ✅ HECHO (PR #40) |
| 4 | [Edición en 3D: clic derecho para pintar / luces / material](./phase-04-edicion-3d.md) | ✅ HECHO (PR #40) |

## Acceptance criteria (global)

- [ ] Si la generación falla, el asistente lo dice y deja reintentar (no se queda atascado
      ni repite el paso al recargar).
- [ ] El usuario elige/crea una zona y sube su imagen a ESA zona; los diseños se generan y
      muestran por zona.
- [ ] Se pueden ver vistas del diseño más allá de la cenital, generadas desde el 3D.
- [ ] (Bloque 4) Clic derecho sobre un elemento en 3D permite cambiar material / pintar /
      encender-apagar luz.
- [ ] Sin regresiones; suite verde; tsc+eslint+build limpios; verificación en navegador.

## Riesgos / notas

- **Fase 3 y 4 requieren su propio PREDICT** antes de implementar (capturas WebGL fieles y
  edición 3D son delicadas). Fase 1 y 2 son de bajo/medio riesgo.
- Fase 4 (edición 3D) es la más grande → PR propio.
- Multi-imagen por zona y ángulos libres de pared quedan fuera (futuro).
