# Imágenes por vista del recorrido

## Alcance implementado

- Asociación opcional en el documento: punto, entregable y cámara original. No guarda URLs.
- Generación desde un punto: vincula resultado únicamente si coincide la captura y no cambió
  el documento. Otros ángulos siguen en Diseños; fallos de asociación no convierten un render
  terminado en fallo de generación.
- Miniatura, apertura en otra pestaña, regeneración individual, selector de galería compatible.
- Galería con organización de sesión y filtro de proyecto/zona; URLs firmadas al consultar,
  refresco manual y cada ocho minutos mientras esté visible.
- Reemplazo con historial deshacer/rehacer. Quitar vista o punto retira referencia, no imagen.
- Cámara cambiada: avisa que necesita regeneración. Comparación normaliza dirección de mirada.
- Control Ocultar recorrido conservado.

## Validación

- 13 pruebas focalizadas: referencias, reemplazo, serialización, deshacer, borrado,
  validación, comparación de pose y galería con ámbito.
- 248 pruebas en 42 archivos del editor, documento y acciones relacionadas pasan.
- TypeScript, ESLint focalizado y compilación de producción pasan. Build conserva avisos
  locales de credenciales OAuth ausentes.
- Navegador del proyecto propio: panel y selector cargan, no hay imágenes con cámara
  compatible. El PNG existente es una vista general con FOV45; los puntos usan FOV75.
- Sin generación de pago; no validada asociación automática con proveedor real ni selección
  visual de una miniatura compatible. Tests verifican contrato y persistencia.

## Pendiente

Anclaje manual de imágenes antiguas, estado de créditos por vista, generación por lotes,
subidas KEYFRAME/máscaras, consistencia entre imágenes y cinco generaciones reales.
