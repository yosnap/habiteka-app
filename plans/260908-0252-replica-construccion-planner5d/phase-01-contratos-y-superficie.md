---
phase: 1
title: "Contratos y superficie de construcción"
status: pending
priority: P1
dependencies: []
---

# Contratos y superficie

## Overview

Separar catálogo, selección, gesto y documento. Construya abre navegación lateral de categorías más panel de opciones; contextual acompaña la selección y panel inferior muestra medidas.

## Requirements

- Paredes, habitaciones, formas y construcciones según evidencia; Smart Wizard solo anotado, no implementación.
- Inventario observado: Importar plano arriba; Dibujar Paredes, Habitaciones, Smart Wizard, Formas; construcciones Puertas, Ventanas, Escaleras, Arcadas, tabicas, Tejados, Chimeneas, columnas, Terrazas y vallas. Registrar categorías completas; esta iteración profundiza paredes/puertas/ventanas/escaleras, el resto requiere confirmar alcance funcional antes de exponer acciones.
- Menú pared y elemento con acciones reales y etiquetas; escapar, click exterior, foco de retorno, viewport clamp.
- Misma selección en 2D y 3D; menú desaparece durante drag para no interceptarlo y vuelve al finalizar.
- Móvil: categorías en sheet y propiedades en bandeja inferior; acciones equivalentes, targets ≥44 px.

## Architecture

Propuesta: `ConstructionMenu`, `ConstructionCatalog`, `SelectionContextMenu`, `SelectionPropertiesBar`, `CanvasOverlayAnchor`.
Registro `SelectionAction` por tipo comparte habilitación y ejecución con teclado. `GestureState` fuera de historia; únicamente commit validado cambia documento.
Capabilities por modelo: puerta sencilla observada sin Abrir/Cerrar, doble sí; ventana observada sin inversiones; escalera sí. No mostrar la misma corona para todos los elementos. Comentarios/favoritos se registran como acciones observadas; antes de activarlos definir persistencia y alcance, no botones simulados.
Evolucionar esquema de forma explícita a una nueva versión con lector v2 y migrador puro: altura pared, altura/elevación hueco, `catalogId`, bisagra y apertura, materiales; escalera tipada. No añadir campos que parser descarte ni reescribir revisiones inmutables.
Guardar defaults resueltos una vez en migración, no inferirlos distinto en 2D y 3D. Cliente antiguo no puede sobrescribir documento nuevo; lectores desconocidos fallan cerrado y muestran solo lectura.
Ocultar pared es visibilidad de vista, no borrado ni eliminación del suelo; distinguir ocultación temporal por cámara de preferencia guardada.

## Related Code Files

- Modificar: `src/lib/editor-document/{schema,validation,commands}.ts`, `src/canvas/editor-v2/store.ts`.
- Modificar: `src/components/editor-v2/{editor-shell,toolbar,inspector}.tsx`, `editor.module.css`.
- Revisar: `src/server/editor/document-input.ts`, adapters, drafts y cola para versión nueva.
- Reutilizar patrón, no copiar ciegamente: `src/components/canvas/3d/radial-context-menu.tsx` (targets actuales 36 px y símbolos heterogéneos).

## Implementation Steps

1. Congelar evidencia y matriz acción/tipo/estado; resolver curva y variantes pendientes antes de prometerlas.
2. Tests rojos de versión, roundtrip y valores desconocidos; migración sin escritura de historia anterior.
3. Extraer acciones semánticas; construir sidebar/contextual/propiedades con tokens existentes.
4. Conectar comandos y readonly; no botones placebo.

## Success Criteria

- [ ] Documento anterior carga sin pérdida; guardar versión nueva conserva todas las propiedades.
- [ ] Todos los controles tienen teclado, foco visible y cancelación; ningún overlay tapa selección en bordes.
- [ ] Abrir/cerrar menús y alternar modos no crea revisiones.

## Risk Assessment

## Evidencia parcial — 2026-09-08

Implementados contrato v3, migración explícita sin mutar v2, rechazo de downgrade, megamenú y barra/contextual DOM. Tests `construction-contract` y `construction-integration` verifican roundtrip, propiedades desconocidas y orientación física al invertir/fusionar. Root verificó guardado/recarga de puerta nueva; selección sobrevive cambio de modo y ACK, con selector «Elemento del plano» operable por teclado en inspector. Pendientes para aceptación: todas las propiedades nuevas persistidas en E2E, retorno de foco, bordes/móvil, apertura de menús y cambio de modo sin revisiones. No se cierra fase por mera existencia de componentes.

Esquema desplegado antes de lectores compatibles causa pérdida/rechazo: señal test roundtrip fallido; detener rollout y mantener versión previa, nunca silenciar campos. No cambio automático de proyecto legacy.
