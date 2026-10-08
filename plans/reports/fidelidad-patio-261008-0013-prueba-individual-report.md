# Prueba individual del patio del paseo

Proyecto privado de pruebas; no publicar como ejemplo en la guía de usuario.

- Continuación autorizada: imágenes una a una, techo adicional 3 USD incluidos análisis;
  máximo previo 11 intentos. Vídeo independiente hasta 60 s y 2 EUR, todavía sin generar.
- Primer intento del patio: coste 0,142004 USD; acumulado de esta autorización
  0,58765925 USD. Candidato `0031e0c1-bd54-4233-a8c4-c40143b757bc`.
- Auditor automático aprobó. Inspección detectó cama/mesilla por el ventanal del
  estudio y cielo abierto donde el exterior aceptado muestra vidrio de cubierta.
- Confirmación geométrica: ventana en (11167,5042) mm conecta patio y estudio;
  cristal ocupa x 8318–12432, y 5062–7949 mm. Datos privados solo en este reporte.
- Candidato marcado `review.source: visual-inspection`, rechazado, sin aceptación.
  Conserva informe automático original y archivo. No válido como referencia de vídeo.

## Ajustes

- `spatialOpenings` identifica usos en ambos lados de cada hueco, sin obligar a
  mostrar vecinos ocultos. Nombres saneados como el resto del contexto.
- `renderSpatialContext` conserva huellas de vidrio del tejado y las incluye
  en las instrucciones de generación y de revisión.
- Lectura de muebles incluye las estancias contiguas visibles por sus huecos.
- Auditoría independiente recibe exterior aceptado además de cenital. Contrasta
  vecinos y exige `architectureCheck` separado en el esquema. Omitir ese informe
  deja la auditoría incompleta; un cambio visible invalida el aprobado general.
- Generación y reauditoría del paseo usan esa misma referencia exterior. Se
  incorpora a la llamada de comparación existente, sin otra llamada de visión.

## Validación

- Pruebas de conexiones y vidrio: 2 correctas. Auditoría, referencias espaciales
  y reauditoría: correctas tras completar `dimensionalOrigin` de una fixture.
- Suite relacionada de fidelidad, instrucciones y mobiliario: 90 pruebas correctas.
- TypeScript, ESLint y diff --check correctos. Docs actualizadas; docs:updates y
  docs:build correctos, 18 páginas y cero errores/avisos.
- Segundo intento exclusivamente del mismo patio tras los ajustes:
  `267b4bbc-1ecc-4307-9eee-ccef6d75d43d`. Coste 0,111815 USD; acumulado 0,69947425 USD.
  Auditor general rechaza por confundir puerta O30 y ventanal. No llega a ejecutar
  la comparación independiente de identidad/exterior al fallar antes.
- Inspección del segundo resultado: ya no aparece la cama incorrecta, pero sigue
  sin representarse el lucernario y cambia la fuente cuadrada aceptada por otra
  redonda. También cambian acabados de muros. Sigue descartado; no se acepta.
- Revisión del código de captura: la cubierta sí se activa con captura solid y
  el vidrio usa DoubleSide. Las piezas de tipo glass no tienen bastidor modelado,
  a diferencia de roof-window, y combinan opacidad 0,35 con transmisión 0,85.
  La guía puede resultar poco explícita para el generador; todavía no se ha
  demostrado esta hipótesis con una captura aislada del segundo encuadre.
- Cinco intentos totales de los once autorizados: tres de entrada y dos de patio.
  Ninguna otra zona ni clip enviado. La segunda imagen no valida la solución.

## Pendiente

Mejorar la lectura del vidrio de la guía y la fidelidad de la fuente sin nuevas
generaciones ciegas. Validar con evidencia el alcance visible de la puerta O30,
porque el rechazo del auditor puede asignar un identificador de hueco incorrecto.
La comparación independiente nueva de cubierta aún no se ha ejecutado en una
prueba real completa. No dar el paseo por listo ni generar clips con estas imágenes.
