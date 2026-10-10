---
title: 'Experiencia Habiteka con referencia WalkMyHome'
description: 'Navegación y trabajo contextual en escritorio y móvil, conservando la construcción del plano 2D actual.'
status: completed
priority: P1
effort: 'Implementación visual local y validación responsive'
branch: feat/publicidad-vertical-cotas
tags: [frontend, docs, ux]
blockedBy: []
blocks: []
created: 2026-10-10
---

# Experiencia de trabajo con referencia WalkMyHome

## Overview

Adoptar la navegación, trabajo sobre el inmueble, ayuda contextual y presentación de WalkMyHome. **Conservar la construcción y herramientas del plano 2D, compartiendo navegación y menús por aclaración posterior**, usar **asistente contextual junto al lienzo** e incluir **móvil desde el inicio**: decisiones expresas del usuario. Implementación autorizada el 10 de octubre; no autoriza gasto, aceptación automática, publicación ni despliegue.

Alcance confirmado: **solo vistas y diseño**, conservando todas las funcionalidades/opciones/servicios de Habiteka. Lo propio sin equivalente externo se adapta visualmente. No incorporar motores ni funciones exclusivas de WalkMyHome.

Fuente duradera: [referencia UX](../../docs/ux/walkmyhome-reference.md). Evidencia: [demo y editor autenticado en Comet](../reports/ux-261010-0427-walkmyhome-report.md). Navegación de escritorio revisada; no confundirla con pruebas de resultados o móvil externos.

## Goals

| #   | Goal                                                           | Priority |
| --- | -------------------------------------------------------------- | -------- |
| 1   | Contexto y retorno consistentes entre tareas                   | P1       |
| 2   | Trabajo en Amueblado/3D con paneles y asistente contextuales   | P1       |
| 3   | Diseños y medios con aceptación, presupuesto y estados reales  | P1       |
| 4   | Flujos adaptados a escritorio, tableta y móvil desde cada fase | P1       |

## Phases

| #   | Phase                                                                   | Status                               |
| --- | ----------------------------------------------------------------------- | ------------------------------------ |
| 1   | [Auditoría y contrato UX](./phase-01-start.md)                          | Implementado; inventario contrastado |
| 2   | [Espacio de trabajo y contexto](./phase-02-espacio-trabajo.md)          | Implementado                         |
| 3   | [Navegación 3D y edición contextual](./phase-03-edicion-contextual.md)  | Implementado                         |
| 4   | [Diseños, aceptación y medios](./phase-04-disenos-y-medios.md)          | Implementado                         |
| 5   | [Adaptación de funciones propias](./phase-05-herramientas-avanzadas.md) | Implementado–3                       |
| 6   | [Validación y entrega](./phase-06-validacion-y-entrega.md)              | Completada localmente                |

## Dependencias y límites

Reutilizar rutas, editor/store, catálogo, autoridad del servidor, aceptación y estudio de vídeo. Las capacidades finales pendientes se siguen en el [plan integral](../260924-1459-flujo-integral-plano-diseno-inmersion-video/plan.md), no se implementan en este rediseño. Sus estados antiguos deben contrastarse con Starlight y código. La regla vigente de diseños IA aceptados prevalece.

La visita continua exige una representación validada del diseño aceptado; no se resuelve activando el paseo del modelo guía. La construcción del plano 2D queda protegida: no cambiar gestos, atajos, trazos, selección ni cotas. Lateral y menús se rediseñan por autorización expresa. La integración externa debe probar que no cambia esos contratos.

## Success Criteria

- [x] Validar inventario funcional completo y prototipo a partir de la referencia revisada.
- [x] Conservar todas las funciones/opciones existentes, adaptando las propias sin equivalente externo.
- [x] Conservar plano 2D y contratos de guardado/operaciones pendientes.
- [x] Recuperar contexto válido al volver de diseños, medios y asistente.
- [x] Validar cada incremento en móvil, tableta y escritorio.
- [x] Mantener gasto expreso, aceptación humana y bloqueos de referencias.
- [x] Dejar documentadas solo funciones verificadas, con guía y novedades preparadas para el mismo despliegue.

## Validation Log

Registro inicial de implementación: módulos `workspace/`, asistente compartido, paneles flotantes y tareas de Diseños/Vídeos. Preferencia posterior del usuario: modos en lateral izquierdo, Ayuda/Ajustes inferiores, backup actual reutilizado y audio futuro. Primer pase: tipos/lint correctos y 49 pruebas en 7 archivos. La revisión detectó especificidad del CSS heredado, corregida antes de la entrega. La cámara interior se vuelve a elegir desde los controles; se restaura la exterior. Sin IA de pago ni cambios geométricos en proyectos privados.

Confirmado por el usuario: cambio exclusivamente de vistas/diseño; funcionalidades de Habiteka íntegras; adaptar las propias sin equivalente externo; construcción 2D protegida; asistente contextual y móvil desde el inicio. Navegación autenticada revisada en Comet. Inventario contrastado y composición implementada/revisada en navegador. No se requiere volver a preguntar decisiones confirmadas.

Revisión de contratos: rutas/componentes y pruebas citados se verifican en el repositorio. Revisar coherencia completa tras incorporar evidencia autenticada. El seguimiento vive en las casillas de cada fase; no se abre un gestor externo ni se delega a otros agentes.

Verificación tras Comet: `npm run docs:updates` y `npm run docs:build` correctos; Astro sin errores ni avisos, 18 páginas. Estructura AK, formato y diff correctos; 10 documentos, 18 enlaces y 26 rutas revisadas sin errores. Barrido de las seis fases: solo presentación, equivalencia funcional, construcción 2D protegida y móvil desde el inicio. No acredita mejoras implementadas ni operaciones externas no probadas.

<!-- slug: referencia-walkmyhome -->

## Entrega local

### Corrección tras revisión del usuario · 11:52

El usuario aclara que el lateral y los menús del Plano 2D también pueden cambiar; la restricción protege la construcción y herramientas, no su presentación. Esta aclaración prevalece sobre la protección visual inicial descrita en las fases. Los tres modos comparten siete grupos desplegables, barras flotantes de vistas/herramientas/iluminación y paneles de altura ajustada. Sin arrastre, nuevos motores ni cambios a CanvasView, comandos, imanes, cotas o atajos. Corrección implementada y verificada localmente: 46 pruebas pertinentes, tipos/lint y navegación a 360/768/1440 px.

Escena se amplía por petición posterior: pestañas Estructura/Mobiliario/Estancias, paredes con sus aberturas, suelos y techos con luminarias, Mostrar más, nombre en campos existentes y visibilidad de sesión sin editar geometría. [Informe de la corrección](../reports/implementation-261010-1152-menus-flotantes-report.md).

[Informe de implementación y equivalencia](../reports/implementation-261010-0509-workspace-walkmyhome-report.md). Seis fases completadas dentro del alcance visual; 94 pruebas en 16 archivos, tipos/lint/build correctos. Comet: referencia, asistente, diseños, vídeos y regreso al 3D con cámara conservada. Emulación: 360/390/768/1024/1440 px. Audio y modalidades finales pendientes conservan su estado propio. No generación de pago, aceptación de imágenes, commit, push ni despliegue.
