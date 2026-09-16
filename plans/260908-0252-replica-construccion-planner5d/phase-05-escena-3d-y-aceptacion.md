---
phase: 5
title: "Escena 3D coherente y aceptación"
status: pending
priority: P1
dependencies: [2, 3, 4]
---

# Escena 3D y aceptación

## Overview

Alternar 2D/3D muestra el mismo documento, habitación y construcciones. El 3D no reinterpreta el plano ni genera una imagen con IA.

## Requirements

- Suelo derivado de habitaciones cerradas, muros con volumen y esquinas cerradas, huecos reales, marcos, hojas, vidrio y escalera.
- Cámaras orbitales y encuadre comprensible; ocultación de muros por cámara debe respetar selección y no alterar geometría.
- Mantener selección e historial al alternar; editar desde contextual usa comandos canónicos, no `scene-to-doc` legacy.
- Estados de carga/WebGL no disponible/pérdida de contexto y error de modelo; 2D permanece disponible.

## Architecture

Nueva proyección pura `editor-document-to-scene.ts`: mm→m, x2D→X, y2D→Z, altura→Y. Origen estable por proyecto/vista, no recenter cada movimiento de un objeto.
Modelo de escena independiente de React con sourceEntityId por mesh. Suelos por contornos reales, no bbox sustituto ante habitación abierta. Triangulación de concavidad y huecos validada.
Volúmenes de muro segmentados por vanos, con dinteles/alféizares y carpintería; reutilizar conceptos de `wall-openings.ts` tras separar entrada canónica. Extremos unidos por topología compartida, no heurística de cercanía 0,3 m.
Extraer renderer presentacional desde `plan-3d-view.tsx` o reutilizar capas glass/frames; no portar store legacy ni sus mutaciones. Carga dinámica 3D; geometrías/materiales memoizados y liberados al sustituir.
Render bajo demanda cuando no hay interacción; limitar luces/sombras y medir antes de añadir efectos. Consulta R3F web no disponible por límite de contenido: verificar docs/API local al implementar.

## Related Code Files

- Crear: `src/canvas/editor-v2/scene/{editor-document-to-scene,wall-meshes,room-meshes}.ts` y vista 3D modular.
- Revisar/reutilizar: `src/components/canvas/3d/{plan-3d-view,glass-layer,opening-frames-layer}.tsx` y `src/canvas/3d/camera-views.ts`.
- Modificar: `src/components/editor-v2/editor-shell.tsx` y registro de selección compartido.
- Tests: proyección, huecos, esquinas, escaleras, cambios de modo y persistencia de documento nuevo.

## Implementation Steps

1. Tests puros de ejes, pivotes, medidas y huecos antes de conectar renderer.
2. Escena mínima iluminada con controles; cámara y ocultación comprobadas.
3. Modelos constructivos y contextual compartido; ninguna geometría desde imagen IA.
4. Aceptación end-to-end en Comet, proyectos de prueba separados, sin modificar plano original.

## Success Criteria

- [ ] Fixture rectangular, L, U, muros diagonales y varias habitaciones: volumen y cotas coinciden ≤1 mm.
- [ ] Tras mover puerta/ventana, no queda abertura fantasma en pared anterior ni muro macizo en la nueva.
- [ ] 20 alternancias 2D/3D no cambian documento ni duplican eventos; 50 undo/redo íntegros.
- [ ] Reload conserva escena; no nuevas pérdidas por HMR, cuotas IDB, conflicto o sesión cerrada.
- [ ] Comet 1280×800 y 390×844: controles accesibles, sin overflow; keyboard y reduced-motion.
- [ ] Escena de 200 elementos: medir p95 interacción <100 ms y objetivo ≥30 fps durante órbita en equipo documentado; no asegurar rendimiento universal.
- [ ] Tests, lint, typecheck, build; evidencia visual antes/después y consola sin errores nuevos.

## Risk Assessment

## Evidencia parcial — 2026-09-08

Proyección pura mm→m, suelo cóncavo, muros con vanos/dintel/alféizar, hoja/vidrio, escaleras y cámara orbital implementados. Root capturó habitación, puerta, ventana y escalera U interior en 3D real; undo/redo de posición sincronizado y selección conservada tras modo/ACK. Pérdida de contexto tras HMR resuelta recargando, no se declara resiliencia completa. Tests puros verifican origen estable, huecos, diagonal y escaleras. QA actualizada: 923 aprobadas/5 omitidas, 135 archivos aprobados; typecheck y lint del alcance 0. Lint global 29 errores/16 avisos legacy. Build aislado aprobado Next 16/webpack, 25/25 páginas, `/tmp/habiteka-build-B3t2Cl`, sin detener dev. Pendientes gates compuestos: fixtures completos, nueva ventana reubicada, 20 cambios/50 undo, fallos persistencia, móvil/teclado/reduced-motion, p95/FPS y consola final. Comet compartido con usuario: pruebas foreground requieren coordinación, no abrir Chrome.

Reusar renderer sin adaptar contratos reintroduce escala/defaults y asociaciones erróneas: bloquear test de coordenadas. Modelo cargado pero incorrecto no equivale a éxito. Rendimiento insuficiente: perfilar geometría/luces, no degradar silenciosamente medidas o quitar construcciones.
