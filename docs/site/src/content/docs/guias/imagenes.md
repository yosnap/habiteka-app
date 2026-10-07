---
title: Crear y revisar imágenes
description: Preparar vistas del inmueble sin perder su identidad.
---

La generación desde el Editor recibe también una guía de las estancias y de los huecos del plano guardado. Nombra correctamente cada espacio: **Comedor**, **Cocina**, **Aseo** o **Lavadero** definen su función y ayudan a evitar que el diseño los convierta en dormitorios. La guía conserva contornos, ancho de huecos y dimensiones y giro de las hojas de puerta; sus rótulos no forman parte de la imagen final.

En la generación inicial desde el Editor, antes de guardar una imagen nueva, la revisión comprueba los usos de las estancias, la coherencia de puertas y huecos, la circulación y el realismo, además de cámara y arquitectura. Debe revisar cada estancia y hueco de la guía; los elementos ocultos o fuera de cámara deben quedar identificados como tales. Un fallo con informe completo se guarda como **Descartado**. La revisión dispone de respuesta suficiente para comprobar cada estancia, puerta, ventana y elemento exterior de la planta. Si la revisión visual no llega a completarse (los modelos de **Análisis visual** no responden, se alcanza el tope de gasto, rechazan la petición o devuelven un informe incompleto), la imagen ya generada (y cobrada) se guarda también como **Descartado**, con el motivo y los modelos que fallaron, para que no se pierda: no puede aceptarse sin revisión. Si es una cenital de toda la planta, ábrela en **Diseños** o en la biblioteca de referencias y pulsa **Volver a revisar**: la revisión compara la imagen guardada con el plano del que salió, sin generar otra ni descargarla, y consume solo una revisión visual. Si la supera, queda pendiente de que la aceptes; si el plano ha cambiado desde entonces, hay que generarla de nuevo. Para otras vistas, descárgala y pásala por [Revisar una imagen existente sin regenerarla](#revisar-una-imagen-existente-sin-regenerarla) cuando la revisión vuelva a responder. Este control automático sigue necesitando tu revisión visual y aceptación explícita.

Los **huecos** son pasos sin hoja ni bisagra: no deben convertirse en puertas abiertas. La guía distingue también los usos que comparten un recinto sin separación y muestra el barrido de cada puerta hasta el ángulo configurado. El mobiliario debe dejar libre ese giro, además del paso frontal. Una corredera o plegable puede verse cerrada, entreabierta o abierta aunque el plano la dibuje en otra posición: solo se descarta si aparece como puerta abatible o con muebles en su recorrido. En la cenital, el plano que recibe la IA dibuja cada puerta solo con su hoja abierta en su ángulo, sin el arco de giro, que la IA convertía en un tablón curvo. La hoja debe verse como una tabla rígida y recta, y una hoja curva, partida en V o un tablón entre los marcos descarta la imagen, salvo en las puertas plegables. Un patio o pavimento vacío no autoriza una piscina; la libertad decorativa tampoco permite añadir construcciones.

En **Qué falla y dónde**, las puertas con huecos de menos de **65 cm** se señalan para revisar su ancho en **Propiedades**. Es un umbral orientativo de revisión del modelo. El aviso no cambia el plano ni amplía una puerta por su cuenta. Corrige las medidas que no coincidan con el original antes de preparar nuevas vistas.

Las versiones creadas con **Pedir cambios** conservan la referencia del plano y de la cámara, pero empiezan pendientes de una nueva aceptación. La aceptación y la auditoría de la imagen anterior no se transfieren al nuevo resultado.

Al **Pedir cambios** sobre un diseño procedente del Editor, la evaluación de la petición y el retoque reciben los nombres y las ubicaciones de las estancias del plano. Puedes pedir que los muebles correspondan al uso de cada estancia, por ejemplo «coloca los elementos según los nombres de las estancias». Se utiliza la revisión que originó el diseño cuando está registrada; en diseños antiguos sin esa referencia se utiliza el plano actual disponible. Los cambios crean una versión nueva, conservan la referencia de generación y no modifican el plano ni aceptan el diseño automáticamente. Si no hay un plano disponible, concreta las estancias y los elementos que quieres cambiar.

### Corregir un detalle de la cenital completa

Para diseñar toda la vivienda, prepara **Toda la planta → Cenital** desde el plano completo. El resultado sigue siendo una imagen de conjunto; los retoques por zona se realizan después sobre esa misma imagen, sin generar ni unir habitaciones independientes.

1. Abre la imagen que quieres conservar como base y pulsa **Pedir cambios**.
2. En **Alcance del cambio**, deja **Una zona de esta imagen** y arrastra sobre el detalle. Incluye el objeto y su sombra; deja fuera los muros, huecos y muebles que deban conservarse. Puedes volver a arrastrar para sustituir la selección o pulsar **Borrar selección**.
3. Escribe una corrección concreta, por ejemplo «quita la hoja inventada del paso al comedor y conserva sus jambas».
4. Pulsa **Aplicar cambio**. Sin una zona seleccionada, el botón permanece desactivado. Preparar la selección no genera imágenes; aplicar el cambio sí puede consumir créditos.
5. Revisa la nueva versión completa, el interior del área retocada y sus bordes antes de aceptarla. El original se conserva.

La evaluación de la petición recibe también la zona seleccionada. Puedes describir un defecto, por ejemplo «en esta zona falta una puerta»: no hace falta escribirlo como una orden ni repetir el nombre de la estancia si ya la has marcado. Restaurar una puerta omitida en un hueco existente es una corrección de la imagen; no abre un acceso nuevo ni modifica el plano. Cambiar la selección invalida la evaluación anterior. Esta evaluación comprueba la claridad de tu petición, no verifica visualmente si la puerta está bien situada: revisa el resultado antes de aceptarlo.

Para un detalle pequeño, la IA recibe un recorte cercano de la imagen base que incluye su entorno. El retoque se coloca de nuevo en la imagen completa y solo puede modificar el área que marcaste. Ese contexto no amplía la zona editable ni crea un diseño de habitación independiente. Incluye en la selección el espacio que necesita el cambio; por ejemplo, una hoja abierta y su sombra. Una selección amplia mantiene la referencia completa.

El servidor conserva los píxeles originales fuera de la selección, incluso si la IA cambia otras zonas en su respuesta. El mensaje **Versión creada** confirma que existe otra imagen; comprueba que realmente resuelve tu petición. Esto no garantiza que el detalle generado dentro sea correcto ni que sus bordes encajen: revisa puertas, sombras, materiales y circulación. **Pedir cambios** no ejecuta una nueva auditoría visual automática ni transfiere la anterior. Si el resultado cambia la proporción de la referencia enviada, el retoque se detiene sin aplicarlo ni generar otro automáticamente. El proveedor puede haber cobrado esa generación; la imagen base permanece intacta.

**Limitación comprobada:** incluso con contexto cercano, el generador puede colocar el cambio fuera de la zona marcada. La protección impide trasladarlo a otra parte del plano, pero el detalle solicitado puede seguir sin corregirse y mostrar diferencias de tono. Este comportamiento aún no está resuelto. No aceptes una versión que conserve el defecto; repetir la petición puede consumir otra generación sin resolverlo.

Con teclado, enfoca **Seleccionar zona de retoque** y pulsa **Intro** para iniciar una selección. Las flechas la desplazan; **Mayús + flechas** ajusta su tamaño; **Supr** o **Retroceso** la borra. La selección corresponde a la imagen visible, excluyendo sus márgenes. Al pasar a otra imagen se reinicia. En escritorio, el panel lateral se desplaza de forma independiente para mantener la cabecera y la cenital a la vista.

Elige **Toda la imagen** expresamente para un cambio general de estilo o iluminación. Ese alcance permite modificar toda la imagen y exige revisar nuevamente la distribución. Para corregir varios detalles manteniendo el resto, aplica y revisa uno por uno sobre la versión que quieras conservar.

El retoque recibe también el tipo de hueco, las medidas y el giro de las puertas, las zonas abiertas compartidas y las piscinas modeladas. Puedes pedir que quite una hoja inventada o aparte el mueble que choca con una puerta. También puedes quitar, añadir o sustituir muebles y sanitarios dentro de la zona marcada; por ejemplo, «aquí hay 3 inodoros y 2 lavabos, deja solo uno de cada». Al quitar un objeto («este inodoro sobra, elimínalo»), la zona marcada se tapa con el tono del suelo antes de enviarla a la IA, que la rellena con el suelo o la pared de alrededor sin dibujar otro igual. Después, el color del relleno se iguala al del suelo que rodea la zona y su borde se funde con la imagen, para que no se note un rectángulo. Marca el objeto entero con un poco de suelo alrededor y sin pisar los muros: lo que quede fuera de la zona no cambia, y un muro dentro de ella se redibuja peor. Si pides dejar una pieza de varias («deja solo uno»), la zona no se tapa. La imagen puede diferir del plano en muebles y sanitarios, y el plano del Editor no cambia. Ampliar una piscina ya presente requiere una petición explícita y debe conservar los límites y accesos de su terraza. Esa petición afecta a la nueva imagen, no autoriza piscinas en otras zonas ni cambia las dimensiones guardadas en el Editor. El retoque no hereda una revisión superada: comprueba visualmente el resultado antes de aceptarlo.
:::note[Revisión del recorte antes de generar]
Una captura que registra tabiques interiores ocultos se bloquea antes de generar la imagen. Prepara de nuevo la vista y comprueba la previsualización: frontal, trasera y laterales abren únicamente la fachada del lado de cámara. Las fotos antiguas con ese defecto aparecen como **No válida para construcción** en el estudio de vídeo y deben reemplazarse. Cambiar sus etiquetas no repara la imagen.
:::

## Preparar la generación

La generación y la revisión deben conservar la función de cada objeto visible: las camas siguen siendo camas y las placas de cocina mantienen sus fogones, sin convertirse en decoración ni quedar tapadas. Revisa también estos detalles antes de utilizar una imagen para vídeo.

La guía distingue inodoro, lavabo, bidé, bañera y ducha y registra sus cantidades por estancia, además de las placas y fregaderos de la cocina modular. La revisión comprueba estos elementos por separado: un lavabo y una ducha no deben convertirse en dos inodoros más. La revisión no recibe las cantidades esperadas, solo qué estancias mirar: cuenta cada pieza en la imagen y la aplicación compara su recuento con el plano. Así no puede dar por bueno un inodoro duplicado copiando la cifra del plano. Conserva también el tipo de vehículo del catálogo: compacto, berlina, SUV o furgoneta. En vistas derivadas, el diseño que has aceptado fija los elementos visibles; los ocultos no se añaden para mostrar el inventario completo. Estos controles no reparan imágenes antiguas ni sustituyen tu inspección visual.

La **Cenital** de **Toda la planta** incluye también el exterior modelado: superficies de césped, tierra, grava o asfalto, cercos y setos con sus puertas, vegetación y vehículos. El encuadre abarca el terreno y el cerramiento; el generador recibe sus materiales, posiciones, medidas y tipos. El césped debe seguir siendo césped y cada coche debe conservar su identidad, ubicación y orientación. El estilo de la vivienda no autoriza convertir el jardín en arena ni los coches en muebles. En vistas parciales solo se conserva lo visible dentro de la cámara o zona elegida.

Abre la generación de diseño/imágenes desde el editor. Elige el ámbito, las vistas, el estilo, el momento de luz y tus instrucciones. Revisa el coste mostrado antes de generar.

Las **Instrucciones de diseño** son opcionales. Puedes indicar preferencias o restricciones, como «materiales realistas, sombras naturales y pasos despejados» o «conserva la ubicación de las puertas». No necesitas pedir que cambie un objeto ni repetir una estancia cuando la indicación se aplica a todo el ámbito elegido. La evaluación distingue estas indicaciones de **Pedir cambios** sobre una imagen existente y recibe el ámbito, el estilo, el objetivo y los permisos del estudio. Los rechazos guardados con el criterio anterior se vuelven a evaluar en la próxima solicitud. Las peticiones incompatibles o contradictorias siguen sujetas a revisión; interpretar la instrucción no garantiza la fidelidad de la imagen resultante.

En **Ángulos del diseño**, puedes marcar varias vistas seguidas con ratón o teclado. Las casillas mantienen el foco dentro del panel desplazable: el marco y los botones del estudio permanecen en su sitio al seleccionar Dron, Isométrica o los laterales. Seleccionar ángulos solo configura las vistas; no genera imágenes.

Marca **Personas** si quieres que aparezcan personas haciendo vida en las estancias. Solo cambian la imagen: no modifican el plano ni el diseño, y la revisión las admite mientras no tapen puertas o pasos ni tengan una escala irreal.

Elige si el resultado debe incluir solo la casa o también su entorno. En vistas lejanas, la parcela confirmada aporta la ortofoto guardada y se utilizan referencias aceptadas de identidad. El dron y el exterior necesitan esa ortofoto, guardada o adjunta en el diálogo. La isométrica no: sin ella parte de la cenital aceptada y muestra solo el terreno modelado del plano, con fondo neutro alrededor y sin calles ni casas inventadas.

## Qué muestra cada vista

| Vista | Muros y huecos | Techo y tejado |
|---|---|---|
| Frontal, Trasera, Izquierda y Derecha | Se ocultan los muros exteriores del lado de cámara y sus puertas, ventanas, cortinas, estores y persianas. Se conservan los muros del fondo y los interiores. | Ocultos en las capturas para diseñar, porque la cámara mira desde encima de la casa. Visibles al usar estas vistas en el visor 3D. |
| Cenital, Isométrica y Dron | Se conservan los muros para leer la distribución. | Ocultos para ver el interior. |
| Exterior terminado | Fachadas completas y cerradas, sin retirar muros. | Visibles, con la forma del tejado configurado. |

Estos cortes son ayudas de visualización: no eliminan elementos del diseño. Comprueba **Ver vistas de referencia** antes de generar. La imagen debe respetar ese corte, sin reconstruir la fachada oculta ni añadir cortinas que vuelvan a taparla. Si preparaste referencias antes de cambiar estas opciones, vuelve a prepararlas.

Cada captura utiliza su propia cámara: preparar un lateral desde una vista cenital no oculta las pérgolas o carpas que deben verse en ese lateral.

**Propuestas de rediseño.** **Proponer acabados y muebles con IA** admite modelos que exigen razonamiento; corregida la petición que lo desactivaba y provocaba el error «Reasoning is mandatory». Sigue siendo necesario revisar la propuesta antes de **Aplicar al plano**. Si el modelo agota la respuesta sin terminarla, reduce el ámbito a unas estancias o una zona, o cambia el modelo en **Modelos por uso**.

La **Cenital** de toda la planta se genera a partir del plano 2D, en vista ortogonal y con la hoja y el giro de cada puerta, con unas instrucciones breves: estilo, luz, estancias y conservar la estructura. También nombran, en frases cortas y sin identificadores ni coordenadas, los muebles más importantes de cada estancia (camas y sofás con su orientación, armarios, chimenea, mesas y asientos; lo apoyado sobre otro mueble, como un televisor o una lámpara de mesa, se considera un detalle), el exterior con su posición en la imagen (vehículos, superficies, cercos y sus puertas, equipamiento y vegetación) y los sanitarios y placas de cada estancia. Con el inventario completo en formato de datos, las instrucciones superaban los 20.000 caracteres: algunos generadores las rechazaban y el respaldo reinventaba la distribución. La revisión posterior sigue comprobando el inventario completo. Esto aplica cuando no se diseñan zonas concretas ni **Solo la casa**, que siguen usando la captura del 3D. Las vistas que parten de la captura (zonas concretas, **Solo la casa**, isométrica, dron, frontal y exterior) siguen el mismo criterio: nombran el exterior y los sanitarios en frases breves y sin posiciones, porque la captura ya los muestra, y conservan las reglas que protegen césped, cercos, vehículos y sanitarios. Con zonas concretas solo se nombra lo que queda dentro de ellas. Antes, con el inventario completo, sus instrucciones llegaban a 28.000–35.000 caracteres: los generadores las rechazaban y el respaldo reinventaba la planta. La revisión posterior compara el resultado con ese plano y con el mapa de estancias. En la prueba real, una cenital de día y otra de noche superaron la revisión con un acabado más nítido y realista que el de la captura 3D. En la de noche algunas hojas salieron como cuñas; el plano dibuja ahora el giro como un arco fino, pendiente de comprobar.

**Muebles del editor como diseño base.** La cenital inicial recibe los muros, huecos, nombres de estancias y muebles del editor; el boceto o la imagen original del plano no llegan al generador. Si colocas muebles, a mano o con **Diseñar el plano → Amueblar → Proponer acabados y muebles con IA → Aplicar al plano** (la propuesta trabaja sobre la planta y Jev revisa la distribución), la cenital los recibe dibujados, con almohadas en el lado del cabecero y respaldos en los sofás. Después de aceptar una cenital, frontal, trasera y laterales toman su mobiliario y acabados de esa imagen, aunque difieran de los muebles del plano. Su sección técnica solo fija arquitectura y huecos. Cambiar el plano cambia la referencia: genera y acepta una cenital compatible antes de los laterales.

Al generar un ángulo distinto de **Cenital**, se envía la captura de ese ángulo y, cuando se localizan estancias, una copia de la misma imagen con sus nombres en los puntos correspondientes. La guía usa la cámara del plano y comprueba qué puntos interiores quedan tapados por la estructura; no traslada los nombres de las habitaciones ocultas al primer plano. El recorte por zonas y su máscara se respetan también en esta guía. Si los nombres quedan juntos, los rótulos se separan y una línea los une a su punto, sin desplazar la ubicación de las estancias. **Al fondo** identifica un punto visible a través de un hueco: no representa otro espacio en primera línea del corte. Los rótulos son auxiliares y no deben aparecer en el resultado final.

El mapa cenital auxiliar se reserva para generar cenitales y para la revisión posterior; así no introduce otra perspectiva en los laterales. El formato de salida se fija desde la captura principal, añadiendo margen si hace falta, sin estirar ni recortar el inmueble. La guía identifica puntos de las estancias, no certifica que se vea toda su superficie. Esta preparación no garantiza que el modelo respete la cámara o el uso de cada espacio: comprueba el resultado antes de aceptarlo.

**Limitación comprobada en los laterales:** las pruebas frontal y trasera conservaron sus cámaras y los usos visibles, pero una izquierda adelantó un espacio del fondo y añadió puertas al corte; una derecha convirtió una separación arquitectónica en listones. Ambas se descartaron. Además, cada lateral inventaba su propio mobiliario: por ejemplo, dos camas donde la cenital aceptada tenía una. Para corregirlo, estas vistas parten ahora de la cenital aceptada, ocultan el tejado y acercan la cámara. En la prueba real, la frontal y la izquierda reprodujeron el mobiliario y los acabados de la cenital y superaron la revisión. La trasera también lo hizo, pero la revisión la descartó porque leía el mapa sin girarlo; tras corregirla, esa misma imagen supera todos los criterios. La derecha mostró dos veces la casa entera desde arriba y el control de encuadre la descartó; al enviar la cenital recortada a las estancias de esa cámara, conservó el alzado y superó la revisión. Una trasera posterior se descartó por ampliar la casa, simplificar el fondo y dejar una puerta sin hoja: el resultado sigue variando entre intentos y cada imagen requiere tu revisión. La guía distingue también los puntos vistos a través de huecos y pide conservar los tabiques macizos. Las vistas oblicuas siguen pendientes de prueba real. Ninguna de estas comprobaciones acepta el diseño ni certifica todos sus detalles.

### Frontal, trasera y laterales a partir de la cenital aceptada

**Frontal**, **Trasera**, **Izquierda** y **Derecha** muestran el interiorismo de una **Cenital** que hayas aceptado. En **Toda la planta** se generan como una maqueta abierta vista a la altura de los ojos: parten de una sección 2D del plano sin la fachada de ese lado, con sus ventanas, puertas, cortinas y lo que cuelga de ella, y con las estancias que quedan abiertas, de izquierda a derecha. Cada estancia debe conservar los muebles, colores y acabados de la cenital, también su orientación: si en la cenital el cabecero de una cama toca la fachada retirada, desde ese lado la cama se ve por detrás, no de frente. Para ello, antes de cada alzado una lectura automática de la cenital describe el mobiliario de cada estancia tal como lo verá esa cámara; añade un pequeño coste de visión. Con zonas concretas o **Solo la casa** se sigue usando la captura del 3D, que fija la cámara, el corte, los muros y los huecos. La revisión automática compara también cada estancia con la cenital aceptada y descarta un interiorismo distinto o un mueble girado. En la maqueta abierta exige ver todas las estancias que abre el corte, en su orden: si falta una o en su hueco aparece otra, la imagen se descarta.

La cenital se envía recortada a las estancias que esa cámara ve de frente, siempre con la fachada cortada completa, y girada para que esa fachada quede abajo y su izquierda y derecha coincidan con la cámara; desde la trasera, por ejemplo, el orden de las estancias aparece invertido respecto a la cenital y es correcto. La cenital tiene que corresponder al mismo diseño y usar el mismo ámbito, luz, libertad y permiso de rediseño. Mover el rótulo de una estancia dentro de ella no cambia el diseño; pasarlo a otra estancia, renombrarlo o modificar muros y huecos sí lo cambia, también para los vídeos. Por ejemplo, una cenital aceptada con **luz cálida de atardecer** no sirve para laterales con **luz natural de día**, y si se generó con **Rediseño** de cocina, isla, sanitarios y armarios, los laterales deben llevar también ese permiso para reproducir esos mismos fijos. Sin una cenital compatible y aceptada, la vista se detiene antes de llamar al generador y no se cobra. Si preparas la cenital en la misma tanda, se genera primero; acéptala en **Diseños** y vuelve a preparar después los laterales con los mismos ajustes. Los vehículos de esas estancias se nombran con su tipo del catálogo, y la imagen no puede mostrar logotipos ni marcas reales.

El recorte solo se aplica cuando se puede reconocer un fondo neutro fiable. Con jardín, parking o un entorno que impide delimitar la casa, se conserva la imagen aceptada completa y girada, para no cortar estancias equivocadas. El resultado sigue usando la cámara de la sección.

La maqueta abierta de frontal, trasera y laterales va **sin techo ni tejado**. La guía técnica no añade una losa superior: deben verse los bordes de los muros reales, sin bloques o bandas continuas que cierren la vivienda por arriba. Para representar fachadas con cubierta usa **Exterior terminado**.

En plantas con retranqueos, cada franja de la sección muestra la primera estancia abierta desde ese lado y conserva las paredes que tapan las del fondo. Una cochera parcialmente visible no permite trasladar su coche a la zona del salón. Los límites ocultos que delimitan un suelo exterior no se tratan como paredes. Las indicaciones de visibilidad llegan también a la lectura del diseño y a la revisión automática.

Si no se puede leer el mobiliario de todas las estancias abiertas de la cenital aceptada, la generación de esa vista se detiene antes de pedir una imagen nueva. La lectura de visión tiene coste; no se sustituye por los muebles del plano ni se continúa sin ella. Estos controles corrigen la preparación, pero no garantizan por sí solos una imagen fiel: abre el resultado y compáralo con el diseño aceptado, incluso si la revisión automática lo deja pasar. Las imágenes anteriores no se reparan con esta corrección.

Para construcción desde imágenes, incluye **Cenital** y **Exterior terminado** en la misma tanda, o cierra el tejado desde el modelo sobre la isométrica o el dron aceptados (ver la sección siguiente). La cenital fija la distribución y se genera primero; el exterior utiliza una referencia cenital compatible para conservar la identidad y mostrar el edificio acabado con cubierta. Revisa el panel **Tejado** antes de preparar. Añade las vistas laterales necesarias para verificar tabiques y accesos. Si seleccionas zonas concretas, el exterior conserva ese mismo ámbito y no añade el resto de la parcela.

En **Exterior terminado**, la captura conserva el grosor exterior de los muros y el vuelo del tejado junto al contorno seleccionado. Ese margen solo afecta a la estructura: no amplía el suelo ni incorpora la parcela. Revisa la captura gratuita antes de generar; si muestra una fachada abierta por un recorte, esa referencia todavía no sirve para el final de obra. Una imagen antigua no se corrige automáticamente al volver a preparar la vista.

### Cerrar el tejado desde el modelo

La cubierta no se diseña con IA: su tipo, pendiente, alero, color, lucernarios y chimeneas son los que defines en **Exterior › Tejado**. Para obtener la imagen final con tejado, abre en **Diseños** (o en la galería del estudio) una **Isométrica** o un **Dron** de **Toda la planta** que ya hayas aceptado y pulsa **Cerrar tejado desde el modelo** en **Acciones de imagen**.

Habiteka dibuja una maqueta del inmueble (muros, huecos y la cubierta del plano) vista desde la cámara de esa imagen, y la envía junto con la imagen aceptada. La IA añade la cubierta con esa forma y la alinea con los muros que ve: el generador de la vista lejana puede haber reencuadrado ligeramente la cámara, así que no se pega la maqueta encima. Una revisión automática compara después las tres imágenes: la forma de la cubierta, que se conserven el encuadre y todo lo demás (fachadas, parcela, vegetación, vehículos y mobiliario exterior), y el realismo. Un criterio fallido o dudoso deja la imagen **Descartada** con el motivo.

- La imagen con tejado es un diseño nuevo de la misma tanda. Queda **Pendiente de revisar**: compruébala y acéptala antes de usarla.
- Sirve como referencia con **Fachadas y tejado** para el [vídeo de construcción](/videos/estudio/), igual que **Exterior terminado**.
- Tiene el coste de una imagen y una revisión visual.
- Se bloquea antes de cobrar si la imagen no está aceptada, si es de zonas concretas, de **Solo la casa** o interior, si el plano no tiene cubierta o si muros, huecos o muebles cambiaron desde que se generó. Cambiar solo la cubierta no lo bloquea.
- Cada vista admite una imagen con tejado: si ya existe, el botón se bloquea sin coste. Elimínala si quieres repetir el cierre. Pulsar de nuevo mientras se genera tampoco genera un segundo cobro.
- Por ahora está disponible en inmuebles de una sola planta.
- Fuera de la cubierta, la IA puede introducir pequeñas diferencias respecto a la imagen aceptada; la revisión las busca, pero compara tú ambas imágenes antes de aceptar.

## Control de los cambios

En **Diseño de la imagen**, elige **Respetar diseño actual** o **Rediseñar interiorismo**. Si eliges rediseñar o lo pides en el objetivo o las instrucciones, se exige un cambio reconocible de interiorismo, formas, acabados o muebles móviles; mejorar solo la luz o la textura de la misma composición no basta. La captura fija la distribución y los huecos. **Rediseño de fijos** autoriza además sustituir cocina, isla, sanitarios y armarios empotrados dentro del ámbito elegido; no autoriza mover muros.

Al activar rediseño en un lote de varias vistas, las siguientes utilizan una vista aceptada como referencia de acabados y mobiliario. Comprueba su continuidad: la referencia ayuda a mantener el nuevo diseño, pero la IA aún puede equivocarse. La auditoría rechaza una copia sin cambio reconocible cuando se pide rediseñar.

- **Estricto** reproduce los elementos existentes con pocas libertades.
- **Controlado** permite decoración en las categorías autorizadas conservando la geometría.
- **Libre** permite decorar y ambientar según el uso de cada estancia, sin construir ni cerrar espacios.
- En la **Cenital** de toda la planta, **Estricto** conserva solo el mobiliario dibujado, **Controlado** añade únicamente las categorías marcadas (sin ninguna, no añade objetos) y **Libre** completa la decoración.
- Autoriza expresamente el rediseño de elementos fijos si quieres cambiarlos.
- Los ajustes reutilizables ayudan a repetir tus preferencias; comprueba el contexto de cada inmueble.

:::note
El plano y su 3D son guías de geometría y medidas. Los vídeos y visitas finales deben conservar los renders IA aceptados, con sus muebles y acabados, aunque difieran del plano guía. No se ofrecen grabaciones del 3D como alternativa al diseño final.
:::

## Preparar cobertura para un vídeo

Genera exteriores y vistas interiores a altura de ojos de cada estancia. Un dron, una isométrica o una cenital no sustituyen un paseo interior. Mantén la misma versión, estilo y luz.

Desde **Vídeos → Primera persona → Revisar y aceptar diseños interiores**, abre los diseños finales existentes. Solo puede elegirse un interior IA aceptado y compatible. Crear una captura del plano no cumple ese requisito. Derivar nuevos interiores desde otras vistas aceptadas sigue pendiente. Consulta [el piloto de primera persona](/videos/recorrido/#primera-persona-desde-tus-diseños-piloto-de-una-estancia).

## Revisar antes de aceptar

En **Diseñar con IA**, el teclado permanece dentro de la ventana abierta. **Tab** y **Mayús+Tab** recorren sus controles; al cerrar, el foco vuelve al control que la abrió. Las vistas ampliadas de referencia tienen un botón **Cerrar vista ampliada**. **Escape** cierra primero la vista ampliada o el desplegable activo y permite seguir en el estudio. El cierre del estudio permanece bloqueado mientras prepara o genera; durante una tanda puedes usar **Parar tras actual**.

Abre una imagen en **Diseños** o en **Diseños de esta tanda**, durante la generación, y pulsa **Aceptar este diseño** solo después de comprobar su arquitectura, mobiliario, acabados e hiperrealismo. Se registra tu decisión de forma independiente de la auditoría automática; el panel muestra la fecha y hora de aceptación en UTC. **Retirar aceptación** impide nuevos vídeos y anuncios desde esa imagen; no elimina archivos ya guardados. Una variante nueva requiere otra aceptación. Las imágenes antiguas sin aceptación registrada deben revisarse: no se aceptan automáticamente ni se cobran por aceptarlas.

Las miniaturas indican **Pendiente de revisar**, **Aceptado**, **Descartado** o **Solo referencia**. Cada tanda resume esos estados y muestra la revisión del plano con la que se generó. **Aceptado** registra tu decisión; para vídeo se comprueba además que las referencias sean compatibles. Una imagen descartada conserva su motivo y no puede aceptarse. Las imágenes nativas o sin origen IA registrado se muestran como **Solo referencia** y no sirven como diseño final.

En el visor, **Criterios de la revisión visual** muestra arquitectura y proporciones, uso de estancias, puertas y ventanas, circulación, realismo, identidad del mobiliario y cambios solicitados. Cada criterio incluye la observación del auditor; puedes desplegar el detalle por estancia y hueco. También se identifica el modelo que generó la imagen. Los informes antiguos avisan cuando no guardaron esos criterios: no se inventa una valoración retrospectiva.

Los nuevos informes incluyen **Zonas comunicadas sin puerta** y **Construcciones añadidas**. La revisión registra qué tipo de hueco observa y si el giro queda libre. Si detecta una hoja donde el plano tiene un paso sin puerta, un choque o una construcción no autorizada, el resultado queda descartado aunque su valoración global fuera favorable. Estos controles no se añaden retroactivamente a imágenes antiguas ni garantizan que la IA detecte todos los errores.

También puedes desplegar **Terreno, cerramientos y objetos exteriores**. La revisión exige comprobar cada superficie, tramo de cerco y objeto exterior del inventario. Un césped cambiado por tierra, un cerco perdido o un coche convertido en un bloque debe descartar la imagen aunque el resumen indique que cumple. Una capa completamente cubierta por otra superficie o un elemento fuera de una cámara parcial puede figurar como **Fuera de vista**; en la cenital completa no se admite esa explicación para vehículos, cercos o superficies que la referencia muestra. Los informes y las imágenes anteriores no se corrigen automáticamente: esta comprobación se aplica al generar o revisar de nuevo. La revisión automática sigue requiriendo tu comprobación visual y aceptación explícita.

Si hay un descarte registrado por **Comprobación visual adicional**, su motivo aparece junto al estado del diseño, separado del informe automático. Así puedes distinguir un defecto comprobado después de las observaciones del modelo, que pueden ser erróneas. El informe anterior se conserva.

Los fallos y dudas aparecen primero. Se muestran por separado el modelo de imagen y el de revisión cuando están registrados. El perfil administrativo **Validación arquitectónica GPT 2.5** utiliza Sunburst para generar y Sonnet 5 para revisar; cambiar de modelo no garantiza un resultado válido. La configuración y su coste estimado se revisan antes de generar.

La fiabilidad que aparece antes de generar corresponde al **plano**, no al realismo del resultado. En las nuevas revisiones cenitales de alta resolución se examinan además ampliaciones de la candidata. En frontal, trasera y laterales, una puerta del fondo cuyo giro no puede comprobarse desde el corte ya no descarta la imagen; un giro bloqueado sí. Un criterio fallido o no verificable impide aceptar el diseño: el resultado con informe completo se conserva como **Descartado**, con sus motivos, para poder revisarlo. Esto no garantiza que el auditor detecte todos los defectos; la aceptación final sigue siendo tuya.

Un diseño aceptado ofrece **Preparar vídeo con mis diseños** para abrir Vídeos en la misma zona del proyecto. Allí eliges modalidad y referencias compatibles; este enlace no inicia una generación.

Comprueba muros, distribución, puertas, ventanas, suelos, muebles relevantes y pérgolas. Rechaza pérdida o deformación de elementos aunque la imagen resulte atractiva. La vista debe mantener la identidad completa de la casa.

Si una imagen de la tanda se rechaza por fidelidad, revisa o regenera esa vista; las demás pueden continuar. Revisa también los avisos de cobertura por ambiente al preparar el montaje.

Los avisos del lote identifican cada vista que falló, incluidos los descartes anteriores al error que detuvo la tanda. Si falla la cenital, **Exterior terminado** puede quedar bloqueado antes de generar porque necesita una cenital válida del mismo diseño.

Los nuevos resultados que fallen la comprobación inicial de encuadre también se conservan como **Descartados** para abrirlos y compararlos con la referencia. Su informe indica que los demás criterios visuales no se han evaluado; no pueden aceptarse ni usarse en vídeo. Guardar el descarte no inicia otra generación ni recupera automáticamente los resultados de tandas anteriores.

Ese requisito incluye la misma selección: **Toda la planta**, **Solo la casa** y **Zonas concretas** no son intercambiables. Aunque tengas una cenital, cambiar el ámbito, la planta, la luz o los permisos puede hacerla incompatible. Recupera la tanda original para conservar sus ajustes; consulta [el bloqueo del exterior](/ayuda/problemas/#exterior-terminado-pide-una-cenital-que-ya-tengo).

La auditoría automática puede dejar pasar errores o rechazar una imagen fiel. Compara cualquier aviso de elementos añadidos con la captura original: un descansillo o una superficie blanca ya modelados no son elementos nuevos. Comprueba también que las camas siguen siendo camas y que las placas de cocina no se convierten en decoración. Una imagen descartada en una revisión posterior queda desactivada para construcción y se excluye del montaje y de las referencias de nuevas vistas. Se conserva en la galería; no existe todavía un botón de revisión posterior en ella. Reintentar una generación puede volver a consumir dinero.

## Dónde encontrar las imágenes

### Elegir una referencia de la biblioteca

Si ya tienes una buena cenital guardada, no necesitas descargarla y subirla como PNG. Después de **Preparar vistas**, abre **Elegir de la biblioteca** en **Referencia cenital del diseño** para frontal, trasera, laterales, isométrica o exterior. Para **Dron**, el selector pide una isométrica aceptada del mismo diseño.

1. Abre **Ver imagen y aceptación** y comprueba el diseño. Puedes abrir la imagen a tamaño completo.
2. Si está pendiente y la consideras correcta, pulsa **Aceptar este diseño**. La selección nunca acepta por ti; una imagen descartada no puede utilizarse.
3. Pulsa **Usar como referencia** y continúa con la generación de las vistas preparadas. **Quitar selección** vuelve a la búsqueda automática de una referencia aceptada compatible.

La biblioteca muestra imágenes del mismo proyecto y zona, su estado y las diferencias de luz, planta, ámbito, libertad, zonas de colocación o permiso de rediseño. El plano actual debe corresponder al que originó la imagen. Si hay diferencias, ajusta las opciones y prepara de nuevo las vistas antes de elegirla. **Ver más imágenes** permite buscar resultados anteriores. El servidor vuelve a comprobar la selección al generar; si ya no es válida, detiene la operación sin sustituirla por otra imagen.

Cuando solo difieren los ajustes recuperables de una imagen aceptada, pulsa **Usar ajustes de esta referencia**. Se recuperan luz, libertad, ámbito, zonas de colocación y permiso de rediseño de fijos, manteniendo los ángulos que has pedido. Vuelve a pulsar **Ver vistas de referencia**; la imagen elegida se conserva. Este botón no corrige un plano diferente ni cambia la planta activa.

Consultar la biblioteca, aceptar y seleccionar no consume créditos. Generar las nuevas vistas sí tiene coste. Elegir el diseño no sustituye la ortofoto que requieren el dron y el exterior.

### Revisar una imagen existente sin regenerarla

Después de preparar las vistas, abre **Opcional: revisar un PNG externo**. Elige la cámara que corresponde a tu archivo, carga un PNG de hasta 10 MB y pulsa **Revisar y guardar imagen existente**. Se conserva el ámbito y la tanda de la preparación; el archivo debe corresponder al diseño actual y a esa cámara. Para reutilizar un diseño guardado como referencia, usa la biblioteca descrita arriba.

La revisión visual con IA tiene coste, pero no solicita otra imagen al generador. Aplica los mismos controles de cámara, arquitectura, muebles y ámbito: solo guarda el archivo si los supera. Una imagen importada se identifica como tal; esta opción no convierte una captura del 3D en un diseño profesional ni permite saltarse un rechazo.

### Completar una tanda

Desde **Vídeos → Construcción**, despliega **Zonas incluidas y más vistas** y pulsa **Completar vistas de la tanda** para recuperar una tanda de ángulos generales después de cerrar el panel. Se conservan las imágenes válidas y se preparan solo las vistas ausentes o descartadas, con el mismo ámbito, luz y permisos. Preparar no consume IA; generar las pendientes sí.

Guardar una imagen actualiza las galerías y mantiene abierto el panel con sus capturas y ajustes mientras termina la tanda. Si vuelves a abrir **Diseñar con IA** desde su botón normal, comienza una preparación nueva.

Puedes desmarcar cámaras para completar la tanda por partes y ajustar el gasto de cada paso. Cambiar únicamente los ángulos conserva la tanda; cambiar luz, ámbito o permisos inicia otra.

Las instrucciones libres anteriores no se recuperan: revísalas antes de generar. Cambiar otros ajustes además de los ángulos prepara una nueva tanda; si el diseño ya no coincide, la aplicación pide una nueva. Las cámaras interiores y la vista actual deben prepararse de nuevo.

Cada tanda aparece en **un único bloque de galería**, tanto durante la generación como en **Diseños**. El título identifica la zona, estancia o ámbito, distinguiendo **Solo la casa** de **Toda la planta**. Cada miniatura indica **Frontal**, **Trasera**, **Izquierda**, **Derecha**, **Cenital**, **Isométrica**, **Dron**, **Exterior terminado** o cámara interior. Los resultados antiguos sin esos datos se identifican como **Vista sin registrar** o **Ámbito sin registrar**.

Pulsa una imagen para abrirla en grande. En escritorio, la imagen queda junto al panel **Revisar diseño** y **Acciones de imagen**; en pantallas estrechas, el panel aparece debajo y puedes desplazarte por él. Solo dentro de ese modal aparecen **Aceptar este diseño**, **Usar como fondo del plano**, **Descargar imagen**, **Pedir cambios** y **Generar variante**. Pedir cambios y generar variantes pueden consumir créditos según la operación.

Usa los botones de imagen anterior/siguiente o las flechas izquierda/derecha del teclado para recorrer la tanda. Mientras escribes una petición de cambios, las flechas conservan su función de edición. **Escape** cierra la imagen y devuelve el foco a su miniatura; si la abriste desde el generador, este permanece abierto.

El fondo es una referencia auxiliar del plano 2D: no sustituye los muros ni incorpora la decoración al modelo 3D. Se conserva con el plano y su imagen se vuelve a cargar con una URL vigente.

**Historial** conserva resultados anteriores. Para montar la selección, abre [Montaje de imágenes](/videos/montaje-imagenes/).
