# Importación de mobiliario: posición fiel y coincidencias explícitas

Seguimiento: https://github.com/yosnap/habiteka-app/issues/41

Estado: backlog; diferido para priorizar techos e iluminación. Fecha: 2026-09-17.

## Problema

Los muebles importados pueden quedar desplazados o representados por una pieza
que no coincide con la del plano. No debe presentarse una aproximación como una
identificación exacta. Mantener importación de estructura por defecto.

## Evidencia en el código

- `src/server/ai/sketch/place-furniture.ts` escribe el centro en x/y;
  `src/lib/editor-document/spatial-properties.ts` interpreta x/y como origen local
  de la huella, cuya esquina rota alrededor de ese origen. Hay un desfase real.
- La estancia se busca por su caja rectangular, no por el polígono real. Puede
  aceptar muebles sobre huecos de una estancia en L o atravesando paredes.
- Se usa la escala de la imagen con las estancias ya ajustadas por el solver de
  cotas; falta propagar a los muebles la transformación local de su estancia.
- Se elige la pieza del mismo perfil más cercana por tamaño y estancia, sin umbral
  de calidad. Sus dimensiones sustituyen a las dibujadas. Si NO existe el perfil,
  se omite con aviso: no siempre hay sustitución. Una categoría mal reconocida sí
  puede conducir a un objeto incorrecto.

## Propuesta por etapas

1. Corregir centro → origen considerando giro, y trasladar muebles con el ajuste
   geométrico de su estancia. Conservar caja, orientación y fuente originales.
2. Validar huella orientada contra el polígono útil, muros, huecos y circulación.
   No desplazar silenciosamente un objeto para forzarlo a caber.
3. Separar reconocimiento de selección de catálogo. Estados: reconocido,
   aproximación compatible y sin identificar; umbrales calibrados con fixtures,
   sin presentar puntuaciones heurísticas como probabilidades de certeza.
4. Si no hay coincidencia adecuada, conservar un marcador neutro con huella,
   etiqueta y recorte del plano. Sin reemplazo automático por un mueble distinto.
   Un marcador sin identificar no participa en el render como mueble confirmado.
5. Revisión por estancia: aceptar aproximación, elegir modelo, corregir medidas
   y orientación, ignorar. Diferenciar medidas dibujadas/estimadas/confirmadas.
6. Ampliar catálogo según los objetos desconocidos frecuentes. Reconstrucción
   exacta de un modelo 3D desde una silueta 2D queda fuera de esta entrega: el
   plano no aporta por sí solo material, altura ni todos los detalles de forma.

## Aceptación

- Centro y orientación coinciden en fixtures 0/90/180/270° y giro arbitrario.
- El ajuste de cotas conserva la pertenencia y posición relativa a la estancia.
- Pruebas de estancias cóncavas, muebles grandes y colisiones contra muros/huecos.
- Ningún desconocido se convierte silenciosamente en un mueble de catálogo.
- Aproximaciones identificadas en 2D, 3D y contexto IA; revisión antes de aceptar.
- Guardar, recargar y deshacer conservan identidad, fuente y correcciones.

## Pendiente de definición

Tolerancias de tamaño/posición y nivel de detalle de los marcadores, a calibrar
sobre el banco de planos antes de fijar cifras de aceptación visual.
