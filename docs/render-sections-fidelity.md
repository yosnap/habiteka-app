# Referencias aceptadas y visibilidad de alzados

## Continuidad de interiores y revisión v13 — 7 de octubre

`interiorDesignReference` exige una cenital aceptada compatible con el documento,
ámbito y ajustes. La biblioteca usa el mismo requisito. La generación persiste
`referenceDesignId` y la revisión recibe la misma imagen de identidad. En interiores
se conserva completa y sin girar: el encaje por proporción de la imagen no acredita
una correspondencia exacta entre sus píxeles y el plano. El helper experimental de
recorte no forma parte de este flujo.

Las vistas derivadas no reciben el contrato de acabados del editor ni una orden de
rediseñar de nuevo. Las fachadas cerradas conservan la captura con cubierta, sin
pasar por el raster de sección. Los laterales abiertos mantienen la cenital girada;
las otras cámaras no reciben esa descripción de orientación.

La revisión solicita `referenceVisible` por hueco y rechaza desapariciones aunque
el resumen marque éxito. Exige las estancias de la cenital completa y de la cámara
interior. La normalización de huecos, exterior y sanitarios conserva un `fail`
explícito. Los grupos sanitarios solo pueden normalizarse como ocultos si tampoco
se observaron piezas en la referencia. Los informes antiguos no se reescriben.

En interiores, `interiorFurnitureBrief` lee el mobiliario de la cenital antes de
generar; una lectura vacía o sin estancia localizada detiene la imagen. La captura
se envía en gris, una sola vez, sin su duplicado anotado. Su geometría sigue guiando
la cámara; sus colores y modelos de muebles no fijan la apariencia final.

Cuando una vista con referencia aceptada supera la revisión general,
`accepted-design-identity-audit` compara exclusivamente las dos imágenes de diseño
a mayor resolución, sin la maqueta ni el aprobado anterior. Registra descripciones
separadas de origen y candidata por grupo. Un cambio o duda invalida el aprobado;
una respuesta vacía o totalmente oculta deja la revisión incompleta. Estas llamadas
añaden coste de visión y no certifican identidad por sí solas. Una prueba real
detectó así sillas y taburetes sustituidos que el informe general había aprobado.
La nueva revisión de secciones tampoco exige aplicar otra vez el rediseño original.
El permiso original de rediseñar fijos no permite intercambiar bañera y ducha al
cambiar de cámara. Las instrucciones de sección prohíben añadir decoración ausente
de la cenital, incluidas plantas que una prueba lateral introducía en dormitorios.

La lectura previa y la comparación independiente reciben también cuatro ampliaciones
solapadas de la referencia aceptada cuando su resolución lo permite. No se asume
correspondencia de píxeles con el plano ni se recorta una supuesta habitación.
Se cuentan asientos por lado, evitando sumarlos dos veces por el solapamiento.
Una prueba real reducía erróneamente las cantidades de sillas y taburetes;
con ampliaciones se recuperaron las cantidades de la referencia. La cámara
interior aporta posición y objetivo para no confundir sus lados con ejes del plano.
Los frentes verticales ocultos en una cenital no prueban por sí solos una alteración.
Las dos generaciones posteriores mejoraron textiles, mesillas y modelos de asientos.
El dormitorio superó la revisión. En el salón se detectó también un falso descarte:
el revisor contaba dos veces parte de un taburete. Desde v12 se adjuntan detalles de
ambas imágenes, etiquetados por origen, también en interiores panorámicos; se pide
localizar las piezas de cualquier cambio de cantidad y justificar las oclusiones.
Esto no garantiza un recuento correcto ni permite levantar un bloqueo sin revisión.
Además, `candidateIdentityInventory` lee primero la candidata sola, enumera piezas
visibles y obtiene la cantidad de esa enumeración. La comparación recibe después
esa lectura; una discrepancia que no puede situar se considera dudosa. Una lectura
vacía o inválida bloquea la revisión. Es una llamada adicional de visión, sin una
nueva generación de imagen ni aceptación automática.
La revisión v13 separa primero `occlusions` (obstáculo y ubicación) de `comparisons`
(subconjuntos observables en ambas vistas). Una fila visible se compara con esa
misma fila, nunca con el total cenital. Las partes ocultas no se certifican; tampoco
pueden borrar un cambio visible ni convertir una comparación vacía en aprobado.
La prueba real del interior nuevo supera la comparación visible y el control con
taburetes sustituidos sigue rechazándose. El resultado corregido queda pendiente
de aceptación explícita; no se acepta por superar el control automático.

## Primera persona: versión de origen y luz del diseño

El estudio permite elegir una aprobación existente como versión de origen para
primera persona. Se validan pertenencia, arquitectura y cámara contra esa revisión
inmutable al preparar y al enviar. Los cambios posteriores del borrador no la
sustituyen ni se incorporan al vídeo; la interfaz lo indica. Construcción mantiene
su comprobación de versión vigente. La elección no crea ni modifica aprobaciones.

La luz de primera persona procede de las referencias aceptadas, no de la maqueta
aprobada. `designVisitSelectionIssue` exige luz registrada e igual en todas las
imágenes; `designVisitPrompt` la toma de esa selección. El estudio muestra versión
y luz antes de guardar la preparación, sin generar ni transferir medios todavía.

Tests cubren referencia obligatoria, selección compatible, prioridades de apariencia,
fachadas sin corte, desapariciones y contradicciones del informe. No acreditan por
sí solos el realismo de imágenes nuevas. La primera persona continúa limitada a una
estancia; no se implementa con este cambio un trayecto entre habitaciones.

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
