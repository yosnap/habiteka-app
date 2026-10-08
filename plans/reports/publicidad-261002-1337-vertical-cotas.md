# Publicidad vertical y cotas — 02/10/2026

Rama: `feat/publicidad-vertical-cotas`, desde `dd322f6` (producción v0.4.0). Prioridad elegida por el usuario: publicidad vertical y cotas. Trabajo local preparado; sin commit, merge ni despliegue de este bloque.

## Implementación

- `Crear vídeo → Publicidad → Mis diseños`: selección de imágenes, formato 16:9/9:16, cotas opcionales, vista previa y acciones separadas de guardar/descargar.
- `Publicidad → Vídeo guardado`: compone otro archivo desde un original de la misma aprobación. H3 exige aceptación previa. Mantiene original, audio y duración; sin generación IA.
- Panel separado con medidas globales de todas las plantas y cubierta del documento aprobado: animadas, inicio (4 s), fijas o ninguna. El encaje vertical conserva toda la imagen con márgenes. No hay seguimiento de cámara ni medición desde píxeles.
- Exportación 3D opcional 9:16; conserva la cámara horizontal y sus cotas geométricas, encajadas en la salida vertical.
- Fuentes, aprobación, organización/proyecto/zona y versión revalidadas antes de guardar; ticket firmado, cabecera/tamaño/MIME inspeccionados, guardado idempotente y procedencia registrada. Resultados e historial reconocen el anuncio.
- Guías de estudio, montaje, tipos y novedades actualizadas. Referencia técnica: `docs/publicidad-video.md`. Sin migraciones.

## Verificación

- Suite completa en PostgreSQL local aislado: **2396 pruebas correctas**, 5 omitidas (375 archivos correctos, 4 omitidos).
- 47 pruebas enfocadas correctas: formato, encaje sin recorte, medidas con varias plantas/cubierta, compatibilidad, aislamiento de fuentes, aceptación H3, firma/procedencia, errores y guardado idempotente.
- TypeScript correcto; ESLint 0 errores y 15 advertencias existentes. `docs:updates`, `docs:build` y `git diff --check` correctos.
- Next.js: compilación de producción y comprobación de tipos correctas en un worktree aislado, con instalación Bun congelada y documentación generada. No se modifica el servidor de desarrollo ni producción.
- Chrome headless con WebCodecs y módulos reales: clip de control de 5 s a **1080×1920 H.264/AAC**, 150 fotogramas. La pista AAC original y la del anuncio tienen el mismo SHA-256 de paquetes; audio conservado sin recodificación en este caso.
- Segundo anuncio con medidas de inicio: inspección del fotograma a 4,5 s confirma retirada del panel visible, sin cambiar el encuadre. Montaje de control de 3,2 s con bordes completos y cifras fijas.
- Render Three.js real de control: construcción vertical **8,064 s H.264/AAC**, con cotas y efectos nativos. Sin errores de navegador.
- Evidencia de controles sintéticos: `/tmp/habiteka-publicidad-browser/`, clips/fotogramas y logs, sin diseños privados ni llamadas de pago.
- Prueba completa adicional en Comet sobre un proyecto local: original de diseños aprobado → vertical con cotas animadas → vista previa → Guardar en Vídeos. Confirmación visible de guardado y reproducción desde la galería tras recargar, entregable persistido, objeto recuperado desde MinIO y evento de consumo con coste cero. El original permanece intacto. El MP4 recuperado tiene **1080×1920 H.264, 5,6 s**; el original de este caso no contiene audio. Los artefactos privados quedan solo en `/tmp/habiteka-publicidad-proyecto/`, fuera del repositorio. No se prueba el almacenamiento de producción.

## Límites

Los márgenes del vertical conservan el encuadre completo; no se inventa una cámara vertical ni se rellena el entorno. El panel mide el documento aprobado, no el mobiliario generado. Las cotas existentes en el original se mantienen: elegir Sin medidas evita otro panel. H3 sigue necesitando revisión de identidad y etapas. Primera persona continua desde renders, música/locución, editor de tomas y cotas geométricas sobre clips IA siguen pendientes. Consumo IA de esta intervención: **0 USD**.
