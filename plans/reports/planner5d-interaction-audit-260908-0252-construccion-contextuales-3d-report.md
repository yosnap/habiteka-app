# Planner5D: construcción, selección contextual y 3D

Fecha: 2026-09-08. Referencia: [editor de Planner5D](https://planner5d.com/es/editor).
Método: observación visual y árbol de accesibilidad en Comet; acciones reales de selección, catálogo, traslado de puerta, inserción de ventanas/escalera, cambio 2D/3D, órbita y zoom.
No se inspeccionó código privado de Planner5D, ni se descargaron modelos/texturas para reutilizarlos.
No se modificó código de Habiteka durante esta auditoría.

## Alcance decidido por el usuario

Prioridad actual: réplica de la experiencia de construcción manual. Megamenú vertical, dibujo de paredes, puertas, ventanas, escaleras, menús contextuales y representación 3D de la misma geometría.
Smart Wizard, importación y generación IA se registran como contexto de navegación, no como trabajo de esta iteración. No se eliminan los objetivos anteriores: quedan fuera de esta propuesta acotada.

## Evidencia y límites

| ID | Estado observado | Resultado / confianza |
|---|---|---|
| E01 | Construya abierto | Confirmado: panel vertical y tarjetas a dos columnas; barra de categorías permanece a su izquierda. |
| E02 | Dibujar Paredes | Confirmado: catálogo se retira y aparece tutorial. Texto indica clic inicial, mover para longitud y clic para crear; Escape/doble clic termina. No se completó una habitación nueva mediante este modo. |
| E03 | Pared superior seleccionada | Confirmado: tramo verde, extremos coloreados, controles flotantes y panel inferior. |
| E04 | Puerta en pared derecha | Confirmado: ancho 96 cm, altura 210 cm, elevación 0; distancias visibles 1.15 m y 2.94 m. |
| E05 | Traslado de esa puerta al muro superior | Confirmado visualmente: orientación se adapta y pieza queda en muro superior; mantiene 96/210/0, offsets 2.59 m y 1.45 m. La puerta se devolvió mediante Deshacer. |
| E06 | Catálogo e inserción de ventanas | Confirmado: selección de modelo lo hace aparecer en canvas. Ejemplo 250 cm de ancho, 175 cm alto, elevación 45 cm; panel y contextual cambian según tipo. |
| E07 | Intentos de llevar ventana a muro | Confirmado: muros inferior y derecho se resaltaron en verde. NO confirmado el encaje final: la ventana permaneció libre en el centro en las capturas. No atribuir este resultado a un fallo del producto: el gesto automatizado puede ser insuficiente. |
| E08 | Escalera en U insertada | Confirmado: 300×216×304 cm, elevación 0, ángulo 0; vista superior, selección y distancias alrededor. |
| E09 | Vista 3D | Confirmado: escena orbital, zoom, interior y exterior del recinto, puerta abierta con hueco, suelo y escalera con volumen real. Las ventanas libres también se representan donde quedaron. |

Las capturas se observaron en esta conversación. No se han guardado archivos de captura en el repositorio; no presentar enlaces ficticios a evidencias.
El árbol de accesibilidad a veces conserva etiquetas de selección previas: prevalece la captura visual actual para decidir qué control está realmente abierto.

## Megamenú vertical

- Barra estrecha persistente a la izquierda: iconos de búsqueda y familias del catálogo; familia activa verde.
- Panel blanco flotante adyacente, con cabecera, cerrar y ampliar; mantiene el canvas visible y operativo.
- En vista de categoría: flecha atrás, título, acceso «Back to all categories», búsqueda y mosaico de miniaturas.
- En raíz «Construya»: importación arriba; bloque de creación con Dibujar Paredes, Habitaciones, Smart Wizard y Formas.
- Construcciones: puertas, ventanas, escaleras, Arcadas, tabicas, Tejados, Chimeneas, columnas, Terrazas, vallas/cercas.
- Se observan variantes rectas, con giro, en U, helicoidales y modelos de pocos peldaños en el catálogo de escaleras. No se verificó el comportamiento de cada variante.
- Hay funciones/modelos restringidos por plan. No replicar bloqueos comerciales ni botones ficticios; limitar catálogo propio a variantes implementadas.

Dimensiones visuales aproximadas: el panel ocupa unos 360 px CSS en la captura de navegador inicial de 2550 px de ancho; la captura nativa posterior está escalada. No mezclar ambos sistemas de coordenadas para derivar tokens exactos.
Paleta observada: superficies blancas/grises, iconos oscuros, verde para selección/estado, pequeños indicadores cian y magenta. Fuente, hex exactos y duraciones no medidos.

## Selección contextual por tipo

No es solo un inspector lateral. Combina selección en el espacio, acciones flotantes alrededor del elemento y edición numérica compacta abajo.

| Tipo | Contextual observado | Panel numérico observado | Canvas |
|---|---|---|---|
| Pared | Comentario, Estilo, Curved wall, Añadir esquina, Ocultar | Length, tres opciones de anclaje representadas por colores, Thickness | Tramo verde; extremos cian/magenta; cotas próximas a la pared. Semántica de los tres anclajes pendiente de prueba. |
| Puerta simple | Comentario, Estilo, Copiar, Centro, Voltear horizontalmente, Voltear verticalmente, favoritos, Borrar | Width, Height, Levitation | Contorno verde, hoja orientada, distancias hasta límites del muro. |
| Otra puerta de dos hojas | Además se observó Abrir o cerrar | Width, Height, Levitation | En 3D hay marco, vidrio/hojas y hueco real. No asumir que todos los modelos ofrecen apertura animada. |
| Ventana probada | Comentario, Estilo, Copiar, Centro, favoritos, Borrar | Width, Height, Levitation | Selección verde; no se vieron volteos en ese contextual concreto. |
| Escalera U | Comentario, Estilo, Copiar, Centro, volteos, favoritos, Borrar y Girar | Width, Depth, Height, Levitation, Angle | Caja verde, control de giro y cuatro distancias al entorno. |

Se observó también un elemento recién extraído del catálogo de ventanas con panel libre Width/Depth/Height/Levitation/Angle. No confundir este estado provisional con un hueco ya hospedado correctamente en un muro.

### Cotas

La habitación de referencia figura como 5×5 m y 24.980 m². La pared seleccionada indica 499.80 cm y grosor 10 cm; aparecen cotas de 5 m y 5.2 m alrededor de caras diferentes.
No convertir estos redondeos en contradicción ni deducir la fórmula exacta sin una prueba de anclajes. La réplica debe definir explícitamente longitud interior, exterior y de eje.

## Contrato de interacción propuesto

### Muros

Estado inactivo → primer clic → previsualización con cota → clic confirma tramo → continuar desde vértice anterior → Escape/doble clic finaliza.
Propuesta: cada tramo confirmado debe ser deshacible, y Escape elimina solo el tramo transitorio. Cierre sobre el primer vértice debe compartir ID de vértice y producir recinto válido, no dos extremos casi coincidentes.
El resaltado hover, selección, vértice arrastrado y pared candidata para una abertura son estados distintos aunque compartan familia de color.

### Puertas y ventanas

Catálogo → pieza provisional → búsqueda de muro candidato → preview alineada → confirmar/reubicar → contextual.

- La selección de muro candidato debe ocurrir en coordenadas del documento, con tolerancia expresada en pantalla para no cambiar sensibilidad al hacer zoom.
- Proyectar centro sobre el eje del muro; orientación derivada del muro, no giro libre residual.
- Mostrar resaltado del muro, contorno de pieza y cotas a extremos. Añadir señal/etiqueta válida o inválida: no comunicar solo por color.
- Cambiar de muro cambia `wallId` y posición relativa de forma atómica, conservando dimensiones físicas y sentido definido de apertura.
- Comprobar extremos, aperturas existentes, altura, alféizar/elevación y espesor antes de confirmar. No se verificó en Planner5D qué política exacta usa ante colisiones.
- Si no encaja: preview inválida y explicación; al cancelar o soltar inválido, conservar ubicación anterior. Esto es requisito propuesto, no comportamiento observado completo.
- Reubicar una pieza existente debe producir un único comando confirmado al soltar y un único paso de deshacer.

### Escaleras

Entidad con huella y geometría vertical, no un mueble genérico con etiqueta. La primera familia puede ser recta + L + U con parámetros explícitos; variantes helicoidales no deben aparecer utilizables antes de soportarlas.
Ancho, desarrollo, altura, elevación y giro deben tener significado estable en 2D/3D. Definir número de peldaños, descansillos y barandilla en un contrato propio. No se ha probado generación automática de hueco en forjado ni conexión entre plantas en la referencia.

## 3D observado y exigencia para Habiteka

El conmutador 2D/3D cambia la representación de un mismo diseño; no dispara una imagen generada por IA.
Se vieron caras exteriores de ladrillo, interiores claras, suelo de madera, espesor de pared, apertura real bajo dintel, marcos, hojas abiertas y escalera con peldaños, descansillo y barandillas.
La cámara orbita y permite zoom; no se verificó navegación interior con colisiones ni comportamiento exacto de ocultación automática de muros.

Requisito: el mismo documento métrico alimenta planta y escena 3D. La geometría del hueco debe recortarse en el muro; dibujar una puerta sobre un muro macizo no cumple.
La apertura y el alféizar afectan al hueco, no solo a la malla del modelo. Cambiar a 3D y volver no puede modificar el documento ni reiniciar undo/redo.
Modelos y texturas propios o con licencia adecuada; no reutilizar assets propietarios de la referencia.

## Gaps encontrados en Habiteka (inspección read-only)

- `Opening` v2 guarda muro, posición y ancho, pero faltan altura, elevación, modelo, bisagra/sentido y apertura.
- `Wall` no guarda altura ni materiales por cara. No hay entidad escalera.
- Dibujo actual pointerdown/pointerup por segmento; falta sesión encadenada y finalización contextual.
- Aberturas actuales: alta por clic en pared + inspector de porcentaje; falta preview, drag, rehosting y resaltado candidato.
- Ya existen Three.js, R3F/Drei y capas 3D legacy. Reutilizar piezas visuales donde sea seguro, no la inferencia legacy por proximidad ni su escala en píxeles.
- Propuesta de capa pura documento mm → escena, preservando IDs y unidades. No convertir a CanvasDoc legacy como autoridad intermedia.

## Pruebas de aceptación de la réplica

1. Dibujar cuatro paredes encadenadas, cerrar, comprobar juntas y área; cancelar un tramo sin perder los confirmados.
2. Seleccionar pared: contextual junto al tramo y medidas editables sin tapar extremos ni cotas.
3. Poner puerta en muro horizontal/vertical/diagonal; acercarse y alejarse cambia candidato sin parpadeo.
4. Trasladar puerta entre muros: preview, resaltado, giro, hueco, cotas y undo consistentes.
5. Repetir con ventana y alféizar; prueba explícita de destino inválido y choque con otra abertura.
6. Voltear puerta y abrir/cerrar: símbolo 2D y geometría 3D coinciden con bisagra y sentido.
7. Insertar, mover, girar y dimensionar escalera; footprint y peldaños 3D coherentes.
8. Guardar/recargar y alternar 2D/3D diez veces sin variar IDs, medidas, anclajes ni geometría.
9. Menús utilizables con teclado, sin recorte en viewport y con alternativas al drag.
10. Medir latencia de drag y coste de regenerar mallas; fijar presupuesto antes de declarar fluidez.

## Estado de la referencia al terminar

Se dejó Planner5D en 3D con los elementos de ensayo visibles: dos ventanas libres y una escalera añadida durante la revisión. La puerta probada vuelve al muro derecho. No se afirma que todo el proyecto de referencia haya quedado exactamente igual al inicio.
Hubo una discrepancia de atajo: `Cmd+Shift+Z` no se comportó como Rehacer durante la inspección. Se recuperó el estado de ensayo mediante el botón Rehacer visible hasta quedar desactivado; no extrapolar atajos sin pruebas.
Habiteka y su plano original no se tocaron.

## Preguntas / comprobaciones pendientes

- Completar demostración manual de encaje de ventana y observar fotograma durante el drag, no solo antes/después.
- Probar pared encadenada real, anclajes numéricos de longitud y política de colisiones.
- Confirmar familias de escalera iniciales y si se requiere conexión entre plantas y hueco de forjado en esta entrega.
- Establecer qué acciones de Estilo se replican primero; comentarios/favoritos no son necesarios para validar construcción.
- Medir tokens visuales exactos y responsive en la implementación; esta auditoría no los certifica.
