# Parcela: controles y espacio de trabajo

## Cambios

- Fotografía amplia a la izquierda, panel de ajustes con scroll independiente a la derecha y pie de guardado persistente.
- Secciones: fotografía, diseño, casa actual y vídeo. Tapado automático, dimensiones, movimiento y eliminación juntos.
- Control compartido para zoom, escala, ambos giros, ancho y largo: slider, valor numérico editable y botones −/+. Unidades visibles: ×, %, ° y m.
- Entrada exacta aplicada al salir del campo o pulsar Enter; límites y valores inválidos controlados. El foco sin cambios no invalida la confirmación.
- Escala visual independiente del zoom. Paleta y tipografía de Habiteka; estado de cambios y confirmación en el pie. Guardar mantiene abierto el panel.

## Verificación

- TypeScript y ESLint de los cuatro componentes: correctos. `git diff --check`: correcto.
- Chrome local: distribución visual, zoom por botón 4 → 4,25 y entrada exacta de vuelta a 4; menú Día/Tarde/Atardecer/Noche visible y Escape cierra solo el menú.
- Se preservaron escala 110 %, giro −49° y zona existente. No se confirmó el encaje ni se generó vídeo.
- El editor muestra un conflicto con revisión 147 de otra pestaña. No se eligió una versión ni se probó un nuevo guardado sobre ese conflicto.
