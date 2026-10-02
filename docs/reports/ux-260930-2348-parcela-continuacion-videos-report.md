# Parcela: continuación hacia aprobación e imágenes

## Problema comunicado

El usuario no veía «Ver aprobado» dentro del panel y la confirmación acababa en un mensaje sin siguiente acción. Comunicó cierres al elegir luz/escenario y aclaró que el vídeo deseado debe mostrar diseños generados.

## Cambios

- ModernSelect permite un contenedor de portal. Los menús de parcela y revisión se montan dentro de su diálogo; se impide el cierre por interacción externa.
- Seleccionar el valor actual no invalida la confirmación. Guardar sin cambios y confirmar un encaje ya confirmado están deshabilitados.
- Pie de parcela con revisión de aprobación y enlace al montaje de imágenes. Los enlaces conservan el ámbito de zona cuando corresponde.
- Revisión de aprobación en diálogo centrado, errores dentro de él y luz de parcela al iniciar desde el encaje.
- Acceso a vídeos de imágenes desde la vista aprobada. Etiquetas y guías distinguen montaje de renders, recorrido del modelo y paseo fotorrealista pendiente.
- Cambiar luz de parcela no regenera imágenes existentes; para nuevas imágenes hay que elegir esa luz en el generador.

## Verificación

- TypeScript y ESLint de los componentes modificados: sin errores.
- `npm run docs:updates`, `npm run docs:build`, `git diff --check`: correctos. Astro: 5 archivos comprobados, 16 páginas generadas, sin diagnósticos.
- Navegador: cambio de luz y escenario mantiene el panel; los valores probados se restituyeron sin guardarlos. Clic externo mantiene el panel.
- Se confirmó el encaje existente sin mover, escalar o sustituir su geometría. La continuación abrió la revisión con Atardecer. No se confirmó la aprobación del diseño durante la prueba.

## Límites

El cierre comunicado no se reprodujo en el estado inicial de esta prueba; la protección se añadió y verificó sobre ambos menús. No se generaron imágenes ni clips de pago ni se exportó un nuevo MP4. El montaje existente utiliza zoom/fundidos; el paseo continuo fotorrealista y la película fotorrealista de obra siguen pendientes. No hubo despliegue remoto.
