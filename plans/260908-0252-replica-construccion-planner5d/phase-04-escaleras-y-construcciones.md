---
phase: 4
title: "Escaleras y catálogo constructivo"
status: pending
priority: P1
dependencies: [1, 2]
---

# Escaleras y construcciones

## Overview

Entidad constructiva propia, no rectángulo de mueble etiquetado. Símbolo 2D y geometría 3D comparten dimensiones y orientación.
Variante U observada: 300×216×304 cm, elevación 0, ángulo 0; contextual Comentario / Estilo / Copiar / Centro / inversiones / Favoritos / Borrar y Girar. Cuatro cotas de distancia a paredes. En 3D se ven peldaños, barandillas y descansillo. No reutilizar geometría propietaria del modelo inspeccionado.

## Requirements

- Inventariar variantes inspeccionadas y controles antes de cerrar alcance exacto.
- Colocar, seleccionar, mover, girar, editar ancho/fondo/altura/elevación, copiar y borrar con undo.
- Representar peldaños, sentido de subida, descansillos y barandilla cuando el modelo la incluya.
- No declarar conexión funcional entre plantas sin niveles, destino y hueco de forjado explícitos.

## Architecture

Propuesta `Stair` con ID, catálogo/modelo, posición, rotación, ancho, desarrollo, altura total, elevación y parámetros tipados por variante. Constraints del catálogo impiden estirar una pieza de manera imposible.
`stair-layout.ts` puro devuelve huella, escalones y desembarco; consumido por 2D y 3D. No duplicar geometría con GLTF visual de escala desconocida.
Niveles/hueco: decisión de alcance pendiente; si se pide conexión vertical, incluir `levelId`, altura entre niveles y polígono de apertura, más validación. No ocultar esa carencia tras un modelo decorativo.
Otras construcciones según inventario, con clasificación wall-bound/free-standing; no forzar escaleras por contrato de abertura.

## Related Code Files

- Modificar: `src/lib/editor-document/{schema,validation,commands}.ts`.
- Crear: `src/lib/editor-document/stair-layout.ts`, catálogo constructivo y capas `stair-layer` 2D/3D.
- Revisar: `src/canvas/catalog.ts`, `src/canvas/3d/furniture-models.ts` (reutilización de infraestructura, no semántica).

## Implementation Steps

1. Congelar inventario y dimensiones observadas; diferenciar valores por defecto de restricciones.
2. Modelo y tests de geometría; serialización/versionado ya cubiertos en fase 1.
3. Catálogo, colocación y contextual con mismo sistema de comandos.
4. Construir símbolo y volumen coherentes; revisar intersecciones espaciales y escala.

## Success Criteria

- [ ] Cada variante entregada coincide en huella/altura/sentido entre 2D y 3D.
- [ ] Girar/copiar/recargar conserva parámetros; modelo ausente comunica error, no caja anónima como éxito.
- [ ] Ningún control dimensional muestra éxito si rompe parámetros de la escalera.

## Risk Assessment

## Evidencia parcial — 2026-09-08

Entidad `Stair`, variantes recta/L/U, geometría compartida `stairLayout`, peldaños/descansillos/barandillas 3D, edición dimensional y giro implementados. Tests de contrato/proyección verifican huella y altura de las tres variantes. Root insertó U y confirmó persistencia después de HMR; origen inicial fuera de habitación corregido. Ahora U interior X4000/Y2300 mm, captura 3D con habitación/puerta/ventana y undo Y920/redo Y2300 reales en Comet con «Sincronizado». wall_chain implementa copia de escalera; falta evidencia final y E2E giro/copia/recarga, controles inválidos y modelos ausentes. Alcance entregable: representación espacial de una planta, no conexión entre plantas ni certificación normativa.

«Escalera» puede implicar edificio multinivel: resolver antes de implementar. Esta app visual no certifica cumplimiento normativo; no convertir límites de UI en garantía constructiva.
<!-- Adenda 03:28: Copiar escalera ya implementado, nuevo ID y +300 mm XY, un undo.
Comet confirma copia X4300/Y2600 desde X4000/Y2300; undo conserva solo original.
Recarga conserva original y ubicación interior, verificada también en 3D.
Persistencia exhaustiva de todos los parámetros/variantes sigue pendiente. -->
