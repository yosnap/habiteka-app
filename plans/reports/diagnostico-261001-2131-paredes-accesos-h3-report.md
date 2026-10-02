# Origen de las paredes perdidas y los accesos alterados

01/10/2026. Investigación de solo lectura: plano aprobado 156, seis fotos realmente enviadas y MP4 H3 de 8 s. Sin generaciones ni gasto nuevo; no se edita el plano.

## Conclusión

Hay dos fallos distintos. Las fotos frontal/trasera/izquierda ya se capturaron con tabiques interiores ocultos. H3 recibe imágenes contradictorias y reproduce/extiende esas aperturas al girar. La sección de acceso adicional junto al baño exterior aparece en el vídeo: no corresponde a la disposición de las dos escaleras rectas y la rampa del plano.

## 1. Plano aprobado

32 muros, de los cuales solo tres delimitadores lógicos de patio llevan `hidden=true`. Los tabiques de dormitorios, baño y salón/cocina siguen presentes como muros físicos.

Accesos existentes:

| Elemento | Ubicación en planta, coordenadas del editor | Configuración |
|---|---|---|
| Escalera 1, `855a1059…` | Extremo derecho del patio, junto a la rampa | Recta, 16 peldaños, ancho 0.827 m, profundidad 2.084 m, desnivel 1 m, rotación 180° |
| Escalera 2, `4ca7f0a3…` | Lado izquierdo del patio, junto al baño exterior | Recta, 16 peldaños, ancho 1.020 m, profundidad 2.123 m, desnivel 1 m, rotación 0° |
| Rampa 1, `fbfb39f4…` | Lado derecho, contigua a Escalera 1 | Un tramo inclinado, ancho 0.956 m, profundidad 3.647 m, desnivel 1 m |
| Dos descansillos | Uno junto a cada acceso | Superficies planas; `riseMm=0`, cota 1 m |

No existe tercera escalera ni escalera en L/U. Los tres registros de `ramps` no significan tres rampas inclinadas: dos son descansillos.

## 2. Fotos que ya llevan el error de paredes

Tanda usada: `4954cc10-db5f-4901-9662-ef663c1cbb3e`, generada el 01/10 entre las 03:30 y 03:39 hora de Madrid. Todas registran revisión 156, pero eso no acredita la corrección de la captura.

| Foto en Diseños | Referencia enviada | Muros ocultos registrados | De ellos, tabiques interiores |
|---|---|---:|---:|
| Frontal | 3, `…d72374a5…` | 14 | 8 |
| Trasera | 4, `…42b3d231…` | 24 | 9 |
| Izquierda | 5, `…94d53e9e…` | 18 | 8 |
| Dron / Isométrica / Cenital | 1 / 2 / 6 | 0 | 0 |

Ejemplos verificables: `w1` separa los dormitorios superiores; `w3` separa dormitorio de salón/cocina; `w4` separa dormitorio de baño; `w13` y `w18` delimitan el baño; `w15` es un tabique abierto dentro de salón/cocina. Estos IDs aparecen indebidamente en `generation.view.cutawayWallIds` de una o varias fotos laterales.

La foto **Trasera** expone los muebles del dormitorio como una banda abierta, sin sus divisiones. La **Izquierda** abre las separaciones de dormitorios/baño hacia el resto del interior. La **Cenital** sí permite comprobar que esas divisiones existen.

El prompt de imagen dice conservar tabiques interiores, pero también manda ocultar explícitamente los IDs registrados. En estas fotos antiguas esas órdenes son contradictorias. Hay que arreglar/renovar las referencias, no quitar paredes del documento.

El cálculo actual de fachadas no reproduce esa lista vieja: usando las mismas cámaras y el plano aprobado, oculta 2 muros en frontal, 6 en trasera y 4 en izquierda, ninguno de los tabiques interiores señalados. Es evidencia de que las fotos guardadas contienen un recorte anterior incompatible con la regla actual; no acredita por sí sola una nueva captura visual correcta. Verificar la captura real antes de regenerar.

Puntos de código: `editor-scene-view.tsx:329` compone la lista de ocultación; `render-view-visibility.ts:8` incorpora los IDs al prompt. `design-video-sources.ts:28` comprueba revisión y `:37` homogeneidad, pero no rechaza listas que contengan tabiques interiores. Por eso las referencias defectuosas entraron en el piloto.

## 3. Sección de acceso en el vídeo

En **00:04.75–00:05.25**, el baño exterior queda expuesto en el centro del lado próximo a cámara y aparecen bloques de acceso con barandilla negra a sus dos lados. La foto **Izquierda**, referencia 5, muestra el acceso inmediato junto a ese baño a un solo lado; el otro conjunto de escalera/rampa está en el extremo opuesto del patio en la cenital y en el plano.

La posición/forma de esa sección adicional junto al baño no procede de una tercera escalera del documento. Es una duplicación/reinterpretación temporal de H3 al enlazar ángulos. Las seis fotografías no fijan con suficiente claridad la geometría de los accesos: se ven barandillas, faldones y cuñas, y parte de los peldaños queda oculta. No se puede atribuir cada deformación del vídeo a un único píxel de origen ni certificar sus dimensiones mediante esas imágenes.

La eliminación de muros en el vídeo tiene origen demostrado en las fotos; la nueva sección y su colocación junto al baño son un fallo adicional del generador de vídeo.

## Dónde corregir, en orden

1. Captura/referencias de imagen: revisar y sustituir **Frontal, Trasera e Izquierda** manteniendo todos los tabiques. Mantener el mobiliario/rediseño aceptado como referencia; no volver al inventario de muebles del plano.
2. Accesos de esas referencias: hacer legibles las dos escaleras rectas, la rampa y los descansillos en sus posiciones reales. La cenital sirve para fijar ubicación; una vista exterior cerrada fija volumen y accesos.
3. Admisión de fuentes de vídeo: impedir listas de corte que incluyan muros interiores y evitar mezclar envolvente cerrada con cortes contradictorios como referencias del giro final.
4. H3: exigir continuidad y no duplicación de accesos; revisar el resultado contra esas referencias corregidas. Un prompt solo no garantiza la geometría.

No hay motivo demostrado para borrar tabiques ni añadir/quitar escaleras del plano 156. No se ha lanzado otra generación.

Evidencia visual: [plano, foto izquierda y vídeo](diagnostico-261001-2131-plano-fotos-video.jpg). Clip: [prueba original](/Users/paulo/Downloads/habiteka-construccion-h3-prueba-8s.mp4).

Pendiente: comprobar una captura nueva con la regla actual; confirmar visualmente el tramo específico si el usuario se refiere a otro distinto del señalado junto al baño exterior.
