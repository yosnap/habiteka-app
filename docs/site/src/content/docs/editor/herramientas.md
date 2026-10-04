---
title: Herramientas del editor
description: Qué hace cada herramienta y cómo revisar sus resultados.
---

## Cómo orientarte

Las pestañas **Asistente, Plano, Editor, Diseños, Vídeos e Historial** se mantienen en la parte superior del proyecto. En el editor, la cabecera reúne planta, deshacer/rehacer, guardado, **Vídeos** y **Diseñar con IA**.

Abre **Herramientas** para visibilidad, selección por tipo, recorrido del plano, contexto IA, techo y luces, tejado, parcela real, exportación y aprobación. Solo aparecen las acciones disponibles para ese proyecto. Los botones, enlaces, tarjetas que abren opciones y desplegables muestran el cursor de mano; los controles deshabilitados se distinguen visualmente.

En **Diseñar con IA**, actualizar las vistas de referencia solo vuelve a capturar el 3D; no modifica la geometría. Los avisos de importación pueden seguir pendientes de comparación con el original. Si la fiabilidad exige confirmación, revisa el plano y marca **He revisado el plano y quiero generar con estos avisos** para habilitar la generación. Un bloqueo requiere corregir el plano y no se elimina con esta casilla.

Si la estructura permite continuar y solo queda la comparación de la importación, marcar esa casilla guarda tu confirmación para esa geometría en el proyecto. Al reabrir el diálogo no vuelve a pedir esa comparación. Cambiar muros, huecos, alturas, escala o la referencia de importación requiere una nueva revisión. Mover muebles no invalida la comparación. Los bloqueos y las dudas nuevas de la evaluación siguen exigiendo su corrección o confirmación; esta revisión no acepta ningún diseño IA ni genera imágenes.

En el estudio de diseño, **Toda la planta**, **Solo la casa** y **Zonas concretas** se muestran como opciones del mismo grupo, con la selección en verde de la marca. Las casillas de confirmación, decoración, vistas y estancias usan el mismo control de marca, también al abrir el estudio fuera de la vista del Editor.

Al marcar zonas en modo **Estancia**, pulsar una estancia ya marcada no la añade otra vez. En las zonas permitidas de **Diseñar el plano** la quita; en las zonas de diseño guardadas en el plano, elige la zona que ya existe. Esto funciona aunque hayas alcanzado el máximo de zonas. **Proponer acabados y muebles con IA** reserva ahora margen para la respuesta. Antes el modelo de visión podía agotar el límite pensando y fallar con «El modelo agotó el límite de respuesta sin devolver el diseño».

**Diseñar con IA** abre el estudio en el paso de la vista en la que estás: desde **Plano 2D**, en **Diseñar el plano**, sin pasar al 3D; desde **Amueblado** o **Modelo 3D**, en **Crear imágenes**.

El estudio de diseño tiene dos pasos, en este orden. **1. Diseñar el plano**: la IA coloca muebles, baños, cocina y acabados en el plano 2D, y de ahí en el 3D, sin crear imágenes; un plano sin muebles abre el estudio en este paso. La vista previa es la propia planta 2D: este paso no cambia al 3D ni captura vistas. **2. Crear imágenes**: genera los renders del plano ya diseñado, sin modificarlo; con las imágenes que aceptes se crean después los vídeos.

En **Diseñar el plano** eliges el modo de la propuesta:

- **Amueblar** (por defecto) reproduce primero los muebles de tu boceto, si importaste el plano desde un dibujo: cada uno en su estancia, contra su pared y en su sitio. Después equipa cada estancia del ámbito con todo lo que necesita su uso: muebles, decoración, lámparas y también sanitarios, cocina, electrodomésticos y lavadora. Los coloca contra los muros y agrupados como en una vivienda real. Las piezas que van juntas pueden tocarse: módulos y aparatos de cocina, sanitarios, armarios, mesillas y camas. Conserva lo que ya hay y solo añade. Cada puerta reserva solo lo que necesita: su ancho y, a cada lado del muro, la profundidad de su hoja más 20 cm de paso; un hueco de paso sin puerta reserva hasta un metro a cada lado. La IA elige para cada mueble la pared y el punto, y el sistema lo arrima a la cara interior del muro con la trasera contra él. Si queda a pocos centímetros de un sitio válido, lo desliza a lo largo de su pared sin sacarlo de la estancia. Las sillas pueden tocar su mesa. Si la validación descarta piezas o Jev señala problemas, la IA propone solo sustitutos para ellas y las piezas válidas se conservan tal cual; una pieza señalada sin sustituto válido se queda donde estaba. La cocina se monta como un mueble de cocina continuo, en lineal o en L por las paredes libres, con encimera, armarios altos y los aparatos en orden de trabajo; aparece en la revisión como «Cocina de … m» y se puede desmarcar. Los sanitarios de un baño se recolocan desde las esquinas si no caben como los propuso la IA (la bañera que no cabe pasa a ducha y un inodoro siempre lleva lavabo). Las sillas, las mesillas y la mesa de centro se colocan junto a su mesa, cama o sofá; el mueble de la tele, enfrente del sofá. Una cama con el cabecero bajo una ventana pasa a una pared ciega si cabe con una mesilla. Una pieza principal que no cabe en su pared prueba las demás de la estancia y, si hace falta, una más pequeña. Solo se apoyan objetos pequeños sobre mesillas, mesas, aparadores o encimeras, nunca sobre una cama o un armario. Si la corrección deja una estancia sin su pieza principal, esa estancia se queda como en la primera propuesta.
- **Solo categorías** añade únicamente las categorías que marques, por ejemplo luces y plantas; no incluye sanitarios ni cocina.
- **Acabados** no añade objetos: cambia paredes y suelos y, con **Rediseñar acabados de fijos existentes**, los colores y materiales de cocina, sanitarios y armarios.

En todos los modos, la propuesta elige el suelo y las paredes de **cada estancia** según su uso: cerámica o piedra en baños, aseos, cocina y lavadero; madera en dormitorios y salón. Elige además un material de **fachada** para las caras de los muros que dan al exterior. Cada cara de un tabique toma el acabado de la estancia a la que da: el lado del baño puede ir alicatado y el del dormitorio, pintado. Antes de aplicar, la revisión muestra la fachada y una fila por estancia con su suelo y sus paredes, que puedes cambiar.

**Qué parte del inmueble diseñar** limita cualquiera de los modos a un área: toda la planta, solo la casa, solo el interior, solo el exterior (patio y caras exteriores de los muros, es decir, la fachada), estancias concretas como un dormitorio, un baño o la cocina, o una zona dibujada.

La propuesta trabaja solo sobre la planta. La IA recibe el plano 2D en vista cenital, con cada puerta y el arco de su giro, y coloca los muebles en él; no usa alzados ni capturas de otras vistas. Por eso el estudio ya no ofrece elegir una vista de referencia, y la vista previa es la cenital del 3D editable, sin coste. Antes de enseñarte la propuesta, Jev la revisa dibujada sobre la planta. Comprueba que las camas tengan el cabecero contra un muro, que ningún mueble invada el giro de una puerta ni tape un paso, que queden unos 70 cm libres y que los sofás miren a la zona de estar. Si encuentra problemas, la IA corrige la propuesta una vez con esos motivos. La revisión añade una consulta de visión, y la corrección otra cuando hace falta. La propuesta no tiene un número máximo de objetos. La IA amuebla y decora cada estancia del ámbito por completo, como una vivienda lista para vivir, y solo repite piezas cuando el uso lo pide: las sillas de una mesa o las mesillas de cada cama. La luz de día o de noche no forma parte de la propuesta: se elige después al crear las imágenes, que iluminan las lámparas colocadas. La variedad de la decoración depende del catálogo, que hoy tiene un solo jarrón y ningún espejo ni cuadro: la IA pone menos decoración antes que repetir la misma pieza en todas las estancias.

**Ver en el plano** cierra el diálogo, vuelve al Plano 2D y muestra los muros afectados aunque estuvieran ocultos. Los extremos sin unir de los muros seleccionados aparecen con un círculo rojo y la etiqueta **Extremo sin unir**; la vista se centra en esos puntos. Cambia la selección para retirar las marcas. **Mostrar/Ocultar original** y su opacidad están en la barra superior junto a las vistas, fuera del lienzo.

**Opcional: subir un PNG existente para revisarlo** es una herramienta plegada para un archivo que ya tengas guardado; su presencia no significa que se haya generado una imagen. No hace falta usarla para crear nuevas imágenes. Al abrirla, sube el PNG, selecciona su vista de referencia y pulsa **Revisar y guardar imagen existente**. La revisión con IA tiene coste; guardarlo no equivale a aceptar el diseño.

### Restablecer una muestra local

Las muestras de desarrollo `/dev/editor-v2` son lienzos independientes, disponibles solo en desarrollo. **Restablecer muestra** recupera el documento original de esa muestra, cancela trazos y colocaciones pendientes, cierra paneles y vuelve a **Plano 2D** encuadrado. La cámara 3D se reinicia al volver a abrir esa vista. Aparece **Muestra restablecida** como confirmación, incluso si el documento ya era el original.

Puedes pulsar **Deshacer** para recuperar el documento anterior al restablecimiento. Se conservan tus preferencias generales de visibilidad y atajos. La copia sigue limitada a esa pestaña y el estado de guardado indica si puede conservarse al recargar. Esta acción no modifica proyectos guardados.

## Cocina y pilares

Los pilares recortan el fondo del mueble de cocina, conservando la parte frontal cuando cabe, y eliminan los módulos altos que los atraviesan. Si dos pilares se solapan, se utiliza el recorte más profundo para carcasa, zócalo y encimera. Los aparatos no pueden colocarse ni desplazarse sobre el hueco de un pilar; la colocación automática busca otro hueco libre.

## Vistas y selección

| Control | Para qué sirve |
|---|---|
| Plano 2D | Revisar trazado y dimensiones. |
| Amueblado | Trabajar con la representación visual del plano. |
| Modelo 3D | Revisar volumen, acabados y circulación de la guía. |
| Seleccionar | Seleccionar elementos o arrastrar un marco de selección. |
| Propiedades | Cambiar parámetros del elemento seleccionado. |
| Medir | Arrastrar entre dos puntos para dejar una cota con su distancia. |
| Texto | Añadir etiquetas al plano. |

Cambiar entre **Plano 2D**, **Amueblado** y **Modelo 3D** conserva la selección, el panel abierto y la sección de Propiedades. El selector de cámaras de Modelo 3D también conserva la selección. Al entrar en Amueblado se prepara la vista cenital; al entrar en Modelo 3D, la isométrica. El encuadre manual de esas dos vistas no se recuerda al salir de ellas.

Los paneles tienen espacio propio junto al lienzo. En pantallas estrechas aparecen debajo, con desplazamiento independiente; el plano y sus controles siguen accesibles. Abrir o cerrar un panel conserva el centro y la escala del plano técnico. Si necesitas ver todo el inmueble en el espacio disponible, pulsa **Encuadrar**.

### Navegar mientras trabajas

**Plano 2D** y **Amueblado** incluyen **Alejar**, **Acercar**, **Encuadrar** y **Mano**. Mano permite arrastrar la vista sin mover objetos; activarla no cancela un trazo ni una colocación pendiente. Desactívala para seguir dibujando o colocar el objeto. Los atajos son **−**, **+**, **0** y **Espacio**, respectivamente, cuando los atajos están activos y no estás escribiendo en un campo.

Puedes llevar un objeto pendiente entre Plano 2D y Amueblado. **Modelo 3D** queda deshabilitado hasta colocarlo o pulsar **Cancelar colocación**. Escape cancela primero el objeto y conserva el catálogo; un segundo Escape cierra el panel. Pegar una copia desde Modelo 3D abre Amueblado para colocarla.

Elegir una herramienta de trazado desde una vista visual abre Plano 2D. Con esa herramienta activa, termina con **Finalizar** o Escape antes de abrir Amueblado o Modelo 3D. Los tramos de pared ya confirmados se conservan; el segmento pendiente se descarta. El zoom, el encuadre y Mano siguen disponibles durante el dibujo.

### Medir una distancia

Activa **Medir** o pulsa **M**. En Plano 2D, arrastra desde el primer punto hasta el segundo: la distancia aparece durante el gesto. Al soltar se guarda una **cota**, queda seleccionada y vuelves a Seleccionar. Los trazos menores de 5 cm se descartan. **Escape** cancela el trazo pendiente.

Con **Ajuste** activo (**A**), los puntos se alinean con referencias del plano. La medida se consulta también en **Propiedades** y en el buscador de elementos, dentro de **Medidas**. Puedes mover la cota arrastrándola, eliminarla o deshacer su creación; no cambia las dimensiones de paredes ni muebles.

La cota seleccionada y las cotas manuales mientras usas Medir se muestran aunque **Herramientas → Vista → Medidas** esté en **Ocultas** o **Solo exteriores**. Al dejar de seleccionarla se vuelve a aplicar ese filtro; puedes recuperarla desde el buscador de Propiedades.

## Propiedades de la selección

Al seleccionar un elemento, la barra inferior muestra su nombre y el acceso a **Propiedades**. El panel permanece abierto al elegir otro elemento o pulsar en una zona vacía del lienzo; puedes cerrarlo con su X o con Escape fuera de un campo de texto. El menú de acciones junto al elemento se oculta mientras Propiedades está abierto.

**Buscar o cambiar de elemento** ofrece dos controles separados: **Buscar en el plano**, un único campo con lupa para escribir un nombre, y **Elemento del plano**, un desplegable para elegirlo de la lista. Elegir un resultado lo selecciona y centra el plano sin cerrar el panel. Sin selección, el buscador permanece disponible.

El panel reúne **Medidas**, **Acabados** y **Notas**, según lo que admite el elemento:

- **Pared:** longitud, grosor, altura y cota base; después, giro y curvatura. Longitud y giro desplazan el extremo final y las paredes unidas a él. Para paredes curvas, la longitud indicada es la distancia entre extremos. Las acciones incluyen curvar/enderezar, añadir esquina, dividir, invertir, ocultar y unir paredes contiguas. Los colores y materiales de cada cara se encuentran en Acabados.
- **Habitación:** nombre, superficie calculada y cota del suelo. Acabados reúne textura, color, repetición y giro del suelo, y los ajustes de forjado cuando está elevado. Para cambiar la superficie, edita las paredes del contorno; una habitación interior no se elimina como un mueble.
- **Puerta, ventana o hueco:** ancho, altura, elevación y posición del centro dentro de su pared. Una puerta también permite ajustar apertura y bisagra. Las acciones permiten centrar, ocupar todo el muro y copiar para colocar otra abertura. Los colores disponibles están en Acabados.
- **Mueble:** primero ancho, fondo y altura; después posición X/Y, elevación y giro. Copiar y girar 90° están en las acciones. Acabados muestra las opciones reales del objeto; en modelos 3D importados, el tinte es global y conserva texturas y transparencias.

Las medidas del panel se expresan en **metros** y los giros en **grados**. Notas reúne los comentarios del elemento y su contador. En modo de solo lectura puedes consultar las secciones, con la edición deshabilitada.

### Varios elementos

Con elementos compatibles, se muestran únicamente campos comunes que se aplican a toda la selección. Se muestran los valores del primero, que pueden diferir de los demás; los cambios se deshacen con Ctrl/Cmd + Z. Las paredes comparten grosor, altura, cota y acabados; los huecos comparten dimensiones y elevación; los objetos comparten dimensiones, elevación y giro. Las posiciones individuales y las acciones de forma requieren elegir un solo elemento.

Si mezclas tipos distintos o seleccionas varios elementos sin edición conjunta, el panel ofrece **Editar un elemento de la selección**. Elegir uno deja solo ese elemento seleccionado. Una medida no válida se rechaza sin aplicar parcialmente el cambio al resto.

## Construir

Abre **Construir** y elige una tarjeta de categoría: paredes, habitaciones, puertas, ventanas y huecos; también columnas, escaleras, rampas y otras formas disponibles. Las tarjetas incorporan imágenes realistas orientativas; las funciones pendientes siguen identificadas dentro de su categoría. **Todas las categorías** vuelve al inicio del panel. Los huecos se vinculan a una pared.

Para cadenas de paredes, pulsa para fijar inicio y extremos. Cerrar el contorno termina la cadena; Escape termina un trazo abierto conservando los tramos confirmados. Una habitación rectangular se dibuja arrastrando sus esquinas.

Con ajuste activo, las guías ayudan a unir extremos y cerrar recintos. Comprueba las uniones en **Plano 2D**.

## Amueblar y propiedades

Abre **Amueblar** y explora **Habitaciones** o **Categorías** mediante miniaturas realistas. También puedes buscar por nombre o abrir **Ver todos los muebles**. Dentro de los resultados, despliega **Filtrar por estancia y estilo** si lo necesitas; **Todas las habitaciones y categorías** limpia los filtros y vuelve al inicio.

Elige la variante, pulsa **Añadir al plano** y coloca el objeto. El catálogo permanece abierto al pulsar sobre el lienzo; puedes cerrarlo con su X o Escape. En **Propiedades**, revisa dimensiones, giro, elevación y acabados disponibles. Las imágenes de habitaciones y categorías son ilustraciones genéricas generadas con IA para orientarte: no representan el modelo exacto de un producto ni un diseño aceptado de tu inmueble. Cada ficha conserva sus dimensiones, variantes y representación propia.

Con **Ajuste** activo, al colocar o arrastrar una pieza que va contra la pared (armario, sofá, cama, cómoda, estantería, sanitario o electrodoméstico) cerca de un muro, se gira sola con la trasera contra él, como una puerta en su muro. Así puedes llevar ya girado un armario que no cabe girarlo donde está. Mientras la pared con la que ya está orientada siga a su alcance, la pieza conserva ese giro: un armario puesto en horizontal en un rincón no salta a la pared lateral. Solo se gira hacia otro muro cuando se aleja del suyo; mesas, sillas, alfombras, plantas y lámparas conservan el giro que les diste.

En la vista cenital, las alfombras se pintan debajo de todo y las sillas y bancos debajo de la mesa. **Ocultar original** se recuerda en el navegador: al recargar, el boceto sigue oculto hasta que pulses **Mostrar original**, igual que su opacidad.

En Plano 2D, los tiradores de esquina cambian el tamaño manteniendo la esquina opuesta y usan referencias magnéticas cuando Ajuste está activo. Alt permite crecer alrededor del centro. Las medidas de los tiradores de objetos se muestran en centímetros; el panel Propiedades usa metros. Elevación cambia la posición vertical, no el tamaño.

## Suelos, paredes y exterior

- Selecciona un suelo para cambiar acabado, textura y parámetros disponibles.
- Selecciona una pared y abre **Propiedades → Acabados** para elegir su cara interior o exterior. **Pintar**, en el menú del lienzo, abre esa misma sección.
- **Construir → Patio / terraza** permite superficies exteriores abiertas.
- **Exterior**, en la barra lateral, abre vegetación, cerramientos, pérgolas y equipamiento. También puedes entrar desde **Construir → Exterior y jardín**.
- **Añadir terreno** y **Añadir pavimento**, dentro de Exterior, muestran miniaturas de césped y pavimento para distinguir ambas superficies; un pavimento visual no habilita por sí mismo un recorrido.

En **Elementos de exterior**, **Buscar elemento** y **Categoría** aparecen en filas separadas, antes de las tarjetas de resultados. Puedes combinar texto y categoría; **Todas** elimina el filtro de categoría. Las miniaturas de Construir, terreno y pavimento son ilustraciones genéricas generadas con IA para navegar, no diseños aceptados ni fotografías exactas de los elementos que se añaden al plano.

### Ajustar terreno y pavimento

Al añadir terreno o pavimento se abre **Amueblado**, con la superficie seleccionada, Propiedades y el plano encuadrado. Puedes ajustarla en **Plano 2D** o **Amueblado**. Sus ocho tiradores permiten cambiar ancho y fondo: las esquinas cambian ambos y los puntos intermedios solo un lado, manteniendo fijo el borde opuesto. El control central mueve la superficie. También puedes arrastrar una zona libre de la superficie seleccionada.

**Ajuste** activa los imanes hacia bordes, centros y referencias de otras superficies y elementos; las guías aparecen durante el gesto. Desactívalo para colocar libremente. También puedes mover la selección con flechas: 1 cm, o 10 cm con Mayús. En Plano 2D puedes seleccionar superficies con un marco. **Ctrl/Cmd + Z** deshace cada movimiento o cambio de tamaño.

**Propiedades** permite escribir ancho, fondo y posición exactos, consultar la superficie en m² y cambiar el acabado. Los tiradores admiten de 5 cm a 200 m por lado. **Giro de textura** cambia la orientación del material; la superficie conserva su forma rectangular alineada con los ejes del plano. Escape cancela un ajuste pendiente desde los tiradores.

## Plantas, techos y recorrido

Gestiona niveles desde el selector de planta. En **Herramientas**, configura [Techos y luces](/editor/techos-luces-tejado/) por estancia o abre **Recorrido** para comprobar una ruta en el plano. Los vídeos finales se preparan desde los diseños IA aceptados en **Vídeos**.

Al abrir el editor o aprobar cambios sigues en edición. **Herramientas → Ver aprobado** abre la revisión, con **Plano 2D**, **Modelo 3D** y **Volver al editor**. Los avisos de objetos aproximados y estancias sin techo están en **Detalles de la guía: objetos y techos**. Los recorridos de la guía no se activan automáticamente. El botón **Vídeos** de la cabecera del editor guarda primero los cambios pendientes y abre la página de Vídeos; si hay un conflicto o no se pueden sincronizar, permanece en el editor y explica el motivo.

## Navegación 3D

Utiliza los botones de acercar, alejar y encuadrar; el selector **Vistas** cambia la cámara. **Entrar en una estancia** coloca la cámara a altura de ojos. La vista de maqueta y los controles de techo facilitan examinar el interior: ocultar una cubierta para estudiar el plano no la elimina del diseño.

Editar una medida o abrir un panel conserva la posición de cámara. Buscar y elegir un elemento desde Propiedades centra la vista activa en él sin cambiar el zoom, también en Amueblado y Modelo 3D. **0**, **+** y **−** funcionan en las tres vistas cuando los atajos están activos. Cambiar de planta o de plantas apiladas vuelve a encuadrar; una cámara situada dentro de una estancia conserva su tratamiento específico.

Consulta [Atajos](/editor/atajos/) para trabajar con teclado.

Haz **doble clic en un elemento** para abrir Propiedades en Plano 2D, Amueblado o Modelo 3D, con Seleccionar activo y Mano desactivada. Las luces conservan su panel específico. Un clic normal selecciona sin abrir el panel. Pulsar el lienzo devuelve el foco desde los campos para usar los atajos sobre la selección.

El menú de acciones de la selección permanece disponible en Plano 2D aunque Propiedades esté abierto. Para duplicar una pared o un objeto, mantén **⌥ Option en Mac / Alt** al comenzar a arrastrarlo y suelta en la nueva posición. El original se conserva y la copia queda seleccionada; una pared copia también sus huecos con identificadores independientes. En Amueblado, Option/Alt + arrastrar copia objetos y superficies de terreno o pavimento.

En **Plano 2D**, Option/Alt + arrastrar el cuerpo de una **puerta, ventana o hueco** crea una copia sobre el muro de destino al soltar. La vista previa indica si cabe; si invade otra abertura o no hay un muro válido, no se crea la copia y se conserva el original. Los tiradores de los bordes siguen ajustando el ancho: con Option/Alt, redimensionan alrededor del centro.
