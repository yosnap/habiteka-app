# Regresión de laterales y techo inventado

## Diagnóstico

El usuario confirma fallo visual, no error de generación. Las solicitudes al
proveedor y a visión terminaban correctamente; la auditoría podía aprobar una
imagen incoherente. Revisados originales y revisión guardada, sin gastar IA.

- La sección técnica añadía una losa continua de 200 mm por encima de todos
  los muros. El prompt pedía conservarla y la auditoría la llamaba techo,
  contradiciendo la vista sin techo.
- Con muebles en el plano, `prepareRenderImageRequest` omitía la lectura de la
  cenital aceptada y priorizaba los muebles técnicos.
- El encaje automático de la casa confundía jardín/parking con la huella del
  edificio y podía recortar la referencia equivocada.
- Abrir parcialmente una estancia llevaba a describirla completa y mostrar
  muebles que seguían detrás de otra estancia.

## Corrección

- Eliminada losa artificial; prompt v7 y auditoría mantienen alzados abiertos
  por arriba. Exterior terminado conserva cubierta real.
- Guía de generación de secciones solo arquitectónica. Muebles y acabados
  vienen siempre de una lectura completa del diseño aceptado; si falta,
  bloquea antes del generador. Eliminada la alternativa de mobiliario dibujado
  en el prompt de secciones.
- Recorte solo con fondo neutro fiable; con entorno se conserva la referencia
  completa y girada.
- Visibilidad por franja proyectada, manteniendo tabiques del fondo y
  distinguiendo límites ocultos. Procedencia conservada en curvas. Franjas
  relativas comunicadas a lectura, generación y auditoría.
- Dron/isométrica/exterior activan también autoridad del diseño aceptado.

## Verificación

- 139 pruebas, 14 archivos: referencias, secciones, auditoría, biblioteca y
  controles de sanitarios/vehículos. Todas pasan.
- TypeScript y ESLint de archivos afectados correctos.
- `docs:updates`, `docs:build` y `git diff --check` correctos.
- Inspección de guías sobre revisión guardada: sin losa superior; el coche
  oculto no se traslada al salón; límites ocultos no tapan habitaciones.
- La banda oscura horizontal artificial ocupaba 84 % del ancho de la guía
  revisada; tras la corrección solo quedan los cantos verticales de los muros.
- Test de orientación permite menos de 20 píxeles de antialias, manteniendo
  contraste con un panel real de más de 20 000 píxeles. No se oculta un fallo
  funcional: eliminar la losa cambia encuadre y mezclas de borde.

Guías/novedades y documentos técnicos actualizados. Sin commit, despliegue,
generaciones, auditorías IA nuevas, aceptaciones ni modificaciones de imágenes.

## Pendiente

Comprobar un nuevo render real y su fidelidad visual. Las pruebas de código,
el prompt y la auditoría automática no acreditan un resultado final correcto.
Las imágenes anteriores no se reparan automáticamente.
