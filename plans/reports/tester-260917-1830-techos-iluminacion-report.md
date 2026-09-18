# Verificación de techos e iluminación

Fecha: 2026-09-17, 18:44 Europe/Madrid. Rama: feat/planos-ia.
Resultado: 232 pruebas pasan; build correcto; lint global bloqueado por errores preexistentes.

## Alcance y selección por cambios

Revisados `git diff --name-only HEAD` y archivos nuevos mediante `git ls-files --others --exclude-standard`.
35 archivos TypeScript/TSX modificados o nuevos analizados por ESLint. Sin cambios de configuración.

- Dominio: schema, validation, spatial-properties, commands, curve-commands, building-levels,
  ceiling-commands/geometry/validation/reconciliation/design-context, lighting-proposal.
- Editor: store, editing-operations, vertex-preview, integración de capas/panel/escena.
- Importación: plano2d-import y exterior-vertex-constraint.
- Render: design-context, render-contract y prompts/contextos editor-v2.
- Mapping por imports/contrato (estrategia C): toda la carpeta tests/editor-document,
  pruebas de edición/colocación/importación de canvas, build-plan-import y ceiling-render-prompt.
- Mapping por módulo (A/B): ceiling-scene-utils.test.ts.
- Alcance amplio por contratos compartidos. No se ejecutó suite global con integración DB.
- Se ejecutaron 38 de los 192 archivos `.test.ts` encontrados en tests/ y src/.
- Sin pruebas UI automatizadas para ceiling-lighting-panel/layer/meshes y wiring de editor-shell.
  La validación de navegador corresponde al agente principal y no se acredita en este informe.

## Comandos y resultados finales

```sh
DATABASE_URL=postgresql://localhost/habiteka_test bun run test \
  tests/editor-document \
  tests/canvas/editor-v2-editing.test.ts \
  tests/canvas/spatial-placement.test.ts \
  tests/canvas/plan-import-fidelity.test.ts \
  tests/server/build-plan-import.test.ts \
  tests/agent/ceiling-render-prompt.test.ts \
  tests/editor-v2/ceiling-scene-utils.test.ts
bun run lint
bun run build
```

| Comprobación | Resultado |
| --- | --- |
| Pruebas seleccionadas | 232 pasan, 0 fallan, 0 omitidas; 38 archivos |
| Duración Vitest | 6,23 s total; 1,25 s ejecución de pruebas |
| Build Next.js | Correcto; compilación 6,4 s; TypeScript 9,2 s; 28 páginas generadas |
| Typecheck independiente anterior | Correcto, `bun run typecheck` |
| Lint global | Falla: 29 errores y 22 advertencias |
| Lint del diff y archivos nuevos | 35 archivos; 0 errores, 0 advertencias |
| Cobertura líneas/ramas/funciones | No medida; proveedor de coverage no instalado/configurado |

Para separar deuda previa, se ejecutó también `new ESLint().lintFiles(['.'])` y se cruzaron
sus resultados con los archivos modificados/nuevos obtenidos por Git. Los 29 errores
pertenecen a archivos idénticos a HEAD. No se modificaron esos archivos.

## Nuevas pruebas de dominio

17 casos en `tests/editor-document/ceiling-commands.test.ts` y `lighting-proposal.test.ts`:

- Lectura histórica sin migración; edición explícita schema8, serialización, undo/redo.
- Exclusión de patio etiquetado, perímetro exterior sintético y uso exterior.
- Altura del techo, falso techo mínimo y focos compatibles.
- Anclaje de luz al variar altura del techo.
- Muros, luces superpuestas, muebles altos/girados y suelo elevado.
- NaN/Infinity, rangos físicos e IDs duplicados.
- Eliminación de techo y sus luces; soporte perdido con advertencia.
- Split de muro conserva techo; división de habitación no reasigna arbitrariamente.
- Crear/copiar/cambiar plantas conserva schema8 y contenido.
- Recalibración escala XY, no alturas físicas ni caída.
- Planta 2700 con muros 3500 respeta 2700 en vista, buildingDocuments y contexto de prompt.
- Estilos moderno/mediterráneo, resultados deterministas y propuesta aún no persistida.
- Distribución en L, aplicación atómica, luces previas conservadas y propuestas obsoletas.
- Colgantes solo sobre mesas físicas confirmadas.

Se detectó inicialmente downgrade schema8→5 al crear planta vacía. Corregido por el
agente principal; regresión cubierta y prueba final correcta.

## Fallos y advertencias pendientes

Errores de lint preexistentes, todos fuera del diff:

| Archivo | Líneas con error | Regla |
| --- | --- | --- |
| src/components/catalog/use-catalog-items.ts | 43 | react-hooks/set-state-in-effect |
| src/components/wizard/isometric-preview.tsx | 98, 102 | react-hooks/immutability |
| src/components/wizard/step-style.tsx | 104 | react-hooks/set-state-in-effect |
| src/components/canvas/3d/object-properties-panel.tsx | 41 | react-hooks/set-state-in-effect |
| src/components/canvas/3d/led-strip-layer.tsx | 30 | react-hooks/rules-of-hooks |
| src/components/canvas/3d/furniture-layer.tsx | 333, 337, 408, 421, 423, 435, 438, 439 | react-hooks/immutability |
| src/components/canvas/3d/ceiling-layer.tsx | 168, 171, 213, 218, 220, 232, 234, 235 | react-hooks/immutability |
| src/components/canvas/3d/catalog-panel-3d.tsx | 36 | react-hooks/set-state-in-effect |
| src/components/canvas/3d/opening-interaction-layer.tsx | 196, 201, 203, 230, 231 (2) | react-hooks/immutability |

- Vite advierte import sin extensión en vitest.config.ts para test-database-guard.
- Build advierte credenciales ausentes de proveedores sociales Google/Facebook.
- Fidelidad de importación sigue en 9/12 estancias CAD y 5/10 decorado dentro de ±5 %.
  Las pruebas pasan con esos límites existentes; no implica fidelidad completa.
- No se midió rendimiento gráfico ni fugas de memoria; tiempos anteriores son de prueba/build.
- No se evaluó flakiness mediante campaña de repeticiones.

## Límites y próximos pasos

No hubo integración contra DB real, migraciones, generación IA de pago ni modificación
de fuentes por este agente. DATABASE_URL de pruebas se usó para satisfacer el guard;
las suites seleccionadas son locales/puras.

1. Completar validación visual 2D/3D del agente principal, especialmente selección y undo.
2. Corregir deuda de lint por separado antes de exigir lint global como gate de CI.
3. Añadir cobertura instrumentada y prueba UI del flujo revisar/aceptar iluminación.

Preguntas pendientes: ninguna para las pruebas locales ejecutadas.
