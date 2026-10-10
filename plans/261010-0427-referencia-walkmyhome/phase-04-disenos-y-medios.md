---
title: 'Fase 4: Diseños, aceptación y medios'
status: completed
---

# Fase 4: Diseños, aceptación y medios

## Objetivo y dependencias

P1. Completada localmente. Conectar preparación, resultado y presentación sobre la autoridad existente. [Regla de producto y flujos](../../docs/ux/walkmyhome-reference.md).

## Arquitectura

Reutilizar visor, galerías de tandas, acciones de aceptación y estudio de vídeos. Contexto común para retorno y acciones siguientes; comprobaciones de compatibilidad y permisos siguen en servidor. Navegación no equivale a aprobación ni generación.

Cambio exclusivamente visual: todas las cámaras, ámbitos, modos, referencias, permisos, retoques, variantes y modalidades actuales siguen accesibles. No implementar reconstrucción, nuevos motores o modalidades como parte de este plan.

## Pasos

1. Revisar entrada a Diseñar con IA según vista y conservar el diseño del plano 2D existente. La nueva composición integra resultados/asistente sin modificar sus herramientas.
2. Dar visibilidad a revisión del plano, ámbito, planta, cámara, luz, origen y presupuesto en preparación y resultados. Mostrar estados registrados, no deducidos por existencia de imagen.
3. Conectar tanda y visor a contexto de navegación; anterior/siguiente, petición de cambios y volver al editor conservan identidad y foco.
4. Destacar revisión/aceptación humana y próxima acción. Una variante o retoque empieza pendiente; auditoría y aceptación siguen distintas.
5. Preparar medios desde selección compatible: modalidad, referencias, cobertura, coste y recuperación. Preservar reintentos expresos y trabajos ya cobrados.
6. Adaptar visualmente estados y accesos de exploración/recorrido existentes. La visita final continua mantiene su estado pendiente y bloqueo; su implementación pertenece al plan integral, fuera de este rediseño. Jamás reconectar FreeWalk como sustituto ni copiar atajos externos sobre los propios.
7. Resolver móvil desde aquí: imagen y panel revisables sin quedar bajo teclado, carrusel accesible, acciones de aceptación alcanzables y foco/restauración correctos.

## Archivos

Modificar si procede: `src/components/deliverables/render-image-dialog.tsx`, `render-image-dialog.module.css`, `render-acceptance.tsx`, `render-batch-gallery.tsx`, `src/components/editor-v2/editor-generate-dialog.tsx`, `video-studio.tsx`, `video-studio-workspace.tsx`.

Reutilizar sin debilitar: `src/server/walkthrough/render-acceptance-actions.ts`, `src/lib/editor-document/render-reference-compatibility.ts`, `src/server/editor/authority.ts`. No migración de aceptación automática de históricos.

Documentar: Starlight `guias/imagenes.md`, `guias/guardar-aprobar.md`, `videos/estudio.md`, `videos/tipos.md`, `videos/recorrido.md`, `ayuda/novedades.md` según comportamiento cambiado.

## Seguimiento

- [x] Conectar preparación, tanda, visor y retorno.
- [x] Mantener aceptación explícita y incompatibilidades.
- [x] Integrar modalidades y recuperación con presupuesto.
- [x] Presentar exploración/recorrido con sus capacidades y bloqueos actuales íntegros.
- [x] Validar móvil y actualizar documentación.

## Aceptación y pruebas

Descartado/referencia/nueva variante no sirven como diseño aceptado. Cambio de revisión, ámbito, planta o permisos produce motivo concreto de incompatibilidad. Acceso al estudio no cobra; confirmar gasto es acción expresa. Retirar aceptación bloquea nuevas operaciones. Visita continua pendiente no exporta ni muestra una guía nativa como resultado.

Pruebas: `pnpm exec vitest run tests/server/render-acceptance-actions.test.ts tests/agent/render-reference-library.test.ts tests/editor-document/video-studio.test.ts tests/editor-v2/approval-drift-notice.test.ts`. Añadir regresión del contexto/retorno solo donde cambie. Revisar teclado y táctil del visor.

## Riesgos y continuación

El atractivo visual no demuestra fidelidad. Se conservan los requisitos actuales de revisión humana de arquitectura, muebles, acabados, movimiento y uniones sobre referencias aceptadas. Los tests/compilación no sustituyen esa revisión. Adaptar la interfaz de capacidades existentes; la continuidad final mantiene su bloqueo y se desarrolla en su plan propio.

## Resultado de implementación

Completado dentro del alcance visual autorizado. [Inventario y verificación](../reports/implementation-261010-0509-workspace-walkmyhome-report.md). Se conserva el 2D y los servicios existentes. Barra izquierda, Ayuda/Ajustes inferiores y paneles flotantes; audio futuro. Responsive verificado por emulación y navegación local en Comet, sin generar ni aceptar material. Cámara exterior restaurada; la interior se elige con los controles actuales. Las pruebas no sustituyen hardware móvil real ni validación de una producción IA. Entrega local; no despliegue.
