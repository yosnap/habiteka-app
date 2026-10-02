# Guía de uso de Habiteka

> Esta guía es la instantánea inicial del 30/09/2026. El manual vigente se mantiene por temas en `docs/site/src/content/docs/` y se publica en `https://docs.habiteka.app`. Actualiza esas páginas al cambiar la aplicación; este documento conserva el contexto de su primera versión.

Actualizada: 30/09/2026. Describe las funciones disponibles en la rama actual; no acredita su despliegue en producción.

## 1. El recorrido de trabajo

1. Abre o crea un proyecto desde **Proyectos**.
2. En **Asistente**, explica el inmueble, el estilo y lo que deseas cambiar.
3. En **Plano**, sube una imagen o PDF si partes de un plano existente. Revisa las medidas antes de enviarlo al editor.
4. En **Editor**, completa paredes, puertas, ventanas, plantas, acabados y mobiliario. Comprueba las medidas y el paso entre habitaciones en 3D.
5. Si necesitas mostrar la construcción en su ubicación real, prepara **Parcela real**.
6. Revisa el diseño y espera el estado **Sincronizado**. Pulsa **Aprobar cambios** para conservar la versión que usarán la visita y los vídeos nativos.
7. Crea imágenes o exporta el vídeo adecuado a tu objetivo.
8. Consulta resultados en **Diseños** y versiones anteriores en **Historial**.

## 2. Importar o dibujar el plano

En el estudio de planos: sube la fuente, elige la imagen activa, pulsa **Importar este plano**, revisa la tabla de medidas y utiliza **Recalcula** después de corregirlas. Si falta una escala fiable, indica el ancho total real. **Enviar al editor** reemplaza el plano del proyecto y solicita confirmación.

En el editor utiliza **Construir** para estructura y huecos; **Amueblar** para el catálogo. Selecciona un elemento y abre **Propiedades** para sus medidas y acabados. Gestiona las plantas desde su selector superior. Usa **Medir** y las vistas **Plano técnico**, **Plano visual** y **3D** para revisar el conjunto.

## 3. Guardado, conflictos y aprobación

El borrador se sincroniza mediante el guardado del editor. **Sincronizado** indica que no quedan cambios pendientes en su cola de guardado. Una aprobación es una copia de diseño conservada: editar después el borrador no modifica esa visita ni sus vídeos.

Si aparece **Otra pestaña guardó la revisión…**, hay dos ediciones que necesitan resolverse. El guardado se pausa para evitar sobrescribir una de ellas.

1. Pulsa **Descargar copia de ambas versiones** para conservar el respaldo.
2. **Conservar mi edición** guarda el plano de esa pestaña como nueva revisión y sustituye la versión activa del servidor.
3. **Usar la versión guardada** carga la versión del servidor; la edición local queda respaldada en el dispositivo.
4. Revisa la explicación y pulsa **Confirmar elección**. Cerrar el aviso solo lo oculta; no reanuda el guardado.

Evita editar el mismo proyecto a la vez en varias pestañas. Antes de aprobar, espera a que se resuelva cualquier conflicto y se sincronice el borrador.

## 4. Colocar el diseño en la parcela real

Abre **Parcela real** desde el editor. Introduce latitud y longitud y carga la fotografía. El ancho de ortofoto determina cuánta superficie se obtiene; no es el zoom de pantalla.

### Fotografía

- **Zoom de la fotografía** acerca o aleja la vista; sus valores se muestran en ×.
- **Mover la fotografía** permite arrastrarla sin cambiar la posición relativa del diseño.
- **Centrar diseño** y **Ver parcela completa** ayudan a orientarte.
- **Ver la casa actual** compara la fotografía original con la propuesta.

### Diseño

- **Colocar el diseño** permite arrastrarlo a su ubicación.
- **Tamaño del diseño** ajusta su encaje: 100 % es el tamaño original y 110 % lo amplía un 10 % respecto a la fotografía. No cambia las cotas del plano editable. Revisa que el encaje corresponda a las dimensiones reales.
- **Giro del diseño** alinea la casa y su acceso.

### Casa actual y zona tapada

- Para sustituir una construcción, pulsa **Tapar la casa actual** y arrastra un rectángulo sobre ella.
- **Tapar debajo del diseño** propone una zona siguiendo el diseño; revisa que cubra el tejado existente completo.
- Ajusta el giro, ancho y largo de la zona beige por separado. **Mover zona tapada arrastrando** permite desplazarla sin mover el plano.
- **Quitar la zona tapada** elimina esa intervención de la propuesta.
- Evita tapar árboles y construcciones vecinas que quieras conservar.

Todos los controles de medidas utilizan slider, valor exacto y botones −/+. Escribe un valor y pulsa Enter o sal del campo para aplicarlo. Las unidades son ×, %, ° y m.

### Escenario, luz y confirmación

En **Imágenes y vídeo**, selecciona obra nueva, sustitución o reforma, y Día, Tarde, Atardecer o Noche. La exportación de etapas de reforma necesita definir los elementos conservados; todavía no está disponible.

**Guardar cambios** aplica el encaje al borrador y mantiene abierto el panel. Comprueba después el estado de sincronización del editor. **Confirmar para el vídeo** marca el encaje como revisado; para exportar desde esa ubicación también debes guardar y aprobar la nueva revisión del proyecto.

La fotografía es una ortofoto plana IGN/PNOA. El contorno tapa visualmente una zona: no reconstruye ni demuele en 3D la casa anterior. La fecha de copia no es la fecha del vuelo.

## 5. Techos, luces y tejado exterior

**Techo y luces** permite configurar techos interiores, falso techo, luminarias y acabados de la cara superior y del canto de la cubierta plana, con su espesor.

El **tejado exterior independiente** —por ejemplo, una o dos aguas, cuatro aguas, pendiente, cumbrera y aleros— sigue pendiente. El falso techo no define esa forma exterior. No consideres terminada una vista aérea si falta el tejado que necesita el inmueble.

## 6. Crear imágenes

Desde el editor abre la generación de diseño/imágenes. Elige ámbito, vistas, estilo, luz e instrucciones. Revisa el coste mostrado antes de generar.

- **Estricto** reproduce los elementos del diseño con pocas libertades.
- **Controlado** permite añadir las categorías de decoración autorizadas conservando la geometría.
- Decide expresamente si autorizas rediseñar elementos fijos.
- Para un vídeo completo, prepara vistas exteriores y vistas interiores a altura de ojos de todas las estancias. Una cenital no equivale a un paseo interior.
- Revisa puertas, ventanas, distribución, muebles importantes y pérgolas. Una imagen bonita que pierde elementos debe descartarse.
- Para vistas lejanas se utilizan referencias de identidad aceptadas; una parcela confirmada aporta la ortofoto guardada.

La decoración que añade la IA a una imagen no se incorpora automáticamente al modelo 3D editable. La grabación nativa muestra el modelo 3D, mientras el montaje de imágenes muestra los renders seleccionados.

## 7. Elegir el vídeo

| Objetivo | Función disponible | Resultado actual |
|---|---|---|
| Presentar diseños terminados | Diseños → Vídeos → Crear vídeo con N imágenes | Imágenes con desplazamiento, zoom y fundidos; no es movimiento continuo entre habitaciones. |
| Pasear en primera persona | Ver aprobado → 3D y visita → Exportar y guardar recorrido · MP4 | Ruta por el modelo 3D aprobado. Requiere recorrido válido. |
| Mostrar etapas y después recorrer | Visita aprobada → Guardar vídeo resumen · terreno, obra, vuelo y recorrido | Muestra nativa: introducción de 16 s y la ruta guardada. La película cinematográfica completa sigue pendiente. |
| Mostrar construcción sobre la parcela | Visita aprobada → Promoción en la parcela · 30 s · MP4 | Visualización conceptual con ortofoto, preparación, etapas del diseño y vuelo exterior. No requiere ruta interior. |
| Construcción y paseo fotorrealistas como las referencias | Pendiente | Requiere clips entre imágenes validadas, continuidad, guion y presupuesto aprobado. |

### Montaje de imágenes

En **Diseños → Vídeos**, revisa la selección por ambiente y los avisos de cobertura, revisión y luz. Puedes consultar **Comprobar homogeneidad con Jev**: esa evaluación no sustituye la revisión visual. Pulsa **Crear vídeo con N imágenes**; la duración se muestra antes de empezar. El resultado se descarga y se guarda en Vídeos.

### Recorrido y muestra nativos

En el borrador crea una ruta desde **Recorrido**, comprueba los tramos bloqueados y aprueba la revisión. Abre **Ver aprobado → 3D y visita** y selecciona la ruta si hay varias. Exporta solo el recorrido o la muestra de etapas más recorrido. El máximo conjunto es 110 s; la muestra añade 16 s a la ruta.

### Promoción geográfica

Prepara y confirma la parcela, el contorno, el escenario y la luz. Sincroniza y aprueba esa revisión. En su vista 3D aprobada pulsa **Promoción en la parcela · 30 s · MP4**. Si está deshabilitado, consulta el motivo: ubicación pendiente, aprobación, carga de ortofoto o escenario de reforma.

Las exportaciones nativas son MP4 H.264, horizontales a 1080p/30 fps y dependen de la compatibilidad del navegador. Montar imágenes o grabar el 3D no consume generación de vídeo IA; crear los renders sí puede tener coste.

## 8. Qué revisar antes de compartir

Comprueba el archivo exportado de principio a fin: versión, distribución, tejado, huecos, pérgolas, objetos importantes, continuidad de luz y cámara. En **Diseños**, las imágenes, los **Recorridos** y los **Vídeos** tienen apartados separados.

Todavía están pendientes el editor de tomas, la exportación vertical 9:16, audio opcional y la película fotorrealista continua. La visita libre es interactiva; un MP4 tiene una cámara y duración fijas.

## 9. Atajos y ayuda

La página **Ayuda** de la cabecera contiene la guía rápida y los atajos del editor. Las letras funcionan con el foco fuera de los campos de texto; pueden desactivarse desde el menú de visibilidad.

## Preguntas pendientes

- Para cada reforma concreta: ¿qué elementos exteriores se conservan y cuáles se sustituyen?
- Antes del piloto de vídeo IA: duración, formato y presupuesto máximo por pieza.
