---
title: Referencia UX WalkMyHome para Habiteka
date: 2026-10-10
summary: 'Referencia y plan por fases, preservando 2D y con asistente contextual y móvil desde el inicio.'
---

# Referencia UX WalkMyHome para Habiteka

## Trabajo documentado

Revisión de demo/fuentes públicas y después navegación de la escena autenticada en Comet: paneles, catálogo, materiales, estudio visual, chat, árbol/inspector, herramientas, importación y entrada/salida de Walkthrough. Referencia en docs/ux/walkmyhome-reference.md y plan en plans/261010-0427-referencia-walkmyhome. Sin editar el inmueble ni ejecutar operaciones de pago.

## Decisiones confirmadas

Solo cambiar vistas/diseño, conservando todas las funcionalidades/opciones de Habiteka y adaptando las propias sin equivalente externo. 2D íntegro, asistente contextual junto al lienzo y móvil desde el inicio. No añadir motores ni funciones externas; las capacidades pendientes conservan sus bloqueos. Sin implementación ni gasto IA.

## Verificación y siguiente paso

Ampliación Comet verificada: docs updates/build, estructura, formato, 18 enlaces y 26 rutas sin errores. Pendientes inventario funcional antes/después y prototipo, con equivalencia completa y protección del 2D. La sincronización accidental inicial de pnpm se detuvo y se restauraron lockfile y cuatro carpetas movidas.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Implementación autorizada y entrega local

El usuario autorizó implementar y añadió lateral izquierdo con modos, Ayuda/Ajustes inferiores, backup existente y menús flotantes; audio futuro. Implementados módulos de workspace, asistente compartido y composición de Diseños/Vídeos. 2D conserva CSS, Toolbar, CanvasView y tabla de atajos. Vista/selección válida/cámara exterior separadas del documento; conversación montada al abrir y conservada al plegar.

94 pruebas en 16 archivos, tipos/lint/build correctos. Comet: asistente, galería, Vídeos y vuelta al mismo 3D. Responsive 360/390/768/1024/1440; cierre y retorno de foco. Corregidos CSS heredado y fallback con cuota agotada. Manual Starlight/novedades y plan actualizados. Sin pagos, aceptación de imágenes, edición geométrica privada, commit, push ni despliegue. El informe final está en `plans/reports/implementation-261010-0509-workspace-walkmyhome-report.md`.
