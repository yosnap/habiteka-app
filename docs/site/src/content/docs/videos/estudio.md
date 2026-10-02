---
title: Crear vídeo en un solo lugar
description: Preparar construcción, publicidad o recorrido desde el estudio de vídeos.
---

## Abrir el estudio

En cualquier proyecto, abre la pestaña **Vídeos**, o pulsa **Crear vídeo** en el editor o en la vista aprobada. El estudio reúne preparación, ajustes, creación y resultados. Conserva la zona activa del proyecto.

| Opción | Qué produce | Qué necesita |
|---|---|---|
| Construcción → Mis diseños | Piloto H3 de 8 s; 12 s opcionales para amueblado. | Imágenes de una tanda del diseño aprobado, KIE activo y confirmación de coste/envío. |
| Construcción → Prueba del plano 3D | 8 s de obra rápida y vuelo del modelo 3D; 12 s opcionales. | Plano y revisión aprobada; no necesita recorrido ni parcela. |
| Publicidad → Mis diseños | Presentación de imágenes generadas con movimiento suave y fundidos. | Imágenes compatibles con el diseño aprobado, con estilo y luz coherentes. |
| Publicidad → Vídeo guardado | Otro MP4 horizontal/vertical con panel de cotas opcional; conserva sonido y duración del original. | Clip de la misma aprobación; H3 debe estar aceptado. |
| Publicidad → 3D en parcela real | 30 s de etapas sobre la ortofoto y vuelo exterior. | Parcela confirmada y revisión aprobada; no necesita ruta interior. |
| Primera persona | Paseo por el modelo 3D editable. | Recorrido válido en la revisión aprobada. |
| Construcción + visita | Obra y vuelo de 8 s (o 12 s), seguidos del paseo 3D. | Recorrido válido y revisión aprobada. |

:::note[Fuente de las imágenes]
En construcción, **Mis diseños** prepara una prueba H3 basada en tus imágenes, pendiente de revisar su fidelidad. En publicidad, **Mis diseños** monta imágenes con movimiento y fundidos. **Prueba del plano 3D**, primera persona y construcción + visita graban el modelo del editor. La película profesional validada y la inmersión continua desde renders siguen pendientes.
:::

## Construcción desde mis diseños: prueba H3

1. Elige **Construcción → Mis diseños**. La selección inicial propone una cenital (o isométrica/dron si falta) y un exterior cerrado de la tanda más reciente compatible con la aprobación. Puedes añadir vistas de apoyo de esa tanda. H3 admite de una a nueve imágenes. El piloto exige una misma tanda, al menos una cenital, isométrica o dron del conjunto y una vista del exterior con fachadas completas y cubierta visible.
2. Comprueba las miniaturas y **Se incluye**. Se utilizan las selecciones guardadas con cada render, incluidas zonas exteriores, escaleras y rampas. No se aplica el recorte de estancias cerradas «Solo la casa». Si faltan zonas, completa las referencias del diseño antes de generar.
3. Elige **8 s** o **12 s**, calidad **768P** para un piloto económico o **2K**, sonido solicitado e indicaciones. Se pide que los muros crezcan consecutivamente en tres segundos; el modelo debe demostrar que respeta ese ritmo.
4. Pulsa **Preparar prueba H3**. Este paso guarda imágenes, ámbito, versión, guion y coste previsto; no envía medios a KIE ni consume IA.
5. Revisa las imágenes y el guion preparado. **Modificar selección y guion** permite volver a los ajustes antes del envío. Confirma el envío de esas imágenes a **KIE/MiniMax**, incluida la parcela si aparece en ellas, y el presupuesto. Pulsa **Generar prueba H3** para iniciar un único intento de pago.
6. Tras el envío aparece **Consultar resultado sin regenerar**, también disponible en **Vídeos guardados**. Recupera la tarea existente; no crea otro clip. Cuando termina, el MP4 se archiva en el proyecto y queda **Pendiente de revisar**.
7. Reproduce todo el clip y acepta o rechaza la prueba. Comprueba todas las zonas, tejado, aleros, pérgolas, huecos y muebles, también antes de colocar la cubierta. Cuenta los muebles repetidos y revisa que no aparezcan jardines o construcciones ajenos a las referencias. Comprueba el crecimiento individual de los muros y el orden de los acabados: el guion no garantiza los tiempos. Rechazar conserva el MP4, no inicia otro intento ni garantiza devolución del coste del proveedor.

**Los muebles provienen de las imágenes elegidas.** Se pide conservar cantidad, posición, forma, colores y materiales del diseño: cuatro camas visibles en el diseño no se sustituyen por la cama del plano original. No se adjunta el inventario del editor. Esto es una instrucción al modelo, no una garantía de fidelidad: si cambia muebles o elimina zonas, rechaza el clip. Las vistas seccionadas ayudan a ver la distribución; **Exterior terminado**, en los ángulos de **Diseñar con IA**, aporta la referencia con fachadas y tejado completos. Si falta una vista de ese tipo, el estudio indica el motivo y bloquea la preparación y el envío de una preparación antigua.

Las miniaturas seleccionadas indican su función: **Distribución y muebles**, **Fachadas y tejado** o **Apoyo de geometría**. La cenital seleccionada tiene prioridad para todos los muebles, incluidos los del patio; si falta, se utiliza una isométrica o dron. Si no seleccionas una vista de distribución, la preparación se bloquea y explica cuál falta. El exterior fija la envolvente y el encuadre oblicuo, sin reemplazar muebles porque muestre otro interiorismo. El guion pide una cámara fija durante la obra y un desplazamiento final corto, sin forzar una vuelta completa hacia caras no documentadas. En la prueba preparada, las miniaturas están numeradas en el mismo orden del guion y del envío. Revisa esos papeles en **Guion preparado** antes del envío. Las preparaciones anteriores conservan su guion: modifica la selección para preparar otro con estas reglas.

Esta prioridad resuelve qué diseño pedir cuando cambian sofás o sillas entre imágenes; no corrige las imágenes ni garantiza que el vídeo obedezca. Si las referencias contradicen muros, cubierta o accesos, completa o corrige esas referencias antes de pagar una prueba.

### Fotos con tabiques ocultos y accesos inventados

Una foto cuyo recorte registrado incluye tabiques interiores aparece como **No válida para construcción**, con su selección desactivada. Se conserva en la galería, pero no puede prepararse ni enviarse a H3, incluso si estaba en una preparación antigua. Vuelve a **Diseñar con IA**, prepara esa vista y revisa la previsualización local sin coste: solo debe abrirse la fachada del lado de la cámara. Crear la nueva imagen sí consume IA.

La comprobación del recorte se aplica también antes de generar nuevas imágenes. Detecta muros ocultos registrados en la captura; no acredita por sí sola que todos los píxeles de un render sean correctos.

El guion preparado añade cantidad, forma, huella y posición local de escaleras, rampas y descansillos de la aprobación que estén dentro del ámbito elegido. Una rampa no debe convertirse en peldaños y un descansillo no es otra escalera. El permiso para rediseñar cocina, sanitarios y armarios no permite cambiar la estructura. Son instrucciones al generador: si duplica o mueve accesos, o borra tabiques durante el giro, rechaza el vídeo.

El presupuesto de salida de 8 s con cinco referencias es **$0.32 a 768P** o **$0.52 a 2K**; cada referencia adicional a la quinta suma **$0.02**. Se muestran también los créditos que se reservarán. No se adjunta vídeo de entrada en este piloto. Tarifa orientativa contrastada el 01/10/2026; auditorías e intentos adicionales no están incluidos. [Tarifa y modelo KIE H3](https://kie.ai/minimax-h3).

Un envío interrumpido puede haberse aceptado en KIE: si aparece **Envío sin confirmar**, revisa esa tarea antes de otra prueba. No hay reintentos automáticos de generación. Si hay identificador, puedes volver a consultar; si falla la descarga, la tarea se conserva para recuperarla sin pagar otro clip. El piloto se solicita sin cifras. Tras revisarlo y aceptarlo, **Publicidad → Vídeo guardado** permite añadir un panel con las medidas globales del diseño aprobado, sin otra generación IA. Las cotas ancladas a la geometría y al movimiento de un clip IA siguen pendientes.

El identificador de una tarea aceptada se guarda antes de registrar su coste. Si se interrumpe ese registro, **Consultar resultado sin regenerar** vuelve a conciliar el coste y los créditos de la misma tarea, sin crear ni cobrar un segundo intento. Si aparece saldo pendiente de conciliación, conserva la tarea y vuelve a consultarla cuando se recupere el servicio.

## Preparar la prueba 3D sin salir del estudio

1. Elige el objetivo.
2. En **Qué aparece en el vídeo**, elige **Solo la casa** (opción inicial) o **Todo el plano**. En **Preparar el diseño**, abre **Tejado** para revisar la cubierta exterior y **Parcela real** para situar el diseño sobre su fotografía.
3. Para primera persona o construcción + visita, abre **Recorrido por las estancias**. Prepara una ruta automática o dibuja puntos en **Plano y recorrido**. Comprueba los tramos con **Previsualizar en 3D**.
4. Elige formato horizontal o vertical, luz, efectos de construcción, volumen y presentación de las medidas. En vertical se encaja la vista 3D completa con márgenes arriba y abajo. Puedes preparar indicaciones en **Guion para generar con IA**.
5. Pulsa **Guardar y aprobar revisión**. Revisa la ventana y confirma la aprobación: volverás al estudio, con las opciones elegidas conservadas.
6. Pulsa **Crear vídeo**. Si está deshabilitado, el motivo aparece debajo: ruta, aprobación, carga o parcela pendientes.

Cambiar la luz o el contenido del diseño exige revisar su aprobación. Durante la grabación los ajustes se bloquean; puedes **Cancelar creación**. La grabación usa la instantánea aprobada y no altera el plano.

Al exportar desde el estudio o desde la visita aprobada se guardan con el vídeo las opciones utilizadas de sonido, cotas, ámbito y duración. La ficha del resultado conserva esos ajustes junto a la aprobación correspondiente.

En publicidad con imágenes o un vídeo guardado, elige formato y cotas y prepara la vista previa. Después puedes guardar o descargar. No necesitas una ruta del editor para estas presentaciones. Consulta la [guía de montajes y anuncios](/videos/montaje-imagenes/).

## Construcción: orden y ámbito

En **Acabado del vídeo → Duración del vídeo**, la opción inicial es **8 s · construcción rápida**. Los muros se levantan **uno a uno en tres segundos en conjunto**, sin ampliar la duración por cada pared. Elige **12 s · más tiempo para los muebles** para dar más tiempo al amueblado y al vuelo; los muros siguen ocupando tres segundos. En **Construcción + visita**, el selector ajusta solo la obra: el paseo se añade después y el total aparece arriba.

| Etapa | Versión de 8 s | Versión de 12 s |
|---|---|---|
| Vacío | 0–0,5 s | 0–0,5 s |
| Suelos | 0,5–1,3 s | 0,5–1,5 s |
| Muros consecutivos | 1,3–4,3 s | 1,5–4,5 s |
| Huecos y tejado | 4,3–5,1 s | 4,5–5,5 s |
| Muebles | 5,1–6 s | 5,5–9 s |
| Vuelo final | 6–8 s | 9–12 s |

La cámara permanece fija durante la obra y el vuelo empieza con el edificio terminado. Los fragmentos de un mismo muro, incluidos los cierres hasta el tejado, crecen juntos. Al activar sonido, cada muro tiene un roce/impacto sincronizado con su inicio; son efectos sintetizados localmente. La duración se guarda junto al vídeo. Las exportaciones anteriores conservan su duración original.

**Solo la casa** usa las estancias interiores cerradas y conserva el tejado con sus aleros. Recorta suelos y objetos fuera de ese ámbito, excluyendo jardín, piscina y decoración exterior del plano. Cámara y cotas se ajustan a la casa. Comprueba el encuadre: patios, porches y pérgolas fuera de las estancias interiores quedan fuera de esta selección; elige **Todo el plano** para incluirlos.

Con una parcela confirmada, su ortofoto se conserva como fondo real. El terreno modelado del plano se retira en **Solo la casa**: la fotografía no queda tapada por una plataforma exterior. Sin parcela confirmada se utiliza el fondo neutro de la escena. La selección se conserva en los datos del vídeo; no cambia el diseño aprobado.

Los muebles proceden del editor, no de una reconstrucción automática de los renders. Un rediseño generado en imágenes puede tener otros muebles: el vídeo 3D no reproduce ese nuevo interiorismo. La animación continua de esos diseños requiere la integración de clips con referencias y una revisión de continuidad; sigue pendiente.

## Medidas animadas y ocultación

En **Acabado del vídeo → Medidas del edificio** elige:

| Opción | Resultado en el MP4 3D |
|---|---|
| Animadas | Ancho, fondo y altura se dibujan una a una al comienzo; después permanecen. |
| Solo al inicio | Aparecen con un fundido y desaparecen por completo a los cuatro segundos. |
| Fijas | Permanecen ancladas al edificio durante el vídeo. |
| Sin medidas | No aparece ninguna cota. |

**Ocultar detrás de la casa**, activado inicialmente, permite que paredes, tejado y objetos visibles tapen las cotas al girar. Las líneas y etiquetas usan profundidad 3D; no se pegan encima de la imagen. Al desactivar la opción, las cotas permanecen por delante. Su tamaño aparente se ajusta a la cámara y sus valores proceden del plano seleccionado, no de una estimación de IA. No son medidas catastrales. Los objetos transparentes pueden dejar visibles las cotas.

## Preparar un guion para MiniMax H3

Abre **Guion para generar con IA** y escribe tus indicaciones. **Ver guion completo** muestra la combinación de objetivo, ámbito, luz, identidad del diseño, secuencia, sonido y presentación de cotas elegidos. **Copiar guion para IA** permite llevarlo al generador. Las indicaciones adicionales se guardan junto a la siguiente exportación 3D y se pueden consultar en **Vídeos guardados**.

El piloto H3 de construcción está en **Construcción → Mis diseños**. El guion portable de la prueba 3D incluye los segundos y el ritmo elegidos en el selector de construcción. El texto libre no cambia cámara, duración ni mobiliario del vídeo nativo. Utiliza **Duración del vídeo** y **Medidas del edificio** para ajustar el MP4 3D: escribir «8 segundos» o «solo al inicio» en el guion no sustituye esos ajustes.

MiniMax H3 admite imágenes inicial/final o referencias de imagen, vídeo y audio. Una referencia de movimiento puede aportar el orden de obra; las imágenes del diseño aportan apariencia y muebles. La API directa trata esos dos modos como alternativas: no mezcla referencias con fotogramas inicial/final en una misma solicitud. Divide películas largas en tramos coherentes de hasta 15 segundos y revisa la identidad entre ellos. [API oficial de MiniMax](https://platform.minimax.io/docs/api-reference/video-generation-v2-create).

Para rapidez, MiniMax documenta **H3 Max** como variante rápida, con salida de hasta 768P; el piloto conectado utiliza **H3 mediante KIE**, a 768P/2K. El primer clip real de 8 s/768P tardó 286 s según KIE y llegó con audio estéreo. Se rechazó por crecimiento de muros en grupos y cambios de la envolvente durante el giro: un guion con seis referencias no ha demostrado la fidelidad exigida. El tiempo de otro trabajo puede variar. Las cotas exactas sobre clips IA necesitarán composición y comprobación de cámara/oclusiones; el control actual está implementado en el MP4 3D.

## Revisar y descargar

El MP4 se descarga y se guarda vinculado a la aprobación. Tras grabar el modelo, pulsa **Reproducir último vídeo** para revisarlo dentro del estudio. La pestaña **Vídeos guardados** reúne las modalidades, incluidos los recorridos, con reproducción y descarga.

Las exportaciones 3D usan 1080p, 30 fps y H.264. Los efectos de obra sintetizados añaden AAC cuando el navegador lo permite. La exportación local y el montaje no consumen IA; generar imágenes y consultar su evaluación pueden tener coste.

La reforma parcial sigue pendiente de definir qué elementos se conservan; su promoción por etapas permanece bloqueada. Los efectos disponibles no simulan la ejecución técnica de una obra ni sustituyen su planificación profesional.
