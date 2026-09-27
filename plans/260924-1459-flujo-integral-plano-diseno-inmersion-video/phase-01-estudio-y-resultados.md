---
title: "Fase 1: Estudio de planos y resultados comprensibles"
status: in-review
---

# Fase 1: Estudio de planos y resultados comprensibles

## Objetivo

Que cualquier usuario entienda qué tiene, qué puede hacer ahora, cuánto cuesta cada generación y cuál es el siguiente paso hacia el editor.

## Evidencia actual

- En `plano-studio.tsx`, «Editable (beta)» está deshabilitado salvo si existe `plano` y `fromDrawing`. Cuando se habilita, muestra un SVG en `PlanImageViewer`, no controles de edición. Los planos importados se revisan en `PlanImportPanel` y se editan después en Editor v2. La etiqueta y la pestaña no representan esa ruta.
- «Vista cenital» solo se activa si existe `cenitalUrl`; antes de generar no explica el requisito. El selector también permite «Maqueta 3D», pero el resultado se muestra bajo la pestaña «Vista cenital».
- El selector técnico/decorado puede apuntar a un modo aún no generado mientras se sigue mostrando otra imagen. El aviso rojo compite visualmente con el botón de acción.
- «Resultados guardados en este proyecto» presenta un enlace al original, botones de importación y controles de generación; no muestra el conjunto de resultados guardados.

## Diseño de interacción

1. Sustituir la cabecera por etapas con estados explícitos: **Original → Plano editable → Diseño → Visita → Vídeo**. Cada etapa muestra «pendiente», «listo» o una acción concreta; nunca una pestaña deshabilitada sin explicación. El SVG se llama «Vista vectorizada»; «Editar plano» abre Editor v2. La pestaña de imagen generada se llama «Render» para abarcar cenital y maqueta.
2. En la etapa Plano, separar **imagen visible** (original/técnico/decorado) de **acción de generar redibujado**. El modo seleccionado y el resultado mostrado deben coincidir; los modos no generados se presentan como acción de creación, no como una vista ya existente.
3. Convertir el panel derecho en dos bloques: «Siguiente paso» contextual y «Resultados del proyecto». La galería muestra miniatura, tipo, fecha, fuente, estado y acciones de abrir/comparar/continuar; incluye original, redibujados, extracción editable, vistas y entregables existentes.
4. Explicar junto a cada acción si usa IA y puede consumir créditos. Redibujar sigue siendo opcional. «Importar este plano» conduce a revisión de medidas; «Generar vista» produce una imagen y no un modelo navegable.
5. Preservar el trabajo al recargar y al cambiar de etapa. Las URL firmadas se resuelven al servir; el historial guarda claves estables, no enlaces caducos.

## Código afectado

- Modificar `src/components/plano-studio/plano-studio.tsx`, `src/lib/studio-state.ts`, `src/server/plan/studio-repo.ts` y la página de estudio.
- Reutilizar la galería de `src/app/(app)/projects/[id]/deliverables/page.tsx` para resultados finales; mantener borradores del estudio con referencias tipadas a activos. Separar componentes de cabecera, próximo paso y galería para que `plano-studio.tsx` no crezca más.

## Criterios de aceptación

- Dado el estado de la captura adjunta, el usuario ve que la extracción editable y la vista generada están pendientes, por qué, y qué acción las crea.
- Se puede alternar original/técnico/decorado sin que el selector describa una imagen distinta de la visible.
- Todos los resultados guardados accesibles desde el proyecto conservan procedencia y versión; una recarga no los convierte en enlaces caducados.
- El flujo distingue visualmente «imagen de presentación» de «modelo editable».

## Riesgos

- `studioState` solo conserva el último cenital y último redibujado por modo. Para una galería histórica hay que persistir referencias adicionales o reutilizar entregables; no fabricar tarjetas a partir de estados inexistentes.

## Estado de implementación

- Implementadas etapas con estado, pestañas explicativas, siguiente paso contextual y galería de originales, redibujados, renders y entregables con referencias de almacenamiento estables.
- Persistidas las correcciones de medidas para retomarlas tras recargar; iniciar otro plano avisa cuando sustituirá una revisión pendiente.
- Verificados tipos, lint, compilación, pruebas puras, navegación visual en un proyecto local (escritorio y móvil, sin gastar IA) y pruebas de integración en la base aislada: subida → dos generaciones simuladas → recarga → reactivación histórica.
- Pendiente antes de cerrar la fase: cotización exacta de proveedor por modelo configurado y una prueba controlada de generación real. Hoy el Estudio no descuenta créditos de usuario; no se presenta un precio inventado.
