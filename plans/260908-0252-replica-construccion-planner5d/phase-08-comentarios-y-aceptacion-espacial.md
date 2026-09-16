---
title: "Phase 8: Comentarios y aceptacion espacial"
status: todo
---

# Phase 8: Comentarios y aceptacion espacial

## Overview

Comentarios anclados y persistentes; aceptación de toda la ampliación. Depende de 6–7, sin sustituir gates 1–5.

## Requirements

Acción Comentar sobre pared, abertura, mueble y escalera; añadir/editar/eliminar texto plano, marcador y contador.
Comentario sigue al elemento al mover/girar/cambiar anfitrión.
Anotaciones del proyecto con permisos actuales: no correo, avisos, menciones ni chat en tiempo real.
No atribuir autoría suministrada por cliente. Si se muestra autor, debe asignarlo la sesión validada por servidor.

## Architecture

v4 implementado: comments con id,targetEntityId,ancla local normalizada,text limitado. Pared/abertura ancla longitudinal/cara; objetos local XY. Proyección 2D/3D. Matriz de aceptación exhaustiva todavía abierta.
Texto plano sin HTML ejecutable ni adjuntos. Propuesta 2000 caracteres/comentario, 500/documento y límite total de payload existente.
Reutilizar revisiones/CAS/scope, no canal colaborativo paralelo.
Eliminar entidad elimina comentarios asociados en mismo comando reversible. Copiar entidad no copia comentarios por defecto.
Borrador no entra en historia hasta confirmar. Cancelar no guarda.

## Related Code Files

Worktree: src/lib/editor-document/{schema,validation,migrations}.ts y comment-commands.ts; src/server/editor/document-input.ts y guardado existente; componentes canvas-selection-menu,element-comments-panel,comment-markers; escena; tests editor-document/server/UI.
Markdown únicamente original/plans u original/docs según instrucciones actuales.

## Implementation Steps

1. Contrato, comandos CRUD, anclas y límites; pruebas referenciales/XSS/scope.
2. Acción contextual, panel accesible y marcadores ligados al ID.
3. Guardado/reapertura/conflicto dos sesiones, no sobrescritura silenciosa; undo/redo y eliminación asociada.
4. Comet en proyecto de prueba: cama, mesa, escalera, puerta, ventana, pared pintada y comentarios.
5. Suite, lint/typecheck y build aislado; documentación y reconciliación completa 1–8.

## Success Criteria

- [ ] Comentario de ventana sigue cambio de muro y sobrevive 2D/3D y recarga.
- [ ] Copia no hereda conversación; eliminar+undo restaura anclas/textos.
- [ ] Readonly/scope ajeno bloquean escritura; texto malicioso se muestra literalmente.
- [ ] Tamaño→giro→elevación→encaje→pintura→comentario→3D→undo/redo→recarga conserva geometría ≤1 mm.
- [ ] Comet escritorio/móvil/teclado, suite compartida y build con evidencia.
- [ ] Ninguna colocación válida termina interpenetrada ni cambiar modo crea revisiones.

## Risk Assessment

No simular chat multiusuario sin conflictos. Colaboración en vivo requiere otro contrato. No etiquetar modelos simplificados como certificación constructiva; registrar límites concretos sin ocultar carencias.
