---
phase: 3
title: "Puertas y ventanas alojadas en paredes"
status: pending
priority: P1
dependencies: [1, 2]
---

# Puertas y ventanas

## Overview

Colocar y mover con preview orientada, pared candidata resaltada y distancia a extremos; soltar confirma exactamente lo mostrado.
Esto es el comportamiento propuesto que debe superar aceptación. En referencia la puerta sí se reubicó; para ventanas solo se comprobó highlight verde, no alojamiento final. No usar esa prueba incompleta como garantía.
Dos ventanas quedaron libres en ensayos (una fuera y otra en centro). La automatización puede no haber reproducido la interacción necesaria: no es prueba de un defecto ni limitación de Planner5D.

## Requirements

- Catálogo tipado con miniatura propia/licenciada, ancho/alto/elevación y límites por modelo; no scrape de activos privados.
- Click catálogo entra en colocación; drag y alternativa click pared + campos numéricos.
- Referencia observada crea algunos modelos libres en centro antes de alojarlos. Propuesta Habiteka: mantener preview transitorio sin huésped o distinguir explícitamente objeto libre de abertura; nunca guardar `Opening` sin `wallId` válido ni abrir un vano por simple cercanía.
- Selección muestra contextual y medidas. Centro, copiar, invertir bisagra/apertura, eliminar; estilo por materiales/modelos soportados.
- Reasignación a otra pared preserva ID, ancho, altura, modelo y orientación semántica; rotación geométrica se deriva del anfitrión.
- Resaltado indica pared receptora, no solo objeto seleccionado; complementarlo con preview y estado textual para no depender solo del color.

## Architecture

`resolve-opening-placement(doc,pointer,viewport,opening,previousHost)` puro devuelve `{wallId,position,orientation,clearances,valid,reason}`.
Proyección ortogonal y clamp por semiancho; comprobar colisión con otros huecos, límites de altura y longitud. Histéresis en pantalla evita salto entre muros próximos; desempate estable. Umbral no implica pegar cualquier objeto lejano.
Preview usa ese resultado; commit `rehost-opening` revalida contra documento vigente. Soltar inválido restaura origen; Escape no cambia historia. No remover hueco anterior hasta commit.
Separar selección, candidato y error con tokens distintos. Cotas desde bordes del vano a límites útiles, definición documentada.

## Related Code Files

- Modificar: `src/components/editor-v2/document-layer.tsx`, `inspector.tsx`, catálogo.
- Crear: `src/canvas/editor-v2/opening-placement.ts`, `opening-gesture.ts` y capas preview separadas.
- Modificar: `src/lib/editor-document/commands.ts` y validación.
- Revisar algoritmos legacy `src/canvas/3d/wall-openings.ts`; no usar asociación geométrica como identidad.

## Implementation Steps

1. Tests resolver: horizontal, vertical, diagonal, invertida, esquinas, muros próximos, vano ancho y solapes.
2. Registro catálogo y símbolo 2D ligado a sentido de apertura.
3. Gesto/transiciones/highlight; el mismo resultado posiciona preview y cotas.
4. Contextual, campos y comandos; copiar comienza colocación válida, no duplica solapado.
5. Guardado/recarga y comprobación 3D fase 5.

## Success Criteria

- [ ] Puerta cambia de pared derecha a superior sin salto ni cambio de ancho; posición guardada coincide ≤1 mm.
- [ ] Ventana conserva altura/elevación al reubicar; pared nueva abre vano y anterior se cierra.
- [ ] Soltar sin anfitrión o con solape no destruye elemento; feedback explica cómo corregir.
- [ ] Una operación de undo restaura anfitrión/posición/flips; mover no produce cientos de revisiones.

## Risk Assessment

## Evidencia parcial — 2026-09-08

Resolver compartido preview/commit, agarre longitudinal preservado, histéresis, clamp con holgura de esquina, highlight/estado textual y commit único. Copiar abertura inicia colocación. Tests cubren anfitrión horizontal→vertical, solapes, lejanía, ancho imposible y bypass de esquina. Root comprobó puerta nueva superior→derecha, persistencia y 3D; no equivale todavía al recorrido inverso ≤1 mm medido. Ventana existente visible; nueva inserción/reubicación conservando altura/elevación y undo completo pendientes de E2E. Benchmark tras corrección de preview: 200 muros ~0,234 ms, 500 ~1,12 ms por resolver; no equivale a FPS de escena.

Preview y commit divergentes: señal salto al soltar; bloquear entrega, unificar resolver. Flips físicos no son `scaleX(-1)` genérico: pruebas por orientación de muro y doble inversión.
