---
title: 'Fase 2: Espacio de trabajo y contexto'
status: completed
---

# Fase 2: Espacio de trabajo y contexto

## Objetivo y dependencias

P1. Completada localmente. Conectar tareas y retorno conservando rutas y editor 2D. [Contrato UX](../../docs/ux/walkmyhome-reference.md).

## Arquitectura y requisitos

Mantener el store y la sesión de edición existentes como dueños del documento. Un contexto de navegación separado conserva proyecto/zona/planta, vista, selección válida y cámara 3D. No añadir estado visual al documento geométrico ni duplicar cola de guardado.

El cambio es de presentación: conservar cada función/opción y sus manejadores, contratos y servicios. El estado de navegación nuevo, si resulta necesario, pertenece exclusivamente a la interfaz; no cambia operaciones ni permisos.

La cabecera y navegación exterior pueden aclarar tareas, pero el marco interior del plano 2D mantiene su composición y comportamiento. Compatibilidad de enlaces existentes. Preferencias locales por usuario/proyecto/zona; sin cambiar Prisma salvo necesidad demostrada.

## Pasos

1. Consumir el inventario funcional de fase 1 y verificar correspondencia de cada entrada/opción. Inventariar estado de rutas/sesión y respetar contratos actuales al navegar, recargar y cambiar de proyecto.
2. Proponer módulo pequeño de contexto de navegación con restauración validada. Referencias borradas o de otra zona se descartan y se explica el contexto recuperado.
3. Integrar cabecera y retorno sobre ProjectTabs y EditorSession. No duplicar títulos, guardado ni comandos.
4. Mantener CanvasView y su interfaz actual; aplicar nueva composición exclusivamente a vistas y espacios autorizados.
5. Adaptar navegación exterior y paneles nuevos a móvil desde este incremento. Hoja con cierre/retorno, teclado virtual y áreas seguras; ningún control nuevo tapa el 2D.
6. Mantener conflictos y operaciones pendientes. Navegar nunca cancela ni confirma un trazo, una colocación o una generación en silencio.

## Archivos

Modificar: `src/components/app/project-tabs.tsx`, `src/components/editor-v2/session/editor-session.tsx`, `src/components/editor-v2/editor-project-bar.tsx`, `src/components/editor-v2/editor-shell.tsx`, `src/components/editor-v2/editor-preferences.ts` según contrato validado.

Propuesta de módulos nuevos: `src/components/editor-v2/workspace-navigation-context.ts` y `workspace-navigation.tsx`. Su ubicación/nombre deben confirmarse buscando módulos equivalentes antes de crearlos. No eliminar rutas ni reescribir el shell; extraer solo integración necesaria y mantener archivos menores de 1000 líneas.

Documentar cambios reales en `docs/site/src/content/docs/guias/primer-proyecto.md`, `editor/herramientas.md`, `ayuda/novedades.md` y referencia técnica.

## Seguimiento

- [x] Definir persistencia y contrato de retorno.
- [x] Garantizar que toda función/opción conserva acceso y el mismo manejador.
- [x] Implementar navegación y contexto sin cambiar el 2D.
- [x] Resolver guardado, lectura, borrador divergente y referencias borradas.
- [x] Validar móvil/tableta/escritorio y documentación.

## Aceptación y pruebas

Volver desde Diseños/Vídeos recupera proyecto, zona, planta, vista y cámara válidos. Cambiar de proyecto nunca restaura la selección ajena. Borrador y conflicto conservan sus acciones. Ninguna navegación inicia gasto.

Pruebas pertinentes: `pnpm exec vitest run tests/editor-v2/view-navigation.test.ts tests/editor-v2/side-panel.test.ts tests/editor-document/save-queue.test.ts tests/editor-document/save-queue-review.test.ts`. Añadir cobertura de retorno/invalidez si aparece comportamiento nuevo. Comparación visual y manual del 2D contra fase 1; widths 360, 390, 768, 1024, 1440.

## Riesgos y continuación

Remontar el editor podría perder historia/cámara; definir propietarios y limpieza antes de integrar. Campos de texto y operaciones pendientes conservan foco y prioridad. Fase 3 consume el contexto común.

## Resultado de implementación

Completado dentro del alcance visual autorizado. [Inventario y verificación](../reports/implementation-261010-0509-workspace-walkmyhome-report.md). Se conserva el 2D y los servicios existentes. Barra izquierda, Ayuda/Ajustes inferiores y paneles flotantes; audio futuro. Responsive verificado por emulación y navegación local en Comet, sin generar ni aceptar material. Cámara exterior restaurada; la interior se elige con los controles actuales. Las pruebas no sustituyen hardware móvil real ni validación de una producción IA. Entrega local; no despliegue.
