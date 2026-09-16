# Baseline de pruebas editor-v2

Fecha: 2026-09-08, 01:54 Europe/Madrid.
Worktree probado: `habiteka/worktrees/habiteka-app-feat-editor-v2`.

## Resultado

`bun run test:ci`: salida 0; **779 pruebas aprobadas, 5 omitidas**; **111 archivos aprobados, 4 omitidos**, 115 archivos en total. Duración: 17,17 s.

No se modificaron pruebas, no se añadieron skips ni se aplicaron correcciones durante esta validación. Los skips corresponden al resultado de la suite existente.

## Aislamiento comprobado antes de ejecutar

- Scripts de prueba invocan el runner aislado, sin seed.
- Runner y configuración validan el destino antes de ejecutar pruebas.
- Cliente Prisma valida el destino capturado y selecciona el adaptador de pruebas; no hereda singleton de desarrollo.
- El helper de limpieza comprueba el marcador de aislamiento antes de borrar.
- Ejecución dirigida exclusivamente a la base dedicada `habiteka_test_editor_v2`, preparada previamente por el agente principal.

## Alcance y límites

Baseline del worktree con sus ports y guard actuales; no equivale al checkout original ni al HEAD limpio inicial. No hubo acceso solicitado a datos de desarrollo ni seed manual.

Esta ejecución no valida build, navegador, fidelidad de cenital generativa ni extracción completa del plano real. Esas comprobaciones requieren evidencia separada. No se ejecutaron llamadas reales de IA o pagos como parte de un benchmark.

## Fallos y pendientes

Sin fallos reportados por Vitest. Mantener explícitos los 5 skips; no interpretar el resultado como aprobación de las seis fases del editor.
