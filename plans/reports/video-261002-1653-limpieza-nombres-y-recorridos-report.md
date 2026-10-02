# Limpieza, nombres y recorridos — 02/10/2026

## Entrega

- Commit previo `2b159ac`: publicidad vertical y cotas, incluida prueba de guardado local.
- Limpieza de renders individual y por selección de hasta 200; selección de no válidas, deshacer y papelera durable para restaurar tras cerrar el estudio. Conserva revisión/rechazo, objetos y MP4 existentes.
- Nombre opcional de hasta 100 caracteres antes de crear cualquier modalidad. Se firma en el ticket de subida o se guarda en la preparación H3. Renombrado posterior con ámbito y versión; envío H3 en curso bloquea renombrado para proteger su recuperación. Galería, selector del original, Diseños e Historial muestran el nombre.
- Primera persona y Construcción + visita indican junto a los ajustes que usan el modelo 3D, sin incorporar los acabados de los renders.
- Guía pública, novedades y referencia técnica actualizadas. Sin migraciones ni llamadas de pago.

## Verificación

- 59 pruebas enfocadas correctas en 8 archivos; incluyen 7 casos nuevos con PostgreSQL real aislado: borrado/restauración, lote parcialmente ajeno, otra zona/organización, tipo de medio, límites, preservación de payload y bloqueo durante envío H3.
- TypeScript y ESLint de archivos afectados correctos. Compilación de producción correcta en worktree aislado; documentación construida y comprobación de actualización correctas.
- Comet, proyecto local: limpieza por selección de una imagen, desaparición de la lista y restauración inmediata con Deshacer. La imagen de prueba queda activa de nuevo. Los cambios de limpieza anteriores del usuario se conservan.
- Renombrado de un anuncio existente y comprobación de nombres en galería y selector de originales de publicidad.
- Exportaciones reales del recorrido aprobado completo: **22,766667 s H.264 1920×1080**, sin audio para primera persona; **30,826667 s H.264/AAC 1920×1080** para construcción + visita. Los nombres se conservan en los registros, y el SHA-256 de cada objeto MinIO coincide con su descarga. Ambos eventos tienen coste cero.
- Artefactos privados solo en descargas locales y `/tmp/habiteka-publicidad-proyecto/`; no se incorporan imágenes, coordenadas o diseños privados a esta entrega. No se prueba ni modifica producción.

## Pendiente

Inmersión continua desde renders y película combinada con interiorismo generado; estas pruebas validan la vía nativa 3D. No certifican identidad de vídeos H3 ni calidad profesional. Consumo IA adicional: **0 USD**.
