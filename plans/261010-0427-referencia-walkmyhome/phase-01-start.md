---
title: 'Fase 1: Auditoría y contrato UX'
status: completed
---

# Fase 1: Auditoría y contrato UX

## Objetivo y dependencias

P1. Referencia revisada en Comet e inventario contrastado; composición implementada y revisada en navegador. Escritorio, tableta y móvil desde el inicio. Base: [referencia](../../docs/ux/walkmyhome-reference.md) e [informe](../reports/ux-261010-0427-walkmyhome-report.md).

## Requisitos

- Conservar íntegra la vista y funcionamiento del plano 2D actual.
- Usar asistente contextual junto al lienzo y los servicios existentes.
- Distinguir editor autenticado, demo, ilustración comercial y propuesta de Habiteka.
- Mantener separación entre guía geométrica y diseños IA aceptados.
- Cambiar solo vistas/diseño; conservar todas las funcionalidades y adaptar las propias sin equivalente en WalkMyHome.

## Pasos y entregables

1. Usar la revisión en Comet de la escena indicada: navegación, paneles, catálogo, materiales, chat, árbol/inspector, importación, estudio visual y entrada/salida de Walkthrough. No volver a pedir login: existe sesión. Registrar móvil autenticado y operaciones no probadas como límites de evidencia.
2. Registrar por flujo: entrada, controles, acciones, respuesta visible, retorno, bloqueo/error y pantalla estrecha. No ejecutar generaciones ni exportar contenido privado sin alcance expreso.
3. Inventariar todas las funciones/opciones de Habiteka, ubicación y manejador actuales, ubicación propuesta y prueba de equivalencia. Incluir expresamente las funciones sin equivalente externo. Registrar base visual/interacción del 2D en muestra de desarrollo, sin alterar proyectos del usuario.
4. Crear prototipo local de Amueblado/3D, asistente, revisión de diseño y preparación de vídeo en 360/390, 768/1024 y 1440 px. Fuera de alcance: rediseñar la pantalla del plano 2D.
5. Validar nombres, agrupación de rutas y posición de paneles con tareas reales. Ajustar referencia y fases con evidencia, sin reabrir decisiones ya confirmadas.
6. Estimar esfuerzo de implementación tras resolver límites técnicos y prototipo.

## Archivos y arquitectura

Modificar documentación: `docs/ux/walkmyhome-reference.md`, informe y fases de este plan. El usuario autorizó implementar: la interfaz real y las muestras aisladas sirven como prototipo revisable. Reutilizar tokens de `docs/ux/design-system.md`. No publicar enlaces, coordenadas ni capturas privadas.

## Seguimiento

- [x] Revisar navegación de escritorio de la escena autenticada en Comet y registrar límites.
- [x] Completar inventario funcional antes/después sin pérdidas de opciones.
- [x] Levantar base de Habiteka y protección del 2D.
- [x] Validar prototipo de escritorio, tableta y móvil.
- [x] Resolver hallazgos y estimar fases.

## Aceptación y comprobación

Cada comportamiento atribuido al editor tiene evidencia directa; cada propuesta se etiqueta. Ninguna limitación de acceso se presenta como revisión completa. Prototipo permite localizar una estancia, pedir ayuda, revisar una imagen y volver al mismo contexto sin tocar el 2D.

Verificar enlaces y estructura: `ak plan validate plans/261010-0427-referencia-walkmyhome`, `npm run docs:updates`, `npm run docs:build`. Los tests de aplicación no acreditan esta auditoría.

## Riesgos y siguiente paso

La escena autenticada permite estudiar navegación, no certificar generación o edición externas. La composición está implementada y revisada. Fase 2 arranca con inventario y contrato visual, sin incorporar funciones externas ni convertir capacidades pendientes de Habiteka en promesas.

## Resultado de implementación

Completado dentro del alcance visual autorizado. [Inventario y verificación](../reports/implementation-261010-0509-workspace-walkmyhome-report.md). Se conserva el 2D y los servicios existentes. Barra izquierda, Ayuda/Ajustes inferiores y paneles flotantes; audio futuro. Responsive verificado por emulación y navegación local en Comet, sin generar ni aceptar material. Cámara exterior restaurada; la interior se elige con los controles actuales. Las pruebas no sustituyen hardware móvil real ni validación de una producción IA. Entrega local; no despliegue.
