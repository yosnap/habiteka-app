# Verificación: promoción geográfica y referencias

## Decisiones de Paulo, 30/09/2026

- El vídeo de casa terminada con exteriores/interiores sigue siendo una salida válida.
- Otra salida es la promoción: mostrar el proceso de construcción en la parcela real, según el plano y diseño del proyecto.
- Coordenadas recibidas: **[coordenada privada], [coordenada privada]**. Sustituyen al centro aproximado anterior para esta verificación.
- Para reconstrucción, retirar visualmente la casa existente del área intervenida y mostrar el nuevo diseño en ese lugar. Para reforma, representar lo que se conserva y lo que cambia; no asumir demolición total para toda reforma.
- La luz debe condicionar imágenes y vídeo: día, tarde, atardecer o noche. Terreno, fachada e interiores deben corresponder al mismo ambiente; cambios de luz requieren una transición prevista en el guion.
- Se mantiene identidad completa del diseño: no perder pérgolas, huecos, cubiertas ni otros elementos visibles.

## Salidas distintas

| Objetivo | Qué enseña | Estado verificado |
|---|---|---|
| Presentación | Casa terminada, exteriores e interiores mediante montaje | Existe el montaje de 12 imágenes; no certifica todas las etapas de construcción |
| Promoción de obra/reconstrucción/reforma | Estado inicial de parcela, intervención, etapas y resultado final | Falta integración geográfica y guion de estados de obra |
| Recorrido en primera persona | Entrada real y ruta interior continua | Existe exportador nativo de ruta; el montaje de imágenes no demuestra una cámara interior continua |

## Referencias recibidas y examinadas

Cuatro enlaces únicos de vídeo (el segundo venía duplicado):

- [Terraza, transformación](https://es.pinterest.com/pin/946952259169855132/): examinados inicio y fotograma intermedio. Cámara elevada sobre el mismo edificio y calle; azotea inicial sin acabar y colocación de pavimento. Útil para conservar emplazamiento y entorno durante la intervención.
- [Casa moderna, construcción](https://es.pinterest.com/pin/623607879698757291/): examinada una muestra con casa terminada, grúa y contexto exterior. Referencia de promoción de obra; no se ha auditado toda su continuidad.
- [Casa de 233 m²](https://es.pinterest.com/pin/1122311169623091001/): muestra observada de fachada terminada desde la calle. Referencia para presentación exterior.
- [Casa 6×15, loft](https://es.pinterest.com/pin/1077345542122017365/): muestra observada de fachada terminada, huecos, materiales y pérgola. No usar sus dimensiones como dimensiones del proyecto.

Seis imágenes de acabado descargadas sin modificar, en `referencia-260930-acabado-1.jpg` a `-6.jpg`:

- 1, 2 y 6: terrazas acabadas, mobiliario, madera/pavimentos, vegetación e iluminación cálida integrada.
- 3 y 4: vistas de conjunto abiertas que permiten leer distribución, muebles y acabados.
- 5: vivienda en vista aérea con interior acabado y luz cálida; útil para legibilidad del plano vestido.
- Marcan calidad de iluminación, detalle y ambientación. Sus plantas, ciudades, terrazas o muebles concretos no autorizan a alterar la geometría del proyecto.

## Parcela

Obtenida una ortofoto JPEG real del servicio [IGN/PNOA](https://www.ign.es/web/ign/portal/ide-area-nodo-ide-ign), capa `OI.OrthoimageCoverage`:

- Archivo: `verificacion-260930-ubicacion-pnoa.jpg`, 1440×1440 px, norte arriba, aproximadamente 180 m de lado.
- Las coordenadas están en el centro de la imagen. Bbox, CRS y procedencia en `verificacion-260930-ubicacion-pnoa.json`.
- Se observan construcciones, caminos, árboles y placas solares existentes. Aún no se ha fijado la huella intervenida ni qué construcción concreta se sustituye. No se han modificado vecinos ni eliminado edificios de esta fuente.
- Es una ortofoto de referencia, no una reconstrucción 3D del entorno ni una imagen captada hoy. No se ha comprobado la fecha exacta del vuelo.

## Comparación con el producto

Examinadas hojas de exteriores/interiores actuales y demo de dron sobre parcela:

- Los interiores actuales tienen acabado, muebles y luz natural; no se ha aprobado una variante de tarde/noche equivalente a las referencias.
- La hoja exterior combina casa seccionada y vistas de conjunto. Para el cierre de una promoción hacen falta cubierta/fachadas terminadas y volumen completo.
- La demo de dron ya combina el proyecto con una parcela real, pero omite elementos respecto al diseño de referencia. Sigue siendo un resultado rechazable por la exigencia de identidad completa.
- El grabador `offline-recorder.ts` + `showcase-timeline.ts` revela cuatro grupos (suelos, estructura, huecos/techo y muebles), empieza con un intervalo de terreno vacío y luego usa la ruta existente. Eso no proporciona georreferenciación, demolición/reforma, cimentaciones reales ni una secuencia de obra completa sobre la ortofoto.
- La app tiene Día, Atardecer y Noche; «Tarde» no es un preset independiente. La auditoría de homogeneidad señala mezclas de luz, pero no implementa una transición temporal de día a noche.
- La referencia de ortofoto para vistas lejanas implementada antes de esta verificación condiciona el entorno de una imagen; no registra ni garantiza por sí sola la implantación exacta en coordenadas.

## Guion concreto propuesto: promoción de 30 s

| Tiempo | Estado / cámara |
|---|---|
| 0–3 s | Parcela real y estado actual, vista aérea que localiza la intervención |
| 3–6 s | Retirada de elementos dentro de la huella autorizada; terreno preparado (reconstrucción) o estado de reforma acordado |
| 6–10 s | Huella a escala del plano y cimentación/losa |
| 10–15 s | Estructura, plantas y muros según el modelo |
| 15–20 s | Cubierta, huecos, carpinterías y fachadas terminadas |
| 20–25 s | Acabados y mobiliario; vuelo de presentación con identidad completa |
| 25–30 s | Acercamiento al acceso real y primera toma interior, o cierre exterior según objetivo |

Cada estado debe derivar del mismo diseño y emplazamiento. El vuelo del entorno y la construcción mantienen escala, orientación, caminos, vecinos y paisaje fuera de la intervención. Las imágenes de referencia sirven para acabado; el plano controla la geometría. Una reforma debe poder omitir demolición/cimentación si no forman parte de su alcance.

## Verificación realizada y siguiente paso

Verificación de referencias, ortofoto, salidas existentes y alcance del código. Ninguna generación nueva de imágenes o vídeo de pago; ningún cambio de código en esta verificación. No se certifica todavía una promoción terminada. Antes de generarla: fijar la huella y orientación sobre la ortofoto, registrar escenario y luz, preparar estados de obra del modelo y revisar el fotograma final implantado. Después generar una prueba corta y comprobar continuidad antes de producir los 30 s completos.

## Cuestiones abiertas

1. Huella exacta, acceso/orientación y construcción existente que se sustituye; las coordenadas solas no resuelven estos tres datos.
2. Escenario para la primera prueba: reconstrucción completa o reforma de elementos concretos.
3. Luz inicial de la prueba y si habrá transición temporal; no deducirla del estilo de las referencias.
4. Presupuesto específico para nuevas imágenes, auditorías y clips, respetando el límite de la ronda anterior hasta que se amplíe.
