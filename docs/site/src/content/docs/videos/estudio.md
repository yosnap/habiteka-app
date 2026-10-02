---
title: Crear vídeo en un solo lugar
description: Preparar construcción, publicidad o recorrido desde el estudio de vídeos.
---

## Abrir el estudio

En cualquier proyecto, abre la pestaña **Vídeos**, el botón **Vídeos** de la cabecera del editor o **Crear vídeo** en la vista aprobada. El estudio reúne preparación, ajustes, creación y resultados. Conserva la zona activa del proyecto.

Vídeos es una página propia: no abre un modal sobre el plano. Las pestañas del proyecto siguen visibles. **Volver al editor** regresa a la edición y **Mis diseños** abre la galería para revisar y aceptar imágenes. Al entrar en el editor se mantiene la edición; la revisión aprobada solo se abre cuando la solicitas.

Elige **Construcción**, **Publicidad** o **Primera persona**. La pieza combinada se indica como pendiente, sin un botón que parezca disponible. **Vídeos guardados** reúne los resultados existentes.

Si falta una versión aprobada o ha cambiado el proyecto, **Revisar versión del proyecto** abre su confirmación de luz y versión dentro de Vídeos. Esto no acepta las imágenes por ti: cada render se revisa y acepta en Diseños.

Para construcción y primera persona, sigue tres pasos en la misma página:

1. **Elige los diseños**: aparecen primero las imágenes utilizables. Si faltan, abre **Revisar y aceptar diseños**. En **Gestionar imágenes y ver las no disponibles** puedes mostrar las demás y limpiar la galería.
2. **Ajusta el vídeo**: escribe un nombre y elige duración. Despliega **Calidad, sonido e indicaciones** para personalizarlo.
3. **Revisa antes de generar**: consulta el coste previsto y pulsa **Revisar vídeo antes de generar**. Este paso prepara las referencias sin consumir IA; el envío de pago requiere su confirmación posterior.

| Opción | Qué produce | Qué necesita |
|---|---|---|
| Construcción → Mis diseños | Piloto H3 de 8 s; 12 s opcionales para amueblado. | Imágenes IA aceptadas de una tanda compatible con el plano guía aprobado, KIE activo y confirmación de coste/envío. |
| Publicidad → Mis diseños | Presentación de imágenes generadas con movimiento suave y fundidos. | Imágenes IA aceptadas, compatibles con el plano guía aprobado, con estilo y luz coherentes. |
| Publicidad → Vídeo guardado | Otro MP4 horizontal/vertical con panel de cotas opcional; conserva sonido y duración del original. | Montaje o H3 desde diseños aceptados, con fuentes todavía aceptadas; H3 debe estar revisado y aceptado. |
| Primera persona → Mis diseños | Piloto H3 interior de 8/12 s dentro de una estancia. | Diseño interior IA aceptado con cámara verificada, paredes y techo completos, una misma tanda; confirmación de coste/envío. |
| Construcción + visita | Pendiente sobre diseños aceptados. | No se sustituye por un recorrido del plano. |

:::note[Diseños aceptados como fuente]
Todos los vídeos y visitas finales deben conservar los renders IA que hayas aceptado en **Diseños**. El plano y su 3D aportan geometría y medidas; no son material final ni una alternativa cuando faltan imágenes. La auditoría automática no sustituye **Aceptar este diseño**. Primera persona permite un piloto de una estancia; la visita virtual continua y la pieza combinada siguen pendientes.
:::

## Poner nombre y limpiar las imágenes

El campo **Nombre del vídeo (opcional)** está en los ajustes antes de preparar o crear cualquier modalidad. Admite hasta 100 caracteres. Si lo dejas vacío, se utiliza la etiqueta automática. En **Vídeos guardados → Cambiar nombre** puedes renombrar los resultados existentes; el nombre también aparece al elegir **Publicidad → Vídeo guardado**, en Diseños y en el Historial. Las tareas H3 en curso conservan sus controles de seguimiento: espera a que terminen para renombrarlas.

En construcción y primera persona, despliega **Gestionar imágenes y ver las no disponibles**. En publicidad, utiliza **Mis diseños**. Puedes limpiar las imágenes:

- Para quitar una sola, pasa el puntero por su miniatura y pulsa el icono de papelera. También está disponible al enfocar la tarjeta con el teclado; en pantallas táctiles se muestra directamente.
- Para quitar varias, pulsa **Limpiar imágenes**, marca las casillas de eliminación y pulsa **Mover N a la papelera**. Estas casillas son distintas de las que eligen referencias para generar un vídeo.
- **Seleccionar todas** permite limpiar las imágenes mostradas. **Seleccionar no válidas** facilita quitar las rechazadas en construcción o las de otra revisión en el montaje. El máximo es de 200 por selección.
- **Deshacer limpieza** restaura la última selección retirada. **Papelera de imágenes** permite restaurarlas también después de cerrar el estudio; puedes recuperar una o todas las mostradas. La retención predeterminada es de 30 días.

Puedes quitar cualquier imagen mostrada, aunque no sea válida para el vídeo. Desaparece de Diseños y del material disponible para nuevos vídeos en esa zona. Los MP4 guardados se conservan. Restaurar una imagen conserva su revisión y su rechazo: no la convierte en una referencia válida.

## Construcción desde mis diseños: prueba H3

1. Abre cada referencia en **Diseños** y pulsa **Aceptar este diseño** tras revisarla. Elige **Construcción** en Vídeos. La selección inicial propone una cenital (o isométrica/dron si falta) y un exterior cerrado de la tanda más reciente compatible con la aprobación. Puedes añadir vistas de apoyo de esa tanda. H3 admite de una a nueve imágenes. El piloto exige una misma tanda, al menos una cenital, isométrica o dron del conjunto y una vista del exterior con fachadas completas y cubierta visible.
2. Comprueba las miniaturas y **Se incluye**. Se utilizan las selecciones guardadas con cada render, incluidas zonas exteriores, escaleras y rampas. No se aplica el recorte de estancias cerradas «Solo la casa». Si faltan zonas, completa las referencias del diseño antes de generar.
3. Elige **8 s** o **12 s**, calidad **768P** para un piloto económico o **2K**, sonido solicitado e indicaciones. Se pide que los muros crezcan consecutivamente en tres segundos; el modelo debe demostrar que respeta ese ritmo.
4. Pulsa **Revisar vídeo antes de generar**. Este paso guarda imágenes, ámbito, versión, guion y coste previsto; no envía medios a KIE ni consume IA.
5. Revisa las imágenes y el guion preparado. **Modificar selección y guion** permite volver a los ajustes antes del envío. Confirma el envío de esas imágenes a **KIE/MiniMax**, incluida la parcela si aparece en ellas, y el presupuesto. Pulsa **Generar prueba H3** para iniciar un único intento de pago.
6. Tras el envío aparece **Consultar resultado sin regenerar**, también disponible en **Vídeos guardados**. Recupera la tarea existente; no crea otro clip. Cuando termina, el MP4 se archiva en el proyecto y queda **Pendiente de revisar**.
7. Reproduce todo el clip y acepta o rechaza la prueba. Comprueba todas las zonas, tejado, aleros, pérgolas, huecos y muebles, también antes de colocar la cubierta. Cuenta los muebles repetidos y revisa que no aparezcan jardines o construcciones ajenos a las referencias. Comprueba el crecimiento individual de los muros y el orden de los acabados: el guion no garantiza los tiempos. Rechazar conserva el MP4, no inicia otro intento ni garantiza devolución del coste del proveedor.

**Los muebles provienen de las imágenes elegidas.** Se pide conservar cantidad, posición, forma, colores y materiales del diseño: cuatro camas visibles en el diseño no se sustituyen por la cama del plano original. No se adjunta el inventario del editor. Esto es una instrucción al modelo, no una garantía de fidelidad: si cambia muebles o elimina zonas, rechaza el clip. Las vistas seccionadas ayudan a ver la distribución; **Exterior terminado**, en los ángulos de **Diseñar con IA**, aporta la referencia con fachadas y tejado completos. Si falta una vista de ese tipo, el estudio indica el motivo y bloquea la preparación y el envío de una preparación antigua.

Las miniaturas seleccionadas indican su función: **Distribución y muebles**, **Fachadas y tejado** o **Apoyo de geometría**. La cenital seleccionada tiene prioridad para todos los muebles, incluidos los del patio; si falta, se utiliza una isométrica o dron. Si no seleccionas una vista de distribución, la preparación se bloquea y explica cuál falta. El exterior fija la envolvente y el encuadre oblicuo, sin reemplazar muebles porque muestre otro interiorismo. El guion pide una cámara fija durante la obra y un desplazamiento final corto, sin forzar una vuelta completa hacia caras no documentadas. En la prueba preparada, las miniaturas están numeradas en el mismo orden del guion y del envío. Revisa esos papeles en **Guion preparado** antes del envío. Las preparaciones anteriores conservan su guion: modifica la selección para preparar otro con estas reglas.

Esta prioridad resuelve qué diseño pedir cuando cambian sofás o sillas entre imágenes; no corrige las imágenes ni garantiza que el vídeo obedezca. Si las referencias contradicen muros, cubierta o accesos, completa o corrige esas referencias antes de pagar una prueba.

### Fotos con tabiques ocultos y accesos inventados

Una foto cuyo recorte registrado incluye tabiques interiores aparece como **No válida para construcción**, con su selección desactivada. Se conserva en la galería, pero no puede prepararse ni enviarse a H3, incluso si estaba en una preparación antigua. Vuelve a **Diseñar con IA**, prepara esa vista y revisa la previsualización local sin coste: solo debe abrirse la fachada del lado de la cámara. Crear la nueva imagen sí consume IA.

La selección desactivada impide usarla como referencia; no impide eliminarla desde su papelera o mediante **Seleccionar no válidas**.

La comprobación del recorte se aplica también antes de generar nuevas imágenes. Detecta muros ocultos registrados en la captura; no acredita por sí sola que todos los píxeles de un render sean correctos.

El guion preparado añade cantidad, forma, huella y posición local de escaleras, rampas y descansillos de la aprobación que estén dentro del ámbito elegido. Una rampa no debe convertirse en peldaños y un descansillo no es otra escalera. El permiso para rediseñar cocina, sanitarios y armarios no permite cambiar la estructura. Son instrucciones al generador: si duplica o mueve accesos, o borra tabiques durante el giro, rechaza el vídeo.

El presupuesto de salida de 8 s con cinco referencias es **$0.32 a 768P** o **$0.52 a 2K**; cada referencia adicional a la quinta suma **$0.02**. Se muestran también los créditos que se reservarán. No se adjunta vídeo de entrada en este piloto. Tarifa orientativa contrastada el 01/10/2026; auditorías e intentos adicionales no están incluidos. [Tarifa y modelo KIE H3](https://kie.ai/minimax-h3).

Un envío interrumpido puede haberse aceptado en KIE: si aparece **Envío sin confirmar**, revisa esa tarea antes de otra prueba. No hay reintentos automáticos de generación. Si hay identificador, puedes volver a consultar; si falla la descarga, la tarea se conserva para recuperarla sin pagar otro clip. El piloto se solicita sin cifras. Tras revisarlo y aceptarlo, **Publicidad → Vídeo guardado** permite añadir un panel con las medidas globales del diseño aprobado, sin otra generación IA. Las cotas ancladas a la geometría y al movimiento de un clip IA siguen pendientes.

El identificador de una tarea aceptada se guarda antes de registrar su coste. Si se interrumpe ese registro, **Consultar resultado sin regenerar** vuelve a conciliar el coste y los créditos de la misma tarea, sin crear ni cobrar un segundo intento. Si aparece saldo pendiente de conciliación, conserva la tarea y vuelve a consultarla cuando se recupere el servicio.

## Publicidad y modalidades pendientes

En publicidad, utiliza imágenes IA aceptadas o un montaje/H3 aceptado de esos diseños. Elige formato y cotas y prepara la vista previa antes de guardar o descargar. No necesitas una ruta del editor; consulta la [guía de montajes y anuncios](/videos/montaje-imagenes/).

El panel de cotas muestra medidas globales del plano guía aprobado; no decide el mobiliario ni reconstruye el movimiento de cámara del vídeo. Las cotas geométricas con oclusiones sobre clips IA siguen pendientes.

**Construcción + visita** y la visita virtual continua no se pueden crear todavía sobre diseños aceptados. El estudio las marca como pendientes; puedes elegir por separado construcción o primera persona.

## Hiperrealismo y revisión

El objetivo es una filmación hiperrealista del diseño aceptado. Los guiones H3 lo solicitan, pero no lo garantizan. Comprueba cada fotograma relevante: continuidad de paredes, tejado, pérgolas, accesos, cantidad y posición de muebles, texturas y luz. Si un resultado modifica el diseño o parece una maqueta, recházalo antes de utilizarlo en publicidad.

## Revisar y descargar

Los resultados aparecen en **Vídeos guardados** con reproducción y descarga. Las muestras 3D antiguas se conservan como archivo histórico, identificadas como guías; no se pueden crear nuevas ni elegirlas como originales de publicidad.

El montaje y la composición del anuncio no generan vídeo IA. Las imágenes y las pruebas H3 sí requieren su presupuesto y consentimiento. No hay generaciones automáticas ni garantía de fidelidad profesional hasta revisar el resultado real.
