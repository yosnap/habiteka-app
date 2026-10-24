---
title: 'Fase 5: Adaptación visual de funciones propias'
status: completed
---

# Fase 5: Adaptación visual de funciones propias

## Objetivo y dependencias

P1. Completada localmente. Dar a todas las herramientas propias un lugar coherente en el nuevo diseño, incluso cuando no tienen equivalente en WalkMyHome.

## Requisitos

Orientación/sol manual, parcela, cubierta y sus piezas, techo, luces, exterior, revisión, aprobación y demás funciones del inventario completo permanecen accesibles con todos sus campos/opciones. Mantener medidas y flujo del plano 2D. Estudio solar astronómico, nuevos cálculos de costes, auditoría de presupuestos y exportadores exclusivos externos quedan fuera de este rediseño.

## Pasos

1. Usar la revisión de Tools en Comet como referencia de tarjetas y jerarquía; sus cálculos no se probaron y no se incorporan al alcance.
2. Mapear herramientas actuales de Habiteka al contexto de Amueblado/3D/asistente, manteniendo sus controles y las propiedades guardadas.
3. Enlazar problema → elemento/contexto existente sin sustituir el flujo de revisión del 2D ni aplicar correcciones automáticas.
4. Exponer claramente sol manual, luz de aprobación y luz de imágenes; no prometer cálculo por fecha/hora/ubicación.
5. Completar la correspondencia de cada función propia sin equivalente externo: ubicación, acceso, opciones, estados, servicio/manejador original y prueba de equivalencia. Una ausencia en WalkMyHome no justifica ocultarla o eliminarla.
6. Implementar únicamente presentación y acceso visual sobre los componentes actuales. Conservar valores, contratos, comandos, servicios, precisión y límites; no agregar motores, cálculos, proveedores o formatos de exportación.
7. Validar acceso, edición y vuelta en móvil/tableta/escritorio sin superponer herramientas.

## Archivos

Reutilizar/ajustar integración: `src/components/editor-v2/property-orientation-panel.tsx`, `geographic-site-panel.tsx`, `exterior-roof-panel.tsx`, `ceiling-lighting-panel.tsx`, `plan-issues-panel.tsx` y menú exterior al 2D solo si el prototipo lo requiere.

Documentar capacidades/requisitos en `docs/ux/walkmyhome-reference.md`. Actualizar Starlight `editor/herramientas.md`, `editor/techos-luces-tejado.md`, `guias/parcela-real.md` y novedades si la integración cambia el uso.

## Seguimiento

- [x] Clasificar todas las herramientas propias del inventario, incluidas las exclusivas de Habiteka.
- [x] Conectar herramientas existentes a contexto/retorno.
- [x] Conservar correspondencia completa de opciones/campos/acciones sin equivalente externo.
- [x] Validar uso móvil y documentación veraz.

## Aceptación y comprobación

Correspondencia completa de capacidades/opciones antes/después; mismos manejadores y resultados. Acceso contextual sin pérdida de selección o medidas. El norte sigue coherente con parcela y el sol manual conserva su nombre/límites. No hay funciones o cálculos añadidos por referencia externa. Las capacidades pendientes conservan su bloqueo y no ofrecen maqueta final.

Regresión pertinente: `pnpm exec vitest run tests/editor-document/property-orientation.test.ts tests/editor-document/lighting-scene.test.ts` si cambia su integración. Probar ida/vuelta de paneles y comparación 2D. Verificar fichas contra código y evidencia autenticada.

## Riesgos y continuación

El riesgo principal es perder opciones propias al imitar un menú más simple o ampliar funcionalidad por copiar tarjetas externas. El usuario pide vistas/diseño y conservación funcional. Fase 6 exige inventario completo y prueba de equivalencia; cualquier función nueva requiere una petición distinta.

## Resultado de implementación

Completado dentro del alcance visual autorizado. [Inventario y verificación](../reports/implementation-261010-0509-workspace-walkmyhome-report.md). Se conserva el 2D y los servicios existentes. Barra izquierda, Ayuda/Ajustes inferiores y paneles flotantes; audio futuro. Responsive verificado por emulación y navegación local en Comet, sin generar ni aceptar material. Cámara exterior restaurada; la interior se elige con los controles actuales. Las pruebas no sustituyen hardware móvil real ni validación de una producción IA. Entrega local; no despliegue.
