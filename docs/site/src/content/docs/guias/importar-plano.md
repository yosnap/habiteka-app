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

## Corregir sobre el original y guardar

En **Muros y medidas**, activa **Superponer sobre el original**. Pulsa una puerta o un muro para abrir **Revisar medidas** con ese elemento seleccionado. La revisión incluye zoom, Encuadrar y Mano; desactiva Mano para seleccionar elementos. Puedes regular la opacidad de la geometría.

- **Puertas:** selecciona la puerta sobre el plano y usa los deslizadores de ancho y posición para ajustarla rápidamente. Los campos numéricos permiten indicar medidas exactas. También puedes cambiar el lado de apertura y la bisagra. El ancho modifica el hueco y el arco. Se rechazan los anchos que no caben y los solapamientos con otros huecos. Las opciones aparecen en las propiedades de la puerta seleccionada; no hay un listado separado de puertas y arcos.
- **Muros:** cambia longitud, grosor y coordenadas de sus extremos, o arrastra los puntos resaltados. Las esquinas compartidas se desplazan conjuntamente. Para añadir o borrar estructura, continúa en el Editor.
- **Avisos:** pulsa un aviso asociado a una estancia para resaltarla. Los avisos generales muestran el ajuste de ancho total; no identifican un muro concreto.

**Deshacer geometría** y **Rehacer** recuperan las ediciones de muros y puertas de esta sesión, hasta guardar. Las cotas escritas son referencias: cuando se conservan los muros detectados, cambiar una cota no desplaza esos muros; corrige su geometría explícitamente.

Las posiciones corregidas manualmente se conservan en medidas reales. Si cambias después la escala global, vuelve a comprobarlas sobre el original.

**Guardar revisión** conserva las medidas, los muros y las puertas corregidos para volver más tarde. Espera el mensaje **Revisión guardada en el proyecto**. Si sales con cambios pendientes, puedes guardar y volver, descartarlos o seguir revisando. Una revisión guardada no equivale a aprobar su fiabilidad ni actualiza todavía el documento del Editor. Si otra pestaña ha guardado una revisión más reciente, recarga antes de continuar.

Después, **Enviar al editor** aplica la revisión guardada y pide confirmar la sustitución del plano existente. Guardar y recalcular no realiza una evaluación IA de pago; los avisos y bloqueos de revisión siguen siendo aplicables.

En el Editor del proyecto, **Mostrar original** sigue disponible después de guardar otra revisión. No es necesario volver a enviar el plano para recuperar el fondo: mostrar la referencia no sustituye tus ediciones. El fondo corresponde a la importación conservada actualmente en el proyecto; comprueba su concordancia si has importado otro plano.

## Comprobación en el editor

Alterna **Plano 2D**, **Amueblado** y **Modelo 3D**. Revisa alturas, huecos y acceso entre estancias. En el Editor del proyecto, la importación aplicada conserva el original como referencia en Plano 2D y Amueblado: usa **Mostrar/Ocultar original** y su opacidad para contrastar y continuar editando.

Continúa en [Herramientas del editor](/editor/herramientas/).
