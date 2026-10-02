# Completar referencias de construcción — 01/10/2026

> Estado histórico de preparación. La ejecución posterior recuperó el control nativo, guardó Izquierda y registró 0,25713075 USD dentro del máximo autorizado; el límite volvió a 0. Cenital y Exterior terminado siguen pendientes. Detalle actualizado en `imagenes-261001-2354-continuacion-referencias-report.md`.

## Resultado

Implementado **Completar vistas de la tanda** en Crear vídeo → Construcción → Mis diseños. Recupera los ajustes y prepara únicamente las cámaras pendientes; conserva las imágenes aceptadas y el ID de tanda. Carga y preparación sin IA.

La tanda revisada conserva Frontal y Trasera. Faltan Cenital, Izquierda y Exterior terminado. La Izquierda anterior está descartada porque convirtió las cuatro camas en butacas; no puede utilizarse para construcción. El intento cenital anterior fue rechazado y Exterior terminado no llegó a generarse.

## Preparación e inspección

- Misma revisión visual 156; 12 zonas originales, atardecer, decoración controlada y fijos protegidos.
- Capturas gratuitas preparadas y ampliadas en el navegador: cenital con tabiques y cuatro camas; lateral con camas y tabiques interiores; exterior con cubierta y pérgolas.
- Capturas aisladas sobre fondo gris; sin transmitir coordenadas ni ortofoto a proveedores.
- Las imágenes nuevas todavía no están generadas. La regla v15 protege camas y placa de cocina, pero su cumplimiento requiere revisar los resultados.
- El texto libre y el estilo originales no estaban persistidos. El panel indica que deben revisarse; no promete recuperarlos.

## Cambios técnicos

- Resolución por organización, proyecto, zona e ID; rechazo de revisiones visuales u opciones incompatibles.
- Pendientes a partir de la unión de ángulos originales; las revisiones rechazadas y las cámaras que ocultan tabiques vuelven a quedar pendientes.
- Conteo único de cámaras aceptadas y rechazo de payloads sin objeto.
- El servidor permite variar ángulos al continuar, pero bloquea cambiar luz, ámbito o permisos antes de enviar la imagen.
- Cambiar ajustes en el panel invalida la continuidad y prepara otra tanda. No admite continuar cámaras interiores ni «Vista actual».
- Documentación pública en guía de imágenes y novedades; referencia técnica en `docs/estudio-videos-galeria.md`.

## Verificación

- TypeScript y ESLint correctos; `git diff --check` correcto.
- 15 pruebas unitarias pasadas: continuación, ejecución de tandas y fuentes de vídeo.
- 3 pruebas de acciones de proyecto pasadas en PostgreSQL aislado `habiteka_test_continuation_261001`, creado expresamente con sus migraciones y marcador de pruebas.
- Base temporal propia retirada después de verificar marcador y ausencia de conexiones; base real sin cambios por las pruebas.
- Una repetición conjunta agotó 5 s durante importación de las acciones (2 timeouts); la repetición focalizada con 30 s pasó las 3. No se modificaron las aserciones.
- `npm run docs:updates` correcto; `npm run docs:build`: 17 páginas, cero errores.
- Consulta de costes del proyecto desde el inicio de esta preparación: **0 llamadas, 0 USD**. Límite global verificado en **0 USD**.

## Coste y siguiente paso

La tanda anterior registró aproximadamente **0,3403 USD** entre imágenes y auditorías; detalle en `imagenes-261001-2254-finca-referencias-auditadas-report.md`.

Completar las tres referencias estima **0,24 USD** en imágenes, más auditorías. Propuesta pendiente de autorización: máximo **0,30 USD adicionales**, sin vídeo ni regenerar Frontal/Trasera. Requeriría habilitar temporalmente el límite global de 0 a 0,64 USD y restaurarlo a 0 al terminar; los 0,34 USD de uso global previo corresponden al piloto H3. Vigilar también `AiRequestCost`, porque las imágenes no se contabilizan en `UsageEvent`.

No se ha ejecutado ese gasto ni aprobado un vídeo nuevo. Tras generar se deben inspeccionar tabiques, camas, placa, accesos, tejado y pérgolas antes de preparar otro H3.

## Autorización y bloqueo de ejecución

El usuario respondió «sí» a la propuesta concreta: máximo 0,30 USD adicionales para las tres imágenes y auditorías; habilitación temporal 0 → 0,64 → 0 USD. Autorización vigente, sin vídeo nuevo.

La herramienta habitual de navegador no pudo arrancar por falta del ejecutable del servicio de control, también tras reiniciar su sesión. No se envió generación ni se elevó el límite. Se verificó de nuevo límite 0 USD y cero llamadas nuevas. La base de seguimiento de este intento se guardó en `/tmp/habiteka-h3-pilot/continuation-budget-baseline.json`.

El usuario eligió esperar a recuperar el control habitual. No utilizar Chrome DevTools. La autorización económica permanece vigente; ejecución pendiente de recuperar la herramienta habitual, sin gasto ni cambio del límite.
