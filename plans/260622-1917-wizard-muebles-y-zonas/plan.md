---
title: 'Wizard: seleccion de muebles + gestion de zonas'
description: ''
status: completed
priority: P2
branch: fix/canvas/3d-suelo-y-cierre
tags: []
blockedBy: []
blocks: []
created: '2026-06-22T17:26:28.035Z'
createdBy: 'ck:plan'
source: skill
---

# Wizard: seleccion de muebles + gestion de zonas

## Overview

Tres mejoras al asistente de diseño y a las zonas:

1. **El wizard pregunta qué muebles** — tras elegir el tipo de sala, un paso con casillas de los
   muebles típicos (marcados por defecto), cantidades para los repetibles (sillas, mesillas) y
   opcionales (cocina: isla; salón: alfombra/chimenea). Hoy coloca un set fijo sin preguntar.
2. **Auto-amueblado sin solapes** — hoy en la cocina la encimera (2,4 m) + fregadero + horno se
   montan en la misma pared porque cada mueble se ancla por una fracción sin mirar el ancho de los
   vecinos. Repartir a lo largo de cada pared respetando el ancho real (`catalog.realWidthM`).
3. **Gestión de zonas con papelera** — renombrar, y borrar = soft-delete recuperable (decisión
   usuario). Una vista de "Papelera" lista las zonas borradas y permite restaurarlas o borrarlas
   definitivamente. El esquema YA tiene `deletedAt` (sin migración); hoy `zones.remove` hace
   hard-delete → pasa a soft, el hard-delete vive en `purge`.

## Restricciones / invariantes
- Lógica de amueblado y de layout PURA y testeable en `src/canvas/wizard` (sin React).
- El wizard se dispara desde `canvas-workspace` cuando la zona está vacía; mantener "Dibujar a mano".
- Solo salas RECTANGULARES axis-aligned se amueblan (precondición ya existente de `autofurnish`).
- "Principal" (plano por defecto, sin zona) NO tiene menú de borrar/renombrar — no es una zona.
- Borrado de zona con confirmación; al borrar la activa, navegar a Principal. IDOR ya cubierto por
  org-scope en la Server Action (verificar, no reimplementar).
- Cero regresiones: 466 tests verdes deben seguir verdes; añadir tests del layout y la selección.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Modelo de seleccion y layout sin solapes (puro)](./phase-01-modelo-de-seleccion-y-layout-sin-solapes-puro.md) | Completed |
| 2 | [Paso de muebles en el wizard (UI)](./phase-02-paso-de-muebles-en-el-wizard-ui.md) | Completed |
| 3 | [Zonas: papelera (soft-delete + restaurar) + renombrar](./phase-03-menu-de-zonas-borrar-renombrar.md) | Completed |
| 4 | [Verificacion y cierre](./phase-04-verificacion-y-cierre.md) | Completed |

## Acceptance criteria (global)
- [ ] El wizard, tras el tipo de sala, muestra un paso con los muebles del tipo (casillas marcadas),
      cantidades para repetibles y opcionales; solo se colocan los seleccionados.
- [ ] La cocina (y el resto) se amuebla SIN solapes: los muebles de una misma pared se reparten
      según su ancho real; si no caben, se omiten los que sobran (sin solापar).
- [ ] Cada chip de zona (no "Principal") ofrece Renombrar y Borrar al pasar el ratón; borrar es
      soft-delete con confirmación y, si era la activa, navega a Principal. Una Papelera lista las
      borradas y permite Restaurar o Borrar definitivamente.
- [ ] Si un mueble seleccionado no cabe, se avisa (no se coloca) y nada se solapa (ni en esquinas).
- [ ] 466+ tests verdes; tsc + eslint + build limpios.
- [ ] Verificado en navegador real: +Zona → wizard cocina con horno/vitro marcados → 3D sin solapes;
      borrado de una zona de prueba.

## Dependencies
Ninguna cruzada. Parte de la rama `fix/canvas/3d-suelo-y-cierre` (sobre `develop`).
