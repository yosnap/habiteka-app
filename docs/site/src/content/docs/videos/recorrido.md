---
title: Recorrido y muestra de obra
description: Crear un vídeo en primera persona desde el diseño terminado, paso a paso.
---

## Fuente del recorrido final

La primera persona y la visita virtual deben representar **diseños IA aceptados**, con el mobiliario y acabado de esas imágenes y aspecto de filmación real. El 3D del plano es una guía de geometría y medidas. Sus recorridos permiten comprobar pasos, pero no se exportan como vídeos finales ni se ofrecen como visita inmersiva.

**Primera persona** permite preparar y guardar el paseo por todo el inmueble, generar sus encuadres, revisar las imágenes, generar tramos enlazados y componer un MP4. Preparar es gratuito; generar imágenes, sus análisis y los tramos consume IA. La calidad y continuidad reales deben comprobarse reproduciendo los resultados: un trazado completo no acredita un vídeo correcto.

## Preparar el paseo completo

1. Abre **Vídeos → Primera persona** y elige la **Versión aprobada de origen**. Puede ser anterior: no incorpora cambios posteriores ni modifica el plano.
2. Elige **Luz de los diseños**. Las referencias se comprueban contra esa versión y esa luz.
3. Elige la **Entrada del paseo** en la lista o en el esquema. Un patio no equivale necesariamente al acceso principal. **Preparar las puertas abiertas** crea ese estado solo para la visita, sin editar el plano. Los umbrales unen suelos existentes y admiten pasos de hasta 22 cm con altura libre; no permiten atravesar ventanas ni obstáculos. El terreno decorativo no acredita suelo transitable.
4. Revisa **Todas las zonas**. Las incluidas aparecen en verde y las pendientes en rosa. Se mantienen las zonas inaccesibles en el informe; no se omiten para presentar una ruta parcial como completa. Las plantas adicionales aparecen pendientes hasta enlazar sus escaleras en este flujo.
5. Consulta la duración calculada y **Ver encuadres y pasos previstos**. El paseo rápido dura **hasta 60 segundos**, con un máximo de diez clips de seis segundos y once encuadres compartidos. Conserva la ruta por todas las zonas y agrupa sus giros y desplazamientos; no reserva un clip para cada paso ni hace cuatro vueltas por estancia. Si falta alguna zona, la preparación sigue bloqueada. La construcción se genera en otro vídeo independiente.
6. Revisa los encuadres sin referencia. Una imagen debe estar aceptada y coincidir en cámara, planta y luz; una foto de la misma habitación no sustituye automáticamente una vista desde su puerta. La coincidencia de encuadre tampoco certifica la continuidad entre imágenes.
7. Elige la cenital aceptada que fija el interiorismo y el exterior aceptado que fija fachada, tejado y pérgolas. Pulsa **Guardar paseo y calcular generación · sin gasto**. El paseo queda guardado con su versión, luz, puertas y recorrido. Puedes recuperarlo en **Continuar un paseo guardado**.

## Generar y revisar el paseo

El paseo tiene un **límite de 2 € para el vídeo completo**, sumando todos sus tramos
y los reintentos. El servidor comprueba el presupuesto antes de iniciar llamadas,
con cambio reciente del BCE y un margen del 30 % para cargos y variaciones.
Si supera el límite o no puede verificar el cambio, se bloquea la generación,
incluidas las imágenes nuevas de ese paseo, para evitar preparar una salida fuera
de presupuesto. Las imágenes y sus análisis tienen coste separado y requieren
su propia autorización. El trazado guardado se conserva sin recortarlo ni omitir zonas.

Los nuevos paseos usan **MiniMax Hailuo 02 Standard a 768p**: 0,025 USD/s,
es decir, **1,50 USD para 60 segundos** antes de cambio y reserva. La interfaz muestra
el total en euros con margen. Los paseos antiguos conservan su modelo y presupuesto;
si superan un minuto, prepara uno nuevo. No se cambia de modelo automáticamente.
[Tarifa KIE Hailuo 02 Standard](https://kie.ai/hailuo-api).

1. En **Producción del paseo completo**, comprueba las dos imágenes de diseño que fijan su apariencia, la revisión guardada, el número de encuadres únicos, tramos, duración y costes. Las imágenes repetidas en pausas y uniones se reutilizan. El precio de imágenes no incluye los análisis visuales adicionales. Cada encuadre usa el modelo presupuestado, sin pasar automáticamente a otro proveedor si falla.
2. Pulsa **Preparar guía de los encuadres**. Esta vista del plano sirve únicamente para orientar las cámaras de los nuevos diseños. **Comprobar todas las capturas · sin gasto IA** recorre sus cámaras y comprueba luz, cubierta y encuadre; no genera ni acredita el acabado final. Confirma las imágenes de la tanda, hasta 24, y genera los encuadres pendientes desde tus diseños aceptados. Puedes detenerte después de la petición en curso y continuar con los resultados guardados. La selección del paseo queda bloqueada mientras trabaja.
3. Revisa cada imagen contra los diseños elegidos y los encuadres vecinos: arquitectura, materiales, muebles, luz, puertas y paso libre. **Aceptar este encuadre** registra tu decisión. Una imagen descartada por la revisión no puede aceptarse. Si sospechas un error del auditor, prepara la guía, autoriza los análisis y pulsa **Volver a revisar este encuadre**: analiza la misma imagen sin regenerarla, conserva el informe anterior y solo cobra visión. No reabre descartes por inspección visual ni imágenes aceptadas. **Preparar otra imagen** conserva la anterior y requiere otra autorización de gasto; ambas acciones solo están disponibles mientras esa imagen no se haya usado en un tramo de vídeo. Para probar con poco gasto, empieza con una sola imagen y revísala antes de continuar.

   Los encuadres intermedios y la entrada mirando hacia dentro identifican la
   estancia por su posición y un paso libre en el plano. Así también leen el
   mobiliario del diseño aceptado y comparan su identidad, aunque no coincidan
   con las cámaras fotográficas predefinidas de cada habitación.
4. Antes de producir el resto, elige **Tramo a probar o revisar**. **Prueba de un solo tramo** muestra sus imágenes inicial y final, duración, distancia prevista y precio. Acepta esos encuadres y autoriza **Probar solo este tramo**: no exige generar los demás ni continúa automáticamente con otro clip. **Consultar este tramo sin generar** recupera el resultado. El coste se incluye en el límite del paseo, no se añade como presupuesto aparte. Una prueba fallida es motivo para detener la producción y revisar la viabilidad antes de gastar más.

   Cuando todos los encuadres estén aceptados, confirma el presupuesto y envío a KIE/MiniMax y pulsa **Generar o continuar los tramos**. Cada tramo recibe una imagen inicial y otra final; comparte su extremo con el siguiente. Los pasos intermedios del plano guían el movimiento, pero no obligan al modelo a reproducirlo correctamente. La secuencia continúa con la pestaña abierta y se puede recuperar si la cierras. Consultar no genera otra vez. Los encuadres ya usados en un clip quedan protegidos frente a correcciones; los de otros tramos aún sin generar pueden seguir preparándose.
5. Reproduce cada tramo completo junto al anterior. Comprueba la lista **Zonas a comprobar**: también deben aparecer los espacios intermedios que no tienen un encuadre propio. Acepta su movimiento y unión solo si conserva la casa, sin cambios de muebles ni pasos a través de obstáculos. Un tramo rechazado puede prepararse para otro intento dentro del presupuesto, conservando el vídeo anterior; la unión siguiente vuelve a requerir revisión. Un envío incierto no se reintenta automáticamente.
6. Con todos los tramos aceptados, **Componer y guardar el paseo completo** produce un solo MP4 de hasta 60 segundos, sin fundidos que oculten saltos. La exportación actual es horizontal a 768p, silenciosa y de hasta 1 GB; no añade narración. Necesita un navegador con WebCodecs H.264 y mantener la pestaña abierta.
7. Reproduce el MP4 completo y registra su aceptación final. Compartir extremos, superar una auditoría o componer correctamente no garantiza fidelidad temporal. Si cambias o retiras la aceptación de una referencia, no se permite continuar con las versiones antiguas del vídeo.

Los recorridos entre plantas y los espacios exteriores sin suelo transitable siguen pendientes en este flujo y bloquean el paseo completo. Construcción y paseo son piezas separadas. El proveedor puede producir defectos incluso con referencias correctas; los reintentos tienen coste y nunca se aceptan automáticamente. Un minuto permite una visita rápida: la cobertura detallada y la continuidad se comprueban en el resultado, no en el trazado.

El trazado usa el plano como guía geométrica. También debe contrastarse con el mobiliario del diseño aceptado: una trayectoria libre en la maqueta no garantiza que un mueble del diseño final deje libre ese paso. El acabado y mobiliario finales proceden de las imágenes IA aceptadas. La revisión temporal de los tramos y sus uniones sigue siendo necesaria.

**Fidelidad del movimiento pendiente de validar:** las pruebas han mostrado
espacios y muebles inventados entre dos referencias, e incluso números y flechas
dibujados sobre el vídeo. Si ocurre, rechaza el tramo y detén la producción. Tener
dos imágenes correctas no demuestra que el modelo reconstruya su conexión real;
preparar más encuadres no garantiza resolverlo.

Comprueba también lo que se ve a través de cada ventana y puerta: debe pertenecer a la habitación correcta. Un patio con lucernario en el diseño exterior aceptado debe conservar el vidrio y su estructura donde entren en cámara. La revisión recibe las conexiones entre estancias, la posición del vidrio y el exterior aceptado; un aprobado automático todavía puede pasar por alto diferencias visibles. No aceptes una imagen solo porque la auditoría haya pasado.

Con la guía preparada, **Ver guía de este encuadre · sin gasto IA** muestra la captura exacta de una cámara individual. Úsala para comprobar huecos y cubierta antes de repetir una imagen rechazada. Es una referencia geométrica; no es el diseño final.

Las capturas del paseo retiran el mobiliario de la maqueta para evitar que sus formas sustituyan las de tus diseños aceptados. Conservan muros, huecos, tejado, pérgolas y porches. El vidrio del tejado aparece azul opaco solo en la guía, para distinguirlo de un patio abierto. La generación debe representarlo como cristal realista. Cuando el análisis localiza una estancia en la cenital aceptada, adjunta también un recorte de esa misma imagen para aportar detalle; revisa que los muebles, fuentes y plantas coincidan con ella.

Las referencias sitúan los huecos según la cámara del encuadre e identifican las estancias conectadas. Comprueba también lo que aparece tras cada ventana: una habitación vecina no debe cambiar de uso al girar la cámara.
También se consideran los recintos sin nombre. Si el análisis no describe todas las conexiones, se detiene antes de generar la imagen; la lectura visual previa sí puede tener coste.
Comprueba que las correderas mantengan su tipo y que detrás de cada hueco se vea el fondo real: no debe aparecer una salida al exterior o un pasillo añadido. Las referencias incluyen el tipo de puerta y la profundidad hasta la estructura que queda detrás para ayudar a detectarlo, sin sustituir tu revisión.

Al repetir un encuadre rechazado, se adjuntan el último borrador de esa cámara y su motivo de rechazo para orientar la corrección. Los diseños aceptados siguen fijando el resultado; el borrador no se acepta ni los sustituye. Se conserva la imagen anterior y cada nuevo intento requiere autorizar su coste.

La revisión interior incluye un análisis separado de la candidata contra la lectura previa del diseño aceptado. Esa descripción permanece fija para evitar atribuir al original muebles inventados en la nueva imagen. Una contradicción o una comprobación incompleta impide darla por válida. Este análisis también tiene coste y puede equivocarse; revisa siempre el resultado antes de aceptarlo.

La cenital tampoco permite deducir la altura de una planta ni exige que todo el mobiliario de una estancia se vea por cada una de sus puertas: esas diferencias de perspectiva deben revisarse como visibilidad, sin confundirlas con sustituciones.

Un encuadre descartado muestra **Encuadre rechazado** en lugar de permitir intentar aceptarlo. Su motivo queda visible. Prepara una imagen corregida o, si el descarte fue automático y aparece la opción, vuelve a revisar la existente.

Si el defecto afecta a una zona concreta, prepara y comprueba la guía y pulsa **Corregir solo una zona**. Selecciona el área, describe la corrección y confirma el precio y los análisis. Puedes borrar el contenido inventado antes de reconstruir el fondo. Se conservan los píxeles exteriores y la imagen anterior; el retoque completo vuelve a pasar las revisiones. La selección no puede ocupar más de la mitad de la imagen. Una máscara pequeña no garantiza un resultado correcto dentro de ella: revisa también sus bordes y la profundidad.

Comprueba techo, paredes y accesos en las **imágenes IA aceptadas**. Una captura del plano, aunque muestre techo sólido, no sustituye el interior final ni acredita su acabado. Si la imagen está incompleta o contradice otras vistas, corrige el diseño y revísalo.

<a id="primera-persona-desde-tus-diseños-piloto-de-una-estancia"></a>

## Pruebas anteriores de una estancia

Las tareas H3 de una estancia ya preparadas permanecen en **Vídeos guardados**. No representan el paseo completo ni se utilizan como sustituto de las zonas o transiciones que faltan. Primera persona ya no abre la creación de otra toma aislada.

El presupuesto utiliza la tarifa orientativa del piloto H3 de construcción: 8 s y hasta cinco imágenes son **$0.32 a 768P**; 12 s son **$0.48**, con los suplementos de resolución y referencias mostrados en los ajustes. No hay reintentos automáticos. Ver [coste y recuperación de H3](/videos/estudio/#construcción-desde-mis-diseños-prueba-h3) y [contrato del proveedor](https://docs.kie.ai/market/minimax-h3/reference-to-video).

Tras aceptar una toma antigua, puedes utilizarla como original en **Publicidad → Vídeo guardado**. Unir construcción y visita sigue pendiente; no se ofrece una muestra del 3D como alternativa.
