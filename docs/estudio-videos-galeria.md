# Estudio de vídeos y galería de renders

## Flujo implementado

`/projects/[id]/videos` abre el editor durable con el estudio. Conserva `zoneId` en navegación, lectura de medios, aprobación y guardado. El mismo diálogo se abre desde el editor y el diseño aprobado. Preparación, geometría, recorrido, luz, exportación y resultados están en este estudio.

El editor modifica el borrador. La escena grabable utiliza una copia de la instantánea aprobada, con su luz. Un cambio de contenido o iluminación exige volver a aprobar. Los controles se bloquean al grabar, con cancelación y restauración de cámara, materiales y transformaciones. El controlador de la escena expone creación/estado al diálogo sin duplicar el grabador.

## Modalidades y fuentes

| Modo | Fuente | Ruta | Duración |
|---|---|---|---|
| construction | Modelo editable aprobado | No | 8 s; opción 12 s |
| promotion | Modelo aprobado sobre ortofoto confirmada | No | 30 s |
| walkthrough | Modelo aprobado | Sí | La del recorrido |
| showcase | Modelo aprobado, construcción y recorrido | Sí | 8 s (o 12 s) + recorrido |
| images | Renders del mismo diseño visual | No | Según imágenes seleccionadas |

La película profesional desde renders **no está validada**. Existe un piloto conectado de construcción H3, documentado abajo; la primera generación de pago fue rechazada por secuencia de muros y continuidad de la envolvente. Los modos nativos no reconstruyen los muebles creados por IA en las imágenes. El montaje mueve y funde imágenes; no simula construcción ni un paseo continuo.

## Ámbito y construcción

`videoScopeRegions` comparte la definición de estancias interiores con el ámbito de imágenes Solo la casa. Incluye las plantas del edificio y rechaza planos sin interiores cerrados. Las regiones ajustan encuadre y cotas sin modificar el documento.

`isolateSceneToZone` aplica materiales temporales. Para vídeo conserva ortofoto y tejado completo; retira terreno modelado cuando existe parcela confirmada; filtra estructura/muebles ajenos y recorta superficies, objetos y tapado. Los muros conservados mantienen sus caras completas. Patios y elementos exteriores quedan fuera del ámbito interior; Todo el plano conserva la geometría completa.

`construction-timing` define 8 s por defecto: vacío 0–0,5 s, suelos 0,5–1,3 s, muros 1,3–4,3 s, huecos/cubierta 4,3–5,1 s, mobiliario 5,1–6 s y vuelo 6–8 s. La opción de 12 s asigna suelos 0,5–1,5 s, muros 1,5–4,5 s, cubierta hasta 5,5 s, muebles hasta 9 s y vuelo hasta 12 s. Construcción independiente y la introducción de showcase comparten tiempos, cámara fija hasta el vuelo y sonido. La promoción conserva su guion de 30 s. Estructura se ordena por grupos estables del plano, compartiendo índice todos los fragmentos y cierres con el mismo `buildKey`. La función de progreso admite como máximo un muro en crecimiento.

Los FX sintetizados reciben el número de grupos y los tiempos de fase del exportador. Un roce/impacto acompaña el inicio de cada muro; no hay muestras externas ni música. H.264 a 1080p/30 fps, AAC opcional; render interno adicional según GPU y salida fija para evitar cambios de tamaño por el viewport.

`video-presentation` valida sonido, ámbito, `dimensionMode` (animated/start/fixed/none), `dimensionOcclusion`, `constructionDurationSeconds` (8/12) y guion adicional de hasta 2000 caracteres. Los tickets y el entregable conservan estos ajustes; los vídeos anteriores sin modo mantienen el comportamiento fijo. La duración elegida controla preparación, grabador, límites de recorrido y ticket; los vídeos ya guardados conservan su duración registrada. El límite del ticket permite el JSON/base64 de instrucciones Unicode. La biblioteca expone presentación validada e indicaciones guardadas.

Las anclas de ancho/fondo/altura se calculan una vez desde el ámbito y alturas del diseño. `video-dimension-overlay` crea cilindros y sprites temporales, sin raycasts por fotograma: materiales con depthTest y sin depthWrite, animación escalonada, fundido de inicio de cuatro segundos y tamaño aparente dependiente de cámara. El exportador actualiza el overlay antes de renderizar y libera materiales, geometría y texturas al finalizar/cancelar. Sustituye las antiguas cotas 2D pintadas sobre la imagen y su resumen fijo en esquina.

`video-generation-prompt` prepara un guion portable según modo, luz y presentación, más instrucciones adicionales. El estudio permite revisar/copiarlo. No ejecuta generación ni interpreta lenguaje libre como cambios del MP4 nativo; las opciones estructuradas son las que controlan las cotas de ese MP4.

El ticket firmado conserva aprobación, revisión, huella, ámbito y modo. El servidor valida permiso, ámbito y ruta/guion antes de crear la subida; al finalizar vuelve a comprobar la aprobación y el MP4. Las exportaciones nativas registran coste cero.

## Renders y revisión

Al recuperar una tanda se rechazan payloads sin objeto y se cuentan una sola vez las cámaras aceptadas, aunque existan varias imágenes guardadas del mismo ángulo.

Cliente y servidor comparten `renderBatchSettingsKey`: los cambios exclusivos de cámaras conservan el ID de tanda al volver a preparar. Los cambios de luz, ámbito, permisos o modo la invalidan.

`scenePointerEvents` conserva el gestor de eventos de R3F y omite conexiones tardías cuyo nodo DOM se desmontó al pasar de aprobado a editor. Evita el error de `addEventListener` sobre null durante la inicialización asíncrona de WebGL, sin cambiar las interacciones de un canvas montado.

El `key` del editor depende solo del ámbito: no incluye `continuarTanda`, que se retira de la URL. `useAutoGenerateRequest` atiende cambios de petición sin remontar el espacio de trabajo; el diálogo congela sus ajustes en estado local. Una revalidación posterior al guardado conserva el diálogo y las capturas. Una petición nueva sale de la vista aprobada; abrir el botón normal de generación borra la configuración de continuación.

`loadRenderBatchContinuation` recupera tandas por organización/proyecto/zona e ID; valida opciones y revisiones compatibles. Excluye como completadas las imágenes con revisión rechazada o recorte inválido; recupera pendientes de la unión de ángulos originales. No admite cámaras interiores ni `current`. El enlace **Completar vistas de la tanda** del panel de construcción usa `continuarTanda`; el editor lo consume y limpia la URL. El ID se conserva al preparar; cambiar ajustes invalida esa continuidad y crea otra tanda. El texto libre y estilo del intento original no estaban persistidos, por lo que no se recuperan; se pide revisarlos. `assertRenderBatchCompatible` impide generar con ajustes/revisión incompatibles bajo un ID existente; solo permite variar los ángulos, antes de llamar al proveedor de imagen. No genera IA durante la carga/preparación.

`renderBatchFailureMessage` muestra todos los fallos por cámara incluso cuando un error posterior detiene la tanda. No relanza imágenes. `generation.review` permite registrar un descarte posterior con razón y fecha: `design-video-sources` lo muestra como `issue` y lo rechaza antes de preparar/enviar; `tourImagesFromRows` lo excluye del montaje; `drone-references` y `batch-style-anchor` no lo aceptan como ancla. Se conserva el archivo y la galería. Esta revisión no dispone aún de un control de usuario en la galería.

Prompt de imagen v16 y auditoría comparten `FURNITURE_USE_RULE`: proteger la función del mobiliario, reconocer camas desde sus pies/cabeceros y mantener placas de cocina. Identifica superficies con aros o quemadores sobre islas/encimeras y prohíbe convertirlas en fruteros o taparlas, sin exigir placas en cámaras que no las muestran. Una regla de prompt no acredita que el proveedor ni el auditor la cumplan; requiere inspección visual. Los resultados generados anteriormente no se reparan al cambiar las instrucciones.

La auditoría debe contrastar bloques, plataformas y ocultaciones con la captura original, alineando el encuadre antes de atribuirlos al candidato. No debe inventar un requisito de visibilidad que el original no cumple; conserva el rechazo de cambios reales en límites, peldaños o barandillas. Corrección motivada por un falso aviso sobre un descansillo ya modelado. No reacepta resultados descartados ni elimina controles de fidelidad. Una nueva revisión real del PNG existente pasó la auditoría y se guardó por el flujo normal; acredita ese caso concreto, no la precisión general del auditor.

`ExistingRenderReview` permite subir un PNG de hasta 10 MB para una cámara preparada. `existingImageDataUrl` pasa por el esquema cerrado de ajustes y `generateOrReviewRender` sustituye únicamente la solicitud al generador por bytes del archivo, sin construir URLs remotas ni acceder a claves de assets del cliente. El saneado, autoridad de proyecto/zona, consentimiento, calidad, revisión vigente, compatibilidad de tanda, máscara y auditoría permanecen en la misma acción y antes de publicar. Origen `import/existing-image-review`, versión `habiteka-existing-image-review-v1`; no se atribuye una generación KIE nueva. Se factura la auditoría, no la imagen. Un rechazo no guarda un entregable ni desactiva las otras cámaras.

`groupDeliverables` agrupa por lote y zona, conserva orden y no fusiona renders históricos sin ID de lote. Las miniaturas identifican estancia/zona y cámara; las cuatro acciones aparecen en el modal: fondo de plano, descarga, cambios y variante. El resultado devuelto por generación incluye sus opciones/cámara congeladas para evitar etiquetas cambiantes después de generar.

El fondo v2 guarda el ID del render y dimensiones/posición, no una URL temporal. La carga resuelve un enlace nuevo. La acción verifica organización/proyecto/zona, permiso y revisión optimista; un conflicto no sobrescribe el plano. El fondo no altera geometría ni invalida por sí mismo el contenido visual de una aprobación.

El recorte de una zona usa solo muros exteriores que miran a la cámara; no elimina sus tabiques interiores. La intención de rediseño se reconoce por opción o instrucción. Las políticas permiten mobiliario nuevo sin alterar distribución; los fijos requieren permiso independiente. Una vista aceptada del lote aporta identidad estética a las siguientes. La auditoría exige `redesignApplied=true` cuando se solicita. El montaje rechaza mezclas de interiorismo conservado/rediseñado. Estos controles reducen errores, no garantizan fidelidad absoluta de la IA.

## Siguiente integración: clips desde diseños

No dar por terminada la fase de película profesional con una exportación nativa. Preparar imágenes de estados de obra y exterior terminado con tejado, interiores a altura de ojos, ámbito/luz coherentes, y anclas de mobiliario aceptadas. Los laterales seccionados sirven para distribución; no sustituyen una referencia de fachada cerrada para el final de obra.

Higgsfield documenta `kling-video/v3.0/std/image-to-video`: `image_url`, `last_image_url`, duración 3–15 s, `sound`, `multi_shots`; usa autenticación de servidor y tareas asíncronas. El endpoint requiere medios accesibles para el proveedor: una URL de storage en localhost no sirve como referencia remota. No se han enviado datos de proyectos ni realizado generaciones de pago.

MiniMax H3 es otra opción contrastada: API directa `POST /v2/video_generation`, modelos `MiniMax-H3` (768P/2K, 4–15 s) y `MiniMax-H3-Max` (variante rápida, 480P/768P, 5–15 s). El array `content` admite texto y roles de medios; referencias y primer/último fotograma son modos mutuamente excluyentes. Para transferir la secuencia nativa y las apariencias generadas se debe evaluar reference-to-video con tramos de movimiento y las imágenes de identidad; no garantiza precisión arquitectónica. H3 documenta audio estéreo nativo. Higgsfield ofrece también `minimax/h3/image-to-video`, pero su contrato publicado de imagen a vídeo no expone todas las referencias de la API directa.

Las cotas de clips IA requieren composición determinista posterior y validación del encaje de cámara/profundidad. No delegar cifras exactas al modelo. El overlay actual usa la cámara del modelo 3D, por lo que no puede reutilizarse sin comprobar la trayectoria de un clip generado. Primer piloto H3/KIE: 286 s de proceso para 8 s/768P; rechazado por muros simultáneos y cambios de envolvente. H3 Max no se ha probado. Un resultado no acredita latencia general ni fidelidad profesional.

Fuentes del 01/10/2026: [API directa H3](https://platform.minimax.io/docs/api-reference/video-generation-v2-create), [especificaciones H3 y audio](https://www.minimax.io/news/minimax-h3-open-source), [H3 en Higgsfield](https://open.higgsfield.ai/models/minimax/h3/image-to-video/api-reference).

Pendiente para la película profesional: fotogramas coherentes con cubierta terminada, pilotaje real, auditoría temporal y aceptación de calidad. El guion debe conservar casa, aleros/pérgolas incluidos en el ámbito, entorno y muebles en todos los fotogramas. Rechazar cambios de identidad, apariciones simultáneas cuando se exige secuencia, desapariciones, deformaciones y textura inestable antes de publicar el vídeo.

## Piloto H3 conectado desde diseños

### Integridad de referencias y accesos

El preset de captura/render `exterior` aparece como **Exterior terminado**. Comparte encuadre oblicuo de isométrica, pero fuerza `cutaway=false`, `ceilingView=solid` y no activa ocultación aérea de pérgolas/tejado. La máscara mantiene el ámbito elegido. La integridad rechaza una captura `exterior` con corte o cubierta oculta. `prepare-render-captures` la ordena después de las vistas cercanas; `drone-references` exige cenital compatible para su identidad (y ortofoto en ámbito no aislado), igual que para isométrica. Prompts y galería la identifican como exterior cerrado. El máximo de ángulos del lote es nueve, incluidos vista actual y exterior; H3 sigue admitiendo hasta nueve referencias.

La preparación y el envío H3 comparten `assertConstructionReferences`: una misma tanda, una vista de distribución y una referencia con fachadas completas/cubierta visible. El estudio muestra el motivo y deshabilita preparar si falta el exterior terminado. El bloqueo también alcanza preparaciones antiguas, antes de reservar o transferir. El contrato no prueba que los píxeles de la cubierta coincidan ni que el vídeo la conserve: las revisiones de fidelidad siguen siendo necesarias.

`render-view-integrity` compara `cutawayWallIds` con los muros interiores físicos (`wallSelectionGroups`) de la planta de la captura, o todas las plantas cuando corresponda. Rechaza tabiques compartidos/abiertos interiores, IDs ajenos a la planta, recortes contradictorios y ausencia de la lista en una vista seccionada. Se aplica en preparación local y en `renderEditorConceptAction` antes del adaptador de imagen. No corrige fotos existentes ni prueba su contenido visual.

`design-video-sources` conserva las fotos incompatibles en el listado con `issue`, y las rechaza al seleccionarlas tanto para preparación como para envío, antes de reservar créditos o transferir referencias. El estudio desactiva sus casillas y excluye esas imágenes de la selección inicial. La revisión geométrica compatible de un render antiguo no basta para acreditar su recorte.

`design-video-structure` cruza las huellas de escaleras/rampas con los polígonos del ámbito de las imágenes y respeta la planta de cada vista. En ámbito completo incluye sus accesos; une selecciones sin duplicarlos. Congela en `structuralConstraints` cantidad, forma y posición local, incorporadas al guion revisable. Distingue una rampa inclinada de los descansillos con desnivel cero. Nunca lee mobiliario. El permiso `redesignFixed` afecta cocina, sanitarios y armarios, no autoriza cambios estructurales. Estas restricciones no garantizan que H3 las cumpla; la aprobación del resultado sigue siendo manual.

Construcción usa inicialmente Mis diseños; Prueba del plano 3D es una alternativa explícita. `design-video-sources` recupera solo renders con proveedor y opciones registradas, compatibles con aprobación y ámbito organización/proyecto/zona. No toma imágenes nativas como sustitutas. Preparar exige una misma tanda, homogeneidad de luz/libertad/rediseño y una referencia del conjunto (cenital/isométrica/dron). Los polígonos, IDs de habitaciones/estructuras y opciones de cada render se congelan en `sourceScopes`; sus zonas aparecen en pantalla y en el guion, incluidas partes exteriores. No se aplica `videoScopeRegions(house)` a estos renders.

`designConstructionPrompt` deriva mobiliario y acabados de las imágenes, sin inventario del editor. Pide cantidad/posición exactas y ámbito seleccionado completo; las cifras/cotas quedan fuera hasta implementar composición. Ritmo 8/12 s y tres segundos de muros son instrucciones al generador, no resultados garantizados. Referencias sin cubierta terminada o con inconsistencias siguen siendo un riesgo de fidelidad que debe resolverse antes de aceptar una película final.

`design-video-actions` prepara una fila VIDEO `mode=construction-ai` sin gasto ni transferencia. Guarda aprobación, huella, fuente IDs/opciones, guion, resolución, duración y tarifa prevista. Tras consentimiento específico de medios y máximo USD, revalida versión/tenancy, comprueba saldo/caps, reclama la fila mediante versión optimista, reserva créditos y sanea/sube imágenes propias. Se utiliza la credencial KIE cifrada de servidor; nunca llega al navegador.

Contrato oficial: `POST /api/v1/jobs/createTask`, modelo `minimax-h3/reference-to-video`, `input.prompt`, `reference_image_urls`, `duration`, `aspect_ratio`, `resolution`. El piloto solo adjunta imágenes (máximo nueve), sin vídeo de entrada ni inventario 3D. Prompt máximo 7000 caracteres, 768P/2K y 8/12 s. La consulta usa `/api/v1/jobs/recordInfo`; el MP4 se descarga con límite, se verifica `ftyp` y se conserva en storage propio. [API KIE H3](https://docs.kie.ai/market/minimax-h3/reference-to-video).

Estados: prepared → submitting → generating → review → accepted/rejected; fallos confirmed → failed, envío ambiguo → unknown. Una preparación solo se reclama una vez. Consultar o fallar la descarga no relanza generación. Un rechazo confirmado previo a aceptación del proveedor libera la reserva; respuesta incierta la confirma por prudencia y bloquea otro envío de esa prueba. Si el proceso cae en submitting sin identificador, requiere comprobación manual en KIE: no se puede garantizar aceptación exactamente una vez sin idempotencia del proveedor. No hay worker autónomo; consulta/reanudación desde Vídeos guardados. Aceptar/rechazar es revisión humana, no auditoría automática de fotogramas.

Tarifa orientativa del 01/10/2026: 0.04 USD/s a 768P, 0.065 a 2K; primeras cinco imágenes sin suplemento y 0.02 USD por imagen adicional. Créditos Habiteka: 100 por USD, como la conversión monetaria existente en debit-service; no son créditos KIE. Telemetría `video.kie-h3.estimated` diferencia coste previsto de un importe conciliado. No se generan reintentos ni se promete devolución de una tarea fallida ya aceptada; saldo real/posibles devoluciones deben conciliarse con KIE. [Tarifas KIE](https://kie.ai/minimax-h3).

Fuentes técnicas contrastadas el 01/10/2026: [API de Kling 3.0](https://open.higgsfield.ai/models/kling-video/v3.0/std/image-to-video/api-reference), [flujo de Higgsfield](https://docs.higgsfield.ai/docs). Su catálogo publicaba 0,084–0,126 USD/s para Standard imagen a vídeo; confirmar tarifa según duración/audio antes de reservar gasto. El coste de crear imágenes y auditar es adicional.

Guías públicas: `docs/site/src/content/docs/videos/estudio.md`, `guias/imagenes.md` y `videos/montaje-imagenes.md`.
