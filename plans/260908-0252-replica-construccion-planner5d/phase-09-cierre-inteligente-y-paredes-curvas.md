---
title: "Phase 9: cierre-inteligente-y-paredes-curvas"
status: todo
---

# Phase 9: cierre-inteligente-y-paredes-curvas

## Overview

Ampliación autorizada por el usuario el 2026-09-08 04:19 («adelante entonces»).
Mantener stack React/TypeScript, Konva y Three. Código en worktree feat/editor-v2.
No modificar el plano activo para QA ni introducir segmentos ficticios como paredes curvas canónicas.

## Requirements

- [ ] Cierre inteligente prolonga un extremo libre compatible, preserva IDs, vanos y comentarios, sin pared residual.
- [ ] Pared curva editable con control central y valor de curvatura, retorno a recta y coherencia 2D/3D.

## Implementation Steps

1. Cierre: resolver intersección del eje prolongado con la dirección ortogonal del trazo; tolerancia de captura en pantalla y solo extremos libres. Previsualizar prolongación antes del clic. Remapear parámetros de vanos/comentarios para mantener posición física. Commit único validado con undo.
2. Curvas: ampliar contrato con curva canónica única, resolver trayectoria/longitud/tangente compartidas por dibujo, área, cotas, aberturas, colisiones y malla. Añadir control contextual, arrastre central y campo numérico. Mantener lectura de documentos históricos.
3. Validar cambios con tests geométricos, persistencia e historia; typecheck/lint y recorrido Comet en una escena de prueba.

## Evidencia de referencia

Comet, Planner5D, 04:12: contextual «Curved wall» convierte pared y recalcula contorno/área; arrastre central modifica «Curve height» (observado 187 cm); contextual ofrece «Flat wall». No comprobados aún vanos en curvas ni resultado 3D de esa curva. No inferir implementación interna.

## Revisión técnica

Cierre: reutilizar snap-candidates y wall-draw-machine; no cambiar esquema. Rechazar ambigüedad y cruces por validación existente. Curvas afectan contratos transversales y requieren revisión detallada antes de cambiar esquema; no tratarlas como un cambio cosmético.

## Todo

- [ ] Tests de cierre por ambos extremos, snap desactivado, zoom, vanos, cancelación e historia.
- [ ] Matriz de curvas con uniones, huecos, áreas, cotas, guardado y 3D.

## Success Criteria

Capturas de Comet y pruebas reproducibles respaldan cada comportamiento; no declarar réplica completa si queda algún criterio pendiente.

## Evidencia parcial 04:30

Cierre implementado: `wall-extension.ts`, snap y máquina de trazo comparten resolución; extremo libre de cadena, radio12px, preservación de anfitrión y posición física de vanos/comentarios. Cuatro tests nuevos. Comet confirma superior5m→6,25m al cerrar, sin pared residual; undo restaura inicio corto, redo cierra. Curvas NO implementadas. Criterios compuestos continúan abiertos.
