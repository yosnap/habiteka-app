# Construcción desde cinco referencias — 2 de octubre de 2026

## Autorización y gasto

Máximo adicional autorizado: **0,60 USD** en KIE y OpenRouter para resolver referencias y generar **un único H3 de 8 s, 768P**. Solo imágenes de la casa, sin coordenadas geográficas ni ortofoto. El límite global temporal pasó de 0 a 0,94 USD y se restauró a **0 USD** inmediatamente después del envío confirmado. Vigilancia de respaldo finalizada.

| Operación | Resultado | Coste registrado |
| --- | --- | ---: |
| Nueva cenital y auditoría | Rechazada: salón convertido en dormitorio e isla en mesa | 0,08673575 USD |
| Revisar la cenital anterior sin regenerarla | Aceptada por el mismo flujo de auditoría | 0,00481950 USD |
| Exterior terminado y auditoría | Pasó auditoría; usuario detecta fallo en el lado izquierdo, pendiente de sustituir | 0,08510300 USD |
| Un vídeo H3, 8 s, 768P, cinco referencias | Generado y rechazado por fidelidad | 0,32000000 USD |
| **Total de esta ronda** | **Margen sin usar: 0,10334175 USD** | **0,49665825 USD** |

Los 0,48 USD de imágenes/vídeo KIE son estimados registrados; los 0,01665825 USD de auditorías OpenRouter son confirmados. No equivalen a una conciliación del saldo de KIE. No se hicieron reintentos de vídeo.

## Referencias y guion

Tanda `7aaa64a7-3e2b-472c-802c-3889184d1105`, revisión 156, luz de atardecer. Referencias admitidas por las guardas y enviadas: Frontal, Trasera, Izquierda, Cenital y Exterior terminado. Esa admisión no certifica fidelidad visual: el usuario detectó después un fallo en el lado izquierdo del exterior. La izquierda descartada que sustituía camas por butacas permanece excluida.

La cenital recuperada conserva distribución, camas, salón, placa e isla; el bloque blanco junto al acceso ya existía en el original como descansillo. Se reutilizaron los bytes del PNG anterior y se pagó únicamente una auditoría nueva. No se modificó su revisión directamente en la base ni se omitieron guardas de publicación.

La inspección inicial reconoció cubierta principal, cubiertas de terraza y pérgola central, pero fue insuficiente: el usuario señala que el lado izquierdo del exterior no se ve correctamente. El exterior anterior no debe considerarse una referencia final validada ni reutilizarse sin resolver ese fallo. Las máscaras también tienen bordes algo irregulares.

## Corrección del usuario — 02/10/2026, 01:49

El usuario indica que tampoco está bien la vista derecha y está creando personalmente las nuevas imágenes. La derecha no formó parte de las cinco referencias del último envío H3. Se corrige la valoración anterior del exterior; haber pasado la auditoría individual no acredita su fidelidad completa. Queda pendiente comparar las nuevas vistas entre sí y con la cenital, incluyendo lado izquierdo, accesos, cubierta y mobiliario. No se inician nuevas generaciones ni se interviene en las que está realizando el usuario. Esta anotación corrige el reporte; no modifica las revisiones de imágenes en la aplicación.

### Criterio posterior para TV y sofás

El usuario acepta la nueva ubicación de TV y sofá **si coincide con las demás vistas**. No exige volver a la ubicación anterior del plano; sí exige representar un mismo diseño entre cámaras. La lectura posterior recuperó como última lateral guardada el preset `right`, ID `del-cmu7nm84n0001evmsi8nyt1ee-render3d-20a7e4d2-e9c5-4924-bdce-928f2d8b7fd1`, de una tanda nueva `85fc586a-f38c-4ed2-8137-a100c802d2f6`. No se identificó todavía una izquierda nueva guardada; no se atribuye a esta derecha la valoración del usuario sobre su izquierda.

La derecha muestra dos sofás claros alrededor de una mesa rectangular, distintos del sofá oscuro en L y mesa redonda de la cenital anterior. Por tanto, no está acreditada la coherencia con ese conjunto anterior. El servidor busca como ancla estética la primera imagen de la misma tanda: una tanda nueva no hereda automáticamente el diseño de otra. La auditoría compara con la captura 3D y admite sustituir mobiliario móvil; no comprueba la posición de TV/sofás contra todas las vistas ya guardadas. Se mantiene pendiente revisar las nuevas referencias como conjunto. Solo lecturas y descarga privada, sin generaciones ni cambios en el proyecto.

El guion conserva las 12 zonas seleccionadas, incluidas baño exterior, terraza, dos escaleras rectas de 16 peldaños, rampa y dos descansillos. Pide paredes consecutivas entre 1,3 y 4,3 s, cubierta hasta 5,1 s, muebles hasta 6 s y vuelo final hasta 8 s; efectos de sonido por pared, sin música ni voz. Son instrucciones al modelo, sujetas a revisión del resultado. Las cotas exactas permanecen pendientes de composición y no se pidieron cifras generadas.

Prueba preparada/enviada: `4a08dcee-a7f0-48c1-925e-e3daf061e77a`; tarea KIE `333ed13d36679d5a5af091cdac723ad1`. Resultado archivado, descargado y **rechazado** por el control normal del estudio. Estado verificado en pantalla y base de datos.

## Inspección del resultado

MP4 H.264, **8,000 s, 1344 × 768, 24 fps**, 1.627.397 bytes, pista AAC. Se inspeccionaron 16 fotogramas distribuidos por todo el clip, 24 fotogramas de los primeros tres segundos y capturas completas a 2 y 7,8 s. Esto no es una auditoría automática exhaustiva de los 192 fotogramas.

- Hay aparición por etapas de suelos, muros, tejado, pérgolas y vuelo final. No respeta el calendario del guion: aparecen camas y la isla durante la formación de los tabiques, antes de finalizar la estructura.
- **A 2 s introduce paredes diagonales** y altera la distribución ortogonal visible en la cenital. Las cuatro camas quedan alineadas en una zona frontal distinta de su disposición longitudinal en la referencia. No se trata únicamente de ocultar la fachada para mirar dentro.
- La cubierta y las pérgolas aparecen al terminar; su presencia no acredita identidad completa durante la animación. Tampoco se certifican los 16 peldaños ni la geometría íntegra de rampa/descansillos.
- La pista de sonido contiene señal, con volumen medio aproximado de −36 dB y pico −8,4 dB en la copia de análisis. No se pudo escuchar mediante el canal de análisis disponible: **no se certifica la calidad ni la sincronización de los FX**.

La deformación interior aparece en la generación H3: la cenital enviada conserva tabiques ortogonales. Además, al comparar las vistas aceptadas se observan diferencias de acabados/mobiliario entre cámaras (isla negra y sofá oscuro en cenital frente a isla clara y sofá claro en otras vistas). La compatibilidad de tanda y la auditoría individual no garantizan consistencia visual entre fotos. Antes de otra prueba es necesario resolver esa coherencia y preparar estados de obra con la misma cámara; no repetir este mismo paquete con otro prompt a ciegas. No se pagó una segunda generación.

Copias privadas:

- Vídeo: `/Users/paulo/Downloads/habiteka-finca-construccion-h3-8s-revision156.mp4`.
- Cenital aceptada: `/Users/paulo/Downloads/habiteka-finca-cenital-revision156.png`.
- Exterior anterior pendiente de sustituir: `/Users/paulo/Downloads/habiteka-finca-exterior-revision156.png`.
- Comparativas: `/tmp/habiteka-h3-pilot/current-video-frames.jpg`, `current-walls.jpg`, `current-frame2.png` y `current-frame7.8.png`.

La fase de película profesional **permanece abierta**. Este piloto entrega una prueba revisable, no un vídeo final aprobado.

## Cambio implementado

**Revisar una imagen ya generada** permite elegir un PNG de hasta 10 MB y asociarlo a una cámara preparada. Evita una nueva llamada al generador de imágenes; conserva autoridad, consentimiento, calidad, revisión aprobada, compatibilidad de tanda, saneado, máscara y auditoría del flujo habitual. Solo se guarda si pasa. Procedencia explícita `import/existing-image-review`, versión `habiteka-existing-image-review-v1`.

Se extrajo el esquema cerrado de ajustes a `concept-render-settings.ts` y la selección entre generación/revisión a `existing-render-review.ts`. El control de archivo está en un componente separado. Todos los archivos de código modificados permanecen por debajo de 1000 líneas.

La revisión real guardó la cenital y el panel permaneció abierto con una vista completada. **Reintentar pendientes** generó únicamente el exterior; después se mostraron las dos vistas completadas. Esto verifica en pantalla el arreglo de revalidación pendiente en el reporte anterior.

## Verificación

- ESLint y TypeScript correctos.
- 21 pruebas pasadas en tres archivos: revisión existente (6), auditoría (10) y fuentes de vídeo (5), con URL de pruebas aislada para los casos puros.
- `git diff --check` correcto.
- `npm run docs:updates` y `npm run docs:build` correctos: 17 páginas, cero errores/avisos de Astro.
- Guía de imágenes, novedades y documentación técnica actualizadas en el mismo cambio. Ninguna coordenada, imagen o detalle privado publicado en la guía pública.
- Sin commit, push ni despliegue.
