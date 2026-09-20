# Generación IA desde la cámara seleccionada

## Contrato

El botón del editor, abierto desde 3D, congela una captura WebGL y muestra esa
misma imagen antes de generar. El servidor valida PNG, dimensiones y cámara;
envía una referencia junto con geometría del documento sincronizado. No modifica
el plano. Desde 2D se conserva explícitamente el baseline conceptual anterior.

`selected-view-prompt.ts` separa política fija, preferencias estéticas y datos.
El JSON incluye plantas visibles, cotas de suelos, muros, huecos, columnas,
escaleras y polígonos de cada parte de rampa. Los descansillos independientes
no se contabilizan como rampas. La captura también identifica muros omitidos
por el modo interior. No se trunca el JSON.

Las APIs de imagen no comparten un campo `system`: las reglas del servidor
viajan al inicio de `prompt`. El respaldo recibe la misma petición y referencia.
Los nuevos resultados registran proveedor/modelo efectivo, índice de respaldo,
versión de prompt, revisión de documento y cámara. El diálogo muestra el modelo.

## Evidencia y aceptación

2026-09-15: prueba real del flujo completo sobre Valdetorres, revisión 196.
La primera imagen se guardó, preservó el encuadre general, pero sustituyó
visualmente el acceso izquierdo por vegetación. **No aprobada en fidelidad.**
Ese resultado no tenía trazabilidad del modelo efectivo: no atribuirlo al
primario KIE. Después se añadieron trazabilidad, inventario explícito y una
restricción de no reemplazar accesos por vegetación.

La segunda ejecución respondió con `openrouter/google/gemini-3-pro-image`
(respaldo), ya sin la vegetación añadida sobre el acceso. Tras corregir el
parseo de tareas, la tercera ejecución respondió con
`kie/gpt-image-2-5-sunburst-image-to-image`, índice de respaldo 0, y quedó guardada
en Diseños. Se inspeccionaron las tres imágenes a tamaño completo. La tercera
mantiene mucho mejor la organización visible; sigue pendiente validar desde
otras cámaras los elementos ocluidos y comparar todos los perfiles.

No existe todavía evidencia suficiente para denominar a esta versión «el mejor
prompt» ni para aprobar todos los perfiles. Una respuesta HTTP correcta o una
imagen atractiva no son validación geométrica.

Para comparar perfiles: mantener documento, captura, estilo y prompt idénticos;
registrar el modelo que respondió, no solo el perfil elegido. Comprobar por
separado cámara, número/posición de accesos, cotas, columnas, huecos y circulación.
Cualquier elemento estructural agregado, movido o eliminado invalida el resultado.
No pasar a vídeos hasta validar las vistas de referencia.

## Fuentes del contrato de proveedor

La auditoría detectó además un fallo del cliente KIE: `/jobs/recordInfo` devuelve
`state` y `resultJson.resultUrls`, pero el cliente solo leía `successFlag` y
`response.result_urls`. El test con la respuesta oficial reproducía un timeout
antes de corregirlo. Ahora se reconocen éxito, fallo y resultados malformados.
Esto impide confundir una tarea KIE completada con un motivo para usar respaldo.

Verificación técnica: 21 pruebas focalizadas pasan; TypeScript y lint pasan.
La suite ampliada de IA tuvo 105 pruebas correctas y 6 fallidas: cinco dependen
de credenciales de la BD aislada no configuradas en esta ejecución y una de
`gateway-fallback.test.ts` falla en el flujo previo de gateway. No se considera
una suite global verde.

- [KIE Sunburst image-to-image](https://docs.kie.ai/market/gpt/gpt-image-2-5-sunburst-image-to-image): `prompt`, `input_urls`, ratio `auto`.
- [KIE FLUX Flex image-to-image](https://docs.kie.ai/market/flux2/flex-image-to-image): `prompt` e `input_urls`.
- [KIE Market: estado de tareas](https://docs.kie.ai/market/common/get-task-detail): `state`, `resultJson`, `failMsg`.

Las páginas consultadas no publican un máximo total claro de caracteres.
No se inventa ese límite ni se recorta estructura para satisfacerlo silenciosamente.
