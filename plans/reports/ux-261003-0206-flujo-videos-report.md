# UX del constructor: flujo de Vídeos

## Alcance y hallazgos

Continuación autorizada con «adelante» después de Diseños y generación. Se preserva esa ronda local y el commit anterior `c11fcf6`. Sin nuevo commit, push o despliegue.

La revisión de código y navegador identificó:

- Construcción habilitaba la preparación con distribución y exterior aunque procedieran de tandas distintas; el rechazo aparecía después en el servidor.
- El estado vacío confundía falta de aprobación del proyecto con falta de aceptación de imágenes.
- Publicidad todavía sugería un vídeo 3D como original en un texto antiguo, aunque el flujo ya lo excluía.
- Actualizar la galería podía conservar el estado local antiguo de una tarea. Crear vídeo mantenía además una segunda instancia oculta al entrar en guardados.
- La guía apuntaba a una ruta que no servía la documentación de Starlight.

## Implementación

- Comprobación de preparación en memoria con motivo asociado al botón: carga, error, aprobación/luz, aceptación de referencias, tanda única, distribución/cubierta, máximo de nueve imágenes, estancia interior y proveedor activo. Las validaciones del servidor siguen intactas y son la autoridad final.
- Actualizar diseños permite reintentar y conserva las imágenes seleccionadas aún utilizables. Las imágenes no disponibles muestran su recuento y mantienen los motivos al desplegarlas.
- Estados vacíos distinguen aprobación pendiente y referencias compatibles ausentes; no prometen que aceptar una imagen antigua resuelva su incompatibilidad.
- Un render aceptado enlaza a Vídeos en la misma zona. Las tareas preparadas y los anuncios guardados ofrecen acceso a Vídeos guardados. Una prueba H3 aceptada permite abrir el selector de originales de publicidad, sin elegir ni generar automáticamente otro vídeo.
- Publicidad ofrece salidas a montaje o revisión de guardados cuando faltan clips. El montaje ordena selección, ajustes y revisión/guardado; mejora el foco de las miniaturas.
- Actualizar guardados refleja la respuesta reciente, incluida la URL renovada; el botón se deshabilita durante operaciones de las tarjetas. Crear vídeo se desmonta al salir de su pestaña para evitar dos estados de la misma tarea. Se avisa en pantalla y guía: ajustes y previsualizaciones locales sin guardar se reinician; las tareas H3 preparadas permanecen guardadas.
- Guía del estudio corregida al dominio de documentación local/producción. Documentación de estudio, imágenes y novedades actualizada.

## Verificación

- 42 pruebas en cuatro archivos: preparación (13), construcción (5), primera persona (12) y estados de galería (12). Solo memoria, sin acceso ni reinicio de BD.
- TypeScript y ESLint correctos. Archivos modificados menores de 1000 líneas.
- `npm run docs:updates` y `npm run docs:build` correctos: 17 páginas, sin errores ni advertencias de Astro.
- Next.js con webpack compilado en copia aislada, incluidos tipos, 31 páginas y standalone. Solo la copia ajusta `outputFileTracingRoot: '/'` para resolver dependencias enlazadas; el servidor local sigue activo. Avisos de credenciales OAuth locales ausentes, ajenos al cambio.
- CUA nativo: Editor → Vídeos → Diseños; modal de imagen y flechas desde el cierre; formulario abierto sin envío y flechas que conservan la imagen mientras el campo tiene foco; cierre con devolución de foco. Reflujo del modal a 250 %, desplazamiento al panel y restauración a 100 %.
- Vídeos: actualización de diseños; despliegue de imágenes no disponibles y selección deshabilitada con motivo; Primera persona; Publicidad con diseños y con clip existente, bloqueada por aprobación desactualizada; galería de tareas rechazadas/históricos y Actualizar. Guía abierta correctamente y Volver al editor devuelve Plano 2D.
- Verificado el aviso al cambiar de pestaña: un nombre escrito solo en el formulario desaparece al volver de guardados a Crear vídeo. No se preparó ni guardó esa prueba; el navegador queda en Crear vídeo con el campo vacío.
- Ninguna aceptación, aprobación, limpieza, generación, consulta al proveedor ni exportación ejecutada como prueba. No se publican capturas ni datos privados.

## Límites y continuación

- Actualización de cierre: `ux-261003-0709-accesibilidad-consistencia-report.md` añade pestañas con flechas/foco, Escape anidado en la previsualización local y reflujo a 390 × 740. Esta ronda se incorpora al commit conjunto autorizado. Se mantienen los límites de medios aceptados y móvil real.
- No se prueba el envío H3, aceptación/rechazo de medios ni guardado de anuncios; requiere fuentes aceptadas y autorización específica para el gasto. No se declara fidelidad audiovisual por los cambios de UX ni por las pruebas.
- El conjunto disponible no permitía verificar visualmente la selección de referencias aceptadas ni los nuevos accesos posteriores a su aceptación/guardado. Sus condiciones y contratos se revisaron en código; los bloqueos de selección se probaron en memoria.
- Falta la prueba gráfica de Escape anidado en el generador. El reflujo con zoom no sustituye un móvil real.
- La compatibilidad completa de luz, ámbitos y revisiones se vuelve a comprobar en servidor. La guía UI anticipa los bloqueos de selección, sin reemplazar esa validación.
- Continúa el bloque de consistencia y accesibilidad general; paseo continuo y pieza combinada permanecen pendientes funcionales.

## Preguntas pendientes

Ninguna para la siguiente revisión de UX. El usuario conserva la decisión de aceptar diseños y autorizar medios de pago.
