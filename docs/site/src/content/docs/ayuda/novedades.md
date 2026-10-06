---
title: Estado y novedades
description: Funciones implementadas y trabajo pendiente.
---

## En desarrollo — Constructor y navegación visual

- **Precios rellenados solos:** al habilitar un modelo de KIE o APIMart, su precio de entrada se toma de la API de precios del proveedor, como ya pasaba con OpenRouter, y se ve junto a cada modelo de la lista. La lista de modelos Claude de KIE también sale de ahí.
- **Claude por KIE o APIMart ya devuelve resultados legibles:** con Sonnet 5 en KIE o APIMart, el asistente fallaba con «La salida no es JSON válido contra el schema» porque esos proveedores no aplicaban el formato pedido y el modelo contestaba en texto libre. Ahora se le obliga a responder con los campos exactos. Las imágenes que se envían a Claude por KIE se reducen a 2000 px y se mandan siempre dentro de la petición: con las originales KIE respondía «413» (petición demasiado grande) y no podía abrir las del almacenamiento local.
- **Claude Sonnet 5 a través de KIE:** con tu clave de KIE puedes habilitar sus modelos Claude (Sonnet 5, Opus y otros) para **Análisis visual**, **Asistente**, **Interpretación de planos** y **Memoria**, y elegirlos en **Modelos por uso** en el grupo **KIE · Claude**. Admiten imágenes, así que sirven para importar planos y **Amueblar**. El coste que descuenta KIE se registra en cada llamada. Consulta [Proveedores y modelos de IA](/admin/proveedores-ia/).
- **Proveedores de IA propios, con APIMart preparado:** quien administra Habiteka puede añadir cualquier proveedor compatible con OpenAI (por ejemplo, NodeClub.ai) con su URL base y su API key, probar la conexión y habilitar sus modelos de texto y visión con su precio (0 si van incluidos en una suscripción). Después se eligen en **Modelos por uso** como primario o respaldo. APIMart ya viene configurado: solo hay que pegar la clave. Consulta [Proveedores y modelos de IA](/admin/proveedores-ia/).
- **Los muebles de pared se giran solos hacia el muro:** al colocar o arrastrar un armario, sofá, cama, cómoda, sanitario o electrodoméstico cerca de una pared, se orienta con la trasera contra ella, como las puertas y ventanas. Ya no hace falta girarlo antes ni apartar otros muebles para tener sitio. Funciona con **Ajuste** activo; mesas, sillas, alfombras y plantas no se giran. La pieza recuerda su orientación mientras siga junto a su pared, así que un armario en horizontal ya no salta a la pared lateral en un rincón.
- **Alfombras y sillas debajo, y el original oculto se recuerda:** en la vista cenital la alfombra queda bajo el sofá y la mesa y las sillas bajo la mesa. **Amueblar** mete las sillas unos 20 cm bajo el tablero y pone la alfombra del salón bajo el frente del sofá y la mesa de centro, y la del comedor centrada bajo la mesa. **Ocultar original** se mantiene al recargar.
- **Amueblar reproduce tu boceto:** si importaste el plano desde un dibujo, **Amueblar** coloca los muebles que dibujaste (camas, armarios, sofá, mueble de TV, sanitarios, lavadora, encimera de la cocina, mesas con sus sillas) en la misma estancia, contra la misma pared y en el mismo sitio, aunque importaras el plano sin muebles. Elige la pieza del catálogo según el estilo y después completa lo que falte (mesillas, lámparas, decoración). La cocina va en las paredes donde dibujaste la encimera y la nevera puede ir aparte; una cama dibujada bajo la ventana se queda ahí. Hay una nueva **Mesa de cocina** de cuatro plazas.
- **Amueblar monta la cocina, los baños y los conjuntos:** la cocina ya no sale en módulos sueltos repartidos por la estancia. Es un mueble de cocina continuo, en lineal o en L por las paredes libres, con encimera, zócalo, armarios altos (que se omiten sobre las ventanas) y fregadero, lavavajillas, placa, horno y nevera de columna en orden de trabajo; en la revisión aparece como «Cocina de 3,5 m (…)» y se puede desmarcar. En los baños, si lo que propone la IA no cabe entero, los sanitarios se recolocan desde las esquinas, la bañera que no cabe pasa a ducha y un inodoro siempre lleva lavabo. Las sillas se reparten alrededor de la mesa de comedor, las mesillas a los lados de cada cabecero (la cama se desliza por su pared para dejarles sitio) y la mesa de centro delante del sofá. Una cama, un sofá, un armario o un sanitario que no cabe en la pared elegida prueba las demás de la estancia y, si hace falta, una pieza más pequeña. Ya no aparece una planta encima de la cama: solo se apoyan objetos pequeños sobre mesillas, mesas, aparadores o encimeras, y una lámpara de mesa va a la mesilla más cercana. Las plantas se arriman a la pared y un taburete sin isla no se coloca. Una cama con el cabecero bajo una ventana pasa a una pared ciega del dormitorio si cabe con una mesilla, y el mueble de la tele se coloca enfrente del sofá. Si la corrección de Jev deja una estancia sin cama, sofá, mesa, sanitario o armario, esa estancia se queda como en la primera propuesta.
- **Amueblar coloca de verdad toda la vivienda:** antes descartaba casi todo (de 43 piezas propuestas quedaban 10) y dejaba dormitorios sin cama, el salón sin sofá y la cocina vacía. La IA ya no calcula coordenadas: elige la pared y el punto de cada mueble, y el sistema lo arrima a la cara interior del muro con la trasera contra él (cabecero, respaldo, cisterna, fondo del armario o de la cocina). Si una pieza queda a pocos centímetros de un sitio válido, se desliza a lo largo de su pared sin salir de su estancia. Las sillas tocan su mesa, una alfombra puede pisar el paso de una puerta fuera del giro de la hoja y los huecos de paso sin puerta también quedan libres. Primero se colocan camas, sofás, cocina, sanitarios, armarios y mesas, y la decoración al final. Si Jev señala una pieza y la corrección no trae un sustituto válido, se conserva la original. Cada estancia lleva todos sus rótulos (por ejemplo, «Lavadero y Pasillo» si no hay tabique entre ellos), y los acabados siguen el estilo elegido. Una propuesta de toda la casa tarda alrededor de un minuto y sale por unos 0,22 $. En la planta, las alfombras se dibujan debajo de los muebles.
- **Suelo y paredes por estancia, y fachada aparte:** la propuesta ya no pone un único material en todas las paredes, por dentro y por fuera, ni el mismo suelo en el baño que en el dormitorio. Elige suelo y paredes para cada estancia según su uso, y un material de fachada para las caras exteriores. Antes de aplicar se pueden cambiar en la revisión.
- **Plano sin saltos al recargar:** el plano 2D ya no aparece primero sin encuadrar y en modo normal para cambiar al instante al modo comparación con el original. Se muestra una sola vez, encuadrado y con el original cargado. Si la imagen del original falla o tarda más de 2,5 s, el plano aparece sin ella.
- **Diseñar con IA según la vista y Amueblar que amuebla:** desde **Plano 2D** el botón abre **Diseñar el plano** sin pasar al 3D, con la planta 2D como vista previa; desde **Amueblado** o **Modelo 3D**, **Crear imágenes**, que recuerda que los vídeos vienen después. La primera prueba real de **Amueblar** dejó solo plantas porque cada puerta reservaba un cuadrado de unos 2,4 m y descartaba camas, armarios, sofás, mesas y cocina. Ahora reserva solo su ancho y la profundidad de su hoja más 20 cm. La corrección ya no reescribe la vivienda entera, que agotaba el límite: propone solo sustitutos. Si una propuesta muy grande agota el límite de respuesta, el aviso lo dice y sugiere un ámbito más pequeño.
- **Primero diseñar el plano, después las imágenes:** el estudio empieza por **1. Diseñar el plano** (sin imágenes) y sigue con **2. Crear imágenes**. Sus modos son **Amueblar** (por defecto, ahora también sanitarios, cocina, electrodomésticos y lavadora), **Solo categorías** y **Acabados**, y se pueden limitar a un área: estancias concretas, exterior y fachada, o una zona dibujada. Pendientes: unificar materiales de muebles en **Acabados** y un modo **Reordenar** que mueva los muebles existentes.
- **Propuesta de muebles sobre la planta y revisada por Jev:** **Diseñar el plano** envía solo el plano 2D cenital con el giro de las puertas, sin alzados ni la vista de referencia, que desaparece del estudio. Jev revisa la distribución dibujada (cabeceros contra muro, puertas y pasos libres, sofás orientados) y la IA corrige la propuesta una vez si encuentra problemas. Ya no hay un máximo de 8 objetos: la propuesta amuebla cada estancia por completo y solo repite lo que el uso exige. Pendiente: ampliar el catálogo de decoración (espejos, cuadros, más jarrones y tipos de puerta) para que no se repitan piezas.
- **Muebles del editor como diseño base:** la cenital dibuja las camas con sus almohadas y los sofás con su respaldo, y los alzados dibujan esos mismos muebles según cómo los ve cada cámara (de espaldas, de frente o de perfil). Con muebles en el plano, ninguna vista tiene que adivinar su orientación. El boceto original del plano no se envía al generador. Pendiente de probar con una cenital nueva generada con muebles.
- **Zonas sin duplicados y propuesta que responde:** pulsar otra vez una estancia ya marcada la quita de las zonas permitidas o elige la zona guardada, en lugar de repetirla. **Proponer acabados y muebles con IA** dejaba de responder con «El modelo agotó el límite de respuesta»; ahora acota el razonamiento del modelo y reserva salida para el diseño.
- **Alzados como maqueta abierta y personas:** frontal, trasera y laterales de toda la planta parten de una sección 2D sin la fachada de ese lado, a la altura de los ojos, con el interiorismo de la cenital aceptada. Nueva opción **Personas** en el estudio de diseño para cenitales y alzados. Las instrucciones piden que los muebles mantengan la orientación de la cenital: una cama con el cabecero en la fachada retirada debe verse de espaldas. La primera prueba de esta regla convirtió la trasera y la derecha en vistas aéreas; la versión reformulada devolvió una sección, pero con la cocina y la entrada en lugar del salón y el dormitorio 2, y sigue pendiente de validar. Corregido el orden de las estancias de la izquierda: el lavadero, unido al pasillo, se anunciaba en segundo lugar en vez de al final. La revisión automática exige ahora todas las estancias del corte en su orden. Antes de generar cada alzado, una lectura de la cenital aceptada describe cómo se verá el mobiliario de cada estancia desde esa cámara; tiene un pequeño coste de visión adicional. En la prueba, la sección frontal con personas reprodujo cocina, entrada y comedor; falta validarlo en la aplicación con las cuatro vistas.
- **Cenital desde el plano:** la cenital de toda la planta parte del plano 2D con instrucciones breves, como en la prueba directa con el mismo generador, que dio un resultado más nítido y realista que la captura 3D con instrucciones largas. En la aplicación, las cenitales de día y de noche superaron la revisión.
- **Rótulos recolocados sin perder diseños:** mover el rótulo de una estancia dentro de ella ya no invalida las imágenes aceptadas ni su uso en vídeo. Cambiarlo de estancia o de nombre sigue exigiendo diseños nuevos.
- **Laterales con el diseño aceptado:** frontal, trasera, izquierda y derecha exigen una cenital aceptada del mismo diseño, ámbito, luz, libertad y permiso de rediseño. Reproducen su mobiliario y acabados, y la revisión descarta un interiorismo distinto. Sus capturas para diseñar ocultan el tejado y acercan la cámara para que la casa ocupe más imagen. La tanda prepara la cenital antes que estas vistas, y la cenital se envía recortada a las estancias de esa cámara y girada según ella. En la prueba real, frontal, izquierda, trasera y derecha llegaron a reproducir el diseño aceptado; la derecha lo consiguió al recortar la cenital. Los resultados varían entre intentos y algunos siguen descartándose por puertas o fondos simplificados.
- **Referencias por ángulo:** frontal, trasera, laterales y vistas oblicuas reciben su propia captura y una copia anotada en esa misma cámara con los usos localizados. Se comprueban ocultaciones por la estructura y el recorte de zonas. La salida adopta el formato de la captura sin deformarla. Las pruebas frontal y trasera conservaron cámara y usos; los dos laterales se descartaron por cambios arquitectónicos. La guía distingue ahora las estancias vistas a través de un hueco, marcadas **Al fondo**. Esta última corrección tiene pruebas locales, pero falta validar su resultado con IA; las oblicuas tampoco tienen una prueba real. No supone aceptación ni una validación completa del diseño.
- **Nombres legibles en las guías laterales:** los rótulos de estancias estrechas se separan y se conectan con su punto mediante una línea; no cambian la cámara ni la ubicación del espacio.
- **Descartes de encuadre visibles:** las nuevas imágenes rechazadas por recorte o desplazamiento se conservan con el motivo, sin simular una auditoría visual completa ni permitir su aceptación o uso en vídeo.
- **Instrucciones al crear diseños:** la evaluación distingue las preferencias y reglas de conservación de las peticiones de edición. Recibe el ámbito y las opciones del estudio para interpretar indicaciones generales sin exigir un objeto que cambiar. Las evaluaciones antiguas no se reutilizan para este flujo.
- **Ángulos sin saltos del diálogo:** al marcar Dron, Isométrica, Izquierda o Derecha, el foco permanece en las casillas del panel; ya no desplaza el marco entero ni oculta los controles del estudio.

- **Contexto cercano en los retoques:** las selecciones pequeñas se envían ampliadas con su entorno y se reintegran en la imagen completa, conservando los píxeles fuera del área marcada. Crear una versión ya no se presenta como confirmación de que el defecto quedó resuelto. La prueba real ha detectado cambios en una ubicación equivocada: la protección conserva el exterior, pero la corrección local sigue sin estar resuelta y requiere revisión.

- **Peticiones sobre una zona marcada:** la evaluación recibe la selección que se usará en el retoque y contempla frases que describen defectos, como «aquí falta una puerta». Restaurar una hoja omitida se distingue de crear un nuevo acceso. Al cambiar de zona se reevalúa la petición; los rechazos guardados con el criterio anterior no se reutilizan.

- **Retoques por zona sobre la cenital completa:** en **Pedir cambios**, selecciona un rectángulo sobre el detalle. El resto de la imagen conserva los píxeles originales; hay controles de teclado y una opción explícita **Toda la imagen** para cambios generales. Cada retoque crea otra versión y requiere revisar el detalle y sus bordes. La generación inicial sigue partiendo de toda la planta; no une habitaciones generadas por separado.

- **Retoques con imágenes locales:** Pedir cambios mediante KIE puede preparar la referencia desde el almacenamiento local, igual que la generación inicial, sin exigir que ese almacenamiento tenga una URL pública HTTPS.
- **Motivo de revisión adicional:** un descarte por comprobación visual posterior muestra su motivo aunque exista un informe automático; ambos quedan diferenciados y se conserva la evaluación original.
- **Pasos abiertos y giro de puertas:** la guía de generación distingue huecos sin hoja, usos que comparten un recinto y el barrido de las puertas. La revisión registra el tipo observado y los choques; añade controles de zonas comunicadas y construcciones no autorizadas. Un patio vacío no autoriza una piscina. Pedir cambios recibe este contexto y permite solicitar correcciones locales explícitas, conservando la imagen anterior y el plano. Sigue pendiente comprobar visualmente cada resultado nuevo.
- **Criterios visibles de los diseños:** el visor muestra siete criterios con observaciones, detalle por estancia y hueco y el modelo de imagen. La auditoría cenital examina ampliaciones; los fallos y dudas no se compensan con un aprobado global. Los descartes con informe completo se conservan para revisión y quedan bloqueados para aceptación y vídeo. La fiabilidad previa se identifica como revisión del plano. Los informes antiguos muestran sus límites.
- **Perfil de validación arquitectónica:** utiliza Sunburst para imágenes y Sonnet 5 para la revisión visual. El visor distingue ambos modelos y muestra primero los criterios fallidos o no verificables. El cambio de modelo no sustituye la comprobación visual ni tu aceptación.
- **Fidelidad de las imágenes:** la generación inicial recibe un mapa de usos de las estancias y medidas de puertas y huecos. La revisión exige resultados por elemento y controles de circulación y realismo. Las puertas con huecos inferiores a 65 cm se pueden localizar para revisar su ancho; las versiones retocadas ya no heredan la aceptación ni la auditoría de otra imagen. La validación visual de nuevos resultados sigue pendiente de cada generación y de la aceptación del usuario.

- **Controles del estudio de diseño:** selección de ámbito en verde y casillas compartidas de marca para la revisión, decoración y vistas. Las tres opciones de ámbito se alinean y se apilan en pantallas estrechas.

- **Revisión de importación guardada:** confirmar la comparación con el original se conserva para la geometría revisada, sin repetirla al reabrir el diálogo. Los cambios de geometría o escala la invalidan y los bloqueos actuales siguen vigentes.

- **Avisos de importación y estado actual:** las dimensiones extraídas no se describen como cotas verificadas. Cuando la estructura editada permite continuar, se explica la comparación pendiente con el original sin repetir cifras ni instrucciones antiguas como defectos actuales.

- **Cambios con contexto del plano:** la evaluación y el retoque de los diseños del Editor reciben nombres y ubicaciones de las estancias. Las nuevas versiones conservan cámara y referencia de generación, y se recuperan referencias de versiones anteriores cuando es posible.

- **Localizar problemas del plano:** Ver en el plano atiende el centrado al volver desde 3D y señala los extremos sueltos en rojo. El control del plano original y su opacidad pasan a la barra superior.

- **Avisos al diseñar con IA:** una evaluación con porcentaje ya no se presenta como un fallo automático. La confirmación para continuar es visible y la revisión opcional de un PNG existente aparece plegada con instrucciones.

- **Duplicar huecos al arrastrar:** Option/Alt + arrastrar puertas, ventanas y huecos en Plano 2D coloca una copia en el muro de destino conservando el original. Se valida la holgura y se rechazan los solapamientos.

- **Menú y duplicación por arrastre:** el menú de selección del plano 2D permanece visible con Propiedades abierto. Option/Alt + arrastrar duplica paredes y objetos conservando el original; en Amueblado también admite terreno y pavimento.

- **Doble clic y portapapeles:** doble clic sobre un elemento abre Propiedades en las tres vistas. Pulsar el lienzo recupera el foco de teclado desde los campos; ⌘/Ctrl+C y ⌘/Ctrl+V también copian y colocan puertas, ventanas y huecos sobre un muro.

- **Original en el Editor:** guardar una nueva revisión de la importación ya no oculta Mostrar/Ocultar original. La referencia puede consultarse sin reenviar el plano ni sustituir las ediciones del Editor del proyecto.

- **Propiedades de puerta en la revisión:** deslizadores de ancho y posición junto a los campos numéricos; se elimina el listado duplicado de puertas y arcos. Los motivos de fiabilidad repetidos se muestran una sola vez, incluso en revisiones guardadas anteriormente.

- **Revisión del plano importado:** original de fondo también en Muros y medidas; selección de puertas y muros con propiedades, ancho del hueco, extremos de muro arrastrables y deshacer de geometría. Guardar revisión conserva las correcciones en el proyecto sin evaluación IA de pago. La revisión aplicada continúa en el Editor con el original como referencia.

- **Restablecer muestra:** reinicia el documento y la sesión de la muestra local, cancela tareas pendientes, cierra paneles y vuelve a Plano 2D encuadrado. Confirma la acción y permite recuperar el documento anterior con Deshacer.
- **Construir y Exterior:** miniaturas realistas en las doce categorías de construcción y en Añadir terreno/Añadir pavimento. Los filtros de Exterior se separan en filas, con espacio antes de los resultados; el buscador de Propiedades elimina el doble borde y se distingue del selector de elementos.
- **Terreno y pavimento:** ocho tiradores para redimensionar, control central de movimiento y ajuste magnético con guías en Plano 2D y Amueblado. Las superficies también admiten marco de selección y movimiento con flechas en Plano 2D. Los tiradores de otros objetos del plano incorporan ajuste magnético.
- **Medir:** instrucciones del gesto, distancia durante el arrastre y cota seleccionada al terminar. La distancia se consulta en Propiedades y las cotas aparecen en el buscador de elementos, incluso si un filtro las oculta al quitar la selección.
- **Imágenes del catálogo:** miniaturas realistas propias para nueve habitaciones y doce categorías. Son imágenes genéricas de navegación, con las fichas y dimensiones de los modelos conservadas.
- **Teclado y ventanas:** el estudio de diseño y las vistas ampliadas retienen el foco, incluyen un cierre visible y devuelven el foco al control de origen. Escape cierra el nivel activo. Las pestañas Crear vídeo/Vídeos guardados se recorren con flechas y los accesos internos enfocan la pestaña de destino.
- **Diseños y generación:** miniaturas con estado de revisión, resumen por tanda y revisión del plano. El visor reúne imagen, aceptación con fecha y acciones en un panel lateral en escritorio, debajo en pantalla estrecha. Escape cierra solo la imagen y las flechas recorren la tanda sin interferir al escribir cambios. Los ámbitos distinguen Solo la casa, Toda la planta y zonas o estancias concretas.
- **Lienzo y vistas:** paneles junto al lienzo o debajo en pantalla estrecha; controles de cámara accesibles. Cambiar de vista conserva la selección y Propiedades. Amueblado incorpora zoom, encuadre y Mano; editar medidas ya no reinicia la cámara 3D.
- **Colocación continua:** Mano conserva la tarea activa, los objetos pendientes pueden pasar entre Plano 2D y Amueblado y cuentan con Cancelar colocación. Escape cancela el objeto sin cerrar el catálogo. Las vistas incompatibles con la herramienta actual se deshabilitan hasta finalizarla.
- **Propiedades y selección:** panel persistente con Medidas, Acabados y Notas según el elemento. Dimensiones antes que posición y giro; acciones de pared, hueco y mueble reunidas. La barra inferior muestra un resumen y el menú del lienzo se oculta al abrir Propiedades. Buscar un elemento ya no cierra el panel.
- **Selección múltiple más clara:** campos comunes con alcance explícito, aviso de valores del primer elemento y acceso a cada elemento de una selección mixta. Se conservan la validación de medidas y deshacer.
- Catálogo **Amueblar** por habitaciones y categorías, búsqueda, variantes y filtros de estancia/estilo. Permanece abierto al trabajar sobre el lienzo.
- **Construir** organiza la estructura por tarjetas con iconos; **Exterior** ofrece acceso directo a jardín, terreno y pavimento.
- Cabecera con planta, historial de edición, guardado, **Vídeos** y **Diseñar con IA**. **Herramientas** reúne preparación, parcela, tejado y aprobación. Vistas: **Plano 2D**, **Amueblado** y **Modelo 3D**.
- Asistente y entrada del plano con tarjetas visuales y pasos diferenciados. Navegación del proyecto con iconos y sección activa visible.
- Cursor de mano en botones, enlaces, tarjetas clicables y desplegables, incluidas sus opciones. Los estados deshabilitados conservan su indicación visual.

## En desarrollo — Publicidad y primera persona desde diseños

- **Continuidad del estudio:** acceso a Vídeos desde una imagen aceptada, actualización de diseños y tareas, y salidas directas a Vídeos guardados y al selector de publicidad. La preparación explica su bloqueo y detecta mezclas de tandas antes de continuar. El montaje se ordena en selección, ajustes y revisión; los estados vacíos distinguen aprobación pendiente y fuentes incompatibles, sin proponer vídeos del plano 3D.
- **Vídeos como página independiente**: conserva las pestañas del proyecto y ofrece **Volver al editor** y **Mis diseños**. Entrar o aprobar en el editor ya no cambia automáticamente a la guía aprobada.
- **Preparación más clara**: construcción y primera persona se ordenan en elegir diseños, ajustar el vídeo y revisar antes de generar. Las imágenes incompatibles, la limpieza y los ajustes de calidad/sonido se despliegan cuando hacen falta. La pieza combinada aparece como pendiente.
- **Revisión del plano**: muestra **Plano 2D**, **Modelo 3D** y un regreso explícito al editor. Los detalles de objetos aproximados y techos se agrupan en un apartado desplegable; los recorridos se activan por elección del usuario.

- **Crear vídeo**: nombre opcional antes de crear y **Cambiar nombre** para resultados guardados. El selector de originales de publicidad utiliza esos nombres.
- **Mis diseños**: limpieza individual desde la miniatura o por selección, incluidas imágenes rechazadas; papelera con restauración. Los vídeos guardados permanecen disponibles.
- **Diseños como fuente obligatoria**: vídeos, primera persona e inmersión final parten de renders IA aceptados por el usuario. El plano y su 3D son guías; se retiran las opciones de grabación nativa y visita libre 3D. Las muestras históricas se conservan y no sirven como originales de publicidad.
- **Aceptar este diseño**, en el modal de cada imagen, registra tu decisión; **Retirar aceptación** bloquea nuevos usos. No se aceptan imágenes antiguas automáticamente. La comprobación se repite antes de preparar/enviar H3 o guardar un montaje/anuncio.
- **Primera persona** prepara una toma H3 de 8/12 s desde un interior IA aceptado con cámara verificable, misma luz, paredes y techo completos. **Revisar y aceptar diseños interiores** abre la galería. Derivar nuevos interiores desde otras vistas aceptadas, el paseo virtual continuo y la pieza combinada siguen pendientes; no se sustituyen por el plano.

- **Publicidad**: formato horizontal 16:9 o vertical 9:16, con panel de ancho, fondo y altura del diseño aprobado. Medidas animadas, solo al inicio, fijas o desactivadas. Vista previa antes de guardar o descargar.
- **Publicidad → Vídeo guardado**: compone otro anuncio desde un montaje o H3 aceptado de la misma aprobación, conservando audio, duración y original. Composición local sin nueva generación IA; el panel no sigue la cámara ni verifica la fidelidad del clip.

## Versión 0.4.0 — 2 de octubre de 2026

Esta versión reúne tejados, parcela geográfica, estudio de vídeo, galerías y las correcciones revisadas de seguridad, cocina y recuperación de tareas. La construcción H3 sigue siendo un piloto que requiere revisión visual; las funciones pendientes se detallan al final de esta página.

- La cocina evita aparatos dentro de pilares, también cuando el pilar solo recorta el fondo del módulo. Los recortes solapados conservan la profundidad necesaria en carcasa, zócalo y encimera.
- Duración, calidad, luz y cotas del estudio usan los desplegables comunes de la aplicación, contenidos dentro de su panel.

- Los vídeos exportados desde la visita aprobada conservan sus opciones de sonido, cotas, ámbito y duración, igual que los creados desde el estudio. El campo de coordenadas de parcela utiliza una indicación genérica, sin ubicaciones privadas como ejemplo.

- Las tareas H3 aceptadas conservan su identificador aunque falle el registro del coste. Consultarlas recupera el registro pendiente sin generar otro vídeo.

- Todas las páginas de demostración `/dev/*`, incluida la muestra 3D, devuelven 404 fuera de desarrollo. El acceso normal a proyectos y administración conserva sus controles de sesión y permisos.

- **Construcción desde mis diseños**: propone distribución y exterior como referencias iniciales, con su función visible en las miniaturas. La cenital fija mobiliario y distribución; el exterior fija fachadas, tejado y encuadre. El guion pide un vuelo final corto y evita mezclar interiorismos distintos. Las preparaciones antiguas no cambian automáticamente; la fidelidad del clip sigue necesitando revisión. La prueba de dos referencias tampoco valida fidelidad profesional: hay que comprobar cantidades, entorno y etapas, aunque el cierre exterior parezca correcto.
- **Exterior terminado por zonas**: el recorte conserva las caras exteriores de los muros y los aleros del tejado. El margen estructural también se aplica a la máscara enviada a IA; suelo y parcela mantienen el contorno seleccionado. Las imágenes anteriores necesitan revisión; no se modifican automáticamente.
- **Revisar una imagen ya generada**: permite comprobar y guardar un PNG contra una vista preparada, sin pagar otra generación de imagen. La auditoría visual sigue teniendo coste y los mismos controles; los archivos importados se identifican como tales.

## 1 de octubre de 2026

- **Completar vistas de la tanda**, desde construcción: recupera los ajustes y prepara solo las vistas generales ausentes o descartadas. Conserva las imágenes válidas; la generación de pendientes tiene coste.
- La actualización de las galerías al guardar un render conserva el panel y la tanda en curso; una nueva petición de completar vistas abre el editor sin reiniciar su espacio de trabajo.

- Avisos de generación por vista: un error posterior conserva los motivos de los descartes anteriores. Las imágenes descartadas en una revisión posterior se bloquean como referencias de construcción, montaje y nuevas vistas.
- Instrucciones de fidelidad que protegen la función del mobiliario: camas reconocibles y placas de cocina conservadas. La comprobación visual sigue siendo necesaria; la auditoría automática puede equivocarse.
- La auditoría compara las plataformas y ocultaciones con la captura original antes de atribuirlas a la imagen generada. Sigue rechazando cambios de límites, peldaños y barandillas; esta instrucción no garantiza que desaparezcan los falsos rechazos.

- Nuevo ángulo **Exterior terminado** en **Diseñar con IA**: fachadas completas y tejado visible, con el mismo ámbito seleccionado y una cenital compatible como referencia de identidad. La construcción H3 requiere esa vista terminada además de una referencia de distribución, antes de preparar o enviar la prueba.

- Las capturas con tabiques interiores ocultos se bloquean antes de generar imágenes. Las fotos antiguas que registran ese defecto se señalan como **No válida para construcción**; no se pueden seleccionar ni enviar a H3. El guion añade los accesos estructurales del ámbito aprobado y distingue escaleras, rampas y descansillos, sin incorporar muebles del plano. Sigue siendo necesaria la revisión visual del clip.

- **Construcción → Mis diseños**: piloto MiniMax H3 en KIE desde imágenes generadas, con zonas exteriores, escaleras y rampas seleccionadas en esas imágenes. El mobiliario se pide según los renders; no se adjunta el inventario del editor. Presupuesto y envío se confirman antes de generar. Tarea guardada, consulta sin regeneración, MP4 archivado y aceptación/rechazo manual. Primera prueba real de 8 s recuperada con audio; rechazada porque los muros crecían en grupos y la envolvente cambiaba durante el giro. Fidelidad profesional pendiente.

- Construcción rápida de 8 s por defecto, con muros consecutivos en 3 s. Opción de 12 s para dedicar más tiempo a los muebles y al vuelo. Construcción + visita utiliza el mismo ritmo y añade después la ruta. Duración, FX, guion y datos guardados comparten los tiempos elegidos.

- Cotas de vídeo animadas, solo al inicio, fijas o desactivadas; ancho, fondo y altura anclados al edificio con ocultación por profundidad al girar.
- Guion portable para generación IA, con indicaciones propias y copia del texto completo. Los ajustes y las indicaciones se guardan con el vídeo nativo. La construcción H3 dispone de piloto; la composición de cotas sobre clips IA sigue pendiente.

- Construcción nativa con muros consecutivos, fragmentos sincronizados, cámara fija durante la obra y vuelo final. Efecto sintetizado al inicio de cada muro.
- Ámbito de vídeo **Solo la casa / Todo el plano** en el estudio. La casa usa interiores y tejado; encuadre y cotas excluyen puntos exteriores. Conserva la ortofoto confirmada y retira el terreno modelado bajo ella. Los muebles siguen siendo los del editor; animar directamente los renders continúa pendiente.

- **Crear vídeo** y pestaña **Vídeos**: construcción, publicidad, primera persona y construcción + visita, con preparación, aprobación y resultados en el estudio. Construcción sola no exige ruta interior.
- Tandas de renders en una galería única con zona y ángulo. Fondo del plano, descarga, cambios y variante aparecen al abrir la imagen.
- Fondo de render compatible con el editor actual, conservado como referencia auxiliar por proyecto y zona.
- El recorte de una zona conserva todos sus tabiques interiores; solo se ocultan fachadas del lado de cámara. Una solicitud de rediseño exige cambios reconocibles dentro de los permisos.

- Vistas laterales, frontal y trasera con corte del lado de cámara, incluidos huecos, cortinas y persianas; conservan muros del fondo y cubierta. Cenital, isométrica y dron ocultan techo y tejado. Las referencias de imágenes y su revisión de fidelidad respetan estas ocultaciones.
- Panel **Tejado** independiente: cubierta plana, una, dos o cuatro aguas; pendiente, orientación, alero, espesor y acabado por planta. Se conserva en el diseño y el contexto de las imágenes; respeta patios abiertos.
- Muros y hastiales cerrados automáticamente hasta la cara inferior inclinada del tejado, con el acabado de sus muros.
- Montajes bloqueados si el diseño ha cambiado o las imágenes no comparten versión visual, luz y permisos de decoración. Las muestras nativas se identifican como **3D**, separadas del montaje de diseños generados.
- Muros con crecimiento progresivo en vídeos nativos de obra; cubiertas y acabados con fundidos.
- Efectos de construcción opcionales, volumen y cotas globales en **Sonido y cotas del vídeo**. MP4 con pista AAC cuando se activa el sonido.
- Exportación con espera de modelos y texturas, mayor resolución de render interno según la GPU y mayor tasa de vídeo para piezas cortas.

## 30 de septiembre de 2026

- Sitio dedicado de documentación con guías por tarea, herramientas, atajos y búsqueda.
- Tema claro, oscuro y del sistema con iconos directos en cabecera, también en móvil.
- Guías de vídeo con pasos desde el diseño terminado: creación de ruta, revisión, aprobación y localización de botones. Las capturas de menús se incorporarán cuando los flujos estén estabilizados.
- Panel de parcela con fotografía amplia y ajustes agrupados. Zoom, escala, giros y dimensiones con slider, valor exacto y −/+.
- Tapado de casa actual con giro y tamaño independientes del diseño; comparación antes/propuesta.
- Ubicación, escenario y luz conservados con la revisión. Día, Tarde, Atardecer y Noche.
- Menús de parcela contenidos dentro del panel y cierre por clic externo deshabilitado. Elegir el mismo valor no invalida el encaje.
- Continuación visible tras confirmar: revisión de aprobación en ventana, luz de la parcela y accesos directos al montaje de imágenes. La guía distingue el montaje de renders y el paseo continuo fotorrealista pendiente.
- Promoción conceptual sobre ortofoto de 30 s, independiente de ruta interior.
- Identificación de ambientes interiores para el montaje y continuidad de tandas tras rechazo de una imagen por fidelidad.

## Disponibilidad y revisión

Estas guías corresponden a la implementación actual del repositorio. El entorno desplegado puede tener otra versión. Una función implementada no acredita que el resultado de cada inmueble concreto esté validado: revisa su exportación.

## Pendiente

| Función | Situación |
|---|---|
| Etapas de reforma parcial | Pendiente definición de elementos conservados. |
| Película fotorrealista continua | Pendiente imágenes coherentes, guion y piloto de clips con presupuesto. |
| Editor de tomas y ritmo libre | Pendiente; construcción ya permite elegir 8 o 12 s. |
| Cotas geométricas sobre vídeo IA | Pendiente seguimiento de cámara; el panel de medidas globales sí está disponible en publicidad. |
| Música, locución y pistas externas | Pendiente; los efectos sintetizados de construcción sí están disponibles en vídeo nativo. |

Las funciones pendientes se documentan como tales; sus guías se actualizarán cuando estén implementadas y verificadas.
