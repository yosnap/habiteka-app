---
phase: 3
title: Verificacion y cierre
status: completed
effort: ''
---

# Phase 3: Verificacion y cierre

## Overview
Verificación end-to-end en navegador real, suite completa, build, code-review y cierre.

## Implementation Steps
1. Suite completa `bunx vitest run` (453+ verdes) + `bunx tsc --noEmit` + eslint + `bun run build`.
2. Navegador real (dev-login → proyecto "Salón de ejemplo" → Ver en 3D): confirmar hueco de ventana
   con cristal y vano de puerta; orbitar para ver que el recorte por cámara sigue funcionando y que
   no aparecen cajas macizas sobre los huecos. Repetir en una zona con baño (puerta abajo).
3. Capturas a `plans/260622-1845-huecos-ventana-puerta-3d/reports/`.
4. Comprobar FPS (HUD) ≥30 y 0 errores de consola.
5. Code-review del cambio (agente). Actualizar memoria de proyecto.

## Success Criteria
- [ ] tsc + eslint + vitest + build verdes.
- [ ] Navegador: ventana con cristal, puerta como vano, muro recortado, recorte por cámara OK,
      suelo intacto, FPS ≥30, 0 errores. Capturas guardadas.
- [ ] Code-review sin Críticos/Altos abiertos.

## Risk Assessment
- **Regresión del recorte de muros:** más segmentos podrían ocultarse mal al orbitar. Verificar
  explícitamente girando la cámara 360°.
- **Casos del seed reales:** los ejemplos tienen solapamientos mínimos; si la asociación falla,
  el hueco no aparece. Verificar con los docs reales del seed, no solo fixtures sintéticos.
