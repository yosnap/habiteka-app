---
title: "Phase 6: Propiedades espaciales y acabados"
status: todo
---

# Phase 6: Propiedades espaciales y acabados

## Overview

Ampliación aprobada 03:46: tamaño, giro sobre centro, elevación y pintura implementados; aceptación integral parcial. Preservar fases 1–5 y su evidencia.

## Requirements

Furniture hoy no guarda altura/elevación/material; escena usa altura de presentación. Opening usa colores constantes para marco/hoja/vidrio. Pared ya tiene materiales por cara, pero falta acceso directo y color. Escalera gira sobre origen, no centro.
Captura: Width/Depth/Height/Elevation/Angle y escalera -5°. No inferir física de Planner5D.

## Architecture

Propuesta documento v4: altura/elevación/apariencia de muebles; acabados de marco/hoja de aberturas; color por cara de pared; comentarios definidos en fase 8.
Lectura v2/v3 inmutable; migración explícita con apariencia equivalente, parse estricto y rechazo de downgrade con pérdida.
Conservar origen histórico: helper calcula centro mundial y compensa x/y al cambiar ángulo/tamaño. No migrar todos los pivotes.
Capacidades por tipo: mueble/escalera ancho/fondo/alto/elevación/ángulo; abertura ancho/alto/elevación y orientación del muro; pared largo/grosor/alto/caras.
Puerta/ventana no rota libre fuera del muro. Giro de hoja/bisagra es otra propiedad.
MaterialId propio y color validado. Paredes: acabados independientes Interior/Exterior visibles solo en 3D; coronación comparte tinta arquitectónica con 2D. Contorno determina cara interior; tabique común distingue dos interiores. Contorno abierto no inventa interior/exterior. Preservar transparencia del vidrio.

## Related Code Files

Worktree feat/editor-v2: src/lib/editor-document/{schema,validation,migrations,construction-properties,construction-commands}.ts, adapters; src/canvas/editor-v2/scene/{editor-document-to-scene,opening-meshes,wall-meshes}.ts; src/server/editor/document-input.ts; tests/editor-document y tests/server.

## Implementation Steps

1. Tests de lectura histórica y pivote central; inventariar todos los lectores/escritores.
2. Contrato y comandos versionados; defaults equivalentes a escena actual.
3. Proyección usa dimensiones y acabados guardados, no colores/alturas constantes.
4. Campos coherentes cm/grados, acceso contextual Pintar; rechazo restaura valor previo.
5. Guardar/reabrir, copia, undo/redo y pérdida de sesión.

## Success Criteria

- [ ] Altura, elevación y apariencia sobreviven 2D/3D, copia, undo/redo y recarga.
- [ ] Giro 0→37→90→0 conserva centro mundial ≤1 mm sin deriva.
- [ ] Lectura histórica conserva versión/fingerprint; actualización explícita no pierde datos.
- [ ] Solo controles admitidos por elemento; aberturas siguen en muro.

## Risk Assessment

Corrección 04:38: laterales de inglete continúan acabados por cara incidente, no material neutro global. Prueba específica de dos exteriores azul/verde en una esquina conserva coronación y separación interior/exterior. Comet observado interior rojo/exterior azul sin franjas neutras en extremos. Suite948pass5skip; typecheck/lintscope/buildaislado25/25pass. No cierra matriz integral ni curvas.

Defaults arbitrarios pueden desplazar modelos: comparar escena histórica antes/después. No afirmar medidas de catálogo sin metadatos. Más de ocho archivos justificados por contrato, dos vistas y frontera de guardado; helpers pequeños, sin cambiar stack.
