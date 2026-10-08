# Orientación del inmueble y sol manual

`EditorDocument.propertyOrientation` es una configuración global opcional, validada en todas las versiones compatibles del documento. Conserva `northDeg` (0 arriba, horario) y ajustes `sunlight` por `daylight`, `afternoon` y `warm` (azimut geográfico y elevación). No añade una migración de base de datos ni gira geometría. `levelDocument` excluye el campo de copias por planta; `switchBuildingLevel` mantiene el valor raíz. Participa en la identidad de la revisión aprobada.

`propertyNorth` usa el inverso de `geographicSite.rotationDeg` si existe una ortofoto, y el norte explícito en los demás casos. Los cambios del norte actualizan ese giro e invalidan su confirmación; los cambios de sol también requieren confirmar de nuevo. Cargar una fotografía mantiene el norte previo. Los documentos sin ambos datos conservan las luces anteriores.

`sunDirection` transforma azimut y norte a X/derecha, Y/altura y Z/abajo del plano. `PropertySolarLighting` coloca una fuente direccional con sombras y una luz de relleno sin sombras; fuente y objetivo se trasladan juntos al centro del inmueble. El área de sombras crece con la extensión y las plantas del edificio. De noche solo se mantiene iluminación ambiental y las luminarias del documento: no hay fuente solar ni focos decorativos añadidos por este modo.

La brújula HTML/SVG indica los ejes del plano también en 3D y queda fuera de las capturas WebGL. Los prompts de cenital, alzado y captura comparten `propertySunPrompt`, que distingue el plano original del giro de cámara/referencias. No publica coordenadas. Las imágenes nuevas reciben la instrucción; eso no demuestra fidelidad visual ni sustituye la aceptación del usuario. No se regeneran imágenes existentes.

Los valores iniciales son escénicos: sur/55° de día, suroeste/30° de tarde y oeste/12° de atardecer. La posición solar astronómica por ubicación, fecha y hora no está implementada en este control. No genera peticiones de IA ni descargas geográficas por editar orientación.

Validación: serialización, datos inválidos, Deshacer/Rehacer, persistencia entre plantas, correspondencia con ortofoto, vectores cardinales, sombra opuesta, longitud por elevación, traslado de fuente/objetivo e inclusión en prompts. Guía pública: `docs/site/src/content/docs/editor/herramientas.md` y `guias/parcela-real.md`.
