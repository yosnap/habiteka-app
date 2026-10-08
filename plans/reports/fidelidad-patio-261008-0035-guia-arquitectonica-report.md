# Paseo: guía arquitectónica e identidad del patio

Fecha: 8 de octubre de 2026. Continuación del piloto individual autorizado.

## Alcance y presupuesto

- Mantener 60 segundos como máximo, construcción separada y límite de 2 EUR por vídeo.
- Autorización adicional vigente: 11 imágenes y análisis hasta 3 USD, ejecutadas una a una.
- Al iniciar esta continuación: 5 intentos usados y 0,69947425 USD confirmados.
- No aceptar diseños en nombre del usuario ni generar vídeo con referencias pendientes.

## Hallazgos y cambios

- La guía gris seguía imponiendo una fuente redonda de maqueta frente a la cubeta cuadrada aceptada.
- Capturas con cámara explícita heredaban el preset aéreo del visor, que podía ocultar cubiertas. Ahora usan `custom` durante la captura.
- Nuevo modo transitorio `architectureOnly`: retira mobiliario y cocina, conserva pérgolas, porches y cerramientos; marca vidrio de tejado en azul opaco. Restaura escena y materiales en `finally`.
- Cada encuadre permite examinar su captura sin gasto IA.
- La lectura del diseño aceptado puede localizar y recortar la estancia desde sus píxeles originales; mantiene también la cenital completa.
- La primera prueba con guía vacía recuperó el lucernario pero omitió fuente y vegetación y volvió a asignar dormitorio a una ventana de estudio. Descartada automáticamente; no aceptada.
- Se sustituye el contrato genérico de edición por instrucciones específicas de incorporar interiorismo aceptado sobre arquitectura vacía.
- Generación y auditores reciben los centros de huecos proyectados horizontalmente con sus usos conectados. No se confunde el giro de cámara con el orden de la cenital; la proyección no certifica visibilidad.

## Evidencia local privada

- Guía original: `/tmp/habiteka-patio-guia.png`.
- Guía arquitectónica: `/tmp/habiteka-patio-guia-arquitectura.png`.
- Prueba patio 3: `/tmp/habiteka-patio-prueba-3.png`; cargo 0,11846000 USD incluidos análisis.
- Acumulado confirmado tras ella: 0,81793425 USD, 6 intentos adicionales usados.
- Prueba patio 4: `/tmp/habiteka-patio-prueba-4.png`, 0,14051525 USD. Recupera fuente cuadrada, vegetación y lucernario; el auditor la aprueba, pero la inspección detecta estudio inventado tras el acceso a circulación. Marcada rechazada por inspección visual, conservando el informe automático original y sin aceptación.
- Acumulado tras patio 4: 0,95844950 USD, 7 intentos usados.
- Se detecta que la conexión omitía el recinto sin etiqueta. Ahora incluye su contorno y la lectura previa exige describir todas las conexiones una sola vez; si falta alguna, bloquea antes de generar.
- Prueba patio 5: `/tmp/habiteka-patio-prueba-5.png`, 0,14300600 USD. Recupera circulación al fondo y estudio en la ventana correcta, pero inventa corredor largo/salida al jardín y convierte corredera en abatible. Nuevo aprobado automático falso, marcado rechazado por inspección; se conserva el informe original.
- Acumulado tras patio 5: 1,10145550 USD, 8 intentos usados.
- Se añade el tipo constructivo a los huecos proyectados y profundidad por rayo hasta estructura opaca (aproximadamente 1,30 m tras el acceso problemático). Generación y ambas auditorías reciben estas restricciones.
- Prueba patio 6: `/tmp/habiteka-patio-prueba-6.png`, 0,14050700 USD. Corrige corredera y salida exterior, pero conserva una prolongación frontal y muebles inexistentes tras el acceso. Descarte visual conservando el aprobado automático original.
- Acumulado tras patio 6: 1,24196250 USD, 9 intentos usados.
- Los reintentos no recibían el borrador rechazado ni su motivo. Se añade corrección dirigida con comprobación de ámbito, versión y cámara; diseños aceptados mantienen prioridad. Guardado de `correctionSourceId` y prompt exacto para trazabilidad.
- Prueba patio 7: `/tmp/habiteka-patio-prueba-7.png`, 0,14466125 USD. El generador prácticamente copia el borrador y conserva galería, cómoda y alfombra. El auditor conjunto vuelve a pasar y atribuye esos objetos a la referencia, contradiciendo su lectura previa. Descarte visual guardado. Acumulado: 1,38662375 USD, 10 de 11 intentos usados.
- Se añade comprobación aislada: la candidata se compara contra la lectura previa inmutable; el servidor conserva el texto original y exige todos los índices. No puede borrar sus discrepancias un aprobado conjunto.
- Validación real sobre patio 7 existente (sin generar imagen): identifica `L1-O30` como cambiado por cómoda y alfombra, conserva los siete grupos visibles restantes y distingue la puerta fuera de cámara. Evidencia en `/tmp/habiteka-patio-7-auditoria-aislada.json`. Coste 0,01223175 USD. Acumulado confirmado **1,39885550 USD**.
- Queda un intento autorizado sin consumir. No se genera otra imagen con el mismo enfoque que ha ignorado la corrección. No se inicia vídeo; persiste un fallo real de generación geométrica.
- Verificación de navegador descubre que «Aceptar este encuadre» seguía activo en descartes, aunque el servidor los bloquea. La UI ahora recibe `reviewIssue` y muestra «Encuadre rechazado» deshabilitado.

## Validación

- 47 pruebas de captura, techos, lectura de referencia y preparación de solicitud pasaron.
- 70 pruebas de auditoría, acciones y contexto del paseo pasaron antes del contrato específico.
- Tras contrato y proyección: 77 pruebas relacionadas pasaron, incluido giro de cámara y hueco posterior.
- Recintos sin etiqueta y lectura completa: 9 pruebas pasaron. Profundidad y regresiones: 88 pruebas de generación, proyección y auditoría pasaron; las 9 de reauditoría pasaron tras actualizar su mock de geometría.
- Corrección dirigida y enrutado: 6 pruebas pasaron; se bloquea otro ámbito/cámara y se excluyen referencias aceptadas como borradores.
- TypeScript y ESLint sin errores. `docs:updates` y `docs:build` correctos.
- Documentación de usuario, novedades y documentación técnica actualizadas en el mismo cambio.
- Auditoría aislada y regresiones: 89 pruebas pasaron; se añade una comprobación de integración para que el aprobado conjunto nunca borre su contradicción. TypeScript y ESLint correctos tras ajustar la tabla de casos incompletos.
- Última comprobación de auditoría aislada/integración: 15 pruebas pasaron. En navegador, `Encuadre rechazado` devuelve `isEnabled=false`; evidencia `/tmp/habiteka-patio-resultado-rechazado.png`. TypeScript, lint, docs y diff comprobados tras el cambio de interfaz.

## Límites

Los tests y el contrato no acreditan fidelidad de una imagen generada. Se debe comparar
cada resultado real y obtener aceptación humana antes del vídeo. No se ha generado
ningún tramo del paseo ni se ha cambiado el plano aprobado.
