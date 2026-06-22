---
phase: 3
title: Integración y verificación
status: completed
effort: ''
---

# Phase 3: Integración y verificación

## Overview

Suite completa + verificación visual en el navegador: los muebles del salón aparecen donde
están en 2D, a escala; los kinds sin modelo como caja etiquetada.

## Implementation Steps
1. `bunx tsc --noEmit` + `bunx eslint` sobre archivos F6.
2. `bunx vitest run` (canvas + el test 3D ampliado).
3. Dev server + chrome-devtools en `/dev/3d`: ver el salón con sofá/mesa/TV/lámpara
   colocados; comparar disposición contra el 2D (sofá enfrenta TV, etc.); FPS ≥30; consola
   sin errores. Screenshot (vista cenital o con muros ocultos si hace falta ver el interior).
4. Confirmar aislamiento (solo `/dev/3d` importa el módulo 3D) y limpieza de assets no usados.

## Success Criteria
- [ ] tsc (sin errores nuevos) + eslint + vitest verdes.
- [ ] Muebles visibles, colocados y a escala en el navegador; placeholders donde toca.
- [ ] FPS ≥30, 0 errores de consola. Screenshot guardado en plans/.../reports/ o plans/reports/.
- [ ] Editor 2D sin regresiones.

## Risk Assessment
- glTF reusado en varias instancias sin clonar → comparten transform/estado. Mitigado clonando.
- Modelos pesados (Lantern 9,5 MB) → coste de carga; aceptable en v1, optimización en F6.5.
- Orientación del modelo (mirando a +Z vs −Z) puede no coincidir con la rotación del doc →
  ajuste por-modelo opcional en el mapa si se detecta; documentar si aparece.
