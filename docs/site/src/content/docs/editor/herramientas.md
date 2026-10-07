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

- **Amueblar** (por defecto) reproduce primero los muebles de tu boceto, si importaste el plano desde un dibujo: cada uno en su estancia, contra su pared y en su sitio. La primera vez la IA lee el boceto objeto por objeto y la lectura se guarda; lo dibujado que el catálogo aún no tiene se avisa en la revisión, sin sustituirlo. El sitio, la pared y el giro de cada pieza dibujada los pone el sistema; la IA solo elige el modelo. Reconoce también la cocina americana: la barra, la península, la isla o la mesa alta dibujadas se colocan exentas en su sitio, con el frente hacia los taburetes dibujados, y los taburetes a lo largo de ellas. Las lámparas dibujadas sobre las mesillas van encima de cada mesilla, y las alfombras dibujadas, bajo el sofá o la mesa de comedor con la medida del dibujo; si a esa medida no caben, con la del catálogo. Una alfombra dibujada en otro sitio, como bajo una cama, se queda donde está dibujada y con su medida. Los proyectos que ya tenían guardada la lectura del boceto la repiten una vez (una consulta de visión) para reconocer estos objetos. Después equipa cada estancia del ámbito con todo lo que necesita su uso: muebles, decoración, lámparas y también sanitarios, cocina, electrodomésticos y lavadora. Los coloca contra los muros y agrupados como en una vivienda real. Las piezas que van juntas pueden tocarse: módulos y aparatos de cocina, sanitarios, armarios, mesillas y camas. Conserva lo que ya hay y solo añade. Cada puerta reserva solo lo que necesita: su ancho y, a cada lado del muro, la profundidad de su hoja más 20 cm de paso (la mitad en una puerta de dos hojas, un panel en una plegable y solo el paso en una corredera); una corredera vista reserva además el tramo de pared donde se recoge su hoja, y un hueco de paso sin puerta reserva hasta un metro a cada lado. La IA elige para cada mueble la pared y el punto, y el sistema lo arrima a la cara interior del muro con la trasera contra él. Si queda a pocos centímetros de un sitio válido, lo desliza a lo largo de su pared sin sacarlo de la estancia. Las sillas pueden tocar su mesa. Si la validación descarta piezas o Jev señala problemas, la IA propone solo sustitutos para ellas y las piezas válidas se conservan tal cual; una pieza señalada sin sustituto válido se queda donde estaba. La cocina se monta como un mueble de cocina continuo, en lineal o en L por las paredes libres, con encimera, armarios altos y los aparatos en orden de trabajo; aparece en la revisión como «Cocina de … m» y se puede desmarcar. Los sanitarios de un baño se recolocan desde las esquinas si no caben como los propuso la IA (la bañera que no cabe pasa a ducha y un inodoro siempre lleva lavabo). Las sillas, las mesillas y la mesa de centro se colocan junto a su mesa, cama o sofá, y el televisor encima de su mueble de TV; el mueble de la tele, enfrente del sofá. Los taburetes van de cara a la barra y tocando su canto: a lo largo del frente de una isla o una península (uno por cada 60 cm) o a los dos lados de una mesa alta; sin isla, barra ni mesa alta en la estancia, un taburete se descarta. Si la propuesta pide una lámpara de mesa para un dormitorio, va encima de cada mesilla. La alfombra se pone bajo el sofá y la mesa de centro o centrada bajo la mesa de comedor, una por estancia; un felpudo no se cuenta como alfombra. Una cama con el cabecero bajo una ventana pasa a una pared ciega si cabe con una mesilla. Una pieza principal que no cabe en su pared prueba las demás de la estancia y, si hace falta, una más pequeña. Solo se apoyan objetos pequeños sobre mesillas, mesas, aparadores o encimeras, nunca sobre una cama o un armario. Si la corrección deja una estancia sin su pieza principal, esa estancia se queda como en la primera propuesta.
- **Solo categorías** añade únicamente las categorías que marques, por ejemplo luces y plantas; no incluye sanitarios ni cocina.
- **Acabados** no añade objetos: cambia paredes y suelos y, con **Rediseñar acabados de fijos existentes**, los colores y materiales de cocina, sanitarios y armarios.

En todos los modos, la propuesta elige el suelo y las paredes de **cada estancia** según su uso: cerámica o piedra en baños, aseos, cocina y lavadero; madera en dormitorios y salón. Elige además un material de **fachada** para las caras de los muros que dan al exterior. Cada cara de un tabique toma el acabado de la estancia a la que da: el lado del baño puede ir alicatado y el del dormitorio, pintado. Antes de aplicar, la revisión muestra la fachada y una fila por estancia con su suelo y sus paredes, que puedes cambiar.

**Uso de cada estancia:** la propuesta deduce el uso de cada estancia por el nombre que tiene en el plano. Además de dormitorio, cocina, baño, salón, comedor, despacho y exterior, reconoce cuatro usos:

- **Infantil:** «Dormitorio infantil», «Habitación de los niños», «Cuarto del bebé», «Sala de juegos».
- **Recibidor:** «Recibidor», «Entrada», «Hall», «Vestíbulo».
- **Lavadero:** «Lavadero», «Lavandería», «Tendedero».
- **Garaje:** «Garaje», «Cochera», «Parking».

Si el nombre combina dos usos, manda el más concreto: «Cocina-lavadero» es una cocina y «Porche de entrada», un exterior.

En el modo **Amueblar**, esas cuatro estancias siguen reglas conservadoras:

- **Infantil:** una cama individual o nido con su mesilla, un escritorio con su silla y un armario, nunca una cama doble. Pon una cuna solo si la pides y el catálogo la tiene; todavía no hay ninguna.
- **Recibidor:** una consola o un zapatero contra la pared, espejo y perchero si el catálogo los tiene, y un felpudo junto a la puerta. El paso de la puerta queda libre.
- **Lavadero:** lavadora y secadora juntas contra la pared, la pila si cabe y un armario o una estantería.
- **Garaje:** se deja libre para el coche. Solo admite una estantería metálica, salvo que pidas muebles para el garaje en las instrucciones o los dibujes en el boceto.

Si importaste el plano desde un boceto, la lectura reconoce también cunas, literas, consolas, espejos, percheros, tendederos y estanterías metálicas. Lo que el catálogo aún no tiene, como la cuna, se avisa en la revisión sin sustituirlo por otra pieza. Los planos que ya tenías no cambian: sus estancias y sus muebles siguen igual.

**Qué parte del inmueble diseñar** limita cualquiera de los modos a un área: toda la planta, solo la casa, solo el interior, solo el exterior (patio y caras exteriores de los muros, es decir, la fachada), estancias concretas como un dormitorio, un baño o la cocina, o una zona dibujada.

La propuesta trabaja solo sobre la planta. La IA recibe el plano 2D en vista cenital, con cada puerta y el arco de su giro (dos arcos en una de dos hojas; la hoja y su guía, sin arco, en una corredera), y coloca los muebles en él; no usa alzados ni capturas de otras vistas. Por eso el estudio ya no ofrece elegir una vista de referencia, y la vista previa es la cenital del 3D editable, sin coste. Antes de enseñarte la propuesta, Jev la revisa dibujada sobre la planta. Comprueba que las camas tengan el cabecero contra un muro, que ningún mueble invada el giro de una puerta ni tape un paso, que queden unos 70 cm libres y que los sofás miren a la zona de estar. Si encuentra problemas, la IA corrige la propuesta una vez con esos motivos. La revisión añade una consulta de visión, y la corrección otra cuando hace falta. La propuesta no tiene un número máximo de objetos. La IA amuebla y decora cada estancia del ámbito por completo, como una vivienda lista para vivir, y solo repite piezas cuando el uso lo pide: las sillas de una mesa o las mesillas de cada cama. La luz de día o de noche no forma parte de la propuesta: se elige después al crear las imágenes, que iluminan las lámparas colocadas. La variedad de la decoración depende del catálogo, que hoy tiene un solo jarrón y ningún espejo ni cuadro: la IA pone menos decoración antes que repetir la misma pieza en todas las estancias.

**Ver en el plano** cierra el diálogo, vuelve al Plano 2D y muestra los muros afectados aunque estuvieran ocultos. Los extremos sin unir de los muros seleccionados aparecen con un círculo rojo y la etiqueta **Extremo sin unir**; la vista se centra en esos puntos. Cambia la selección para retirar las marcas. **Mostrar/Ocultar original** y su opacidad están en la barra superior junto a las vistas, fuera del lienzo. El original es el fondo elegido para el editor: la imagen de la que salió el plano o la que marques en el estudio con **Usar de fondo en el editor** (por ejemplo, el redibujado de la IA o tu boceto). Consulta [Fondo del editor](/guias/importar-plano/#fondo-del-editor).

**Opcional: subir un PNG existente para revisarlo** es una herramienta plegada para un archivo que ya tengas guardado; su presencia no significa que se haya generado una imagen. No hace falta usarla para crear nuevas imágenes. Al abrirla, sube el PNG, selecciona su vista de referencia y pulsa **Revisar y guardar imagen existente**. La revisión con IA tiene coste; guardarlo no equivale a aceptar el diseño.

### Restablecer una muestra local

Las muestras de desarrollo `/dev/editor-v2` son lienzos independientes, disponibles solo en desarrollo. **Restablecer muestra** recupera el documento original de esa muestra, cancela trazos y colocaciones pendientes, cierra paneles y vuelve a **Plano 2D** encuadrado. La cámara 3D se reinicia al volver a abrir esa vista. Aparece **Muestra restablecida** como confirmación, incluso si el documento ya era el original.

Puedes pulsar **Deshacer** para recuperar el documento anterior al restablecimiento. Se conservan tus preferencias generales de visibilidad y atajos. La copia sigue limitada a esa pestaña y el estado de guardado indica si puede conservarse al recargar. Esta acción no modifica proyectos guardados.

## Cocina y pilares

En **Amueblar → Habitaciones → Cocina**, busca **Vitrocerámica** para añadir la placa independiente de cuatro zonas (60 × 52 cm). Tiene cristal negro, aros de cocción y controles táctiles. Suéltala sobre una encimera o isla para apoyarla a su altura; también puedes ajustar la cota en Propiedades. El modelo representa los 8 mm visibles sobre la encimera. Las medidas de las fichas se muestran en metros con hasta tres decimales para conservar espesores pequeños (0,008 m). El color modifica el cristal conservando las marcas y el marco.

En la cocina modular puedes añadir **Vitrocerámica** como aparato del tramo; al soltar la placa del catálogo sobre un tramo se encaja como ese aparato, usando la representación del tramo. **Cocina con fogones** sigue siendo el aparato completo de pie.

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

**Paredes externas** selecciona los muros visibles que delimitan una sola estancia interior, incluyendo los que dan a patios; no se limita al perímetro de la parcela. **Paredes internas** incluye los que separan dos interiores y los tabiques abiertos dentro de una estancia. La clasificación de estancias excluye las etiquetadas como patio, terraza, jardín, balcón, exterior, porche o loggia y las delimitadas por límites lógicos exteriores. Un pasillo delimitado así también puede hacer que sus paredes entren en la selección externa. Revisa sus límites y etiquetas si debería ser interior.

Para corregir esa clasificación, selecciona la pared y abre **Propiedades → Medidas → Clasificación de pared**. **Uso de la pared** ofrece **Automática**, **Interior** y **Exterior**. El panel muestra la clasificación aplicada, si es manual y el criterio automático. Puedes seleccionar varias paredes y fijar el uso de todas en una sola operación, incluso si tenían valores distintos. La elección manual manda en **Seleccionar → Paredes**, en los acabados interiores/exteriores y en el corte de fachadas del 3D. **Automática** retira la elección manual. Cambiar el uso no modifica los muros ni convierte un patio en habitación; el ámbito del tejado se configura por separado. Puedes deshacer el cambio.

**Construir → Tejado** reúne configuración, **Editar tejado en plano 2D**, **Ver tejado en 3D** y ocultación. Sus fichas permiten colocar cristales, ventanas de techo y salidas de chimenea con un clic, o dibujar su tamaño arrastrando. El plano muestra las aristas de las pendientes y avisa con una vista previa roja si la pieza no cabe. Mientras editas la cubierta, sus piezas reciben los clics; pulsa **Ocultar tejado · cerrar edición** para volver a paredes y muebles. Los accesos de **Herramientas → Tejado** y **Vista → Tejado en 2D** siguen disponibles. Consulta [Cristales, ventanas y chimeneas](/editor/techos-luces-tejado/#cristales-y-ventanas-en-el-plano-2d).

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
- **Puerta, ventana o hueco:** **Tipo** de puerta o ventana (ver [Tipos de puerta y ventana](#tipos-de-puerta-y-ventana)), **Aspecto** (diseño de la hoja, acabado, tirador o marco; ver [Diseño, acabado y tirador](#diseño-acabado-y-tirador)), ancho, altura, elevación y posición del centro dentro de su pared. Una puerta abatible permite ajustar el ángulo de apertura, la bisagra y el lado de apertura; una corredera o plegable, el lado hacia el que se recoge y abrirla o cerrarla. Las acciones permiten centrar, ocupar todo el muro y copiar para colocar otra abertura. Los colores disponibles están en Acabados.
- **Mueble:** primero ancho, fondo y altura; después posición X/Y, elevación y giro. Copiar y girar 90° están en las acciones. Acabados muestra las opciones reales del objeto; en modelos 3D importados, el tinte es global y conserva texturas y transparencias.

Las medidas del panel se expresan en **metros** y los giros en **grados**. Notas reúne los comentarios del elemento y su contador. En modo de solo lectura puedes consultar las secciones, con la edición deshabilitada.

### Varios elementos

Con elementos compatibles, se muestran únicamente campos comunes que se aplican a toda la selección. Se muestran los valores del primero, que pueden diferir de los demás; los cambios se deshacen con Ctrl/Cmd + Z. Las paredes comparten grosor, altura, cota y acabados; los huecos comparten dimensiones y elevación (el tipo se elige de uno en uno); los objetos comparten dimensiones, elevación y giro. Las posiciones individuales y las acciones de forma requieren elegir un solo elemento.

Si mezclas tipos distintos o seleccionas varios elementos sin edición conjunta, el panel ofrece **Editar un elemento de la selección**. Elegir uno deja solo ese elemento seleccionado. Una medida no válida se rechaza sin aplicar parcialmente el cambio al resto.

## Construir

Abre **Construir** y elige una tarjeta de categoría: paredes, habitaciones, puertas, ventanas y huecos; también **Tejado**, columnas, escaleras, rampas y otras formas disponibles. Las tarjetas incorporan imágenes realistas orientativas; las funciones pendientes siguen identificadas dentro de su categoría. **Todas las categorías** vuelve al inicio del panel. Los huecos de puertas y ventanas normales se vinculan a una pared; las ventanas de techo se colocan sobre la cubierta desde **Tejado**.

Para cadenas de paredes, pulsa para fijar inicio y extremos. Cerrar el contorno termina la cadena; Escape termina un trazo abierto conservando los tramos confirmados. Una habitación rectangular se dibuja arrastrando sus esquinas.

Con ajuste activo, las guías ayudan a unir extremos y cerrar recintos. Comprueba las uniones en **Plano 2D**.

### Tipos de puerta y ventana

En **Construir → Puertas** y **Construir → Ventanas** hay una tarjeta por tipo, con la foto de su modelo 3D montado en un trozo de muro y con su aspecto por defecto. Las puertas se agrupan en los apartados **Interior**, **Entrada**, **Correderas** y **Exterior y garaje**. Al pulsar una tarjeta, la herramienta queda lista con ese tipo: pulsa sobre una pared y se coloca con el ancho y el aspecto del tipo; su altura y su elevación habituales se aplican si caben, igual que al cambiar el tipo. Pulsa Escape para cancelar. En la tarjeta se elige el tipo; el acabado se cambia después en Propiedades.

**Garajes y accesos exteriores en pared:** abre **Construir → Puertas → Exterior y garaje**. Puedes elegir seccional, enrollable, basculante, corredera lateral o batiente de dos hojas para garaje, y **Portón exterior corredero en pared** para el acceso de vehículos al exterior. Pulsa en el muro para abrir el hueco y colocar la puerta; no se coloca como un mueble. La previsualización comprueba el alto del tipo elegido. En las correderas, **Cambiar lado de apertura** elige hacia dónde se recoge la hoja y **Cambiar cara del muro** la sitúa por dentro o por fuera; deja libre el tramo lateral que necesita la hoja. Las medidas se ajustan en Propiedades.

Cada puerta o ventana tiene un **Tipo** que también puedes cambiar en Propiedades. Al cambiarlo se aplican su ancho, su altura, su elevación y su aspecto habituales solo si caben: sin invadir una esquina ni otra abertura, sin superar la altura del muro y sin chocar con un mueble. Si no caben, se prueba a cambiar solo la altura y la elevación, después solo el ancho y, si tampoco, el tipo cambia conservando las medidas actuales (recortadas al ancho máximo del tipo). Cada tipo tiene un **ancho máximo** real: si escribes un ancho mayor, el editor lo rechaza y te dice el máximo.

| Tipo | Medida habitual | Ancho máximo | Plano 2D | 3D |
| --- | --- | --- | --- | --- |
| Puerta abatible | 0,90 × 2,10 m | 1,25 m | Hoja y arco de giro | Hoja sobre bisagras |
| Puerta de dos hojas | 1,40 × 2,10 m | 1,80 m | Dos hojas y dos arcos | Dos hojas que abren hacia el mismo lado |
| Puerta vidriera | 0,90 × 2,10 m | 1,25 m | Hoja azul vidrio y arco | Bastidor con vidrio y zócalo macizo |
| Puerta plegable (acordeón) | 0,80 × 2,10 m | 2,40 m | Zigzag de cuatro paneles | Paneles plegados en zigzag junto a la jamba |
| Puerta pivotante | 1,10 × 2,40 m | 1,60 m | Hoja que cruza el muro, arco grande y arco pequeño al otro lado del eje | Hoja que gira sobre un eje a un quinto de su canto |
| Puerta de cristal templado | 0,90 × 2,10 m | 1,10 m | Hoja fina azul vidrio y arco | Luna sin bastidor con pernios y tirador de acero |
| Puerta de vaivén | 0,80 × 2,10 m | 1,00 m | Arco continuo y arco discontinuo hacia la otra cara | Hoja con placa de protección de acero abajo, en las dos caras |
| Puerta de entrada blindada | 0,95 × 2,10 m | 1,20 m | Hoja gruesa rellena y arco | Hoja de 7 cm, marco ancho, pomo centrado por fuera, escudo y mirilla |
| Puerta de entrada de hoja y media | 1,20 × 2,10 m | 1,50 m | Hoja principal con arco y hoja estrecha fija sin arco | Hoja principal (70 %) y hoja fija estrecha, con mirilla |
| Puerta corredera vista | 0,90 × 2,10 m | 1,40 m | Hoja paralela por fuera del muro, guía discontinua y flecha; sin arco | Hoja colgada de una galería por la cara elegida |
| Puerta corredera empotrada | 0,80 × 2,10 m | 1,20 m | Cajón discontinuo dentro del muro, hoja y flecha; sin arco | La hoja entra en el muro y deja ver su canto |
| Corredera de granero | 1,00 × 2,10 m | 1,50 m | Hoja por fuera del muro, guía continua y flecha | Hoja que tapa el dintel, pletina negra con ruedas y colgadores vistos |
| Corredera de dos hojas al centro | 1,40 × 2,10 m | 2,40 m | Dos hojas por fuera del muro, guía y dos flechas hacia los lados | Dos hojas que se recogen cada una hacia su lado |
| Corredera de vidrio a patio o terraza | 1,80 × 2,10 m | 3,20 m | Dos hojas acristaladas que se cruzan y flecha | Dos hojas de vidrio sobre un carril |
| Corredera elevadora de cuatro hojas a patio o terraza | 3,20 × 2,20 m | 4,00 m | Cuatro hojas acristaladas y dos flechas | Dos hojas fijas en los extremos y dos centrales que se abren por delante de ellas |
| Puerta de garaje seccional | 2,50 × 2,13 m | 5,00 m | Panel por la cara interior, guías discontinuas bajo el techo y flecha hacia dentro | Paneles ranurados; abierta, se recogen en horizontal bajo el techo |
| Puerta enrollable (garaje o local) | 2,50 × 2,20 m | 5,00 m | Persiana por la cara interior y cajón discontinuo | Lamas que se recogen en un cajón sobre el hueco |
| Puerta de garaje basculante | 2,50 × 2,10 m | 5,00 m | Panel, huella discontinua de la hoja abierta y flecha hacia la calle | Chapa nervada que, abierta, queda horizontal asomando un tercio a la calle |
| Puerta de garaje corredera lateral | 2,50 × 2,10 m | 5,00 m | Como la corredera vista | Hoja ranurada que se recoge a lo largo de la pared |
| Portón exterior corredero en pared | 3,00 × 2,00 m | 6,00 m | Hoja paralela al muro, guía y flecha, sin arco | Hoja de lamas antracita que se recoge junto al muro |
| Puerta de garaje batiente de dos hojas | 2,50 × 2,10 m | 5,00 m | Dos hojas y dos arcos | Dos hojas con cuarterones |
| Ventana | 1,20 × 1,20 m a 0,90 m | 2,60 m | Línea de vidrio | Marco, montante central y vidrio (la de siempre) |
| Ventana abatible de una hoja | 0,60 × 1,20 m a 0,90 m | 0,90 m | Línea de vidrio y arco discontinuo | Una hoja acristalada |
| Ventana abatible de dos hojas | 1,20 × 1,20 m a 0,90 m | 1,80 m | Línea de vidrio y dos arcos discontinuos | Dos hojas acristaladas |
| Ventana oscilobatiente | 0,80 × 1,20 m a 0,90 m | 1,20 m | Línea de vidrio y arco discontinuo | Una hoja con su manilla por la cara interior |
| Ventana de tres hojas | 1,80 × 1,20 m a 0,90 m | 2,70 m | Línea de vidrio y tres arcos discontinuos | Tres hojas acristaladas |
| Ventana con fijo superior (montante) | 1,20 × 1,60 m a 0,70 m | 1,80 m | Línea de vidrio y dos arcos discontinuos | Dos hojas bajo un travesaño y un vidrio fijo encima |
| Ventana de guillotina | 0,90 × 1,50 m a 0,90 m | 1,50 m | Dos líneas de vidrio, una por hoja | Dos hojas en carriles distintos, una sobre otra |
| Ventana corredera | 1,20 × 1,20 m a 0,90 m | 3,00 m | Dos líneas de vidrio desplazadas que se solapan | Dos hojas en carriles distintos |
| Balconera (hasta el suelo) | 1,20 × 2,10 m desde el suelo | 1,80 m | Dos hojas y dos arcos continuos | Dos hojas acristaladas hasta el suelo |
| Ventana fija | 1,00 × 1,20 m a 0,90 m | 3,00 m | Doble línea de vidrio | Un solo vidrio sin montante |
| Ventanal fijo hasta el suelo | 1,50 × 2,10 m desde el suelo | 4,00 m | Doble línea de vidrio | Un vidrio fijo de suelo a dintel |

Las elevaciones se miden desde el suelo de la estancia del muro. Los planos guardados antes de existir los tipos se abren como **Puerta abatible** y **Ventana**, con el mismo dibujo y el mismo modelo de siempre.

Al colocar una puerta nueva en una **fachada a la calle**, entra como **puerta de entrada blindada**; la vista previa ya la muestra así. En una pared interior o en la que da a un patio, entra como puerta abatible. Esto solo ocurre cuando colocas la puerta sin elegir tipo (tecla D); si eliges una tarjeta en Construir, se coloca el tipo elegido también en fachada. Una puerta pegada con ⌘/Ctrl+V conserva su tipo y su aspecto.

Los controles dependen del tipo. Una abatible tiene **Apertura (°)**, **Cambiar bisagra** (no en las de dos o tres hojas iguales; en la de hoja y media elige el lado de la hoja principal), **Invertir apertura** y **Abrir/Cerrar puerta**. Una corredera vista o de granero ofrece **Cambiar lado de apertura** (hacia dónde se recoge) y **Cambiar cara del muro**; la de dos hojas al centro, solo **Cambiar cara del muro**; la empotrada y la de vidrio de dos hojas, **Cambiar lado de apertura**; la elevadora de cuatro hojas abre siempre desde el centro. La plegable tiene **Cambiar lado de plegado** e **Invertir apertura**. Las de garaje seccional, enrollable y basculante tienen **Cambiar cara del muro** (la cara por la que se montan y hacia la que se recogen). En correderas, plegables y puertas de garaje, **Abrir puerta** la recoge del todo y **Cerrar puerta** la extiende sobre el hueco. Las ventanas abatibles, la oscilobatiente, la de tres hojas, la de montante y la balconera permiten invertir hacia qué cara se dibujan sus arcos; en el 3D sus hojas se muestran cerradas. La de guillotina no tiene controles de apertura.

#### Diseño, acabado y tirador

En Propiedades, la sección **Aspecto** elige cómo se ve cada puerta o ventana, independientemente de su tipo. Cada tipo enseña solo lo que admite:

- **Diseño de la hoja** (puertas abatibles, correderas de hoja, plegable y batiente): lisa, ranurada horizontal, con molduras de 2 o 4 cuarterones, con franja de vidrio, vidrio cuadriculado, de lamas o vidriera (vidrio completo). La geometría de ranuras, cuarterones, junquillos y lamas se construye en el propio 3D.
- **Acabado** (puertas salvo la de cristal templado y las correderas de vidrio): lacado blanco, roble, nogal, gris antracita o negro. Roble y nogal usan texturas de madera CC0 de la biblioteca de materiales. El acabado de una puerta se aplica a la hoja, al marco y a los tapajuntas. **Color de Pintar** vuelve a los colores de Pintar.
- **Tirador** (puertas de hoja y la de cristal templado): sin tirador, manilla, tirador largo vertical o pomo. En una puerta de entrada, el pomo va centrado en la cara exterior (por dentro lleva manilla) y el tirador largo, por fuera.
- **Marco** (ventanas y correderas de vidrio): PVC blanco, aluminio antracita o madera.

Una puerta con aspecto elegido lleva **tapajuntas** en las dos caras del muro (en una corredera vista, solo en la cara sin hoja). Las de entrada llevan además **mirilla** y escudo de cerradura. Si pintas la hoja o el marco desde **Pintar**, lo pintado manda: se quita el acabado y, si pintas el marco de una puerta, su hoja conserva el tono del acabado como color liso. Los planos anteriores, sin aspecto elegido, se ven exactamente igual que antes (hoja lisa o vidriera, sin tirador ni tapajuntas) hasta que eliges un diseño, un acabado o un tirador. El aspecto se ve en 3D y en las fotos de las tarjetas; en el plano 2D el símbolo sigue el tipo.

El espacio libre de cada puerta sigue su tipo: una abatible reserva el giro de cada hoja (la pivotante, también el del tramo de hoja al otro lado de su eje; la de vaivén, el giro hacia las dos caras); una corredera vista o de granero, la franja de pared por la que se desliza (la de dos hojas al centro, a los dos lados); una plegable, la franja de sus paneles; una empotrada o una corredera de vidrio, solo la hoja dentro del hueco. Las puertas de garaje seccional y enrollable reservan una franja bajo el techo, sobre el hueco (guías o cajón), que no impide aparcar ni poner muebles bajos debajo; la basculante reserva además, abierta, la franja de la calle por la que sale su hoja. Si un mueble ocupa ese espacio, el editor lo avisa como «El giro de la puerta choca…» o, en correderas, plegables y puertas de garaje, «El recorrido de la puerta choca…». La IA recibe el tipo de cada puerta y ventana: en el plano cenital ve los arcos de giro, la hoja y la guía de una corredera o la huella de una puerta de garaje, y en los alzados, montantes, triángulos de apertura (con el de basculado en la oscilobatiente), paneles de la plegable y de la seccional, lamas de la enrollable, travesaño de la guillotina y flechas de las correderas. Al amueblar y al revisar las imágenes trata la franja de una corredera o plegable como espacio libre, sin exigirle arco de giro.

Limitaciones actuales: en una pared curva, las hojas de puerta son rígidas sobre la cuerda del hueco y no llevan tapajuntas; los vidrios de las ventanas siguen el arco sin dibujar hojas separadas ni el montante de la ventana con fijo superior. La corredera vista no comprueba si la hoja recogida llega a una pared perpendicular; elige el lado de apertura con espacio. Las puertas de garaje se ven cerradas o abiertas del todo (sin posiciones intermedias de la hoja basculante). No hay **ventana de esquina**: cada abertura pertenece a un solo muro; para un ventanal en esquina, coloca una ventana fija en cada muro, lo más cerca posible de la esquina. Al importar un plano, la lectura reconoce la puerta de entrada, la de dos hojas, las correderas (vista, de granero, de dos hojas al centro y de vidrio de dos o cuatro hojas según su ancho), la plegable, la puerta de garaje seccional, la balconera y la ventana corredera cuando el dibujo las distingue (consulta [Puertas y ventanas que reconoce](/guias/importar-plano/#puertas-y-ventanas-que-reconoce)); el resto de tipos se eligen aquí.

## Orientación del inmueble y sombras

Abre **Herramientas → Orientación y sol**. Indica dónde está el **Norte del plano**: 0° arriba, 90° derecha, 180° abajo y 270° izquierda. Puedes usar el slider o escribir el ángulo. **Definir norte arriba** activa la orientación cuando aún no existe. No gira paredes ni muebles: cambia la referencia geográfica de todo el edificio, incluida cualquier otra planta.

La brújula aparece en Plano 2D, Amueblado y 3D. **Norte del plano** se refiere a los ejes del plano, no al rumbo de la cámara 3D. No forma parte de las capturas que se envían a los generadores.

Elige **Día**, **Tarde** o **Atardecer** y ajusta **Dirección de donde llega el sol** (0° Norte, 90° Este, 180° Sur, 270° Oeste) y **Altura del sol sobre el horizonte**. Las sombras van hacia el lado contrario; bajar el sol las alarga. Cada ambiente conserva sus propios ajustes. De **Noche** no hay sol y las sombras dependen de las luminarias existentes.

Los valores iniciales son de presentación: Día desde el sur a 55°, Tarde desde el suroeste a 30° y Atardecer desde el oeste a 12°. Se ajustan manualmente; no se calcula la posición solar real por ubicación, fecha y hora. Sin norte definido se conserva la iluminación anterior de presentación.

Con **Parcela real**, el norte se obtiene del giro sobre la ortofoto, que tiene norte arriba. Cambiar el norte aquí también cambia el giro del encaje; cambiar el giro allí actualiza la brújula. Al modificar norte o sol vuelve a confirmar el encaje en Parcela real. Una fotografía nueva conserva el norte que ya hayas indicado.

Los cambios se guardan en el borrador y admiten Deshacer/Rehacer. Guarda el proyecto para sincronizarlos. La maqueta actualiza sus sombras y las nuevas imágenes IA reciben la dirección física del sol; las imágenes ya generadas conservan sus sombras. Revisa la coherencia visual antes de aceptar cada diseño.

## Amueblar y propiedades

**Televisión existente al proponer con IA.** Amueblar conserva la pantalla que ya hay en cada estancia y no añade otra al colocar un mueble de TV. La aplicación también comprueba las propuestas anteriores. Una estancia distinta puede recibir su propia televisión; si quieres varias en la misma habitación, colócalas manualmente desde el catálogo.

**Sanitarios existentes al proponer con IA.** Amueblar completa cada baño sin repetir piezas: si ya tiene inodoro, lavabo, bidé o ducha, venga del plano importado, de una colocación manual o de un Amueblar anterior, solo añade lo que falta. Ducha y bañera cuentan como la misma función, y tampoco pone dos inodoros en el mismo baño aunque la IA los pida. Los sanitarios que ya sobran no se quitan solos: bórralos en el plano.

Abre **Amueblar** y explora **Habitaciones** o **Categorías** mediante miniaturas realistas. También puedes buscar por nombre o abrir **Ver todos los muebles**. Dentro de los resultados, despliega **Filtrar por estancia y estilo** si lo necesitas; **Todas las habitaciones y categorías** limpia los filtros y vuelve al inicio.

**Habitaciones** reúne trece estancias: Salón, Dormitorio, Infantil, Comedor, Cocina, Baño, Lavadero, Recibidor, Oficina, Garaje, Exterior, Iluminación y Decoración. Una pieza aparece en todas las estancias donde se usa:

- **Infantil:** las camas individuales (90 y 105 cm), mesillas, cómodas, el escritorio con su silla, armarios y estanterías.
- **Lavadero:** la lavadora, la secadora, la pila y el cesto de ropa. La lavadora y la secadora salen también en **Baño** y **Cocina**.
- **Recibidor:** el zapatero, las consolas, los percheros, el mueble de recibidor, bancos y el felpudo.
- **Garaje:** solo estanterías metálicas.

Al buscar, escribir el nombre de una estancia también encuentra sus piezas: «lavadora baño» encuentra la lavadora. En **Categorías**, los aparatos están en **Cocina y electrodomésticos**, incluida la lavadora.

**Literas, cortinas y descanso:** en **Dormitorio** e **Infantil**, busca «litera» para elegir madera natural o blanca, metal negro o cama doble inferior de 135 cm con cama superior de 90 cm. Todas incluyen colchones, ropa de cama, barandillas y escalera. Son una sola pieza: al cambiar medidas se escala el conjunto, sin modificar cada cama por separado.

Las cortinas aparecen en **Decoración**, **Dormitorio**, **Infantil** y **Salón**. Además de los dos paños habituales, hay **Cortina de lino para ventanal** (3,60 m de ancho y 2,60 m de alto) y **Cortina corta de lino** (1,20 × 1,40 m, elevada 90 cm), en natural/blanco roto, salvia y terracota. Mantienen el control de cobertura y el ajuste a la ventana en Propiedades.

En **Comedor**, busca «set de comedor»: mesa rectangular de roble con 4 o 6 sillas, o mesa redonda de mármol con 4 sillas. **Añadir al plano** coloca mesa y sillas juntas; la huella y las medidas incluyen todo el conjunto. Puedes moverlo, girarlo y escalarlo como un objeto; las sillas no se editan por separado. Amueblar no le añade otra ronda de sillas.

Al importar un boceto, una cama o mesa sin identificación específica se conserva como pieza suelta: solo se elige litera o set cuando la lectura los nombra expresamente.

En **Exterior** y **Salón**, busca «chill out»: sofá bajo de ratán de 2 o 3 plazas y sillón bajo con cojín crudo o gris para terrazas y zonas de descanso. También sigue disponible la rinconera con mesa. Las fichas de los nuevos muebles propios llevan foto de producto y comparten modelo entre plano y 3D; son guías para preparar el diseño.

Elige la variante, pulsa **Añadir al plano** y coloca el objeto. El catálogo permanece abierto al pulsar sobre el lienzo; puedes cerrarlo con su X o Escape. En **Propiedades**, revisa dimensiones, giro, elevación y acabados disponibles. Las imágenes de habitaciones y categorías son ilustraciones genéricas para orientarte. Las de Infantil, Recibidor, Lavadero y Garaje son renders de Blender con muebles del catálogo y texturas CC0; las demás se generaron con IA. No representan el modelo exacto de un producto ni un diseño aceptado de tu inmueble. Cada ficha conserva sus dimensiones, variantes y representación propia.

**Fotos de las fichas:** cada ficha del catálogo, y cada elemento de **Construir → Exterior y jardín**, muestra una foto del mismo modelo 3D que verás en la escena (con sus texturas, o sus volúmenes si no tiene modelo realista), en vista de tres cuartos con luz suave y fondo neutro, como en una tienda. La foto se genera en tu navegador la primera vez que la ficha aparece en pantalla; mientras tanto ves un marcador gris. Queda guardada en el navegador, así que la siguiente vez sale al instante. Si no se puede generar, la ficha muestra el dibujo de siempre. La foto es una guía de la pieza, no un diseño aceptado de tu inmueble.

El catálogo incluye modelos 3D realistas de Poly Haven, con licencia CC0. Los encontrarás buscando su nombre: taburetes de barra para la cocina, mesillas, una lámpara de mesa y un flexo, cómodas, aparadores y cajoneras, sofás, sillones y un puf, mesas de centro, mesas altas y de comedor, sillas, camas, estanterías, un escritorio, una cocina eléctrica con horno y plantas. Cada ficha muestra las medidas reales del modelo, y **Detalles y créditos** indica su autor, la licencia y la página de origen. El flexo aparece a 75 cm, la altura de un escritorio; las demás piezas se colocan en el suelo. Poly Haven no tiene lavadora, frigorífico, microondas actual ni lámparas de pie: para esas piezas se mantienen los modelos sencillos del catálogo. Estos modelos solo sirven de guía en el plano y en el 3D: el resultado final sale del diseño IA que aceptes.

**Muebles propios de Habiteka:** además, el catálogo trae una colección de muebles modelados por Habiteka con medidas de mercado y texturas CC0 (telas, bouclé, terciopelo, piel, roble, nogal, teca, mármol, ratán y cuerda). Incluye sofás de 2, 3 y 4 plazas en varios estilos (recto, nórdico con patas de madera, de brazos finos y Chester capitoné), sofás con chaise longue a la izquierda o a la derecha, meridianas, chaise longue de dormitorio, rinconeras en L, un sofá cama cerrado o abierto, un sofá modular por módulos, butacas y pufs; camas individuales de 90 y 105 cm y dobles de 135, 150, 160 y 180 cm con cabecero tapizado, capitoné, de madera, de listones, de forja o canapé, todas con ropa de cama; mesas de comedor rectangulares, redondas y extensibles con sus sillas y bancos; taburetes de barra con asiento a 65 o 75 cm, giratorios con o sin respaldo y bajos de cocina; y muebles de exterior (sofás de ratán, teca y aluminio, conjunto chill-out, sillas, tumbonas y mesas). Cada producto agrupa sus medidas y tapicerías en la misma ficha: elígelas en su desplegable. La foto de la ficha es una foto de estudio del propio modelo. **Amueblar** ve una sola variante de cada producto y, si no cabe, prueba la medida inmediatamente menor del mismo modelo. Los modelos antiguos que se veían igual que otro de la lista (por ejemplo, la butaca y el sillón de madera y piel) ya no aparecen en el catálogo, pero los planos que los usan se siguen abriendo igual.

**Muebles realistas en el plano:** los muebles con modelo 3D se dibujan en **Plano 2D** y en **Amueblado** con su vista desde arriba real (texturas, cojines, almohadas) y una sombra suave, en lugar de volúmenes de color. La primera vez que aparece cada modelo tarda una fracción de segundo; hasta entonces se ve el símbolo de siempre. Las piezas del catálogo que coloca **Amueblar** (camas, mesillas, sofás, sillones, mesas de comedor y de centro, sillas, taburetes, armarios, cómodas, aparadores, mueble de TV, estanterías, escritorio, lámparas, sanitarios, frigorífico y plantas) usan también un modelo realista, escalado a sus medidas. El color de catálogo conserva las texturas del modelo, y si pintas la pieza, el modelo toma ese color. El horno de pie sigue con su dibujo sencillo porque aún no tiene modelo a su medida.

**Sillas bajo las mesas:** en **Plano 2D** y **Amueblado**, arrastra una silla o un banco hacia la mesa. Puede entrar por el hueco libre bajo el tablero; el arrastre individual se detiene si toca una pata, un pie central, un travesaño o el tablero. También cuenta el respaldo y los brazos del asiento. Retira un poco la silla y muévela hacia el hueco entre los soportes para rodearlos. Las medidas, el giro y la elevación de ambas piezas se tienen en cuenta. El arrastre conserva el giro mientras entra: orienta primero la silla con Propiedades. Al mover varios elementos juntos se comprueba la posición final. La detección utiliza una aproximación conservadora del modelo, con un pequeño margen; modelos sin geometría de colisión vigente mantienen su envolvente de seguridad.

**Baño al amueblar:** el inodoro, la bañera, la bañera compacta, el plato de ducha y la columna que coloca **Amueblar** se ven con los modelos de baño de Habiteka (inodoro con cisterna vista, bañeras de faldón con grifo de repisa, plato extraplano de resina y columna de suelo), a su medida y sin deformarse. El plato de ducha del catálogo mide ahora 3 cm de alto, como un plato extraplano; los planos que ya lo tenían conservan su altura. El lavabo con mueble mantiene su modelo anterior, porque mide 85 cm hasta la encimera y los lavabos nuevos llegan a 1,05 m con el grifo. Los muebles de lavabo, los espejos y el resto de la colección se eligen desde el catálogo, en **Baño**.

**Almacenaje y electrodomésticos al amueblar:** la mesilla, el armario (blanco de 120 cm o de roble de 180 cm), la cómoda, el aparador, la vitrina, el zapatero, el mueble columna, el mueble de TV, la librería, la lavadora, la secadora, el lavavajillas y el frigorífico (un combi de 70 cm de ancho) que coloca **Amueblar** se ven con los muebles y electrodomésticos de Habiteka, a su medida y sin deformarse. Los planos que usaban el armario, el microondas, el frigorífico o el frigorífico americano antiguos los muestran también con los nuevos. En el catálogo encontrarás además armarios correderos y con espejo, sinfonier, muebles de TV suspendidos e industriales, estanterías, consolas, percheros, frigoríficos combi y americanos, microondas, horno de sobremesa, cafetera, campana y termo. El microondas, el horno de sobremesa y la cafetera se suben solos a la encimera o al mueble sobre el que los sueltas; la campana, el termo, los estantes y los muebles suspendidos aparecen a su altura en la pared.

**Alfombras realistas:** busca «alfombra», «kilim» o «yute» en el catálogo, o abre **Plantas y decoración**. Hay ocho diseños (lisa de lana beige, lisa gris, de pelo largo, bereber de rombos, kilim terracota, geométrica beige, yute natural y rayas crudo y carbón) en 140 × 200, 160 × 230 y 200 × 300 cm, y dos redondas: yute de Ø 160 cm y pelo largo de Ø 200 cm. Están hechas con texturas CC0 de tela, moqueta y fibra de ambientCG y Poly Haven, con su relieve, y miden 1 cm de alto: van pegadas al suelo y los muebles se apoyan encima sin chocar. En **Plano 2D** se ven desde arriba con su textura real. La **Alfombra** del catálogo se ve como la lisa de lana, su variante grande como la de yute y la antigua alfombra redonda como la de yute redonda; las medidas de la pieza no cambian. Igual que los demás modelos, son una guía: el resultado final sale del diseño IA que aceptes.

**Plantas de interior:** busca el nombre de la planta o abre **Plantas y decoración**. Hay 21 plantas en maceta modeladas por Habiteka:

- **Grandes:** monstera, ficus lyrata, olivo, kentia, strelitzia y bambú, en dos o tres alturas, de 60 cm a 1,90 m.
- **Pequeñas:** sansevieria, cactus, cuenco de suculentas, helecho, potus de sobremesa (sus tallos caen por la mesa) y potus colgante en macramé.

Las macetas son de barro con plato, cerámica blanca, cesta de fibra u hormigón. Todas llevan tierra y sus tallos nacen de ella. Las hojas son fotografías CC0 de hojas reales, recortadas por su silueta, con su curvatura y su caída. Por eso, en **Plano 2D** se ve el follaje desde arriba con sus huecos, no un círculo verde.

El potus colgante aparece a su altura, colgado del techo. La **Planta de interior** del catálogo y la que coloca **Amueblar** se ven como el ficus lyrata de 1,20 m en maceta de barro, a la medida de la pieza. Si pintas una planta, cambia el color de la maceta; las hojas y la tierra conservan el suyo.

Con **Ajuste** activo, al colocar o arrastrar una pieza que va contra la pared (armario, sofá, cama, cómoda, estantería, sanitario o electrodoméstico) cerca de un muro, se gira sola con la trasera contra él, como una puerta en su muro. Así puedes llevar ya girado un armario que no cabe girarlo donde está. Mientras la pared con la que ya está orientada siga a su alcance, la pieza conserva ese giro: un armario puesto en horizontal en un rincón no salta a la pared lateral. Solo se gira hacia otro muro cuando se aleja del suyo; mesas, sillas, alfombras, plantas y lámparas conservan el giro que les diste.

En la vista cenital, las alfombras se pintan debajo de todo y las sillas y bancos debajo de la mesa. **Ocultar original** se recuerda en el navegador: al recargar, el boceto sigue oculto hasta que pulses **Mostrar original**, igual que su opacidad.

En Plano 2D, los tiradores de esquina cambian el tamaño manteniendo la esquina opuesta y usan referencias magnéticas cuando Ajuste está activo. Alt permite crecer alrededor del centro. Las medidas de los tiradores de objetos se muestran en centímetros; el panel Propiedades usa metros. Elevación cambia la posición vertical, no el tamaño.

## Suelos, paredes y exterior

- Selecciona un suelo para cambiar acabado, textura y parámetros disponibles.
- Selecciona una pared y abre **Propiedades → Acabados** para elegir su cara interior o exterior. **Pintar**, en el menú del lienzo, abre esa misma sección.
- **Construir → Patio / terraza** permite superficies exteriores abiertas.
- **Exterior**, en la barra lateral, abre vegetación, cerramientos, pérgolas y equipamiento. También puedes entrar desde **Construir → Exterior y jardín**.
- **Añadir terreno** y **Añadir pavimento**, dentro de Exterior, muestran miniaturas de césped y pavimento para distinguir ambas superficies; un pavimento visual no habilita por sí mismo un recorrido.

### Jardín, superficies y caminos

En **Construir → Exterior y jardín** puedes elegir plátano de sombra, olivo, naranjo, pino, ciprés y palmera; boj bajo, seto de boj, laurel y fotinia; además de lavanda, romero, gramíneas, formios, macetas y huerto elevado. Las fichas de estas piezas usan renders de sus modelos. Los setos se dibujan por clics conservando la especie elegida y se dividen visualmente en módulos, respetando zócalos y puertas.

Las superficies **Asfaltado**, **Grava natural**, **Tierra compactada**, **Césped natural**, **Corteza de madera** y **Arena natural** crean una zona rectangular editable. Ajusta su posición, giro y medidas en Propiedades. Asfaltado cubre una zona sin marcas; **Plaza de parking** añade las líneas de aparcamiento. Estas superficies no habilitan por sí mismas una ruta de visita.

En **Caminos**, elige acabado, ancho entre 0,30 y 10 m, bordillos y vegetación a izquierda, derecha o ambos lados. Pulsa **Dibujar camino**: el primer clic inicia el trazo y cada clic posterior confirma un tramo. Escape termina conservando los tramos ya dibujados. Puedes elegir losas, pasos sobre césped o grava, adoquines, grava y tierra. Cada tramo y cada planta se edita por separado; en esquinas cerradas puede ser necesario recolocar plantas o ajustar los extremos. No se generan curvas ni uniones biseladas automáticamente.

**Añadir jardín variado · 4 × 3 m** coloca corteza, arbustos, lavanda, romero y gramíneas. Selecciona sus elementos para moverlos juntos o modifica cada planta por separado. Deshacer revierte la inserción completa.

La piscina, estanque, fuente, barbacoas, carpas, toldo y sombrilla disponen de modelos con piezas y materiales separados. La carpa conserva las opciones de recoger laterales.

Los vehículos incluyen **Coche compacto**, **Turismo moderno (berlina)**, **SUV** y **Furgoneta**, con carrocerías distintas, pasos de rueda, neumáticos, llantas, cristales, retrovisores y ópticas. Sus medidas iniciales (ancho × largo × alto) son 1,75 × 4 × 1,45 m; 1,80 × 4,60 × 1,50 m; 1,90 × 4,70 × 1,75 m; y 2 × 5,20 × 2,30 m, respectivamente. Puedes editar sus medidas, giro y color en Propiedades. El color cambia la pintura y conserva cristales, neumáticos, llantas y luces. Sin pintar, cada modelo trae su pintura de fábrica (compacto plata, berlina azul, SUV gris y furgoneta blanca), que es la que muestra **Pintar → Color de la carrocería** y la que reciben las imágenes con IA. Los vehículos ya guardados conservan sus medidas y muestran la nueva geometría.

Estos modelos sirven para colocar y medir elementos en el editor. El acabado visual sigue admitiendo mejoras; no sustituye los diseños IA aceptados del inmueble.

### Biblioteca de materiales

El selector de material (suelo, caras de pared, forjado, cubiertas, pilares, frentes de cocina y terreno) muestra unos 190 materiales con miniatura y nombre en español. Escribe en **Buscar material** (por ejemplo, «roble», «metro» o «gotelé») o elige una **Categoría**:

| Categoría | Ejemplos |
| --- | --- |
| Parqué y tarima | Roble natural, claro y gris, pino, arce, nogal, cerezo, wengué, espiga, tablero, Versalles, laminados |
| Baldosas y porcelánico | Porcelánico gris, blanco brillo, negro, pizarra y efecto caliza, gres, dameros |
| Baldosa hidráulica y barro | Hidráulicos azules y geométrico ocre, barro octogonal con taco, barro de patio |
| Mármol / Piedra y terrazo | Carrara, Thassos, crema marfil, Emperador, negro Marquina, travertino, granito, pizarra, terrazos |
| Microcemento y hormigón | Microcemento blanco roto, gris claro, arena, beige y gris oscuro; hormigón pulido y liso |
| Moqueta | Lana beige, bucle crudo, gris claro, gris jaspeada, beige de cuadros, azul marino |
| Azulejo de pared | Metro blanco, crema, azul, verde y rosa, zellige verde, cuadrado blanco, mosaico hexagonal |
| Pintura y estuco | Estuco blanco liso y fino, gotelé, pintura blanca, beige, arena, gris perla, gris piedra y antracita |
| Ladrillo visto | Rojo con junta blanca, rojo oscuro, naranja, amarillo, rústico, pintado y encalado |
| Madera (paredes y muebles) | Friso de lamas, machihembrado blanco, tablas, chapa de nogal y wengué, abedul |
| Fachada | Enfoscado rugoso, blanco y ocre, ladrillo caravista, mampostería, sillería, lajas, lamas grises |

También siguen **Tela** y **Exterior** (césped, gravilla, adoquines y pavimentos). Los materiales que ya usaban tus planos conservan su identidad y su aspecto; solo cambian su nombre al español y, en algunos, la categoría.

El mismo material se ve en **Plano 2D** como dibujo repetido y en 3D con su textura, relieve y brillo. Cada uno trae su tamaño real de repetición (una baldosa de 60 cm, un azulejo metro, una tabla de tarima); en el suelo puedes cambiarlo con **Tamaño de repetición** y orientarlo con **Giro de textura**. Todos son texturas CC0 de [ambientCG](https://ambientcg.com) y [Poly Haven](https://polyhaven.com) guardadas en Habiteka: el editor no las descarga de terceros y **Fuente y autores**, bajo la lista, enlaza la ficha original. Son una guía de acabados para el plano y el 3D; el resultado final sale del diseño IA que aceptes.

En **Elementos de exterior**, **Buscar elemento** y **Categoría** aparecen en filas separadas, antes de las tarjetas de resultados. Puedes combinar texto y categoría; **Todas** elimina el filtro de categoría. Las miniaturas de Construir, terreno y pavimento son ilustraciones genéricas generadas con IA para navegar, no diseños aceptados ni fotografías exactas de los elementos que se añaden al plano.

### Porche de entrada

En **Exterior → Elementos de exterior**, busca **Porche de entrada con cuatro columnas**, dentro de **Sombra y equipamiento**. La pieza mide inicialmente 3 × 2 m y 2,70 m de alto: tiene cuatro columnas con base y capitel y una cubierta continua, con los lados abiertos.

Colócala delante de la fachada, dejando la parte trasera hacia la casa. La **puerta de entrada** se añade aparte en el muro desde **Construir → Puertas**; el porche no crea huecos ni modifica la casa automáticamente.

En **Propiedades**, ajusta ancho, fondo, altura y giro. **Cota del suelo del porche** a **0 m** lo deja a ras; una cota mayor crea una base sólida y eleva las columnas y la cubierta. **Altura** se mide desde el suelo del porche hasta la parte superior de la cubierta.

Activa **Peldaños delanteros** para añadir el acceso centrado. Se calculan desde la cota del suelo y cambian junto al porche: a 0,60 m hay tres peldaños de 15, 30 y 45 cm, y la última subida llega a la plataforma de 60 cm. Las huellas miden 30 cm y el acceso tiene hasta 1,20 m de ancho, ajustándose si el porche es estrecho. Los peldaños sobresalen por delante del fondo de la cubierta. A ras no aparecen, aunque la opción esté activada. También puedes dejar la base sin ellos y colocar una escalera independiente.

El porche completo se mueve y gira como una pieza. El plano y el 3D representan la base y los escalones; sus columnas y cubierta cuentan como obstáculos, mientras el paso central queda libre. El recorrido de revisión reconoce la cota de la plataforma y la subida por los peldaños. Ajusta la cota de la puerta y del suelo interior para que coincidan con la entrada elevada. Como el resto del editor, es una guía geométrica del diseño.

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

**Alargar una pared hasta otra:** si al alargarla pasa por la esquina de otra pared, queda unida a ella en T. Si al soltar el extremo se pasa unos centímetros de la pared de destino, se queda en ella (o en su esquina, si está cerca) en lugar de cruzarla. Si aun así la cruzaría, la vista previa se pone en rojo y te pide soltarlo sobre una esquina o sobre la pared.

**Prolongar una pared más allá de una esquina:** al arrastrar el extremo de una pared, la esquina se mueve con todas las paredes que llegan a ella. Mantén **⌘ (Mac) / Ctrl (Windows)** mientras arrastras para mover solo las paredes seleccionadas, sin unirlas a esquinas ni a paredes; las guías de alineación siguen activas. Si la pared prolongada pasa por la esquina que dejó, esa esquina queda unida en T. Al dibujar una pared, ⌘/Ctrl evita que el tramo se pegue a esquinas y paredes. Mientras dibujas o arrastras un extremo, puedes **escribir la medida** en metros (por ejemplo, 3,25) y pulsar Enter para fijar la longitud en la dirección del ratón; la etiqueta de la vista previa muestra la longitud y el ángulo. **Alt + doble clic** sobre una pared añade una esquina en ese punto y selecciona los dos tramos para que la arrastres; el doble clic sin Alt sigue abriendo Propiedades. También puedes usar **Añadir esquina** en el menú de la pared seleccionada.

**Girar un mueble desde sus esquinas:** fuera de cada esquina del mueble seleccionado hay un círculo de giro, que se resalta al pasar el ratón. Arrástralo para girar el mueble sobre su centro; con Mayús gira en saltos de 15°. Los tiradores de las esquinas siguen redimensionando, y Alt lo hace desde el centro: el mueble crece por los dos lados sin desplazarse. Las pistas de abajo a la izquierda del lienzo recuerdan las teclas de lo que estás haciendo.

El menú de acciones de la selección permanece disponible en Plano 2D aunque Propiedades esté abierto. Para duplicar una pared o un objeto, mantén **⌥ Option en Mac / Alt** al comenzar a arrastrarlo y suelta en la nueva posición. El original se conserva y la copia queda seleccionada; una pared copia también sus huecos con identificadores independientes. En Amueblado, Option/Alt + arrastrar copia objetos y superficies de terreno o pavimento.

En **Plano 2D**, Option/Alt + arrastrar el cuerpo de una **puerta, ventana o hueco** crea una copia sobre el muro de destino al soltar. La vista previa indica si cabe; si invade otra abertura o no hay un muro válido, no se crea la copia y se conserva el original. Los tiradores de los bordes siguen ajustando el ancho: con Option/Alt, redimensionan alrededor del centro.
