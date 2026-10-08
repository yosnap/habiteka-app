# Prueba de movimiento antes de producir más imágenes

## Resultado posterior — 08/10/2026, prueba autorizada

El usuario respondió «ok» a la aceptación explícita de entrada y patio para
ejecutar el piloto. Se registraron ambas aceptaciones y se envió exclusivamente
el primer tramo a Hailuo 02 Standard. Cargo estimado registrado: 0,15 USD.
Los otros nueve tramos permanecen pendientes; ninguna imagen nueva generada.

Resultado: **rechazado por inspección visual**, sin reintento. MP4 de 5,916667 s,
1364×768, 24 fps, 3.308.328 bytes. Reproducción comprobada y secuencia muestreada
cada 0,25 s. Defectos visibles:

- Durante el primer segundo transforma el comedor en un pasillo de puertas
  sucesivas que no corresponde a las referencias.
- Entre aproximadamente 0,5 y 4,3 s superpone números, flechas y pseudotexto.
  El prompt contiene coordenadas; su conversión en rotulación es una inferencia
  plausible, no una atribución demostrada del comportamiento interno del modelo.
- Sustituye muebles y acabados por otra sala, con ventanales y vistas diferentes.
- La aproximación final al patio no acredita el trayecto geométrico exigido.

La identidad de los extremos no se conserva durante el movimiento. Se detiene
esta producción; el resultado no acredita una visita del inmueble. Quitar las
coordenadas podría evitar rotulación, pero no resuelve por sí solo la geometría
inventada ni justifica otro cobro. Antes de nuevos intentos hay que cambiar cómo
se controla el espacio intermedio; no basta con seguir retocando imágenes.

Archivos locales: `/tmp/habiteka-piloto-paseo-6s.mp4`,
`/tmp/habiteka-piloto-secuencia.jpg`, `/tmp/habiteka-piloto-contacto.jpg`.
Las imágenes y análisis previos permanecen en 1,621780 USD; esta prueba suma
0,15 USD de vídeo separado. No se ha compuesto ni aceptado un vídeo final.

## Estado previo a la autorización

Preparada y comprobada en la aplicación; no enviada al proveedor. El usuario
aprobó cambiar el plan a una prueba de movimiento, pero no ha aceptado los dos
encuadres de entrada y patio. No se ha aceptado ninguna imagen en su nombre.
Sin gasto adicional: la tanda de imágenes y análisis sigue en 1,621780 USD.

El primer tramo guardado dura 6 s y recorre 9,934 m. Pasa por salón/comedor,
circulación sin etiqueta y la zona del dormitorio principal, desde donde mira
al patio. No equivale a un simple paso por una puerta. No se ha alterado el
trazado ni se han inventado nuevos encuadres para presentar otra prueba.
Coste previsto del clip Hailuo 02 Standard: 0,15 USD, incluido en el presupuesto
completo de 2 EUR. El proveedor recibe extremos y un prompt de posiciones;
no recibe control geométrico 3D. Su viabilidad temporal todavía está pendiente.

## Cambios

- Envío explícito de un único tramo con sus extremos aceptados, sin exigir
  completar todas las imágenes ni continuar con los demás clips.
- Vista de ambos extremos, distancia, duración y precio antes de autorizar.
- La revisión del piloto comprueba sus versiones; exportar el paseo completo
  sigue exigiendo todas las imágenes y todos los clips aceptados.
- Los extremos usados por un clip o intento anterior quedan protegidos; las
  imágenes ajenas al piloto pueden seguir corrigiéndose y auditándose.
- Manual, novedades y documentación técnica actualizados.

## Verificación

- 39 pruebas de referencias, vídeo, reintentos, reauditoría y exportación pasan.
- TypeScript y ESLint de archivos afectados pasan.
- docs:updates y docs:build pasan; sin errores de Astro.
- UI comprobada: dos referencias pendientes de aceptación, precio 0,15 USD,
  generación y composición bloqueadas. Sin llamadas de generación.
- Captura local: `/tmp/habiteka-piloto-listo.png`.

## Criterio de decisión

Aceptar las referencias no acredita el movimiento. Tras generar, revisar todo el
clip y fotogramas intermedios: accesos reales, continuidad de arquitectura,
muebles y materiales, zonas intermedias, ausencia de transformaciones/saltos.
Un fallo implica detener esta producción y revisar su viabilidad, sin repetir
automáticamente ni encadenar nuevos retoques. El resto de imágenes sigue pendiente.
