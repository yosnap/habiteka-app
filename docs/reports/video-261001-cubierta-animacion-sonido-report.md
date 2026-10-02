# Cubierta, animación y sonido del vídeo nativo

## Referencia y diagnóstico

Referencia aportada: https://www.youtube.com/watch?v=X_dNq6G60bw, tramo 00:07–00:39. Incluye parcela acotada, transformación exterior e interiores de acabado fotográfico. El MP4 anterior de 19 s se examinó mediante fotogramas y ffprobe: muros completos entre fases, cubierta principal ausente y sin pista de audio.

## Implementación

- Tejado exterior por planta, con validación y geometría recortada por habitaciones: plana, una, dos y cuatro aguas, pendiente, orientación, alero, espesor, color y material. Cubierta con espesor constante y muros prolongados hasta su intradós; los patios se mantienen como huecos.
- Capturas de fachada/dron con cubierta exterior, cenital e isométrica de estudio sin ella. El contexto completo y compacto para IA incluye forma y huella. Las aprobaciones existentes siguen siendo instantáneas: necesitan nueva revisión para incluir el tejado.
- Animación temporal de muros anclada a su base, con escalonamiento determinista y restauración de transformaciones/materiales incluso al cancelar. Fundidos de otros componentes.
- Efectos sintetizados locales, AAC mono 48 kHz, volumen y cotas del diseño opcionales. No son sonidos grabados de obra ni música.
- Render hasta 3840 × 2160 según GPU, reducción a 1080p/30 fps, H.264 12 Mbps en piezas cortas y 7 Mbps en largas. Espera de modelos y texturas; errores impiden exportar sustitutos incompletos.
- Muestra sintética disponible únicamente en desarrollo: `/dev/editor-v2?muestra=obra`. Permite verificar exportación sin tocar proyectos ni aprobarlos.

## Límites

Estos cambios afectan al vídeo nativo conceptual. La película fotorrealista continua basada en diseños generados requiere cobertura actualizada, estados coherentes de obra, integración de clips y piloto con coste autorizado. No se ha ejecutado generación de pago. La ortofoto tiene su propia resolución: aumentar el render no inventa detalle geográfico. No hay música/locución, formato vertical ni simulación constructiva técnica.

## Verificación local

- TypeScript y ESLint sobre los archivos afectados sin errores; documentación compilada con Astro (16 páginas) y control de actualización aprobado.
- Pruebas de persistencia, aprobación, aislamiento por planta, cuatro tipos de cubierta, patio abierto, referencias obsoletas, crecimiento con base fija, restauración de materiales, sincronización de efectos y carga de texturas.
- Muestra de 19,072 s codificada y reproducible en Chrome a 1920 × 1080. Revisados visualmente 5,71 s (muros parciales) y 11,40 s (cubierta terminada), con cotas. La revisión auditiva final queda pendiente; se ha comprobado la generación de muestras y la exportación con AAC activado, sin escuchar el resultado.
- Selector de tejado probado: cambiar de cuatro aguas a plana conserva abierto el panel y actualiza la altura. El borrador de un proyecto real no se ha alterado para elegir arbitrariamente una cubierta ni se ha aprobado una revisión.
- Encuadre ampliado para el tejado y la altura total de edificios con varias plantas. Normales por faceta para evitar suavizado entre faldones y cantos.

## Corrección tras revisar el caso real

La cubierta elegida por el usuario dejaba sin prolongar los muros hasta los faldones. Se han separado el prisma fino de cubierta y los cierres de pared: cada muro de las estancias cubiertas conserva acabados de sus dos caras y alcanza el intradós inclinado. Los cierres comparten la base y el identificador del muro para crecer unidos durante la obra. Verificado visualmente en el proyecto real desde Frontal y Derecha, sin aprobar ni modificar su configuración de cubierta.

El montaje avisaba de fuentes discordantes pero permitía exportarlas. Ahora bloquea borradores distintos de la aprobación e imágenes de otras versiones visuales, luces o permisos de decoración. Comprueba las fuentes antes de codificar, antes de firmar y antes de publicar; mantiene los montajes parciales coherentes. Las galerías distinguen muestra 3D y montaje de diseños generados. No se ha creado una nueva película del inmueble: el resultado profesional continúa pendiente.

Verificación de esta corrección: 42 pruebas en cinco archivos, TypeScript y ESLint sin errores, control y compilación de documentación aprobados. La pantalla real de Vídeos muestra que faltan fuentes del diseño aprobado actual y deshabilita la exportación.

## Trabajo necesario para la película solicitada

1. Revisar y aprobar el diseño actualizado, con cubierta y cierres, y resolver qué elementos se conservan en el escenario de reforma.
2. Crear fotogramas del mismo diseño y momento de luz: estados de obra desde una cámara exterior fija, exterior terminado con pérgolas y vistas interiores a altura de persona.
3. Integrar tareas persistentes de vídeo, presupuesto explícito, descarga al almacenamiento propio y revisión de identidad de los fotogramas intermedios. El repositorio no tiene todavía adaptador de vídeo ni tarifa para esa acción.
4. Ensayar primero un clip corto de obra y otro de visita; rechazar los que pierdan elementos o alteren distribución. Montar la pieza completa solo tras superar esa revisión.

Contrato candidato comprobado en fuentes oficiales: [KIE Kling 2.5 imagen a vídeo](https://docs.kie.ai/market/kling/v25-turbo-image-to-video-pro), tareas asíncronas mediante `jobs/createTask`; su [formulario oficial](https://kie.ai/kling-2-5) admite imagen inicial y `tail_image_url`, con duraciones de 5 o 10 s. Estos parámetros permiten ensayar anclas de inicio y final, pero no garantizan la geometría de los fotogramas intermedios. No se ha verificado una tarifa vigente ni realizado llamadas de pago.
