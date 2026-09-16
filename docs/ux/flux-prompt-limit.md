# FLUX: límite del prompt y contexto del editor

## Causa investigada (15 septiembre de 2026)

Los modelos KIE `flux-2/flex-image-to-image` y `flux-2/pro-image-to-image`
admiten 3–5000 caracteres. El editor enviaba el prompt completo (11529
caracteres en la revisión 204 de Valdetorres). Una petición real, sin respaldo,
devolvió HTTP 200 con `prompt exceeds maximum length`, sin crear tarea.

Fuentes oficiales consultadas:

- [FLUX Flex](https://docs.kie.ai/market/flux2/flex-image-to-image)
- [FLUX Pro](https://docs.kie.ai/market/flux2/pro-image-to-image)

## Corrección

El servidor prepara una alternativa `compactPrompt` para las capturas del editor.
La estructura usa esquemas de claves compartidas y tuplas de coordenadas y
dimensiones. Renombra identificadores opacos de forma coherente. Conserva
muros, huecos, columnas, muebles, suelos, cotas y geometría de cada tramo de
rampa, cámara y permisos decorativos. Los suelos referencian el contorno de su
habitación en vez de repetirlo. Las instrucciones redundantes se expresan una vez.
No se truncan números, objetos ni restricciones para alcanzar el límite.

FLUX elige esta alternativa solo cuando el prompt completo supera el límite.
Otros proveedores conservan el prompt completo. Si incluso la alternativa
supera 5000 caracteres, se rechaza antes de subir imágenes y se permite el
respaldo configurado. El informe registra `kie_prompt_too_long`, no un error
genérico de disponibilidad. No se modifican automáticamente los perfiles.

## Validación

- Regresión roja antes de corregir: dos pruebas fallaban por enviar el prompt
  largo y subir imágenes antes de validar.
- 28 pruebas focalizadas pasan tras corregir: proveedor KIE, contexto compacto,
  prompt de vista seleccionada y formato de costes.
- TypeScript y ESLint focalizados sin errores.
- La compactación no es una garantía de fidelidad visual del modelo: esta debe
  evaluarse en la imagen resultante y no inferirse del éxito de la API.

## Tareas aceptadas y espera

La prueba desde el navegador confirmó que KIE acepta el prompt compacto.
También descubrió que la espera anterior de 120 segundos iniciaba el respaldo
mientras FLUX seguía ejecutándose. FLUX ahora espera hasta 600 segundos.
Si una tarea aceptada queda sin resultado confirmado, `kie_task_pending`
impide lanzar otra generación y conserva `providerTaskId` en el registro.
Un fallo explícito del proveedor sí permite el respaldo. No hay recuperación
automática posterior implementada en este cambio.

En la comprobación de las 16:43, Flex y Pro de la prueba anterior seguían
en `running` en KIE; todavía no hay resultado FLUX con el que validar fidelidad.
No se lanzaron nuevas pruebas pagadas tras detectar esta duplicación.

## Prueba alternativa Gemini Pro en KIE

El 15 de septiembre se cambió únicamente el mapeo activo `render3d` a
`kie:nano-banana-pro` (Gemini 3 Pro Image), con
`openrouter:google/gemini-3-pro-image` como respaldo. Los perfiles guardados
y el uso `inpaint` no se modificaron.

La [documentación de Nano Banana Pro](https://docs.kie.ai/market/google/pro-image-to-image)
especifica un máximo de 10000 caracteres. Se aplica el contexto compacto
cuando el completo excede ese límite y se valida antes de subir referencias.
Dos pruebas de regresión fallaron antes del cambio y pasan después; 30 pruebas
focalizadas, TypeScript y ESLint pasan.

Prueba real completada a las 17:10:58: `kie:nano-banana-pro`, intento 0,
49332 ms, sin respaldo. Entregable
`del-cmtzyvx0r0052jdms3csry4js-render3d-5ff28a4a-fb01-407f-8032-0c9ad524a608`.
Se abrió la imagen en la galería del navegador. Esto valida ejecución y
persistencia, no garantiza exactitud arquitectónica del resultado.
