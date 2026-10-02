# Estado de vídeos, tejado y documentación

Fecha: 30/09/2026. Rama: `feat/diseno-aprobado-visita-video`. Alcance: implementación local, documentación y pruebas registradas; no implica despliegue en producción.

## Resumen

La fase de vídeo sigue **en curso**. Hay cuatro salidas implementadas, con distinta finalidad. La película publicitaria fotorrealista de construcción, vuelo exterior y paseo interior continuo no está terminada. El tejado exterior configurable es una dependencia pendiente para mostrar correctamente la casa o el edificio completo.

## Conflicto del proyecto FInca

En la comprobación anterior, el editor avisaba de otra edición guardada en el servidor, revisión **147**, y conservaba el borrador local. Es un conflicto de documentos del proyecto, no de Git ni de los cambios de código. La cola pausa el guardado y bloquea generación/aprobación para evitar una sobrescritura silenciosa.

Al revisar de nuevo el navegador en esta ejecución, FInca muestra **Sincronizado** y ya no aparece el aviso. No se eligió ninguna versión desde esta ejecución. No se ha comprobado qué pestaña originó el conflicto ni qué diferencias exactas había entre documentos; el aviso por sí solo no permite atribuirlas.

Si reaparece: descargar las dos versiones; revisar; elegir edición local o servidor y confirmar. No basta cerrar el aviso. La aplicación conserva respaldo local antes de sustituir la edición.

## Lo realizado

1. Imágenes interiores con identificación de estancia/ámbito para la cobertura del montaje. Una imagen rechazada por fidelidad no detiene toda la tanda.
2. Referencias de identidad para vistas lejanas y rechazo de pérdida de elementos, incluidas pérgolas. Cambios de elementos fijos solo con autorización explícita. Alcance «solo la casa» y ajustes reutilizables.
3. Parcela IGN/PNOA guardada en el documento: ubicación, escala, orientación, contorno, escenario y luz. Encaje incluido en la versión aprobada.
4. Panel de parcela rediseñado: fotografía amplia, ajustes agrupados y pie de guardado; slider, número exacto y −/+ para zoom, escala, giros, ancho y largo. Comparación antes/propuesta y máscara rotatable independiente.
5. Día, Tarde, Atardecer y Noche; escenario de obra nueva, sustitución y reforma diferenciados. La exportación de etapas de reforma sigue bloqueada hasta definir elementos conservados.
6. Promoción geográfica conceptual de 30 s con su propio guion, sin ruta interior obligatoria; exportación vinculada a aprobación y ortofoto. Modelos 3D fallidos bloquean la grabación de promoción; plantas, cubiertas y pérgolas se mantienen durante la grabación.
7. Guía de uso en `docs/guia-de-uso.md` y guía rápida visible en `/ayuda`: flujo, parcela, guardado, aprobaciones, imágenes y modalidades de vídeo.

## Qué vídeos podemos hacer ahora

| Tipo | Fuente | Estado real | Uso y límite |
|---|---|---|---|
| Presentación del diseño terminado | Renders seleccionados | Disponible; existen montajes anteriores del proyecto | Zoom/desplazamiento y fundidos entre imágenes. Puede mostrar interiores y exteriores; no es un paseo continuo. |
| Recorrido en primera persona | Modelo 3D aprobado y ruta | Disponible; exportación real de FInca registrada anteriormente | Distribución del modelo editable. No incorpora automáticamente decoración añadida por IA a los renders. |
| Muestra de obra + vuelo + recorrido | Etapas nativas y ruta aprobada | Disponible | Introducción actual de 16 s seguida de ruta; no satisface todavía la película cinematográfica final. |
| Promoción sobre parcela | Ortofoto y modelo 3D aprobado | Implementada y probada por componentes; pendiente MP4 real del encaje actual | 30 s, preparación, suelos, estructura, huecos/cubiertas, acabados y vuelo. Visualización conceptual, sin reconstrucción 3D ni demolición real de la casa anterior. |
| Construcción fotorrealista sobre ubicación real | Fotogramas validados y clips IA | Pendiente | Objetivo de las referencias: mismo entorno y edificio conservados durante la transformación. |
| Paseo fotorrealista continuo por interiores | Renders interiores contiguos y clips IA | Pendiente | Requiere continuidad de puertas, distribución, muebles y luz entre tomas. |
| Película completa exterior → construcción → interior | Guion y montaje de tomas validadas | Pendiente | Combina objetivos con ritmo propio, entrada físicamente posible y cobertura de todas las zonas. |

Los nativos son MP4 H.264 horizontales, 1080p/30 fps; recorrido y muestra tienen máximo conjunto de 110 s. El montaje y la grabación no consumen generación de vídeo IA. Los renders y los futuros clips sí requieren presupuesto. No se generaron clips de pago en esta revisión.

## Tejado exterior: falta funcional confirmada

Actualmente `Ceiling` distingue techo plano y falso techo, con material de cara superior, canto y espesor de losa. No hay un tejado de edificio independiente con aguas, pendiente, cumbrera y aleros. Las formas de cubierta de objetos de catálogo no resuelven el tejado de una vivienda.

Implementación pendiente:

1. Entidad versionada de tejado exterior separada de techos interiores y luminarias; huella y planta superior o cota de apoyo explícitas.
2. Tipos: plana, una agua, dos aguas y cuatro aguas; orientación, pendiente/altura, aleros, espesor y material. Huellas irregulares requieren geometría validada o subdivisión explícita.
3. Herramienta **Tejado exterior** con vista previa 3D y ajuste de cubierta por zona del edificio. Evitar cubrir automáticamente patios abiertos.
4. Mostrar el tejado en fachada, dron, promoción y vuelo final. Ocultarlo solo en las vistas de estudio que necesitan ver el interior, sin borrarlo del diseño.
5. Respetar huecos, pérgolas y volúmenes; mantenerlo en aprobación, capturas, referencias y auditoría IA. Comprobar la unión con muros y que no invade la planta siguiente.

**Esta ejecución documenta el requisito; no implementa todavía esos tipos de tejado.**

## Orden de continuación y entregables verificables

### 1. Completar el edificio y su tejado

Entregable: tejado configurable y verificable en 3D, vistas exteriores y aprobación. Aceptación: cambiar el falso techo no cambia el tejado; no desaparecen pérgolas ni se cubren patios por defecto.

### 2. Validar la promoción de la parcela de FInca

Entregable: MP4 conceptual real de 30 s sobre el encaje revisado. Revisar cobertura de casa anterior, orientación/acceso, escala y luz; sincronizar y aprobar; exportar y revisar el archivo completo. No dar por validado el caso real solo porque pasan pruebas unitarias.

### 3. Preparar imágenes coherentes y guion profesional

Entregable: fotogramas exteriores, etapas e interiores por estancia de la misma versión. Guion revisable por tipo de vídeo; vistas del tejado y entrada real. Comprobar cobertura, luz, estilo y elementos antes de animar.

### 4. Probar clips fotorrealistas con presupuesto explícito

Entregable: piloto corto de transformación exterior y otro de entrada/paseo entre fotogramas validados. Registrar coste, duración y defectos. Rechazar pérdida de elementos o cambios de distribución. El piloto debe demostrar continuidad antes de ampliar la generación.

### 5. Montaje y controles de publicación

Pendientes: editor de tomas/duración/ritmo, vista previa completa, versión horizontal y vertical con encuadre propio, audio opcional y exportación final. La aprobación del diseño, el control por imagen y la comprobación de homogeneidad actuales no certifican automáticamente la continuidad de un MP4 generado con IA.

## Verificación y documentación

- Revisión directa del código: tipos/duración nativos, guion de promoción, botones/exportación, aprobación, conflictos y techo/cubierta.
- Navegador local: FInca **Sincronizado**; promoción en el borrador deshabilitada con el motivo «Guarda y aprueba esta revisión para exportar».
- Verificación previa registrada: 55 pruebas en 8 archivos para promoción/ubicación y compilación de producción. Panel reciente: TypeScript, ESLint y controles/menu en Chrome.
- Guía completa: [Uso de Habiteka](../../docs/guia-de-uso.md). Guía rápida accesible desde **Ayuda**.
- Documentación integrada comprobada en Chrome en `/ayuda`; TypeScript, ESLint de la página/componente y `git diff --check` correctos. No se exportó ni generó un nuevo vídeo durante este reporte.

## Preguntas pendientes

- Tipo de tejado y acabado que se aplicará al inmueble concreto; se podrá elegir en el futuro selector.
- Para reforma: qué partes conservar frente a sustituir.
- Antes de generar clips de pago: presupuesto máximo, duración y formato del piloto.
