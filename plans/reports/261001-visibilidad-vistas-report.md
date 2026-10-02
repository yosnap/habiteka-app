# Visibilidad de vistas de referencia — 1 octubre 2026

## Comportamiento corregido

- Frontal, Trasera, Izquierda y Derecha abren los muros exteriores del lado de cámara y mantienen el resto de muros y la cubierta.
- Puertas, ventanas, cortinas, estores y persianas cercanas al muro se ocultan con él. Asociación visual por geometría, sin editar el documento ni sus posiciones.
- Los cierres de los muros hasta el tejado se ocultan con su muro. El mismo comportamiento se aplica en plantas adicionales.
- Cenital, Isométrica y Dron ocultan techo y tejado y restauran los muros.
- Las capturas usan su visibilidad propia; una cámara aérea previa no elimina pérgolas o carpas de una captura lateral.
- Metadatos e instrucciones de generación y auditoría distinguen ocultaciones deliberadas de pérdida de identidad.

## Verificación

- Las siete cámaras inspeccionadas visualmente en el editor del proyecto actual.
- Lote de siete referencias preparado sin IA. Captura Izquierda inspeccionada con cubierta, fondo conservado y carpa/pérgola; Dron inspeccionada sin cubierta y con muros restaurados.
- 68 pruebas de ocho archivos: asociación de cortinas, cuatro direcciones de recorte/restauración, políticas de techo/cubiertas, preparación de capturas, geometría de tejado, prompts y auditoría.
- TypeScript y ESLint de los archivos afectados sin errores. Documentación actualizada; comprobación y construcción de Starlight correctas.

No se han generado imágenes IA ni aprobado una revisión del inmueble. Las referencias antiguas deben prepararse de nuevo; el resultado fotorrealista de IA necesita su revisión habitual.
