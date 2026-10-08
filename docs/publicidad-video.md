# Publicidad: composición local y medidas

El estudio ofrece montaje desde renders y composición desde un entregable VIDEO existente. Ambos permiten 16:9 (1920×1080) y 9:16 (1080×1920), con panel opcional de ancho, fondo y altura globales del documento aprobado. Los clips conservan cadencia, duración y audio; los montajes se codifican a 30 fps sin audio. No se llama a proveedores IA para componer.

## Procedencia y límites

- Las acciones resuelven el original desde almacenamiento propio y restringen aprobación, organización, proyecto y zona. No aceptan URL externa del cliente ni dimensiones aportadas por este.
- Un borrador visualmente diferente bloquea el anuncio. H3 exige estado `accepted`; los derivados `advertising` no se ofrecen como originales.
- El ticket firmado guarda aprobación, revisión, huella, fuente, duración, formato y modo de medidas. Al finalizar se revalida la fuente y se inspeccionan bytes, MIME y cabecera MP4. El entregable nuevo conserva procedencia y configuración; no sobrescribe el original.
- Máximo 100 MiB por original/salida y 110 segundos por clip. El navegador verifica la duración del archivo contra el registro con tolerancia de 250 ms por la cola de audio. El almacenamiento comprueba tamaño y cabecera; no decodifica el archivo para acreditar cada píxel ni certificar la geometría.
- Mediabunny/WebCodecs compone H.264 y conserva AAC. Se bloquea si descarta una pista primaria. Solo se procesan las pistas primarias de vídeo/audio; no se mezclan pistas secundarias.

## Encuadre y cotas

El vertical y los montajes con medidas encajan cada fuente completa sin recorte ni distorsión, sobre un fondo neutro. El panel reserva 320 px en vertical y 180 px en horizontal. En modo inicio desaparece a los 4 s sin modificar el encuadre. El montaje horizontal sin medidas conserva el comportamiento anterior de zoom y recorte.

Las cotas proceden del documento aprobado: caja global de los vértices de todas las plantas y altura máxima de muros visibles/cubierta respecto a la base. No miden muebles generados, habitaciones individuales ni píxeles del clip. El panel permanece en pantalla; la reconstrucción y el seguimiento de cámara de vídeo IA quedan pendientes.

La exportación nativa mantiene cámara/render 16:9 y compone la salida vertical mediante encaje completo; sus cotas continúan ancladas en 3D. El formato es opcional en la presentación para conservar compatibilidad con exportaciones antiguas. Las opciones y datos se guardan en JSON existente: **no hay migración de base de datos**.

La guía pública explica las acciones de preparar, previsualizar, guardar y descargar en `videos/montaje-imagenes`, `videos/estudio` y `videos/tipos`.

## Validación local

Verificado en navegador con un montaje existente de un proyecto local: preparar anuncio vertical con cotas animadas, reproducir la vista previa y guardar mediante las acciones y la subida reales. Sigue visible y se reproduce en la galería después de recargar. Se recuperó el objeto desde MinIO y se comprobó H.264 a 1080×1920, duración conservada y evento de consumo a coste cero. Este original no tenía audio; la conservación de AAC se verificó por separado con un clip de control. La prueba no acredita el almacenamiento de producción ni la fidelidad de los diseños. No cambia el flujo de usuario descrito arriba.
