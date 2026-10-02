# Cotas, guion y MiniMax H3 — 1 octubre 2026

## Implementación

- Estudio → Acabado → Medidas: animadas, solo al inicio, fijas o sin cotas. Las tres dimensiones se dibujan consecutivamente; el modo de inicio desaparece a los cuatro segundos.
- Cotas 3D con valores del ámbito seleccionado y altura de muros/tejado. Líneas y etiquetas usan profundidad para quedar ocultas tras geometría visible. Opción de mantenerlas delante y tamaño aparente ajustado a cámara. Se retiraron el dibujo 2D sobre la imagen y el resumen fijo de esquina.
- Anclas calculadas una vez por exportación, sin raycasts por fotograma. Materiales, geometría y texturas temporales se retiran al terminar/cancelar. Los medios transparentes pueden dejar las cotas visibles.
- Guion portable con instrucciones libres, revisión del texto completo y copia. Combina objetivo, ámbito, luz, continuidad del diseño/mobiliario, secuencia de obra, sonido y presentación de cotas.
- El campo se identifica como **Guion para generar con IA** y explica el límite actual: no ejecuta IA ni modifica cámara/muebles del MP4 nativo. Las cotas se cambian con el selector estructurado.
- Ajustes e instrucciones (máximo 2000 caracteres) validados y firmados en el ticket de subida, conservados en el entregable y visibles en la biblioteca. Límite del ticket adaptado al guion Unicode; exportaciones anteriores siguen siendo compatibles.

## MiniMax: capacidad contrastada

MiniMax H3 admite referencias de imágenes, vídeo y audio, y sonido nativo. La API directa ofrece H3 a 768P/2K y H3 Max como variante rápida a 480P/768P. Clips de hasta 15 s; películas largas necesitan tramos coherentes. Imagen inicial/final y referencias multimodales son modos alternativos que no se pueden mezclar en una solicitud.

Es un candidato para transferir orden de construcción desde un tramo nativo y apariencia desde los renders aceptados. Esa combinación necesita pruebas de fidelidad. No se ha integrado aún el proveedor, realizado llamadas de pago ni medido su latencia. Higgsfield también ofrece H3, con contrato de imagen a vídeo que no expone todas las referencias de la API directa.

Las cotas exactas sobre clips IA requieren composición posterior y comprobación de cámara/profundidad; el overlay nativo no puede aplicarse automáticamente a un movimiento generado diferente. El guion indica que el modelo no debe inventar cifras.

Fuentes oficiales: [API MiniMax H3/H3 Max](https://platform.minimax.io/docs/api-reference/video-generation-v2-create), [H3 y audio](https://www.minimax.io/news/minimax-h3-open-source), [H3 en Higgsfield](https://open.higgsfield.ai/models/minimax/h3/image-to-video/api-reference).

## Verificación

- 37 pruebas correctas en seis archivos: secuencia/FX, cotas/timing/profundidad/limpieza, guion, ámbito, estudio y acciones de subida con instrucciones Unicode.
- TypeScript correcto. ESLint de archivos afectados sin avisos. `git diff --check` correcto.
- `docs:updates` correcto; Starlight construido con 17 páginas y Astro sin errores/avisos/sugerencias. Guía de estudio, novedades y documentación técnica actualizadas.
- Navegador: selección de Solo al inicio y retorno a Animadas; texto editable; copia con confirmación; guardado y lectura de instrucciones/cotas en la biblioteca.
- Dos MP4 nativos de prueba creados sin cambiar/aprobar el plano. Último: revisión 156, Solo la casa, 14:05:58, `31f34060-91d2-47d8-99b9-fabdfb3f1edc.mp4`.
- FFprobe del último: H.264 1920 × 1080, 30 fps, AAC, 30,08 s. Dos hojas inspeccionadas: inicio cada 0,5 s y giro final cada 1 s. Confirman dibujo consecutivo y desaparición de cotas tapadas durante el giro.
- Un error de transacción al abrir el estudio se resolvió con una recarga. No se han cambiado parámetros de base de datos. Las primeras pruebas fallaron por imports/valores de iluminación incorrectos en sus fixtures; corregidas y verificadas.
- Sin generaciones de pago, transferencia de medios a terceros, commit ni despliegue. La fase profesional sigue abierta.

## Preguntas pendientes

- Acceso API disponible: MiniMax directo, Higgsfield o solo web. Consulta enviada; no se han solicitado claves por chat.
- Presupuesto y selección de referencias para el piloto H3, antes de ejecutar generación de pago.
