---
title: Crear y revisar imágenes
description: Preparar vistas del inmueble sin perder su identidad.
---
:::note[Revisión del recorte antes de generar]
Una captura que registra tabiques interiores ocultos se bloquea antes de generar la imagen. Prepara de nuevo la vista y comprueba la previsualización: frontal, trasera y laterales abren únicamente la fachada del lado de cámara. Las fotos antiguas con ese defecto aparecen como **No válida para construcción** en el estudio de vídeo y deben reemplazarse. Cambiar sus etiquetas no repara la imagen.
:::

## Preparar la generación

La generación y la revisión deben conservar la función de cada objeto visible: las camas siguen siendo camas y las placas de cocina mantienen sus fogones, sin convertirse en decoración ni quedar tapadas. Revisa también estos detalles antes de utilizar una imagen para vídeo.

Abre la generación de diseño/imágenes desde el editor. Elige el ámbito, las vistas, el estilo, el momento de luz y tus instrucciones. Revisa el coste mostrado antes de generar.

Elige si el resultado debe incluir solo la casa o también su entorno. En vistas lejanas, la parcela confirmada aporta la ortofoto guardada y se utilizan referencias aceptadas de identidad.

## Qué muestra cada vista

| Vista | Muros y huecos | Techo y tejado |
|---|---|---|
| Frontal, Trasera, Izquierda y Derecha | Se ocultan los muros exteriores del lado de cámara y sus puertas, ventanas, cortinas, estores y persianas. Se conservan los muros del fondo y los interiores. | Visibles. |
| Cenital, Isométrica y Dron | Se conservan los muros para leer la distribución. | Ocultos para ver el interior. |
| Exterior terminado | Fachadas completas y cerradas, sin retirar muros. | Visibles, con la forma del tejado configurado. |

Estos cortes son ayudas de visualización: no eliminan elementos del diseño. Comprueba **Ver vistas de referencia** antes de generar. La imagen debe respetar ese corte, sin reconstruir la fachada oculta ni añadir cortinas que vuelvan a taparla. Si preparaste referencias antes de cambiar estas opciones, vuelve a prepararlas.

Cada captura utiliza su propia cámara: preparar un lateral desde una vista cenital no oculta las pérgolas o carpas que deben verse en ese lateral.

Para construcción desde imágenes, incluye **Cenital** y **Exterior terminado** en la misma tanda. La cenital fija la distribución y se genera primero; el exterior utiliza una referencia cenital compatible para conservar la identidad y mostrar el edificio acabado con cubierta. Revisa el panel **Tejado** antes de preparar. Añade las vistas laterales necesarias para verificar tabiques y accesos. Si seleccionas zonas concretas, el exterior conserva ese mismo ámbito y no añade el resto de la parcela.

En **Exterior terminado**, la captura conserva el grosor exterior de los muros y el vuelo del tejado junto al contorno seleccionado. Ese margen solo afecta a la estructura: no amplía el suelo ni incorpora la parcela. Revisa la captura gratuita antes de generar; si muestra una fachada abierta por un recorte, esa referencia todavía no sirve para el final de obra. Una imagen antigua no se corrige automáticamente al volver a preparar la vista.

## Control de los cambios

En **Diseño de la imagen**, elige **Respetar diseño actual** o **Rediseñar interiorismo**. Si eliges rediseñar o lo pides en el objetivo o las instrucciones, se exige un cambio reconocible de interiorismo, formas, acabados o muebles móviles; mejorar solo la luz o la textura de la misma composición no basta. La captura fija la distribución y los huecos. **Rediseño de fijos** autoriza además sustituir cocina, isla, sanitarios y armarios empotrados dentro del ámbito elegido; no autoriza mover muros.

Al activar rediseño en un lote de varias vistas, las siguientes utilizan una vista aceptada como referencia de acabados y mobiliario. Comprueba su continuidad: la referencia ayuda a mantener el nuevo diseño, pero la IA aún puede equivocarse. La auditoría rechaza una copia sin cambio reconocible cuando se pide rediseñar.

- **Estricto** reproduce los elementos existentes con pocas libertades.
- **Controlado** permite decoración en las categorías autorizadas conservando la geometría.
- Autoriza expresamente el rediseño de elementos fijos si quieres cambiarlos.
- Los ajustes reutilizables ayudan a repetir tus preferencias; comprueba el contexto de cada inmueble.

:::note
La decoración añadida por IA a una imagen no se incorpora automáticamente al modelo 3D editable. El recorrido nativo muestra el 3D; el montaje de imágenes muestra los renders seleccionados.
:::

## Preparar cobertura para un vídeo

Genera exteriores y vistas interiores a altura de ojos de cada estancia. Un dron, una isométrica o una cenital no sustituyen un paseo interior. Mantén la misma versión, estilo y luz.

## Revisar antes de aceptar

Comprueba muros, distribución, puertas, ventanas, suelos, muebles relevantes y pérgolas. Rechaza pérdida o deformación de elementos aunque la imagen resulte atractiva. La vista debe mantener la identidad completa de la casa.

Si una imagen de la tanda se rechaza por fidelidad, revisa o regenera esa vista; las demás pueden continuar. Revisa también los avisos de cobertura por ambiente al preparar el montaje.

Los avisos del lote identifican cada vista que falló, incluidos los descartes anteriores al error que detuvo la tanda. Si falla la cenital, **Exterior terminado** puede quedar bloqueado antes de generar porque necesita una cenital válida del mismo diseño.

Ese requisito incluye la misma selección: **Toda la planta**, **Solo la casa** y **Zonas concretas** no son intercambiables. Aunque tengas una cenital, cambiar el ámbito, la planta, la luz o los permisos puede hacerla incompatible. Recupera la tanda original para conservar sus ajustes; consulta [el bloqueo del exterior](/ayuda/problemas/#exterior-terminado-pide-una-cenital-que-ya-tengo).

La auditoría automática puede dejar pasar errores o rechazar una imagen fiel. Compara cualquier aviso de elementos añadidos con la captura original: un descansillo o una superficie blanca ya modelados no son elementos nuevos. Comprueba también que las camas siguen siendo camas y que las placas de cocina no se convierten en decoración. Una imagen descartada en una revisión posterior queda desactivada para construcción y se excluye del montaje y de las referencias de nuevas vistas. Se conserva en la galería; no existe todavía un botón de revisión posterior en ella. Reintentar una generación puede volver a consumir dinero.

## Dónde encontrar las imágenes

### Revisar una imagen existente sin regenerarla

Después de preparar las vistas, abre **Revisar una imagen ya generada**. Elige la cámara que corresponde a tu archivo, carga un PNG de hasta 10 MB y pulsa **Revisar y guardar imagen existente**. Se conserva el ámbito y la tanda de la preparación; el archivo debe corresponder al diseño actual y a esa cámara.

La revisión visual con IA tiene coste, pero no solicita otra imagen al generador. Aplica los mismos controles de cámara, arquitectura, muebles y ámbito: solo guarda el archivo si los supera. Una imagen importada se identifica como tal; esta opción no convierte una captura del 3D en un diseño profesional ni permite saltarse un rechazo.

### Completar una tanda

Desde **Crear vídeo → Construcción → Mis diseños**, pulsa **Completar vistas de la tanda** para recuperar una tanda de ángulos generales después de cerrar el panel. Se conservan las imágenes válidas y se preparan solo las vistas ausentes o descartadas, con el mismo ámbito, luz y permisos. Preparar no consume IA; generar las pendientes sí.

Guardar una imagen actualiza las galerías y mantiene abierto el panel con sus capturas y ajustes mientras termina la tanda. Si vuelves a abrir **Diseñar con IA** desde su botón normal, comienza una preparación nueva.

Puedes desmarcar cámaras para completar la tanda por partes y ajustar el gasto de cada paso. Cambiar únicamente los ángulos conserva la tanda; cambiar luz, ámbito o permisos inicia otra.

Las instrucciones libres anteriores no se recuperan: revísalas antes de generar. Cambiar otros ajustes además de los ángulos prepara una nueva tanda; si el diseño ya no coincide, la aplicación pide una nueva. Las cámaras interiores y la vista actual deben prepararse de nuevo.

Cada tanda aparece en **un único bloque de galería**, tanto al terminar la generación como en **Diseños**. El título identifica la zona o estancia; cada miniatura indica **Frontal**, **Trasera**, **Izquierda**, **Derecha**, **Cenital**, **Isométrica**, **Dron** o cámara interior. Los resultados antiguos sin ángulo registrado se identifican como **Vista sin registrar**.

Pulsa una imagen para abrirla en grande. Solo dentro de ese modal aparecen las acciones: **Usar como fondo del plano**, **Descargar imagen**, **Pedir cambios** y **Generar variante**. Usa las flechas para revisar la tanda. Pedir cambios y generar variantes pueden consumir créditos según la operación.

El fondo es una referencia auxiliar del plano 2D: no sustituye los muros ni incorpora la decoración al modelo 3D. Se conserva con el plano y su imagen se vuelve a cargar con una URL vigente.

**Historial** conserva resultados anteriores. Para montar la selección, abre [Montaje de imágenes](/videos/montaje-imagenes/).
