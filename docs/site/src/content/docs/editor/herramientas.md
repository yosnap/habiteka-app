---
title: Herramientas del editor
description: Qué hace cada herramienta y cómo revisar sus resultados.
---

## Cómo orientarte

Las pestañas **Asistente, Plano, Editor, Diseños, Vídeos e Historial** se mantienen en la parte superior del proyecto. En el editor, la cabecera reúne planta, deshacer/rehacer, guardado, **Vídeos** y **Diseñar con IA**.

Abre **Herramientas** para visibilidad, selección por tipo, recorrido del plano, contexto IA, techo y luces, tejado, parcela real, exportación y aprobación. Solo aparecen las acciones disponibles para ese proyecto. Los botones, enlaces, tarjetas que abren opciones y desplegables muestran el cursor de mano; los controles deshabilitados se distinguen visualmente.

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
