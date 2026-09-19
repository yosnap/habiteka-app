# Controles del editor espacial

Estado verificado en la rama `feat/planos-ia`, 2026-09-17; no implica despliegue en producción.

## Clasificación, nombres y acabados cercanos

Construir → Exterior y jardín organiza vegetación, cerramientos, pavimentos/parking, agua/drenaje y sombra/equipamiento. Los elementos conservan sus IDs y geometría existentes. Pufs y tiras LED permanecen en Amueblar e Iluminación.

Selector del plano, título de propiedades y pintura muestran el nombre personalizado o el nombre real del catálogo (por ejemplo, Piscina elevada), evitando números genéricos de mueble.

Pintura, materiales del suelo y techo/luces utilizan el mismo panel cercano al punto de selección en 2D/3D. Si no cabe a la derecha abre a la izquierda y se limita a la ventana. Recalcula posición al desplegar texturas y al cambiar el tamaño de la ventana; sin selección previa de puntero usa la zona central.

## Norma general de alineación y teclado

Con Ajuste activo, bordes, extremos y centros comparten referencias magnéticas entre paredes, superficies, muebles, columnas, rampas/escaleras, aberturas, luces, textos, medidas y puntos de recorrido. Las guías verdes discontinuas aparecen durante el arrastre. El contacto de un objeto con la cara física de una pared tiene prioridad sobre volver al eje del muro. Las conexiones estructurales de columnas, rampas y descansillos conservan sus reglas.

Seleccionar y usar flechas mueve 1 cm; Mayús+flechas mueve 10 cm, sin saltar de nuevo a la cuadrícula. También se admiten habitaciones/patios, paredes, textos, medidas, aberturas y puntos de recorrido, además de objetos espaciales y luces. Los vértices compartidos se desplazan una sola vez en una selección múltiple. Puertas/ventanas se desplazan a lo largo de su pared; límites importados protegidos y colisiones siguen vigentes. Una habitación mueve sus vértices y etiquetas; el mobiliario se selecciona aparte.

### Atajos de teclado

La tabla vive en `src/canvas/editor-v2/editor-shortcuts.ts`; los tooltips de las barras y el manejador de teclado la leen de ahí. No actúan mientras se edita un campo.

| Acción | Tecla |
|---|---|
| Seleccionar | S |
| Construir (abre o cierra el menú) | C |
| Amueblar | F |
| Medir | M |
| Ajuste magnético | A |
| Mano (activa o desactiva) | Espacio |
| Encuadrar | 0 |
| Acercar / Alejar | + / − |
| Muro, rectángulo, puerta, ventana, hueco | B, R, D, V, H |
| Deshacer / rehacer | ⌘Z / ⇧⌘Z |
| Copiar / pegar / seleccionar todo / borrar | ⌘C / ⌘V / ⌘A / Supr |

Con el ratón: Mayús, ⌘ o Ctrl + clic añade o quita un elemento de la selección; arrastrar un elemento de una selección múltiple mueve toda la selección; **Alt + arrastrar un mueble o cerramiento lo duplica** en el sitio donde se suelta, con los mismos imanes y colisiones que un movimiento. Los botones de las barras muestran su atajo en un tooltip al pasar el ratón o enfocarlos.

Los campos numéricos conservan foco al usar Arriba/Abajo repetidamente y muestran botones de aumentar/disminuir al recibir foco o pasar el puntero. Admiten coma y punto decimal. Mientras se edita un campo no se ejecutan atajos del plano. Distancias: paso de 0,01 m; ángulos/unidades generales: 1.

## Norma general de dibujo

Cada herramienta de trazo muestra cursor de lápiz. Paredes, muretes, vallas, cercas, setos y patios usan clics encadenados: el primero inicia, los siguientes confirman un tramo y continúan desde su extremo. Cerrar el contorno vuelve automáticamente a selección. Escape termina un contorno abierto conservando los tramos confirmados. Habitaciones rectangulares y medidas conservan el gesto de arrastre y retorno a selección. Un trazo inválido no se guarda y permite corregirlo. Esta norma sustituye la anterior de arrastre por tramo.

## Patio, terraza y exterior

Construir → Patio / terraza → Superficie exterior. Arrastrar dos esquinas crea una superficie rectangular abierta con suelo editable, sin techo ni paredes físicas automáticas. Puede compartir un lado completo con la casa; uniones parciales que requieren dividir lados todavía no están resueltas.

Seleccionar suelo → Textura del suelo → material: categoría Exterior con césped natural/artificial, tierra, gravilla, corteza de pino, arena, asfalto y pavimento. Son texturas procedurales propias locales; siguen disponibles los acabados interiores.

El patio dibujado se selecciona pulsando suelo o etiqueta y se mueve arrastrando el suelo. Los vértices compartidos con la casa u otra superficie permanecen fijos. El menú permite cambiar textura y eliminar solo los límites propios del patio, conservando la casa. El patio importado conserva su protección de perímetro. El menú contextual no tiene X central; pulsar fuera o Escape lo retira.

Construir → Exterior y jardín incluye pérgola, toldo, sombrilla, puf, vallas/cercas/setos, árboles, arbustos, plantas, macetas, jardineras, huerto, camino, parking, coche, fuente, piscina elevada, estanque, drenajes, barbacoa, rocas/piedras, setas ornamentales y riego. Las miniaturas isométricas del catálogo derivan del mismo modelo de cada objeto. Son geometrías paramétricas editables en 2D/3D, no modelos fotográficos ni simulaciones hidráulicas.

Los pufs permanecen en Amueblar → Mobiliario exterior. Las tiras LED aparecen en Iluminación y sirven en interior/exterior, con difusor y emisión cálida. El color RGB de emisión sigue pendiente en issue #42. Se puede transitar bajo la pérgola evitando postes; las superficies bajas de parking/camino/drenaje no desplazan los objetos colocados encima.

## Cerrar una habitación

Con ajuste activo, al dibujar cerca de la intersección ortogonal con la prolongación de un extremo libre de la cadena, aparece una guía verde y el mensaje de cierre. Al confirmar con un clic se extiende esa pared y une el nuevo segmento en un vértice compartido, sin añadir un tramo residual. Deshacer revierte la unión completa. El ajuste tiene alcance de 12 píxeles de pantalla; no mueve esquinas compartidas ni paredes desconectadas.

## Pintar paredes

Seleccionar pared → Pintar → Interior o Exterior. La habitación cerrada determina las caras aunque se haya dibujado en sentido inverso. Un tabique compartido distingue las dos habitaciones interiores; si el contorno no permite identificar interior, el panel solicita cerrarlo.

Los dos acabados son independientes y solo aparecen en 3D. La coronación mantiene el color del trazo arquitectónico 2D; no hereda pintura de ninguna cara. La selección 3D usa contorno sin sustituir el acabado. Las texturas por cara no están implementadas.

En las esquinas, cada cara de la unión prolonga el acabado de su pared hasta el encuentro. La unión no lleva una franja neutra ni un único color compartido por todo el vértice.

## Suelo interior

El acabado del suelo es una superficie a nivel cero, sin una losa automática de 8 cm debajo. Se recorta contra las huellas reales de paredes y encuentros, respetando grosores distintos, habitaciones cóncavas y muros interiores. Los pasos de puerta a nivel cero conservan su umbral. Ocultar paredes para ver el interior no amplía el suelo.

## Tamaño, giro, elevación y comentarios

Los tiradores de esquina redimensionan dejando fija la esquina opuesta: una valla, una puerta o un armario crecen solo por el lado que se arrastra y no pierden su ubicación. Con Alt pulsado el elemento crece por ambos lados alrededor de su centro. Los muebles se apoyan en el suelo de su estancia: en una estancia con el suelo elevado, un objeto a cota 0 se sube a la cota del suelo al cargar y en cada edición, conservando la elevación propia del catálogo; nunca se baja un objeto colocado más alto a mano. Al cambiar la cota del suelo de una estancia, todo lo que se apoya en ella la acompaña: muebles y columnas dentro del contorno, la elevación de puertas y ventanas de sus muros, y la altura de esos muros para conservar la altura libre. Un muro compartido con otra estancia toma como referencia el suelo más alto de las dos, así no crece dos veces si se elevan ambas.

Los controles inferiores editan medidas en centímetros y ángulo en grados; muebles y escaleras giran alrededor de su centro. La elevación modifica su posición vertical, no su tamaño. Las colisiones consideran altura además de huella. Puertas y ventanas permanecen vinculadas a una pared.

Comentarios son notas de texto del proyecto vinculadas al elemento, no un chat ni una atribución de autoría. Pueden editarse/eliminarse desde su panel.

Paredes curvas siguen pendientes de implementación; no hay aún un control funcional de curvatura.

## Techo y luces

Abre «Techo y luces», elige una estancia interior cerrada y pulsa «Añadir techo a
esta estancia». Puedes elegir techo plano o falso techo, color y descenso. El falso
techo necesita al menos 8 cm de descenso. La altura se calcula desde los muros y la
planta; no se crean techos automáticamente sobre patios o terrazas identificados
como exteriores.

«Visualización del techo» ofrece oculto, transparente al editar y sólido. Es una
preferencia de presentación, independiente del acabado guardado. El techo
transparente permite seleccionar los elementos del interior; el sólido se puede
seleccionar en 3D. No equivale a construir un techo de cristal.

Añade colgantes, plafones o focos empotrados. Los focos necesitan falso techo.
Arrastra sus símbolos en 2D o ajusta X/Y en el panel. Puedes editar tipo, color,
caída, temperatura, flujo luminoso y encendido. Solo los colgantes admiten caída;
la cota vertical sigue al techo. La validación comprueba separación de paredes,
solapamiento, obstáculos altos y al menos 2,10 m libres bajo la luminaria. Son
restricciones del editor, no una certificación constructiva o normativa.

Al modificar paredes, se conserva el anclaje cuando la nueva estancia tiene una
correspondencia inequívoca. Una división o fusión ambigua muestra avisos para
revisión; las entidades no se borran silenciosamente. «Retirar techo» elimina
también sus luminarias, tal como indica el botón. Las ediciones admiten deshacer.

### Propuesta por estilo

Selecciona moderno o mediterráneo y pulsa «Preparar propuesta». La distribución
es local y determinista: no llama a un modelo remoto ni consume créditos IA.
Considera geometría, obstáculos y luminarias existentes. Solo usa mesas/islas
con origen dimensional físico confirmado para colocar colgantes; el mobiliario
importado pendiente no se toma como referencia fiable.

Revisa cada luminaria, modifica sus valores o descártala. «Añadir propuesta al
plano» valida el conjunto contra el documento actual y lo incorpora en una sola
operación, conservando las luces anteriores. Cancelar no altera el plano.

### Representación y renders

El documento versionado conserva techos y luminarias; los prompts de diseño y
render incluyen las entidades aceptadas, posiciones, alturas, colores y luz.
En modo estricto se pide conservarlas sin nuevas adiciones. En modo controlado,
solo se permiten propuestas adicionales con la opción de luces y zonas autorizadas.
La instrucción textual no garantiza la fidelidad de una imagen generada.

Para vistas cenitales/isométricas se omite el techo visualmente y se conservan
las luminarias; una vista interior usa el acabado real. La transparencia de edición
no se envía como material de cristal. El ambiente día/atardecer/noche sigue siendo
independiente de las luminarias persistidas.

La escena admite como máximo 12 emisores orientados hacia abajo, con sombras
desde cada luminaria (mapas de 512 px); los cuerpos válidos siguen visibles aunque superen el presupuesto.
Con luminarias presentes, noche ambiental retira los emisores artificiales de
relleno, incluso si todas están apagadas. Día/atardecer conservan la luz solar.
La iluminación es una previsualización, sin cálculo fotométrico normativo. No se
incluyen tiras indirectas, foseados, techos escalonados o cubiertas inclinadas.

## Recorridos 3D

1. Abre **Recorrido** y selecciona estancias; incluye los pasillos de conexión.
2. Prepara una ruta automática o dibújala sobre el plano. Arrastra los puntos para ajustar
   el paso y edita altura, velocidad, pausa u orientación en el panel.
3. Revisa los tramos bloqueados. Las puertas deben estar abiertas; ventanas y obstáculos
   no permiten el paso. Si cambias los muros, vuelve a revisar la ruta.
4. Pulsa **Ver y exportar en 3D**, prueba **Reproducir** y exporta el MP4.

El vídeo se descarga y se guarda en Diseños e Historial, sin créditos IA. Es el modelo
3D nativo, con techo físico durante el recorrido. Cada ruta pertenece a una sola planta.
Exportación de hasta 60 s, 1080p30, requiere H.264 mediante WebCodecs. Los controles de
cámara e iluminación se bloquean al exportar; cambiar el documento cancela la grabación.

### Diseñar desde un punto

En Recorrido, despliega un punto y pulsa **Diseñar desde este punto**. Se abre el diálogo
de diseño con su cámara interior. Mantén **Vista actual** para usar ese encuadre; puedes
cambiar iluminación y estilo antes de generar. La vista previa es local y no consume IA.
El render generado conserva la pose de cámara. La galería/storyboard por lotes sigue pendiente.

### Cerramientos lineales

Desde Construir → Exterior y jardín, valla de madera, cerca metálica y seto activan dibujo por clics encadenados. El cursor es un lápiz, los extremos usan las guías magnéticas comunes y la longitud aparece durante el trazo. Cada clic confirma un tramo editable; cerrar el contorno o pulsar Escape vuelve a selección. El eje del dibujo pasa por el centro del espesor. Los postes y la vegetación se repiten según la longitud, sin estirar una pieza de dos metros. El tramo mantiene edición de dimensiones, movimiento y deshacer como los demás elementos.
