# Construcción: referencias con función y prueba revisada

## Revisión y decisión

Petición: avanzar desde el exterior corregido hacia el vídeo. Revisión local de las cinco imágenes válidas de la tanda original, sin transferencias a proveedores ni coste. Las vistas frontal/trasera/lateral discrepan en sofás, sillas y acabados; no conviene repetir el envío anterior mezclándolas sin prioridad.

Se usan dos referencias: cenital para distribución y mobiliario, incluidos patios; exterior corregido para fachadas, huecos, tejado, aleros, pérgolas y cámara. El guion indica qué imagen manda en cada aspecto. Esto fija instrucciones; no corrige las imágenes discrepantes ni garantiza obediencia de H3. La envolvente se puede contrastar desde la vista disponible; las caras ocultas y los bordes aislados del acceso todavía necesitan inspección en el vídeo.

## Implementación

- `design-video.ts`: selección inicial de distribución + exterior de la tanda más reciente válida; prioridad de cenital frente a isométrica/dron; funciones e índices explícitos en el guion. Cámara oblicua del exterior fija durante obra, vuelo final corto sin exigir vuelta completa. El mobiliario de las referencias de apoyo no sustituye al principal.
- `design-video-sources.ts`: transmite el ángulo registrado como metadato de las referencias, sin inferirlo por el título traducido.
- `design-construction-panel.tsx`: papeles visibles en miniaturas, selección inicial de dos vistas, bloqueo explicado si falta distribución, numeración de la preparación en el orden real del guion y envío. Se pueden añadir otras vistas de esa tanda.
- Guía pública y novedades actualizadas. Las preparaciones antiguas conservan sus guiones; los vídeos existentes no cambian.

## Preparación real, sin pago

Control habitual nativo de Chrome. Estudio → Construcción → Mis diseños. Verificados 8 s, 768P, efectos solicitados y dos referencias seleccionadas. Indicaciones concretas: cuatro camas en el dormitorio largo, resto de camas conservadas; salón/cocina y patio de la cenital; tabiques verticales consecutivos, muebles después de los muros; accesos y baño exterior; sin escaleras inventadas, parcela añadida, música ni voz.

Preparación guardada: `1de19299-ad39-4409-bf0d-3755794d50e7`, estado `prepared`, guion de 5974 caracteres, coste previsto **0,32 USD / 32 créditos**. Referencias, en orden:

1. `del-cmu7nm84n0001evmsi8nyt1ee-render3d-d2e6f968-d481-40e3-b731-63181cd81c8e` — cenital, distribución y muebles.
2. `del-cmu7nm84n0001evmsi8nyt1ee-render3d-43737bed-3563-49f8-a4a1-36c5733bc401` — exterior corregido, fachadas y tejado.

Misma tanda, revisión 156, atardecer y 12 zonas. Autorización recibida: «Sí, máximo 0,32 USD y restaurar a 0». Se envió una única prueba, KIE `9550ebc163f7a7c2540dddc51fb7695c`, con estas dos imágenes aisladas sin coordenadas ni ortofoto. Cargo registrado: **0,32 USD**, presupuesto restante de esta ronda: **0 USD**. El límite temporal de 0,98 USD (0,66 de uso previo + 0,32 nuevos) se restauró a **0 USD** tras el envío y se verificó en base de datos, también después de rechazar. Estado final: `rejected`, con MP4 conservado. Los permisos previos no se reutilizan para otro cargo.

## Resultado real y diagnóstico

Consulta única del resultado sin regeneración; MP4 archivado y descargado en `/Users/paulo/Downloads/habiteka-finca-construccion-h3-dos-referencias-8s.mp4`: 8,000 s, H.264, 1344 × 768, 24 fps, 2.710.542 bytes. Pista AAC estéreo de 8 s con señal no silenciosa (media −33,2 dB, pico −7,9 dB). Esto no certifica el contenido del sonido ni su sincronización: no se ha podido escuchar mediante el canal de análisis.

Revisados 16 fotogramas distribuidos por los ocho segundos, 27 fotogramas del crecimiento inicial y ampliaciones a 1,8 y 2,8 s. Evidencias locales privadas: `/tmp/habiteka-h3-pilot/two-reference-contact.png`, `two-reference-growth.png`, `two-reference-1-8.png` y `two-reference-2-8.png`.

| Aspecto | Observación | Diagnóstico |
|---|---|---|
| Dormitorio largo | A 2,8 s se ven dos camas; la cenital enviada muestra cuatro. | Pérdida de mobiliario en la generación del vídeo; esa cantidad sí está correctamente en la imagen principal. |
| Patio | Acaba mezclando mesa/sillas y sofás del exterior pese a la prioridad explícita de la cenital. | Las referencias discrepan en este punto y H3 no respeta la prioridad solicitada. |
| Entorno | Desde el inicio aparece jardín, árboles, setos y camino; ambas referencias tienen fondo gris y el guion pide fondo neutro. | Entorno inventado por H3; no procede de una ortofoto ni de coordenadas enviadas. |
| Secuencia | Muros en grupos; cortinas y sanitarios ya visibles antes de completar la envolvente (1,8 s). Muebles antes del intervalo solicitado de 5,1–6 s. | El modelo no mantiene el orden ni los tiempos preparados; no queda validado crecimiento individual de cada muro. |
| Cubierta | Tejado y las tres estructuras de pérgola aparecen en el cierre. | Mejora visible; no compensa pérdidas interiores ni acredita todas las caras y accesos. |

**Prueba rechazada por falta de fidelidad**, mediante el botón del estudio. UI `Prueba rechazada` y base de datos `rejected` verificados. No se borró el MP4 ni se envió otro intento.

## Verificación

15 pruebas focalizadas correctas (`design-video.test.ts`, `design-video-actions.test.ts`), tipos y ESLint correctos, también tras numeración de miniaturas y bloqueo por distribución ausente. UI real confirmó selección inicial, funciones, preparación guardada, resultado recuperado y rechazo. Guía compilada: 17 páginas, 0 errores/advertencias de Astro. `docs:updates` y `git diff --check` correctos. Ningún commit, publicación ni despliegue.

## Pendiente / preguntas

- Prueba autorizada completada y rechazada. No hay presupuesto autorizado para otra generación.
- Antes de otra prueba, resolver el mobiliario contradictorio del exterior y plantear etapas controladas desde el diseño aprobado. Un guion con prioridad explícita no ha bastado para conservar cantidad de camas, fondo y tiempos; repetirlo no acredita una solución.
- Cotas exactas compuestas sobre vídeo IA y película profesional validada siguen pendientes; no se simula que estén terminadas.
