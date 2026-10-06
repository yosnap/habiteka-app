# Referencias aceptadas y visibilidad de alzados

Corrección del 6 de octubre de 2026. Los proveedores devolvían imágenes, pero
una revisión automática podía dejar pasar un lateral visualmente incoherente.
No es un fallo de conexión ni un motivo para sustituir el diseño por el 3D.

## Regresiones corregidas

La sección `cut` añadía siempre una losa de 200 mm sobre la altura máxima de
los muros, sin consultar la visibilidad del techo ni un elemento del modelo.
El prompt pedía conservar ese techo y la auditoría llamaba techo a la banda.
Se elimina la geometría artificial y esas instrucciones: el alzado abierto
va sin techo/tejado. La vía de fachada completa conserva la cubierta real.

`prepareRenderImageRequest` prefería `sectionFurnitureDescription` del plano si
había muebles. Omitía entonces la lectura del diseño aceptado y el raster de
sección imponía su mobiliario. `renderDrawingReferences` usa ahora
`rasterizeEditorElevation(..., { cut: true, furniture: false })`: la guía solo
fija arquitectura y huecos. Las llamadas sin ese ajuste conservan el dibujo
técnico de muebles, filtrado por visibilidad.

`sectionFurnitureBrief` lee siempre la imagen aceptada. Exige una descripción
no vacía por estancia, consume por separado las entradas con nombres repetidos
y falla si faltan estancias o falla visión. No hay sustitución por muebles del
plano ni continuación sin lectura. La operación de visión puede tener coste;
el bloqueo ocurre antes de solicitar una nueva imagen. El diálogo mantiene su
flujo de preparar, seleccionar referencia y generar; muestra el error real.

`acceptedTopForView` suponía que todo lo distinto al color de las esquinas era
la casa. Una cenital con jardín y parking hacía que ese encaje incluyera toda
la parcela. Solo se recorta con esquinas coherentes y fondo neutro; cuando no
hay encaje fiable se conserva la imagen completa, girada según el alzado.
La sección sigue siendo la referencia principal de cámara.

## Secciones con retranqueos

`section-visibility.ts` divide el ancho proyectado por los vértices de los
contornos. En cada franja encuentra la primera entrada a un recinto. Solo abre
una fachada exterior orientada a la cámara; un tabique interior no se retira
por estar detrás de una delimitación oculta. Los bordes ocultos no son paredes
oclusoras. Los segmentos de un muro curvo conservan su ID de procedencia.

El raster recorta los muros a las franjas visibles y al recinto frontal,
manteniendo su pared del fondo. Los muebles técnicos fuera de esa visibilidad
no se dibujan ni se enumeran. `sectionRooms` conserva el contorno completo para
asociar IDs de la guía espacial y añade `visibilityHint` con franjas relativas
al ancho de esa estancia en la cámara. La lectura previa, el prompt
`habiteka-section-simple-v7` y la auditoría reciben esas indicaciones.
No se impone ver todos los muebles de una estancia parcialmente abierta ni
se permite trasladarlos a la parte que sí se ve.

También dron/isométrica/exterior activan `acceptedDesign` cuando adjuntan una
referencia aceptada: sus muebles y acabados prevalecen sobre el plano guía.

## Verificación y límites

Pruebas reproducen una cochera parcialmente abierta con coche oculto detrás
del salón, un límite oculto con tabique real detrás, muebles distintos entre
plano e imagen aceptada, lectura incompleta y cenital ajardinada sin recorte.
La preparación se inspeccionó además sobre la revisión guardada del proyecto
afectado, sin publicar sus datos ni modificar sus imágenes o aceptación.

No se han solicitado imágenes ni auditorías IA nuevas durante esta corrección.
Las pruebas de preparación y los controles automáticos no acreditan el
realismo o la fidelidad de un nuevo render: la comprobación visual del usuario
sigue siendo obligatoria. Un informe `passed` no equivale a diseño aceptado.
