# Piloto H3 de construcción desde diseños

01/10/2026. Proyecto FInca, revisión 156. Sin commit ni despliegue.

## Autorización y envío

El usuario autorizó una única prueba de 8 s/768P con sus seis imágenes actuales, envío a KIE/MiniMax, presupuesto $0.34. Preparación `a417fe82-9687-4403-b548-39ed37594672`.

Primer envío bloqueado antes de transferir medios: `global_spend_cap_usd=0`, gasto agregado de las últimas 24 h=0. No se atribuye el origen del ajuste a tests sin evidencia. El usuario autorizó expresamente habilitar $0.34 de forma temporal y restaurar 0 tras enviar. Aplicación/restauración condicionadas al valor previo y registradas en AuditLog. Límite restaurado a 0 inmediatamente después de comprobar la tarea aceptada.

KIE aceptó `9db0219df7bd9cfe3fff16721dd16a9d`. Un único createTask, seis referencias, sin vídeo de entrada ni reintentos de generación. Débito registrado: 34 créditos Habiteka; coste de uso estimado $0.34, pendiente conciliación con factura del proveedor.

## Corrección detectada durante uso real

La respuesta de inicio devolvía estado sin identificador de tarea, dejando oculto el botón de consulta hasta recargar. Ahora devuelve taskId al cliente y el botón queda disponible tras enviar. Tipos/lint y las ocho pruebas del servicio pasan. Guía pública actualizada.

## Resultado

Tarea terminada: 286 s de proceso informados por KIE. MP4 archivado en storage propio y copia local [vídeo de prueba](/Users/paulo/Downloads/habiteka-construccion-h3-prueba-8s.mp4). 8.000 s, 1344×768, H.264 a 24 fps, 2.86 MB; AAC estéreo 32 kHz. Audio no silencioso (media -19.8 dB, pico -0.4 dB); no se certifica mediante este análisis el carácter de los efectos ni sincronía muro por muro.

Revisión visual del clip completo a 2 fotogramas/s, y de los primeros 3 s a 8 fotogramas/s. Comparación con los seis renders fuente:

- Aparecen terraza/pérgola/barandillas, escaleras y mobiliario con el aspecto de las referencias. No se puede certificar cada zona ni todas las cantidades de muebles con vistas parcialmente tapadas por cubierta y paredes.
- Varios muros crecen juntos; incumple el orden obligatorio de uno en uno.
- Hay mobiliario antes de colocar el tejado y la cámara gira mientras todavía cambian elementos, alterando el orden solicitado.
- El edificio pasa de paredes completas a cortes y aperturas al girar. Las fuentes seccionadas aportan información interior, pero no fijan una envolvente exterior continua. El guion por sí solo no ha resuelto esa contradicción.
- No hay encaje sobre ortofoto: las seis referencias enviadas muestran fondo neutro. No se envió una séptima referencia geográfica ni se amplió el presupuesto.

Veredicto: **rechazada por falta de fidelidad**, persistido en el proyecto. Se conserva visible y descargable; no se genera otro intento ni se devuelve automáticamente el coste del proveedor. Límite global verificado nuevamente en 0 USD. Registro de uso estimado $0.34 y un único identificador de tarea.

Evidencia: [secuencia completa](video-261001-1756-piloto-h3-fotogramas.jpg), [crecimiento de muros](video-261001-1756-piloto-h3-muros.jpg).

## Continuación necesaria

Antes de otro gasto: fijar un exterior cerrado y coherente con tejado, separar las referencias interiores de las fachadas seccionadas y preparar estados de obra consecutivos ligados al diseño. Para localización real hace falta una referencia del conjunto ya encajado sobre la ortofoto confirmada. Revalidar presupuesto y fuentes si cambian. No presentar H3 con seis referencias como solución de fidelidad demostrada: este piloto no supera el umbral.

Tipos, lint focalizado, ocho tests del servicio y documentación Astro/Starlight verificados después de corregir taskId. Sin segundo clip, commit ni despliegue.

Pendiente: conciliación del coste real del proveedor; revisión perceptiva del audio; reconstrucción controlada de estados desde el diseño para conseguir la secuencia y envolvente exigidas.
