# Continuación de referencias — 2 de octubre de 2026

## Resultado y límites

Se recuperó el control habitual mediante la aplicación nativa Comet. No se utilizó Chrome DevTools. Autorización existente: máximo 0,30 USD adicionales para imágenes y auditorías, límite global temporal 0 → 0,64 → 0; ningún vídeo nuevo.

La tanda `7aaa64a7-3e2b-472c-802c-3889184d1105`, revisión visual 156, conserva ahora Frontal, Trasera e Izquierda. Faltan Cenital y Exterior terminado. Las 12 zonas originales y la luz de atardecer se conservaron; referencias aisladas sobre fondo neutro, sin enviar coordenadas ni ortofoto.

| Intento | Resultado | Imagen KIE, estimada | Auditoría OpenRouter, confirmada |
| --- | --- | ---: | ---: |
| Cenital v15 | Rechazada; inspección manual detectó frutero en lugar de placa | 0,08000000 USD | 0,00592050 USD |
| Izquierda v15 | Aceptada y guardada; cuatro camas reconocibles en el dormitorio largo | 0,08000000 USD | 0,00435975 USD |
| Cenital v16 | Rechazada por aviso sobre un bloque blanco junto a la escalera | 0,08000000 USD | 0,00685050 USD |

**Total registrado: 0,25713075 USD**, compuesto por 0,24 USD estimados de KIE y 0,01713075 USD confirmados de auditorías. Margen autorizado sin usar: 0,04286925 USD, insuficiente para otra imagen de 0,08 USD. No se generó Exterior terminado ni otro H3. El límite global quedó verificado en **0 USD**, con registro de auditoría y vigilancia de respaldo finalizada.

## Comparación del último rechazo

El proveedor conservó la placa de cocina en la última cenital. La auditoría declaró nuevo un bloque blanco que supuestamente ocultaba el final de una escalera. Al descargar y comparar la captura gratuita original, esa superficie blanca ya estaba presente en el mismo extremo de la terraza. El documento aprobado contiene allí un descansillo: `builtin:ramp-landing`, 1,785 × 1,236 m, a 1 m de elevación; no es una escalera nueva.

Este motivo concreto de «aparición» contradice la referencia original. Eso no acredita por sí solo toda la fidelidad de la imagen. El intento sigue descartado y no se publicó como referencia de construcción. Se conservó una copia local para comparar, sin saltarse el control de publicación. No se pagó otra auditoría tras modificar sus instrucciones.

Copias privadas para revisión:

- `/Users/paulo/Downloads/habiteka-finca-izquierda-revision156.png`: izquierda aceptada.
- `/Users/paulo/Downloads/habiteka-finca-cenital-captura-revision156.png`: captura 3D gratuita original.
- `/Users/paulo/Downloads/habiteka-finca-cenital-descartada-revision156.png`: último candidato descartado, no apto todavía para construcción.

## Correcciones implementadas

- La revalidación al guardar una imagen dejaba sin `continuarTanda` la URL y cambiaba la clave del editor: se desmontaba todo y desaparecía el panel. Clave estable por ámbito, petición atendida mediante `useAutoGenerateRequest` y configuración congelada al abrir el panel.
- Cambiar únicamente cámaras conserva el ID de tanda; cliente y servidor comparten `renderBatchSettingsKey`. Permite completar por partes sin repetir vistas válidas.
- Protección de placas visibles: prompt v16 y auditoría identifican aros/quemadores sobre islas o encimeras y prohíben sustituirlos por fruteros o taparlos. El último candidato conservó la placa, sin acreditar cumplimiento general.
- Protección del arranque 3D: `scenePointerEvents` evita conectar eventos a un nodo DOM nulo cuando un canvas acaba de arrancar después de desmontarse. La navegación y preparación posteriores funcionaron sin nueva página de error.
- La auditoría contrasta plataformas y ocultaciones con el original antes de calificarlas como nuevas, alineando el encuadre. Mantiene el rechazo de cambios reales en límites, peldaños y barandillas. Eficacia con el proveedor pendiente de verificar.

## Verificación

- 44 pruebas pasadas en siete archivos: eventos 3D, opciones, continuación, prompts, auditoría, tanda y fuentes de vídeo.
- Tras la última modificación de instrucciones, repetición focalizada: 10 pruebas de auditoría pasadas. Son las mismas pruebas del conjunto anterior, no 10 pruebas adicionales.
- ESLint, TypeScript y `git diff --check` correctos.
- `npm run docs:updates` correcto y `npm run docs:build` correcto: 17 páginas, cero errores de Astro.
- Pruebas puras/con adaptadores simulados bajo la guarda de URL de base de pruebas; no modificaron la base real.
- Verificación en pantalla: apertura de continuación con tres vistas guardadas, selección de una sola cenital, preparación gratuita y motivo de rechazo persistente en el panel.
- El arreglo de conservación del panel al guardar está implementado; no se repitió una generación aceptada después del arreglo, por lo que ese caso concreto de revalidación no tiene nueva verificación visual.

Documentación afectada actualizada en `docs/site/src/content/docs/guias/imagenes.md`, `docs/site/src/content/docs/ayuda/novedades.md` y `docs/estudio-videos-galeria.md`. Sin commit, push ni despliegue.

## Pendiente

Actualización posterior: la cenital se revisó sin regenerarla, el exterior se completó y se envió una única prueba H3 con autorización adicional. Seguimiento en [el reporte de construcción](video-261002-0102-construccion-referencias-recuperadas-report.md); este documento conserva el estado y gasto de la ronda anterior.

Resolver una cenital fiable y aceptada, y luego Exterior terminado con cubierta y pérgolas. El nuevo vídeo continúa bloqueado por esas referencias. La corrección de las instrucciones del auditor no reacepta automáticamente archivos descartados. No se debe repetir a ciegas otra generación ni habilitar más gasto sin una propuesta concreta dentro de un presupuesto autorizado.
