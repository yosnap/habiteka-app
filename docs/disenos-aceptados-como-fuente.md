# Diseños IA aceptados como fuente de medios finales

## Decisión principal de producto — 02/10/2026

Imágenes finales, vídeo de obra, publicidad, primera persona, inmersión y visita virtual deben representar los renders IA aceptados explícitamente por el usuario. El plano y su 3D son guías de geometría y medidas, nunca una alternativa de entrega. Arquitectura e identidad completa deben conservarse; mobiliario y apariencia provienen del diseño aceptado, aunque el plano tenga otros muebles. El criterio visual es hiperrealismo comparable a una filmación real, revisado contra las imágenes aceptadas en los fotogramas relevantes. No lo demuestra un prompt ni una prueba de código.

Esta decisión se conserva en `AGENTS.md`. Sustituye las propuestas anteriores de exportación/visita nativa como alternativa; los reportes anteriores describen pruebas históricas, no el producto permitido ahora.

## Implementación actual

- Aceptación explícita en el modal de Diseños. `generation.acceptance` almacena fecha y usuario; retirada elimina ese campo. No modifica la imagen, su arquitectura ni la aprobación geométrica. Auditoría automática y aceptación humana son decisiones distintas. Imágenes sin esta marca, antiguas incluidas, requieren revisión; no se migran ni se aceptan automáticamente.
- `setRenderAcceptance` exige sesión, ámbito organización/proyecto/zona, imagen fuera de papelera, proveedor no nativo y versión optimista. Una imagen rechazada no se puede aceptar; retirar aceptación no borra MP4 existentes. Escribe el JSON existente: sin migraciones.
- `acceptedRenderIssue` bloquea capturas nativas, falta de aceptación o rechazo. Construcción/primera persona revalidan fuentes antes de preparar y antes de enviar; montaje y anuncio antes de servir/preparar/publicar. Anuncios admiten montajes o H3 aceptados con fuentes revalidadas, sin originales nativos.
- Estudio sin selector de 3D y sin escena nativa montada en segundo plano. Combinado muestra pendiente. Primera persona enlaza a Diseños; no propone generar otra habitación desde el plano cuando falta un interior del diseño aceptado.
- Vista aprobada identificada como guía. Exportación nativa deshabilitada, visita libre del modelo retirada del control y rutas usadas como inspección geométrica. Las acciones nativas antiguas rechazan tanto emisión de tickets como publicación, también para clientes/tickets anteriores. Archivos históricos conservados.
- H3 pide hiperrealismo pero sigue siendo un piloto. No se genera, se acepta ni se garantiza calidad por estas modificaciones. Presupuesto y consentimiento de referencias mantienen su puerta existente.

## Trabajo pendiente

Derivar interiores nuevos conservando otras vistas aceptadas, crear visita libre sobre el diseño final, continuidad entre habitaciones, pieza combinada de obra e interiores, auditoría temporal y validación real de fidelidad/hiperrealismo. Sin implementarlos, el flujo indica la falta y no utiliza el 3D como sustituto.

Guía pública: `videos/estudio`, `videos/recorrido`, `videos/tipos`, `videos/promocion`, `videos/montaje-imagenes`, `guias/imagenes` y `guias/guardar-aprobar`. Las referencias de vídeo e imágenes registradas en documentación son objetivos de estética y animación, no sustituyen los diseños aceptados del inmueble.
