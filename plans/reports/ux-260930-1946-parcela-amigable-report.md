# Parcela — simplificación de la interacción

## Cambios

- Vista inicial ampliada 4× y centrada en el diseño. Controles para acercar, alejar, centrar y ver la parcela completa.
- Tres herramientas explícitas: mover fotografía, tapar casa actual y colocar diseño.
- El diseño se mueve arrastrando; la zona a limpiar se marca arrastrando un rectángulo, sin introducir vértices.
- Zona opaca beige para ocultar la construcción existente debajo de la propuesta. Acción automática a partir de los límites del diseño, con margen de 2 m.
- Comparación entre fotografía original y propuesta.
- Coordenadas y ancho de ortofoto dentro de un apartado plegable. Giro, guardado y confirmación con nombres sencillos.
- Zoom y desplazamiento de la fotografía no cambian la escala métrica ni la posición guardada. La zona tapada mantiene el contrato de intervención usado por el vídeo.

## Verificación

Tipos y ESLint correctos; diff sin errores. Navegador: panel ampliado, cobertura automática visible y comparación original/propuesta funcionales. Se recuperó un fallo temporal de transacción al recargar el editor.

La propuesta queda abierta con la cobertura automática para revisión. No se confirmó ni guardó esa cobertura como ubicación final. La cobertura es una previsualización opaca sobre la ortofoto; no una imagen reconstruida del terreno.
