---
title: Formas de sala no rectangulares (L, U, T)
description: ''
status: pending
priority: P2
branch: feat/canvas/formas-sala
tags: []
blockedBy: []
blocks: []
created: '2026-06-23T10:56:00.000Z'
createdBy: 'manual'
source: roadmap-planner5d
---

# Formas de sala no rectangulares (L, U, T)

## Overview

Tier 2 del roadmap competitivo Planner5D
([referencia-planner5d-y-gaps.md](../260622-1142-referencia-planner5d/referencia-planner5d-y-gaps.md#L409)).
Hoy el wizard solo crea salas RECTANGULARES (`buildRoomDoc` genera 4 muros). Planner5D ofrece
formas L, U, T, pentágono… como on-ramp. Objetivo: que el wizard pueda generar el contorno de
muros de una sala en **L, U y T** (además del rectángulo), con sus medidas reales.

**Es la pieza grande del Tier 2** (toca generación de contorno, wizard UI, auto-amueblado y 3D).
Plan + predict antes de implementar.

## Contexto (scout hecho — no re-investigar)

- **`build-room-doc.ts`** (`buildRoomDoc(RoomParams)`) genera 4 muros de un rectángulo cuyo INTERIOR
  mide `widthM × lengthM`, muros por fuera del rectángulo interior. Es PURO. → generalizar a
  "polígono de muros" a partir de un contorno de vértices.
- **`autofurnish.ts`** tiene **PRECONDICIÓN rectángulo**: `interiorRect(doc)` devuelve null si hay
  muros rotados / contorno no rectangular (`autofurnish.ts:12,41,54`). Para L/U/T el auto-amueblado
  no aplica directamente. Decisión de alcance (abajo).
- **`design-wizard.tsx`** tiene 2 sliders (ancho/largo) + `RoomPreview` (rect SVG) + paso de muebles.
  Falta un selector de FORMA y parámetros por forma.
- **3D `doc-to-scene.ts`** extruye CUALQUIER muro a la altura de techo → un contorno en L/U/T en 2D
  debería renderizar en 3D sin cambios (VERIFICAR en el spike/fase de cierre; es la hipótesis).
- Los muros se generan axis-aligned (rotation 0); las formas L/U/T se componen de **rectángulos
  axis-aligned unidos**, así que NO hace falta muros rotados (encaja con el modelo actual).

## Decisiones de alcance (CERRADAS — usuario + predict)

1. **Formas:** L, U y T en este PR (decisión usuario). Pentágono/hexágono y libres → futuro.
2. **Generación del contorno:** modelar cada forma como UNIÓN de rectángulos axis-aligned y derivar
   los segmentos de muro del perímetro. Sin muros rotados.
3. **Auto-amueblado en L/U/T:** **OMITIR con aviso honesto** (decisión usuario): el wizard no
   auto-amuebla formas no rectangulares y muestra "esta forma se amuebla a mano". El sub-rectángulo
   inscrito amueblado queda anotado como futuro. El rectángulo conserva su auto-amueblado intacto.
4. **Wizard UI:** selector de forma (rectángulo/L/U/T) + parámetros por forma. Preview SVG del
   polígono real por forma.
5. **SPIKE OBLIGATORIO (predict, riesgo Alto):** antes de construir, verificar cómo `doc-to-scene`
   genera el SUELO 3D. Si usa el bbox rectangular del contorno, una sala en L mostraría suelo
   sobrante → generar el suelo del polígono entra en alcance (no es "gratis"). Va en la Fase 1.

## Restricciones / invariantes

- Lógica de generación de contorno PURA y testeable en `src/canvas/wizard` (sin React).
- Reusar `scale.ts` (metros→px) y el patrón de `buildRoomDoc`; no duplicar.
- Muros axis-aligned (rotation 0), contorno cerrado y sin solapes degenerados en las esquinas.
- El 3D no debe requerir cambios para que la forma se vea (hipótesis a verificar; si falla, es parte
  del trabajo, no "gratis").
- Cero regresiones: el rectángulo actual sigue igual; auto-amueblado del rectángulo intacto.
- Sin `useEffect` directo en el wizard (regla del proyecto).

## Phases (borrador — se afina tras el predict)

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Generación de contorno por forma (puro)](./phase-01-contorno-por-forma.md) | Pending |
| 2 | [Wizard: selector de forma + parámetros + preview](./phase-02-wizard-forma.md) | Pending |
| 3 | [Auto-amueblado en formas (alcance decidido) + verificación 3D y cierre](./phase-03-autofurnish-y-cierre.md) | Pending |

## Acceptance criteria (global, provisional)

- [ ] El wizard permite elegir forma (rectángulo/L/U/T) y genera el contorno de muros correcto con
      medidas reales.
- [ ] La forma se ve correcta en 2D (contorno cerrado) y en 3D (muros extruidos).
- [ ] Auto-amueblado: comportamiento definido (amuebla sub-rect principal u omite con aviso); sin
      solapes ni muebles fuera del contorno.
- [ ] El rectángulo actual no cambia (sin regresión); auto-amueblado del rectángulo intacto.
- [ ] Lógica de contorno cubierta por tests puros; suite verde; tsc + eslint + build limpios.
- [ ] Verificado en navegador: crear sala en L → contorno correcto en 2D y 3D.

## Dependencies

<!-- Reusa build-room-doc (patrón), scale.ts, doc-to-scene (3D). Sin deps nuevas. -->
