---
title: Opciones de escena
description: Plantas, estilos, superposiciones y exploración del plano guía.
---

En **Plano 2D**, **Amueblado** y **Modelo 3D**, pulsa **Opciones** arriba a la derecha. **Ctrl+K** o **Cmd+K** abre su buscador de comandos: escribe «plantas», «cuadrícula», «techo», «pies» o el nombre de un estilo. Escape cierra el menú y devuelve el foco al botón. En móvil, los submenús se abren dentro del mismo panel y tienen un botón para volver. En 2D aparecen las opciones de fondo, visibilidad, etiquetas, cuadrícula y unidades; las funciones de cámara, plantas separadas, iluminación y exploración corresponden a las vistas visuales.

## Plantas y visibilidad

Modelo 3D entra siempre en **Mover vista**. Puedes girar, desplazar y acercar la cámara sin seleccionar ni arrastrar paredes o muebles, también dentro de una estancia. El flotante de la derecha permite activar **Editar** para seleccionar elementos y abrir sus propiedades. Vuelve a Mover vista para seguir explorando; las flechas, Suprimir y pegar elementos quedan bloqueados mientras navegas. Amueblado conserva su edición directa. Este control no cambia la geometría ni el guardado del proyecto.

Los vehículos conservan sus materiales en ambas vistas. La carrocería incorpora barniz y reflejos para apreciar su forma desde ángulos oblicuos, sin cambiar la iluminación de la casa. Al cambiar su color, se pinta únicamente la carrocería; ruedas, cristales, faros y metales mantienen su acabado. Estas vistas siguen siendo guías del inmueble, no los diseños finales con IA.

En Modelo 3D, **Apiladas** coloca el edificio a sus cotas reales; **Separadas** añade cuatro metros visuales por nivel y destapa las plantas inferiores para inspeccionarlas, conservando la cubierta superior; **Solo planta activa, sin techo** aísla la planta seleccionada en la cabecera. Apiladas y Separadas requieren más de una planta. **Vista superior** coloca la cámara encima. Puedes mostrar u ocultar techo y cubierta de forma independiente.

**Paredes y exterior** permite mostrar/ocultar los muros y sus huecos, abrir los muros hacia la cámara o mostrar/ocultar jardín, vegetación exterior y terreno. Se conserva toda la geometría y las colisiones.

## Estilos, etiquetas y unidades

Opciones y sus submenús usan las mismas filas separadas y el mismo resaltado gris suave que la navegación del Editor. En Superposiciones, Cuadrícula, Nombres y Medidas se distinguen como opciones independientes. El selector de Fuente ocupa todo el ancho disponible; sus opciones conservan texto grande y muestran una marca junto a la elegida.

**Estilo de escena** ofrece Estudio, Papel, Atardecer, Nublado, Azul, Mediterráneo, Crepúsculo, Noche y Verde. En 2D cambia el fondo; en las vistas visuales también cambia la luz ambiental y la exposición. Los materiales del inmueble permanecen. En las vistas visuales están los cuatro ambientes de iluminación y sombras existentes.

**Superposiciones** activa cuadrícula, nombres de estancias y medidas generales de la planta activa. Las etiquetas quedan detrás de los menús; en Modelo 3D los nombres se muestran cuando la planta está destapada o tiene techo transparente. Las medidas generales son el ancho y fondo de la envolvente del plano, no una medición catastral.

En Plano 2D, el control de medidas muestra u oculta las cotas y áreas del plano. Las ayudas de una medición activa o seleccionada permanecen visibles para poder trabajar con ella. La superficie se coloca debajo del nombre para evitar que lo tape.

Dentro de **Superposiciones → Formato de nombres**, elige fuente sans serif, serif o monoespaciada; tamaño entre 9 y 24 píxeles; negrita; color del texto; fondo visible o transparente; color del fondo y redondeado. La muestra permite revisar el aspecto. **Restablecer formato** recupera la etiqueta blanca con texto oscuro. Las tres vistas usan el mismo nombre, posición y formato, con tamaño constante en pantalla al cambiar el zoom. Las estancias sin etiqueta muestran un nombre provisional de trabajo; renombra el espacio desde Escena o sus propiedades para guardar su nombre en el proyecto.

**Medidas y escala** muestra esas medidas en metros o pies y permite elegir el paso de cuadrícula entre 0,5, 1, 2 y 5, con una marca junto a la opción activa. Las cotas automáticas y áreas de 2D también cambian a pies y pies cuadrados; las etiquetas de medida personalizadas conservan su texto. Es una escala de referencia visual: los campos de construcción siguen en metros y el tamaño real no cambia.

## Caminar hacia un punto

En Modelo 3D, **Explorar → Caminar por el plano guía** coloca la cámara dentro. Haz clic o toca un punto de suelo libre y visible de la planta actual para caminar hacia él. La ruta busca pasos transitables; no atraviesa paredes, ventanas, muebles o puertas cerradas. Arrastrar cambia la mirada. Las flechas y los controles de movimiento cancelan el destino; Pausar o Escape detienen el desplazamiento.

Para pasar entre plantas utiliza los controles de marcha y las escaleras transitables existentes; el clic se limita a la planta actual. Salir recupera la cámara exterior.

## Alcance de estos ajustes

El fondo, cuadrícula, visibilidad, unidades y formato de etiquetas son ajustes compartidos entre 2D, Amueblado y Modelo 3D. En un proyecto se recuerdan por usuario, proyecto y zona durante la misma pestaña, también al recargar. Si el almacenamiento local no está disponible, se mantienen mientras el editor permanezca abierto. No cambian la geometría, la aprobación ni los diseños IA aceptados. La disposición de plantas y los modos de cámara siguen siendo ajustes propios de la escena visual.

Al entrar en Amueblado o Modelo 3D, la escena se muestra después de aplicar su cámara inicial o recuperar su encuadre guardado, sin enseñar primero otra perspectiva. Durante capturas y recorridos se recuperan la disposición real, la arquitectura y el aspecto de referencia, sin cuadrícula ni nuevas etiquetas. La exploración comprueba el plano guía: no genera una presentación final ni consume IA; las visitas finales requieren diseños IA aceptados.
