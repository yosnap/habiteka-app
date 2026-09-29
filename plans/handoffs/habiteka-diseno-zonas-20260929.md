# Handoff: Habiteka, diseño por zonas y esquina de Cocina

Fecha: 29/09/2026. Rama: `feat/diseno-aprobado-visita-video`.

## Objetivo confirmado por Paulo

Diseñar por partes (Entrada, Patio, Salón, Cocina), combinar propuestas editables homogéneas en una sola escena 3D y aprobar esa revisión completa. La visita libre y el vídeo automático deben partir del diseño final aprobado. El vídeo debe mostrar terreno vacío, construcción, vuelo exterior tipo dron y paseo interior rápido. Las imágenes IA aisladas sirven para evaluar el aspecto; no constituyen una escena navegable.

## Estado comprobado

- Proyecto «FInca»: `cmu7nm84n0001evmsi8nyt1ee`. Revisión guardada **130**, con contenido de diseño igual a la 129; última aprobación **107**. No se aprobó la 130.
- Las cuatro zonas están guardadas. El plan principal y la fase 3 reflejan tareas pendientes: [plan](../260924-1459-flujo-integral-plano-diseno-inmersion-video/plan.md) y [fase 3](../260924-1459-flujo-integral-plano-diseno-inmersion-video/phase-03-diseno-aprobado.md).
- El hueco de Cocina tenía dos causas geométricas: el pilar trasero vaciaba toda la carcasa/zócalo bajo la encimera y los zócalos retranqueados de los dos tramos en L dejaban suelo visible en la unión. Se corrigieron en `kitchen-run-obstacles.ts` y `kitchen-run-volumes.ts`. El segundo cierre ocupa todo el fondo del tramo perpendicular; una prueba con medidas reales de FInca sitúa las piezas a menos de 5 mm.
- Se generaron nuevas imágenes de Cocina aislada, isométrica, día y libertad estricta. La más reciente es la primera tarjeta de [Diseños de FInca](http://localhost:3040/projects/cmu7nm84n0001evmsi8nyt1ee/deliverables), «Cocina · Isométrica · Plano rev. 130». La encimera y los frentes ya aparecen unidos. Queda una sombra estrecha bajo el apoyo negro; la vista 3D frontal gratuita muestra ese apoyo sin hueco geométrico. Las imágenes anteriores no se actualizan.
- Se pasaron 13 pruebas de cocina, TypeScript y ESLint. Últimos commits: `ad3dcf6` (tonos y esquina), `a638b1c` (módulos junto al pilar), `f2eec53` (ámbito exterior y Entrada), `71c1d7f` (zócalo de la L y planes).
- Hay archivos sin seguimiento previos (`.skill-map/`, otro `plans/handoffs/`, dos informes, `pnpm-lock.yaml`, `pnpm-workspace.yaml`). No mezclarlos con el trabajo nuevo.

## Siguiente paso

Contrastar la sombra de Cocina desde una cámara baja en el 3D editable y en una imagen de referencia gratuita. Si representa un hueco real, corregir la geometría y verificar visualmente antes de generar otra imagen de pago. Si es solo sombreado, documentarlo con precisión y seguir con la composición editable y la validación de Entrada, Patio y Salón. No dar por cerrada la fase 3 ni pasar a visitas o vídeo final hasta aprobar una revisión conjunta con calidad visual suficiente.

## Prompt para la nueva sesión

«Continúa Habiteka desde `plans/handoffs/habiteka-diseno-zonas-20260929.md`. Verifica la rama y el estado del repositorio, revisa la primera imagen de Cocina rev. 130 y la sombra de su esquina en el 3D editable. Después sigue la fase 3 del plan: diseño homogéneo por zonas y aprobación conjunta antes de visita y vídeo. Háblame siempre en español.»
