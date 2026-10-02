---
title: Estado y novedades
description: Funciones implementadas y trabajo pendiente.
---

## En desarrollo — Publicidad vertical y cotas

- **Crear vídeo**: nombre opcional antes de crear y **Cambiar nombre** para resultados guardados. El selector de originales de publicidad utiliza esos nombres.
- **Mis diseños**: limpieza individual desde la miniatura o por selección, incluidas imágenes rechazadas; papelera con restauración. Los vídeos guardados permanecen disponibles.
- Primera persona y Construcción + visita explican junto a sus ajustes que graban el modelo 3D; el paseo continuo con los acabados de los renders sigue pendiente.

- **Publicidad**: formato horizontal 16:9 o vertical 9:16, con panel de ancho, fondo y altura del diseño aprobado. Medidas animadas, solo al inicio, fijas o desactivadas. Vista previa antes de guardar o descargar.
- **Publicidad → Vídeo guardado**: compone otro anuncio desde un montaje, vídeo 3D o H3 aceptado de la misma aprobación, conservando audio, duración y original. Composición local sin nueva generación IA; el panel no sigue la cámara ni verifica la fidelidad del clip.
- Exportación 3D con formato vertical opcional: conserva la vista completa con márgenes y sus cotas geométricas existentes.

## Versión 0.4.0 — 2 de octubre de 2026

Esta versión reúne tejados, parcela geográfica, estudio de vídeo, galerías y las correcciones revisadas de seguridad, cocina y recuperación de tareas. La construcción H3 sigue siendo un piloto que requiere revisión visual; las funciones pendientes se detallan al final de esta página.

- La cocina evita aparatos dentro de pilares, también cuando el pilar solo recorta el fondo del módulo. Los recortes solapados conservan la profundidad necesaria en carcasa, zócalo y encimera.
- Duración, calidad, luz y cotas del estudio usan los desplegables comunes de la aplicación, contenidos dentro de su panel.

- Los vídeos exportados desde la visita aprobada conservan sus opciones de sonido, cotas, ámbito y duración, igual que los creados desde el estudio. El campo de coordenadas de parcela utiliza una indicación genérica, sin ubicaciones privadas como ejemplo.

- Las tareas H3 aceptadas conservan su identificador aunque falle el registro del coste. Consultarlas recupera el registro pendiente sin generar otro vídeo.

- Todas las páginas de demostración `/dev/*`, incluida la muestra 3D, devuelven 404 fuera de desarrollo. El acceso normal a proyectos y administración conserva sus controles de sesión y permisos.

- **Construcción desde mis diseños**: propone distribución y exterior como referencias iniciales, con su función visible en las miniaturas. La cenital fija mobiliario y distribución; el exterior fija fachadas, tejado y encuadre. El guion pide un vuelo final corto y evita mezclar interiorismos distintos. Las preparaciones antiguas no cambian automáticamente; la fidelidad del clip sigue necesitando revisión. La prueba de dos referencias tampoco valida fidelidad profesional: hay que comprobar cantidades, entorno y etapas, aunque el cierre exterior parezca correcto.
- **Exterior terminado por zonas**: el recorte conserva las caras exteriores de los muros y los aleros del tejado. El margen estructural también se aplica a la máscara enviada a IA; suelo y parcela mantienen el contorno seleccionado. Las imágenes anteriores necesitan revisión; no se modifican automáticamente.
- **Revisar una imagen ya generada**: permite comprobar y guardar un PNG contra una vista preparada, sin pagar otra generación de imagen. La auditoría visual sigue teniendo coste y los mismos controles; los archivos importados se identifican como tales.

## 1 de octubre de 2026

- **Completar vistas de la tanda**, desde construcción: recupera los ajustes y prepara solo las vistas generales ausentes o descartadas. Conserva las imágenes válidas; la generación de pendientes tiene coste.
- La actualización de las galerías al guardar un render conserva el panel y la tanda en curso; una nueva petición de completar vistas abre el editor sin reiniciar su espacio de trabajo.

- Avisos de generación por vista: un error posterior conserva los motivos de los descartes anteriores. Las imágenes descartadas en una revisión posterior se bloquean como referencias de construcción, montaje y nuevas vistas.
- Instrucciones de fidelidad que protegen la función del mobiliario: camas reconocibles y placas de cocina conservadas. La comprobación visual sigue siendo necesaria; la auditoría automática puede equivocarse.
- La auditoría compara las plataformas y ocultaciones con la captura original antes de atribuirlas a la imagen generada. Sigue rechazando cambios de límites, peldaños y barandillas; esta instrucción no garantiza que desaparezcan los falsos rechazos.

- Nuevo ángulo **Exterior terminado** en **Diseñar con IA**: fachadas completas y tejado visible, con el mismo ámbito seleccionado y una cenital compatible como referencia de identidad. La construcción H3 requiere esa vista terminada además de una referencia de distribución, antes de preparar o enviar la prueba.

- Las capturas con tabiques interiores ocultos se bloquean antes de generar imágenes. Las fotos antiguas que registran ese defecto se señalan como **No válida para construcción**; no se pueden seleccionar ni enviar a H3. El guion añade los accesos estructurales del ámbito aprobado y distingue escaleras, rampas y descansillos, sin incorporar muebles del plano. Sigue siendo necesaria la revisión visual del clip.

- **Construcción → Mis diseños**: piloto MiniMax H3 en KIE desde imágenes generadas, con zonas exteriores, escaleras y rampas seleccionadas en esas imágenes. El mobiliario se pide según los renders; no se adjunta el inventario del editor. Presupuesto y envío se confirman antes de generar. Tarea guardada, consulta sin regeneración, MP4 archivado y aceptación/rechazo manual. Primera prueba real de 8 s recuperada con audio; rechazada porque los muros crecían en grupos y la envolvente cambiaba durante el giro. Fidelidad profesional pendiente.

- Construcción rápida de 8 s por defecto, con muros consecutivos en 3 s. Opción de 12 s para dedicar más tiempo a los muebles y al vuelo. Construcción + visita utiliza el mismo ritmo y añade después la ruta. Duración, FX, guion y datos guardados comparten los tiempos elegidos.

- Cotas de vídeo animadas, solo al inicio, fijas o desactivadas; ancho, fondo y altura anclados al edificio con ocultación por profundidad al girar.
- Guion portable para generación IA, con indicaciones propias y copia del texto completo. Los ajustes y las indicaciones se guardan con el vídeo nativo. La construcción H3 dispone de piloto; la composición de cotas sobre clips IA sigue pendiente.

- Construcción nativa con muros consecutivos, fragmentos sincronizados, cámara fija durante la obra y vuelo final. Efecto sintetizado al inicio de cada muro.
- Ámbito de vídeo **Solo la casa / Todo el plano** en el estudio. La casa usa interiores y tejado; encuadre y cotas excluyen puntos exteriores. Conserva la ortofoto confirmada y retira el terreno modelado bajo ella. Los muebles siguen siendo los del editor; animar directamente los renders continúa pendiente.

- **Crear vídeo** y pestaña **Vídeos**: construcción, publicidad, primera persona y construcción + visita, con preparación, aprobación y resultados en el estudio. Construcción sola no exige ruta interior.
- Tandas de renders en una galería única con zona y ángulo. Fondo del plano, descarga, cambios y variante aparecen al abrir la imagen.
- Fondo de render compatible con el editor actual, conservado como referencia auxiliar por proyecto y zona.
- El recorte de una zona conserva todos sus tabiques interiores; solo se ocultan fachadas del lado de cámara. Una solicitud de rediseño exige cambios reconocibles dentro de los permisos.

- Vistas laterales, frontal y trasera con corte del lado de cámara, incluidos huecos, cortinas y persianas; conservan muros del fondo y cubierta. Cenital, isométrica y dron ocultan techo y tejado. Las referencias de imágenes y su revisión de fidelidad respetan estas ocultaciones.
- Panel **Tejado** independiente: cubierta plana, una, dos o cuatro aguas; pendiente, orientación, alero, espesor y acabado por planta. Se conserva en el diseño y el contexto de las imágenes; respeta patios abiertos.
- Muros y hastiales cerrados automáticamente hasta la cara inferior inclinada del tejado, con el acabado de sus muros.
- Montajes bloqueados si el diseño ha cambiado o las imágenes no comparten versión visual, luz y permisos de decoración. Las muestras nativas se identifican como **3D**, separadas del montaje de diseños generados.
- Muros con crecimiento progresivo en vídeos nativos de obra; cubiertas y acabados con fundidos.
- Efectos de construcción opcionales, volumen y cotas globales en **Sonido y cotas del vídeo**. MP4 con pista AAC cuando se activa el sonido.
- Exportación con espera de modelos y texturas, mayor resolución de render interno según la GPU y mayor tasa de vídeo para piezas cortas.

## 30 de septiembre de 2026

- Sitio dedicado de documentación con guías por tarea, herramientas, atajos y búsqueda.
- Tema claro, oscuro y del sistema con iconos directos en cabecera, también en móvil.
- Guías de vídeo con pasos desde el diseño terminado: creación de ruta, revisión, aprobación y localización de botones. Las capturas de menús se incorporarán cuando los flujos estén estabilizados.
- Panel de parcela con fotografía amplia y ajustes agrupados. Zoom, escala, giros y dimensiones con slider, valor exacto y −/+.
- Tapado de casa actual con giro y tamaño independientes del diseño; comparación antes/propuesta.
- Ubicación, escenario y luz conservados con la revisión. Día, Tarde, Atardecer y Noche.
- Menús de parcela contenidos dentro del panel y cierre por clic externo deshabilitado. Elegir el mismo valor no invalida el encaje.
- Continuación visible tras confirmar: revisión de aprobación en ventana, luz de la parcela y accesos directos al montaje de imágenes. La guía distingue el montaje de renders y el paseo continuo fotorrealista pendiente.
- Promoción conceptual sobre ortofoto de 30 s, independiente de ruta interior.
- Identificación de ambientes interiores para el montaje y continuidad de tandas tras rechazo de una imagen por fidelidad.

## Disponibilidad y revisión

Estas guías corresponden a la implementación actual del repositorio. El entorno desplegado puede tener otra versión. Una función implementada no acredita que el resultado de cada inmueble concreto esté validado: revisa su exportación.

## Pendiente

| Función | Situación |
|---|---|
| Etapas de reforma parcial | Pendiente definición de elementos conservados. |
| Película fotorrealista continua | Pendiente imágenes coherentes, guion y piloto de clips con presupuesto. |
| Editor de tomas y ritmo libre | Pendiente; construcción ya permite elegir 8 o 12 s. |
| Cotas geométricas sobre vídeo IA | Pendiente seguimiento de cámara; el panel de medidas globales sí está disponible en publicidad. |
| Música, locución y pistas externas | Pendiente; los efectos sintetizados de construcción sí están disponibles en vídeo nativo. |

Las funciones pendientes se documentan como tales; sus guías se actualizarán cuando estén implementadas y verificadas.
