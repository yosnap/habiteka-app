---
title: Techos, luces y tejado
description: Distingue el techo interior del tejado exterior.
---

## Techo interior y falso techo

Abre **Herramientas → Techo y luces** y elige una estancia interior cerrada. Puedes añadir techo, configurar acabado, descenso de falso techo y luminarias disponibles. Revisa alturas libres y posibles interferencias en **Modelo 3D**.

Los focos empotrados requieren soporte de falso techo; las luces no deben invadir muebles altos ni quedar fuera de su estancia. Utiliza las comprobaciones del panel para corregir posiciones.

## Cubierta plana actual

El editor permite material de la cara superior, acabado del canto y espesor de la cubierta plana asociados al techo. El descenso del falso techo modifica el interior; el espesor de cubierta es otro parámetro.

## Tejado exterior independiente

1. Abre **Editor → Construir → Tejado → Tejado exterior**. También puedes usar **Herramientas → Tejado**. En edificios de varias plantas, activa primero la planta que quieras cubrir.
2. Pulsa **Añadir tejado a las estancias interiores**. La cubierta inicial es plana.
3. Elige **Plana**, **Una agua**, **Dos aguas** o **Cuatro aguas**. Ajusta pendiente y orientación si es inclinada.
4. Ajusta alero, espesor, color y material. Los controles muestran su valor y unidad; puedes usar el slider o −/+.
5. Revisa las **Habitaciones que cubre** y **Patios y huecos interiores del tejado**: **Cerrar con el tejado**, **Dejar abiertos** o **Cerrar con cristal**. Los tejados nuevos cierran los vacíos rodeados por la cubierta; el cristal solo aparece si lo eliges. Los tejados anteriores conservan sus huecos hasta que cambies esta opción. Patios y terrazas exteriores no se añaden como habitaciones cubiertas automáticamente.
6. Pulsa **Ver tejado en 3D**. Guarda y aprueba esa revisión antes de generar nuevas imágenes o exportar el vídeo aprobado.

La huella conserva retranqueos, sin extenderse a terrazas fuera de su contorno. La opción de huecos afecta solo a vacíos completamente rodeados por el tejado, incluidos patios interiores o pasos excluidos de sus habitaciones. El cristal sigue las pendientes de la cubierta y es un material real, distinto de la transparencia de edición. La IA no decide abrir, cerrar o acristalar estos huecos. La altura arranca sobre los muros seleccionados; el acabado y la geometría llegan a las referencias y al contexto de las imágenes. Las imágenes antiguas no se actualizan al cambiar un tejado.

Esta opción se aplica a todos los vacíos interiores de la cubierta. Para convertir sus cristales en piezas individuales y reducir su tamaño, utiliza la edición en plano 2D descrita a continuación. La forma general del tejado sigue dependiendo de las habitaciones seleccionadas, el alero y su configuración; no se dibuja un contorno de cubierta libre.

Los muros seleccionados se prolongan automáticamente hasta la cara inferior del tejado inclinado, incluidos los hastiales. El cierre mantiene los acabados de cada cara del muro y no añade ventanas. No necesitas elevar manualmente todos los muros hasta la cumbrera: la parte superior sigue la pendiente. Compruébalo en vistas Frontal, Trasera, Izquierda y Derecha con **Techo: Sólido**.

Si modificas muros y cambian las habitaciones, revisa el panel y pulsa **Actualizar selección con las habitaciones actuales**. La exportación se bloquea si el tejado conserva referencias a estancias que ya no existen. Puedes quitar la cubierta y deshacer los cambios con los controles del editor.

Para una presentación exterior completa o una promoción, el tejado debe corresponder al inmueble. **Ver tejado en 3D** muestra su forma completa; las vistas de estudio ocultan elementos según la cámara.

## Cristales y ventanas en el plano 2D

1. Abre **Construir → Tejado**. Elige directamente **Cristal de techo**, **Ventana de techo** o **Salida de chimenea** para mostrar la cubierta y empezar a colocar la pieza. **Editar tejado en plano 2D · mostrar** permite editar las existentes. También siguen disponibles **Herramientas → Tejado** y **Herramientas → Vista → Tejado en 2D**. Si falta la cubierta, pulsa **Añadir tejado exterior**.
2. El contorno gris muestra el tejado sobre las paredes y las estancias. Las líneas discontinuas separan las pendientes y muestran las aristas y la cumbrera. Los botones **Añadir cristal**, **Añadir ventana de techo** y **Añadir salida de chimenea** permiten seguir añadiendo desde el plano.
3. Haz **un clic** dentro del contorno para colocar una pieza centrada: ventana de **0,78 × 1,18 m**, cristal de **1 × 1 m**, o chimenea de **0,50 × 0,50 m**. También puedes arrastrar entre dos esquinas para elegir su tamaño, de al menos **20 × 20 cm**. La vista previa se vuelve roja y explica el motivo si la posición no es válida. La pieza queda seleccionada; puedes moverla, redimensionarla con los tiradores y girarla.
4. También puedes elegir la pieza en **Piezas del tejado** y editar **Ancho proyectado**, **Fondo proyectado**, **Posición X**, **Posición Y** y **Giro**. Las longitudes son la proyección sobre el plano horizontal; en 3D el vidrio sigue la pendiente de la cubierta. Una ventana de techo debe estar en una sola pendiente, sin cruzar cumbreras o aristas. Si no cabe, muévela hacia el centro de una pendiente o reduce sus dimensiones.
5. Si ya tienes **Cerrar con cristal** sobre los patios, pulsa **Editar tamaño del cristal de los patios**. Se conserva su forma y cada cristal pasa a ser una pieza editable. Al reducirlo, el resto del vacío se cierra con tejado. Esta conversión cambia la opción general a **Cerrar con el tejado** y se puede deshacer.
6. **Configurar tejado** abre forma, pendiente y acabados desde el mismo plano. **Ver tejado en 3D** muestra la cubierta sólida. Pulsa **Ocultar tejado · cerrar edición** para volver al plano normal. Desde Construir también puedes **Ocultar tejado y techo en 3D** para examinar el interior. Estas opciones cambian la visibilidad, no borran la cubierta. Guarda la revisión y aprueba los cambios antes de preparar nuevos diseños.

**Eliminar** o Supr elimina la pieza seleccionada; **Deshacer/Rehacer** recupera las ediciones. Escape cancela la colocación o la selección. No se permiten piezas fuera del tejado ni solapes entre ellas. Para modificar el tamaño del vidrio completo de un patio, conviértelo primero; no coloques otra pieza encima.

Los huecos recortan tanto la cubierta opaca como el techo interior que haya debajo. La ventana de techo tiene vidrio y marco y se representa cerrada; todavía no hay un control de apertura de su hoja. Estas piezas son elecciones manuales, no decoración añadida por la IA. El contexto de nuevos diseños conserva sus tipos y medidas; las imágenes aceptadas anteriormente no se actualizan al editar la cubierta.

### Salida de chimenea

La salida es un conducto vertical hueco de ladrillo con sombrerete metálico. Selecciónala para ajustar **Altura sobre el tejado** (de 0,20 a 5 m; inicialmente 1,20 m). Se mide sobre el punto más alto de la cubierta bajo la pieza; el sombrerete añade 28 cm. Crea el paso en la cubierta y el techo interior y conserva posición, tamaño, giro y altura para los nuevos diseños. No añade una chimenea de salón ni conecta automáticamente un aparato interior: esos elementos se colocan aparte. Las fotos de Construir son renders de catálogo hechos con Blender, no diseños aceptados del inmueble.

La **altura máxima del tejado** del panel se refiere a la cubierta; no suma la altura de las chimeneas.

## Luz del proyecto

Día, Tarde, Atardecer y Noche permiten preparar escenas y resultados con momentos de luz distintos. Mantén una iluminación coherente entre las imágenes de un mismo vídeo. Para promoción geográfica, revisa el preset de la parcela y aprueba los cambios antes de exportar.

## Visibilidad de estudio

Las vistas transparentes o sin techo sirven para examinar el interior; no convierten la cubierta en vidrio ni eliminan luminarias del diseño. En una visita terminada revisa techos y cobertura de las estancias.

Al elegir **Cenital**, **Isométrica** o **Dron**, se ocultan automáticamente el techo interior y el tejado. **Frontal**, **Trasera**, **Izquierda** y **Derecha** conservan la cubierta y abren los muros exteriores del lado de cámara, junto con sus huecos y cortinas o persianas; mantienen los muros del fondo. Puedes mostrar el tejado completo desde su panel o cambiar manualmente los controles **Techo** y **Muros**.
