---
title: Importar un plano
description: De una foto o PDF al plano editable con medidas revisadas.
---

## Preparar la fuente

Las dimensiones globales extraídas de una imagen son datos de la extracción, no cotas verificadas por el usuario. Compáralas con medidas reales. Tras editar la geometría, la evaluación del Editor analiza la estructura actual: los avisos iniciales no se presentan como mediciones nuevas. Si la estructura permite continuar pero queda pendiente la comparación con el original, se mantiene una confirmación explícita antes de generar. Una puntuación alta no verifica que el plano coincida con la imagen original.

En **Plano**, las tarjetas iniciales permiten **Subir una foto del plano**, **Dibujar un boceto**, **Importar CAD o PDF** o **Usar mi plano del editor**. Si ya existe una importación, puedes continuarla desde esa tarjeta.

Si la imagen necesita limpieza, utiliza el redibujado técnico para estructura o el decorado para mobiliario. Selecciona la imagen que quieras importar. Las pestañas **Imagen del plano**, **Muros y medidas** y **Vista generada** separan el material de referencia de su interpretación. La franja de etapas muestra el estado de Original, Plano editable, Diseños y Vídeos.

## Revisar antes de editar

1. Pulsa **Importar este plano**.
2. Revisa la tabla de medidas y corrige las cotas incorrectas.
3. Pulsa **Guardar y recalcular revisión** para conservar las correcciones en el proyecto sin volver a llamar a la IA.
4. Si falta escala fiable, indica **Ancho total real**.
5. Comprueba paredes, huecos y habitaciones.
6. Pulsa **Enviar al editor** y revisa la confirmación: reemplaza el plano actual del proyecto.

:::tip
Una imagen bien presentada no garantiza medidas correctas. Comprueba al menos una dimensión real conocida antes de aprobar.
:::

## Puertas y ventanas que reconoce

La lectura del plano o del boceto distingue el tipo de puerta o ventana cuando el dibujo lo muestra con claridad. En el editor llega con ese **Tipo**, que puedes cambiar después en Propiedades (consulta [Tipos de puerta y ventana](/editor/herramientas/#tipos-de-puerta-y-ventana)):

- **Puerta de entrada blindada:** la de la fachada principal o la rotulada «Entrada» o «Acceso».
- **Puerta de dos hojas:** dos arcos que abren desde los dos extremos del mismo hueco.
- **Corredera:** sin arco, con la hoja dibujada paralela al muro o con flechas de deslizamiento. Si mide 1,40 m o más, o sale a un patio o una terraza, entra como **Corredera de vidrio a patio o terraza**; desde 2,80 m, como **Corredera elevadora de cuatro hojas a patio o terraza**; si es más estrecha, como **Puerta corredera vista**.
- **Corredera de granero:** una sola hoja colgada por fuera de la cara del muro, con su guía dibujada a lo largo de la pared o rotulada «granero».
- **Corredera de dos hojas al centro:** dos hojas paralelas al muro que se separan desde el centro, con flechas hacia los dos lados.
- **Puerta de garaje seccional:** puerta ancha (de unos 2,2 a 5 m) de un garaje, cochera o parking, sin arco, dibujada como una línea por la cara interior.
- **Puerta plegable (acordeón):** hojas dibujadas en zigzag.
- **Balconera (hasta el suelo)** y **Ventana corredera:** cuando el dibujo las diferencia de una ventana normal. La balconera entra desde el suelo y con 2,10 m de alto.

Lo que la lectura no distingue entra como **Puerta abatible** o **Ventana**, con tres excepciones:

- Una puerta sin otra marca en la fachada que da a la calle entra como puerta de entrada. Si la lectura ya ha señalado cuál es la entrada, las demás puertas de esa fachada se quedan abatibles.
- Un paso de 1,40 m o más sin hoja dibujada, entre una estancia y un patio o una terraza, entra como corredera de vidrio (desde 2,80 m, como la elevadora de cuatro hojas). Para eso el patio o la terraza deben figurar como estancia exterior del plano.
- Un hueco de 2,20 m o más en la fachada de una estancia rotulada «Garaje», «Cochera» o «Parking» entra como **Puerta de garaje seccional**, con su ancho medido, aunque la lectura solo vea un hueco. Si es otro tipo de puerta de garaje (enrollable, basculante, corredera lateral o batiente), cámbialo en Propiedades.

El ancho es el medido en el plano. Si el plano no lo indica, se usa el habitual del tipo: por ejemplo, 1,40 m en una puerta de dos hojas o 2,50 m en una de garaje. Cada tipo reconocido entra también con su aspecto por defecto (diseño, acabado y tirador o marco), el mismo de su tarjeta en Construir. La lectura no reconoce la corredera empotrada, la puerta vidriera, la pivotante, la de cristal templado, la de vaivén, la de entrada de hoja y media, las puertas de garaje distintas de la seccional ni las ventanas fija, abatibles, oscilobatiente, de guillotina, de tres hojas o con montante, porque en planta no se distinguen con seguridad: elígelas en Propiedades. Los planos que ya están en el editor no cambian. Una importación hecha antes se leyó sin estos tipos: si la envías de nuevo al editor, solo se aplican las excepciones anteriores (la del garaje, si aquel hueco se midió de 2,20 m o más); para distinguir los demás tipos hay que extraer el plano otra vez.

## Corregir sobre el original y guardar

En **Muros y medidas**, activa **Superponer sobre el original**. Pulsa una puerta o un muro para abrir **Revisar medidas** con ese elemento seleccionado. La revisión incluye zoom, Encuadrar y Mano; desactiva Mano para seleccionar elementos. Puedes regular la opacidad de la geometría.

- **Puertas:** selecciona la puerta sobre el plano y usa los deslizadores de ancho y posición para ajustarla rápidamente. Los campos numéricos permiten indicar medidas exactas. También puedes cambiar el lado de apertura y la bisagra. El ancho modifica el hueco y el arco. Se rechazan los anchos que no caben y los solapamientos con otros huecos. Las opciones aparecen en las propiedades de la puerta seleccionada; no hay un listado separado de puertas y arcos.
- **Muros:** cambia longitud, grosor y coordenadas de sus extremos, o arrastra los puntos resaltados. Las esquinas compartidas se desplazan conjuntamente. Para añadir o borrar estructura, continúa en el Editor.
- **Avisos:** pulsa un aviso asociado a una estancia para resaltarla. Los avisos generales muestran el ajuste de ancho total; no identifican un muro concreto.

**Deshacer geometría** y **Rehacer** recuperan las ediciones de muros y puertas de esta sesión, hasta guardar. Las cotas escritas son referencias: cuando se conservan los muros detectados, cambiar una cota no desplaza esos muros; corrige su geometría explícitamente.

Las posiciones corregidas manualmente se conservan en medidas reales. Si cambias después la escala global, vuelve a comprobarlas sobre el original.

**Guardar revisión** conserva las medidas, los muros y las puertas corregidos para volver más tarde. Espera el mensaje **Revisión guardada en el proyecto**. Si sales con cambios pendientes, puedes guardar y volver, descartarlos o seguir revisando. Una revisión guardada no equivale a aprobar su fiabilidad ni actualiza todavía el documento del Editor. Si otra pestaña ha guardado una revisión más reciente, recarga antes de continuar.

Después, **Enviar al editor** aplica la revisión guardada y pide confirmar la sustitución del plano existente. Guardar y recalcular no realiza una evaluación IA de pago; los avisos y bloqueos de revisión siguen siendo aplicables.

En el Editor del proyecto, **Mostrar original** sigue disponible después de guardar otra revisión. No es necesario volver a enviar el plano para recuperar el fondo: mostrar la referencia no sustituye tus ediciones.

## Fondo del editor

El fondo que muestra **Mostrar original** en el Editor es la imagen de la que salió su plano: al **Enviar al editor**, queda fijada la imagen que importaste (el boceto o el redibujado de la IA), alineada con los muros. Otra extracción o una captura del editor no la cambian.

Puedes elegir otro fondo en cualquier momento: en **Resultados del proyecto**, pulsa **Usar de fondo en el editor** en el original o en un redibujado. La imagen se alinea sola con los muros del plano del editor, sin IA ni coste, aunque el boceto no tenga sus proporciones exactas. La imagen elegida aparece marcada como **Fondo del editor**. Así puedes editar el plano sobre el redibujado de la IA, más limpio, o volver a tu boceto a mano. Una imagen sin muros reconocibles no se puede usar de fondo.

**Usar mi plano del editor** (**Traer el plano del editor**) crea una **Captura del editor** para generar vistas a partir del plano editable. La captura no sustituye el original del estudio ni el fondo del editor, y no se puede extraer ni usar de fondo: el plano ya es editable, y extraerlo de nuevo perdería información, como las puertas.

## Comprobación en el editor

Alterna **Plano 2D**, **Amueblado** y **Modelo 3D**. Revisa alturas, huecos y acceso entre estancias. En el Editor del proyecto, la importación aplicada conserva el original como referencia en Plano 2D y Amueblado: usa **Mostrar/Ocultar original** y su opacidad para contrastar y continuar editando.

Continúa en [Herramientas del editor](/editor/herramientas/).
