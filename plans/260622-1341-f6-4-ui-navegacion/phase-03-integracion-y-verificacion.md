---
phase: 3
title: Integracion y verificacion
status: completed
effort: ''
---

# Phase 3: Integracion y verificacion

## Overview

Verificar el flujo real: abrir un proyecto en el editor, pulsar "Ver en 3D", ver la escena de
la zona, orbitar y comprobar el recorte de muros. Suite completa.

## Implementation Steps
1. `bunx tsc` + `bunx eslint` (archivos F6) + `bunx vitest run`.
2. Dev server + chrome-devtools: el editor real requiere login. Verificar el flujo en
   `/projects/[id]` si hay sesión de dev; si no es viable por auth, verificar el OVERLAY de
   forma aislada montándolo con un doc en `/dev/3d` (botón que abre el overlay) y validar
   recorte de muros allí. Documentar qué vía se usó.
3. Confirmar: overlay abre/cierra (Esc, X), recorte de muros al orbitar, FPS ≥30, 0 errores.
4. Confirmar aislamiento (módulo 3D solo dynamic) y editor 2D sin regresiones.

## Success Criteria
- [ ] tsc + eslint + vitest verdes.
- [ ] Overlay funcional (abre/cierra) y recorte de muros visible al orbitar.
- [ ] FPS ≥30, 0 errores. Screenshot.
- [ ] Bundle del editor sin el chunk 3D; editor 2D sin regresiones.

## Risk Assessment
- Login bloquea ver el editor real headless → plan B: verificar el overlay vía `/dev/3d`.
- Recorte de muros con criterio mal calibrado → muros parpadean u ocultan de más; ajustar el
  margen del helper tras ver el render.
