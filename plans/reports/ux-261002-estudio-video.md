# Simplificación del estudio de vídeo

## Cambios

- Ruta `/projects/[id]/videos` independiente del canvas y del modal anterior.
- Navegación visible a Editor y Diseños, conservando la zona.
- Editor abre edición normal; aprobar no cambia automáticamente de pantalla.
- Construcción y primera persona: elegir diseños, ajustar y revisar antes del envío.
- Imágenes utilizables por defecto; limpieza y no disponibles en un apartado desplegable.
- Parámetros de calidad, sonido y prompt agrupados. Combinado identificado como pendiente.
- Guía aprobada: regreso explícito, plano 2D/modelo 3D, avisos plegados y ruta opcional.
- Documentación de usuario actualizada en el mismo cambio.

## Verificación

- Chrome local: Diseños → Vídeos, selector de duración y Escape, Construcción → Primera persona → Publicidad, fuente Vídeo guardado, Volver al editor y Crear vídeo desde el editor.
- Confirmado que el regreso muestra edición sincronizada, no la vista aprobada.
- TypeScript, lint de componentes modificados, docs:updates, docs:build y compilación Next.js en worktree aislado correctos.
- No se aceptaron imágenes privadas ni se enviaron nuevas generaciones de pago.
- Alcance visual verificado: escritorio. Queda revisión visual móvil y del formulario completo con una tanda de imágenes aceptadas; en el proyecto observado se verificaron los estados sin referencias aceptadas.

## Límites

Esta ronda ordena la UX existente. No implementa la visita virtual continua, la pieza combinada ni mejoras del modelo generativo. No se ha desplegado.
