# Secuencia persistida de vistas del recorrido

## Resultado

- Tira horizontal bajo editor al seleccionar un recorrido.
- Añadir puntos individualmente o todos, quitar, cambiar orden y diseñar una vista.
- Orden editorial independiente del trayecto físico; cámara derivada al capturar.
- Persistencia mediante campo opcional `storyboardWaypointIds` en rutas schema9.
- Validación de referencias existentes y únicas; borrado de puntos retira referencias.
- Compatible con documentos previos, historial de edición, cola de guardado y plantas.

## Verificación

- 20 pruebas focalizadas de recorrido, poses y storyboard pasan.
- Ampliación a editor/documento: 234 pruebas en 39 archivos pasan.
- TypeScript, lint focalizado y diff sin errores.
- Navegador, proyecto propio «Validación techos e iluminación»: añadir dos vistas,
  mover punto2 al primer lugar y guardar con estado Sincronizado.
- Había un conflicto de revisión previo en la pestaña de prueba; resuelto conservando la
  edición de prueba con el mecanismo de respaldo existente.

## Pendiente de F3

No se considera cerrado el storyboard completo: faltan miniaturas/resultados asociados,
sustitución desde galería, estado de créditos por imagen, lotes, capturas/máscaras presignadas,
consistencia y validación con generaciones reales. Este bloque no llama a proveedores de IA.
