# Paseo completo desde diseños

## Reconstrucción local experimental

Existe una [herramienta local de reconstrucción en Blender](reconstruccion-local-disenos.md)
para comparar una escena preparada con diseños aceptados, sin llamadas IA.
Usa arquitectura aprobada y un manifiesto explícito de apariencia; no incorpora
automáticamente muebles del editor. Guarda únicamente borradores privados con
limitaciones y procedencia. No añade un flujo de usuario ni publica vídeos finales.

## Validación de un tramo antes de producir el resto

`startPropertyVisitSegment` acepta `onlyThisSegment: true` con el consentimiento
del tramo. Resuelve únicamente sus extremos, manteniendo aceptación humana,
organización, revisión, cámara, luz, puertas y anclas. La revisión del clip valida
también esos extremos y sus versiones. Sin esa opción se exigen todos los
encuadres; la exportación completa siempre exige todos y todos los clips revisados.
La prueba usa el mismo clip guardado, presupuesto global e historial de intentos:
no crea otro presupuesto ni continúa automáticamente. La UI muestra extremos,
segundos, distancia geométrica y precio antes de autorizar. Su resultado temporal
debe evaluarse; no basta con aprobar las imágenes ni con pasar pruebas de código.

`propertyVisitImageLocked` protege los extremos usados por cualquier clip o intento
anterior. Las imágenes de otros tramos pueden corregirse y auditarse después del
piloto sin alterar sus referencias. Se conserva el bloqueo de reintentos durante
envíos activos o inciertos. No se generan imágenes ni se aceptan referencias al
preparar la prueba. Hailuo recibe `image_url` y `end_image_url`; las coordenadas del
prompt no equivalen a control de geometría, profundidad o trayectoria 3D.

La prueba real de movimiento del 08/10/2026 falló: aparecieron espacios y muebles
distintos entre los extremos, además de números y flechas superpuestos. El clip
se rechazó sin repetirlo. La generación técnica funciona, pero la fidelidad del
paseo completo con este método **no está validada**. Eliminar coordenadas del
prompt no acredita solucionar la reconstrucción del espacio intermedio; no se
debe convertir este fallo en una secuencia automática de nuevos cobros.

`generatePropertyVisitImage` admite un retoque regional opcional ligado al último
borrador rechazado, con máscara validada y máximo media imagen. Reutiliza
`protectedInpaint`: los píxeles exteriores se conservan en servidor; borrar antes
de rellenar impide que el contenido inventado siga condicionando la generación.
La geometría y la lectura de los diseños aceptados acompañan el retoque. No se
envía una captura del 3D como resultado final. Se guarda `imageEdit` con el origen,
se audita la imagen completa y se exige aceptación humana. No cambia el tope de
coste ni habilita respaldos automáticos. La UI reutiliza la selección regional de Diseños.

La generación conserva `acceptedBrief`, leído únicamente de la referencia aceptada,
y lo pasa a `auditIsolatedReference`. Esta llamada ve solo la candidata y devuelve
un resultado por índice; el servidor fija el texto de referencia y rechaza índices
omitidos, duplicados o desconocidos. Sus discrepancias se añaden a la auditoría
de identidad y no pueden ser borradas por el comparador conjunto. Para imágenes
anteriores sin lectura guardada se vuelve a leer la referencia por separado.
Es un análisis visual adicional facturable, no una garantía de fidelidad ni aceptación.

La lectura aislada no infiere altura vegetal de una copa cenital. Las conexiones
describen habitaciones y no obligan a ver todos sus muebles por cada acceso;
el comparador debe explicar oclusiones antes de marcar sustituciones visibles.

Primera persona usa `PropertyVisitPanel` y `inspectPropertyVisit`: preparación
gratuita, autenticada y de solo lectura sobre una aprobación inmutable. No guarda
el documento, acepta renders, sube imágenes ni llama a un proveedor.

## Geometría y cobertura

- `property-visit-entries` identifica puertas/huecos entre interior y exterior en
  la planta inicial. El usuario elige el acceso; se distingue patio de exterior.
  Conserva candidatos bloqueados para explicar el problema.
- `property-visit-paths` calcula un árbol compartido de caminos con la navegación
  existente: malla de 150 mm, afinada a 75 mm si faltan recintos, hasta 60.000 nodos. A* entre destinos evita regresar al árbol del acceso. Cada arista y atajo se comprueba
  contra sólidos, puertas, altura libre y suelo. El límite no acredita ausencia
  de paso; las zonas no encontradas siguen pendientes.
- `property-visit-plan` conserva todos los recintos derivados de todas las plantas.
  Solo marca trazado en la planta del acceso; las otras requieren enlaces de
  escaleras aún pendientes en este flujo. No supone transitables terrenos visuales.
- La ruta a 1,60 m incluye pasos de hasta 2 m, giros de hasta 60 grados y una
  observación breve por zona. `property-visit-compact` conserva esa ruta en
  `pathFrames` y elige hasta once encuadres, repartiendo su tiempo de movimiento
  en hasta diez clips de seis segundos. No trunca las últimas zonas ni conecta
  extremos con líneas rectas que corten paredes. El mapa utiliza la ruta completa.
  Las coordenadas intermedias guían el prompt; no garantizan que el vídeo las siga.
- La guía antigua del editor usa ahora el modo estricto de `autoTour`: ya no
  guarda un recorrido parcial bajo el botón de todas las zonas.

## Referencias y límites de generación

El vídeo completo tiene un techo de 2 EUR. `property-visit-budget` suma todos los
tramos e intentos anteriores (también fallidos, de forma conservadora), aplica
el cambio público del BCE con antigüedad máxima de siete días y reserva un 30 %.
El servidor bloquea antes de cualquier llamada de pago si no puede verificar el
cambio o supera el techo; tampoco genera nuevas referencias para ese paseo.
La interfaz muestra el bloqueo. El minuto de Hailuo 02 Standard cuesta 1,50 USD;
su continuidad real todavía requiere validar un resultado generado. Las imágenes
y análisis se presupuestan aparte. Se bloquean nuevas generaciones y exportación
si el paseo excede 60 segundos o sus tiempos no coinciden. La construcción es otra
pieza; su envío verifica también un máximo de 60 segundos y 2 EUR. El piloto de
construcción conserva sus opciones de 8/12 segundos.

Los diseños se resuelven mediante `designVideoSources`, manteniendo organización,
proyecto, zona, aceptación, revisión y cámara. Se excluyen vistas recortadas,
aéreas o sin techo sólido. La coincidencia usa `sameCameraPose` y luz registrada.
No confundir referencias coincidentes con continuidad validada, ni el mobiliario
del editor con el mobiliario aceptado. Preparar no da acceso a exportación nativa.

`property-visit-job-actions` guarda un entregable VIDEO con aprobación inmutable,
plan, imágenes únicas y segmentos. `property-visit-document` abre puertas en una
copia explícita. `walkthrough-thresholds` une apoyos reales de las dos caras del
hueco, conserva colisiones y limita el escalón a 220 mm. No altera el documento.

`property-visit-image-actions` valida cámara, luz y referencias antes de reclamar
el encuadre; reutiliza generación y auditoría de imágenes. Guarda la procedencia
`generation.propertyVisit` y no acepta resultados. El cliente captura la copia
aprobada, nunca exporta su 3D. Las revisiones incompletas quedan descartadas.
El prompt completo pasa por `englishImagePrompt`, conservando los datos numéricos.
Los errores previos al envío de imagen quedan como fallidos y admiten un nuevo
intento explícito; los envíos inciertos se conservan sin repetirlos. Los análisis
previos completados pueden tener coste aunque no llegue a generarse la imagen.
La comprobación local de todas las capturas no llama a ningún proveedor ni acepta
resultados. Impide cambiar de paseo durante una operación y libera cada captura
al sustituir la vista previa.
El formato de captura debe ser 16:9. El generador queda fijado al modelo y tarifa
confirmados, sin failover de imágenes. La producción muestra las dos referencias
aceptadas y la revisión inmutable del paseo, independiente de la preparación nueva.
Las cámaras del paseo identifican su estancia con `property-visit-room-context`:
posición y punto de mira verificados por un paso libre en el plano, incluido mirar
desde el umbral. No se exige coincidir con una cámara fotográfica predefinida.
Esto activa la lectura previa del mobiliario aceptado, la guía gris y la auditoría
de identidad interior también en cámaras intermedias y accesos. Si el punto de
mira queda tras una pared o puerta cerrada, no se atribuye esa habitación.
Los recintos sin etiqueta mantienen su contorno y un nombre neutro en el mapa
de auditoría; no quedan sin localización por carecer de texto en el plano.

`property-visit-video-actions` revalida todas las imágenes aceptadas; cada segmento
fija versiones de sus extremos. Reserva saldo y reclama por versión antes de subir
referencias o enviar una tarea. Guarda taskId antes de liquidar, conserva estados
inciertos y permite consultar sin crear. Cada reintento explícito conserva archivos
y usa otra clave de reserva. La revisión humana del tramo y su unión es obligatoria.

`compose-property-visit` decodifica los clips secuencialmente y compone H.264 768p,
sin audio ni fundidos. El servidor limita el paseo a 60 segundos. Requiere WebCodecs y memoria para el
archivo (hasta 1 GB). Las acciones de exportación revalidan aceptación, versiones,
ámbito y ticket firmado antes de guardar. La aceptación final es independiente.
Las descargas se firman al consumir cada clip para evitar su caducidad durante
un paseo largo. La versión del trabajo queda fijada desde el inicio de composición;
un cambio concurrente impide guardar una mezcla de intentos. Si el MP4 ya se
promovió y falló el guardado posterior, se recupera verificando el archivo final.

Pendiente: conexión entre plantas, navegación exterior fuera de apoyos modelados,
y validación visual con un paseo real generado. Construcción y paseo son independientes.
Las pruebas unitarias y la preparación geométrica no acreditan hiperrealismo ni
continuidad. Las llamadas reales requieren autorización específica de gasto y las
imágenes nuevas requieren aceptación del usuario antes del vídeo.

`rereviewPropertyVisitImage` repite solo visión sobre el candidato guardado, con una
captura reconstruida de su cámara y la misma cenital aceptada. Valida ámbito, aprobación,
vínculo, luz, cubierta y versiones de trabajo e imagen antes de guardar. Conserva
`reviewHistory`; no acepta el resultado ni reabre descartes por inspección visual.
En vistas parciales, sanitarios ocultos admiten `null` en ambos recuentos y ceros
en categorías ausentes del plano. Un fallo explícito, una pieza visible perdida
o una planta completa no se normalizan como ocultación.

Las referencias espaciales incorporan `connectsRooms` en cada hueco, calculado
muestreando ambos lados de su muro, y `roofGlazing` con la huella de las piezas
de vidrio. Los vecinos no se convierten en estancias obligatoriamente visibles.
La lectura del mobiliario y la comparación independiente usan esas conexiones;
esta última recibe además el exterior aceptado como `architecture`, tanto al
generar como al revisar. El esquema exige un `architectureCheck` separado; si
falta, la auditoría queda incompleta y no permite aceptar. Se añade una imagen a la llamada existente, sin otra
llamada de visión. Una prueba real detectó falsos aprobados por una cama en el
hueco de un estudio y un lucernario omitido. Una prueba posterior ya no mostró
la cama incorrecta, pero siguió omitiendo vidrio y cambió un elemento ornamental;
quedó descartada. Las pruebas locales de referencias no acreditan fidelidad. La
comparación independiente de cubierta aún necesita validación real completa:
la revisión general puede rechazar antes e impedir que se ejecute. No se corrigen
automáticamente las imágenes anteriores.

La captura con cámara explícita usa preset `custom` también para decidir si oculta
cubiertas de mobiliario. Antes heredaba el preset aéreo del editor y podía ocultar
pérgolas aunque declarase techo sólido. La previsualización individual permite
examinar cada captura sin IA; conserva la misma cámara usada en generación.

Las capturas de producción y revisión usan `architectureOnly`: ocultan temporalmente
mobiliario y conjuntos de cocina, conservando cubiertas, porches y cerramientos.
`architectureGuide` restaura visibilidad y materiales en el `finally` de la captura;
los cristales de tejado usan azul opaco exclusivamente como señal geométrica. La
metainformación lo declara al generador y auditor; no se aplica escala de grises a
esa guía. `interiorFurnitureBrief` puede localizar la estancia con una caja normalizada
sobre la cenital completa y adjuntar un recorte de sus píxeles originales, además
de la referencia completa. No hay una generación adicional ni aceptación automática.
La localización sigue siendo probabilística y exige revisar la correspondencia visual.

Para esas guías vacías, `acceptedInteriorPrompt` reemplaza el contrato genérico de
edición por uno de incorporación del interiorismo aceptado. Proyecta el centro de
cada hueco sobre el eje horizontal de la cámara, junto con los usos conectados;
generación y auditorías reciben la misma correspondencia. Esta proyección no
certifica visibilidad, pues el hueco puede estar tapado o su centro fuera de campo.
Los recintos contiguos sin etiqueta conservan su contorno en `connectsRooms`: antes
se omitían y el modelo trasladaba el estudio a un paso sin nombre. La lectura de
la cenital exige una descripción del otro lado de cada hueco, incluidos estos
recintos, y bloquea antes de generar si falta alguna conexión o hay duplicados.
Se añade el tipo constructivo de cada puerta y una medida por rayo hasta la primera
estructura detrás del centro del hueco. Generación y revisión reciben esa profundidad
para evitar pasillos extendidos, salidas inventadas o correderas convertidas en
abatibles. Es una medida puntual, no una reconstrucción completa del campo visual;
un informe automático todavía puede dar falsos positivos y debe contrastarse visualmente.

`propertyVisitCorrection` recupera el último borrador rechazado del encuadre,
comprobando organización, proyecto, zona, cámara, revisión, anclas y estado de puertas.
Lo adjunta antes del exterior aceptado, con el motivo de rechazo delimitado como
evidencia. No lo acepta ni lo utiliza como ancla visual final. Se guardan
`correctionSourceId` y `sentPrompt` en el entregable para rastrear la corrección;
no añade llamadas IA, pero el intento sigue consumiendo imagen y revisiones.

Los nuevos trabajos guardan `videoModel: hailuo/02-image-to-video-standard`.
`createCompactTransition` usa `image_url`, `end_image_url`, duración de texto
`"6"`, resolución `768P` y `prompt_optimizer: false`; máximo 1500 caracteres.
Fuente: [contrato Hailuo 02 Standard](https://docs.kie.ai/market/hailuo/02-image-to-video-standard).
Tarifa verificada el 07/10/2026 en [KIE Hailuo](https://kie.ai/hailuo-api), seleccionando
**02 Image To Video Standard**: 0,025 USD/s a 768p. No hay cambio automático a H3.
Los trabajos anteriores sin `videoModel` conservan su modelo, tarifas e historial.
Un trabajo antiguo que supera un minuto queda bloqueado y requiere otra preparación.

El contrato legado consultado el 07/10/2026 de
[KIE H3 Image-to-Video](https://docs.kie.ai/market/minimax-h3/image-to-video)
admite `first_frame_url`, `last_frame_url` y tramos de 4 a 15 segundos. Es una base
para compartir extremos entre tramos; no constituye garantía de geometría
ni de continuidad temporal. `KieVideoProvider.createTransition` utiliza ese contrato,
separado del piloto reference-to-video. Tarifa consultada: 0,04 USD/s a 768P y
0,065 USD/s a 2K; las dos imágenes están incluidas. El estudio prepara 768P.
