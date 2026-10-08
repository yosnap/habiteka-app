# Opciones de render y costes por intento

El prompt compacto mantiene un presupuesto de 4800 caracteres para los modelos de respaldo. Las políticas de cubierta, luces y fidelidad se condensan manteniendo geometría, permisos de rediseño, ocultaciones, huecos, pérgolas y recorridos LED. Las pruebas incluyen una vivienda real iluminada y una planta grande; no se aumenta el límite del proveedor para hacerlas pasar. El flujo de generación del usuario sigue igual.

## Flujo

En el editor 3D, abrir **Diseñar con IA**. Seleccionar día, atardecer o noche;
vista actual, varias cámaras o las siete vistas predefinidas. **Revisar encuadres**
captura la geometría real sin modificar el plano y restaura cámara, selección e
iluminación. No llama al proveedor de imágenes. Revisar las miniaturas ampliables
antes de **Confirmar y generar**. Los importes operativos están exclusivamente en administración;
preparar ya no depende del servicio de estimaciones.

La previsualización se actualiza automáticamente al elegir iluminación o el
primer ángulo, sin llamadas de pago. Las capturas se serializan para impedir
que cambios rápidos mezclen cámaras o iluminación. El encuadre usa las esquinas
del volumen del proyecto proyectadas en la cámara, con un margen del 8 %, en
lugar de una esfera que deja excesivo espacio vacío. También se usa al encuadrar
el editor. La vista previa se puede ampliar.

**Instrucciones de diseño** ofrece textos predefinidos y personalización.
**Generar propuesta editable con IA** conserva el flujo alternativo de propuesta
editable: se revisan acabados y muebles antes de aplicarlos, no genera una imagen
final. La cabecera y los botones permanecen visibles al desplazar el formulario.
La generación consulta un proveedor aunque luego se descarte la propuesta. **Aplicar al plano**
no llama a la IA: valida y cambia el documento local, confirma el éxito y permite deshacer.
Si la aplicación falla, el diálogo conserva la propuesta y muestra el error; no se cierra.
Los documentos anteriores a v5 se migran antes de incorporar acabados de suelo.

La libertad decorativa es estricta por defecto. En modo controlado solo se
permiten las categorías marcadas; las zonas se dibujan sobre las coordenadas
reales del plano. Las restricciones de construcción y acceso siempre prevalecen.
Los polígonos se almacenan en milímetros y se convierten a metros para el prompt.
Estas instrucciones condicionan al modelo, no garantizan exactitud geométrica
en una imagen generativa: sigue siendo necesaria la revisión visual.

El lote se procesa secuencialmente y puede detenerse después de la petición en
curso. Los resultados correctos se guardan como entregables del proyecto. La
reanudación del diálogo omite los resultados ya completados. La primera imagen
sirve como referencia de acabado de las siguientes, sin sustituir la captura de
su cámara. Cerrar el diálogo pierde el estado de reanudación local, no los diseños
ya guardados. Varias imágenes no equivalen todavía a un tour continuo o un vídeo.

## Informe administrativo

`/analytics/ai-costs` requiere administrador. Se registra cada intento y respaldo
con proveedor, modelo, proyecto, referencia de diseño y lote cuando el llamador
dispone de ellos. Los datos anteriores a esta incorporación no se reconstruyen.
Los costes estimados no son importes facturados; los errores sin importe conocido
se registran como desconocidos, no como cero. La estimación inicial no incluye
necesariamente los intentos de respaldo. El registro es best-effort: un fallo de
telemetría no vuelve a ejecutar una solicitud de pago.

El informe incluye agrupación por proyecto, diseño, proveedor, modelo o usuario;
evolución diaria/mensual UTC; peticiones únicas, intentos de respaldo, errores y
latencia. El detalle se pagina sin truncar los totales y se exporta en CSV por lotes,
con autorización de administrador y neutralización de fórmulas. Los créditos liquidados
del ledger aparecen en una tarjeta separada, global por fechas, sin convertirlos a USD.

Para chat/visión ya no se registra la reserva fija de 0,05 USD como coste de cada llamada.
OpenRouter permite conservar el importe reportado en `usage.cost` ([contrato oficial](https://openrouter.ai/docs/cookbook/administration/usage-accounting)).
Cuando no existe un importe fiable se marca desconocido. Las estimaciones históricas
se conservan sin inventar una conciliación retroactiva. Las propuestas nuevas incluyen usuario y proyecto.

La prueba de filtros detectó y corrigió `ModernSelect`: `defaultValue` requiere estado
interno y las opciones HTML vacías se traducen para Radix, conservando el valor vacío
original en la presentación de formularios.

Migración aditiva: `20260915133600_ai_request_cost`. Tras regenerar Prisma hay que
reiniciar el proceso de desarrollo para renovar el singleton del cliente.

## Verificación del 15 de septiembre de 2026

- Preparación real en navegador: siete capturas nocturnas distintas, más dos
  capturas al atardecer con plantas restringidas a un polígono central.
- Informe administrativo cargado con totales y detalle de intentos.
- Aplicación probada en navegador con fixture local: rechazo visible sin cerrar, y
  éxito con documento actualizado. Escena 3D y deshacer cubiertos por pruebas unitarias.
- Propuesta aplicada solo en memoria a la revisión 198 de Valdetorres: 9 muros,
  2 suelos y vértices conservados, sin escribir en el servidor.
- Filtros modernos controlados y no controlados verificados en navegador. CSV validado
  con 501 registros en base aislada y acceso anónimo rechazado con 403; la descarga
  completa desde el navegador no pudo confirmarse con la herramienta de automatización.
- Pruebas focalizadas de contratos, prompt, proveedor y costes en base aislada.
- La prueba real del lote quedó bloqueada por conectividad externa: resolución
  DNS de KIE agotada y conexión a OpenRouter agotada. No se recibió una imagen
  final ni se validó visualmente la coherencia entre resultados de este lote.

## Separación de flujos y permisos (15 septiembre)

- «Crear imágenes» → «Ver vistas de referencia» (capturas locales, requiere 3D)
  → «Generar imágenes con IA». No modifica el plano.
- «Diseñar el plano» (antes «Cambiar acabados y muebles», ahora primer paso del
  estudio) → «Proponer acabados y muebles con IA» → revisión → «Aplicar al
  plano». Oculta iluminación y cámaras, que no son propiedades de esta
  propuesta editable. Desde el 4 de octubre sus modos se llaman Amueblar (libre),
  Solo categorías (controlado) y Acabados (estricto).
- La propuesta transmite y valida las opciones en el servidor antes de consultar
  al proveedor. Estricto elimina todos los objetos nuevos; controlado restringe
  categorías del catálogo; libre excluía instalaciones y construcción; desde el 4 de octubre «Amueblar» admite sanitarios, cocina, electrodomésticos y lavadora, y solo excluye la construcción.
- Las zonas restringen la huella completa de objetos, incluyendo cruces con
  polígonos cóncavos. No restringen los acabados generales. El cupo de objetos (cuatro, luego ocho) se retiró el 4 de octubre.
- Probado el formulario real en pestaña independiente: estilo destacado y ángulo
  legible con puntero encima. Fixture local confirma envío de Controlado/Plantas
  y aplicación al documento; no se han realizado llamadas IA pagadas en esta prueba.
- Diez pruebas focalizadas pasan: permisos, validación previa al proveedor,
  aplicación, escena y deshacer, y contrato de opciones. TypeScript sin errores.
