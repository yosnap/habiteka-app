---
title: "Fase 5: Vídeo de construcción visual y recorrido"
status: in-progress
---

# Fase 5: Vídeo de construcción visual y recorrido

## Decisión vigente — diseños aceptados como única fuente

Corrección explícita del usuario el 02/10/2026: todo vídeo, primera persona, inmersión y visita virtual final debe partir de renders IA aceptados y conservar su mobiliario/apariencia con hiperrealismo de filmación real. El plano/3D son guías y no valen como entrega ni sustituto. Esta decisión sustituye las alternativas nativas descritas como avances históricos debajo. Se retiran del flujo; aceptación humana de imágenes obligatoria e independiente de auditoría automática. Sin interior aceptado o modalidad implementada, indicar pendiente y bloquear, no grabar el modelo.

No cerrar fase por prompts, capturas del plano, compilaciones ni pruebas. Continúan pendientes derivación coherente de interiores, continuidad y visita libre desde diseños, combinado y verificación temporal/visual real. Fuente permanente: `AGENTS.md`; [contrato técnico](../../docs/disenos-aceptados-como-fuente.md).

## Publicidad vertical y panel de cotas — 02/10/2026

Prioridad elegida por el usuario: publicidad vertical y cotas. Implementación de formato compartido 16:9/9:16, vista previa y guardado separados, y composición local desde vídeos existentes de la misma aprobación. H3 requiere aceptación previa. Se conserva audio y duración del original y se añade otro entregable con procedencia; no se generan clips de pago.

Las cotas del anuncio muestran ancho/fondo/altura globales del diseño aprobado en panel separado, con modos animado, inicio, fijo y desactivado. No reconstruyen la geometría del vídeo ni siguen su cámara. La exportación 3D conserva su cámara horizontal y encaja la imagen completa en vertical. No requiere migraciones. Verificados 47 casos enfocados, suite de 2396 pruebas, tipos/lint/documentación, compilación Next y exportaciones reales H.264/AAC; [reporte](../reports/publicidad-261002-1337-vertical-cotas.md). La fase sigue abierta por fidelidad H3, primera persona continua, editor de tomas y pistas externas. Referencia técnica: `docs/publicidad-video.md`.

## Referencias con función y tercera preparación — 02/10/2026

Exterior corregido generado y revisado: fachada lateral cerrada, cubierta y pérgolas conservadas. La inspección conjunta detecta muebles/colores discordantes en las vistas anteriores. El estudio propone ahora cenital para distribución y mobiliario, exterior para fachadas/tejado/cámara, con función visible e índices alineados con el envío. El guion pide cámara fija, muros consecutivos y vuelo final corto; no garantiza fidelidad del modelo.

Prueba real enviada y revisada con autorización específica: 8 s/768P, dos imágenes aisladas de la misma tanda y revisión, efectos solicitados, **0,32 USD registrados**. Tarea KIE `9550ebc163f7a7c2540dddc51fb7695c`, **rechazada**: pierde camas de la cenital, mezcla muebles del exterior, inventa jardín y no cumple los tiempos ni el crecimiento individual de muros. Tejado y pérgolas sí aparecen. MP4 conservado. Límite global restaurado y verificado en **0 USD**; no se generó otro intento. [Informe](../reports/video-261002-0409-referencias-con-funcion-report.md). Fase **in-progress**: fidelidad profesional, accesos completos, sonido validado y cotas exactas sobre IA siguen pendientes.

## Segundo piloto H3 — 02/10/2026

Completadas cinco referencias compatibles de la misma tanda: frontal, trasera, izquierda, cenital y exterior con cubierta. Se implementó la revisión de PNG existentes por el mismo flujo de auditoría para recuperar una cenital sin regenerarla. El panel permaneció abierto tras guardar y completar únicamente la vista pendiente.

Corrección del usuario a las 01:49: el exterior falla en su lado izquierdo y la vista derecha tampoco está bien. Está creando las sustituciones personalmente. Las cinco referencias admitidas no equivalen a un conjunto visual validado; revisar las nuevas antes de cualquier otro piloto. La derecha no participó en el último envío.

Con autorización adicional de hasta 0,60 USD se generó un único H3 de 8 s/768P por 0,32 USD, usando imágenes aisladas sin ortofoto ni coordenadas geográficas. Total registrado de la ronda: 0,49665825 USD; cap global restaurado y verificado en 0.

**Rechazado:** a 2 s introduce tabiques diagonales y redistribuye las camas respecto a la cenital; mezcla muebles con la construcción de muros. Tiene tejado, pérgolas y pista AAC, sin certificar sincronización de FX ni identidad completa. Las vistas aceptadas también presentan diferencias de acabados entre cámaras: la auditoría individual no garantiza coherencia del conjunto. No hubo otro vídeo. Antes de más gasto, unificar referencias y preparar estados de obra con cámara común. La fase sigue en curso. [Informe y evidencia](../reports/video-261002-0102-construccion-referencias-recuperadas-report.md).

## Avance 01/10/2026: cubierta y presentación nativa

Se implementa **Editor → Tejado** por planta (plana, una/dos/cuatro aguas, pendiente, orientación, alero, espesor y acabado), recortado por habitaciones y patios. Se incorpora a referencias/contexto de imágenes y al vídeo. Los muros del vídeo nativo crecen progresivamente desde su base, los otros componentes entran por fundido; se añaden cotas del diseño, efectos sintetizados opcionales con AAC y previsualización del MP4 recién exportado. Mejora de render interno y espera de texturas/modelos. Referencia nueva: YouTube `X_dNq6G60bw`, 00:07–00:39. Informe en `docs/reports/video-261001-cubierta-animacion-sonido-report.md`.

La fase sigue **in-progress**: estas mejoras del vídeo conceptual no cierran el requisito de película fotorrealista continua sobre imágenes generadas. Falta incorporar el tejado elegido al inmueble, aprobarlo, completar imágenes coherentes y ejecutar el piloto de clips con presupuesto.

## Aclaración de producto (28/09/2026)

El entregable final se llamará **vídeo resumen**: empieza en el terreno vacío, muestra cómo se levanta y termina el inmueble aprobado, incluye un vuelo exterior tipo dron y entra para un **vuelo interior breve y dirigido por todas las zonas del inmueble**. El espectador solo reproduce la pieza. No se presenta como «visita»: la visita libre permite decidir rumbo y mirada, y un «recorrido» es una ruta guardada que puede exportarse por separado. La cámara del resumen necesita guion, ritmo y trayectoria propios, con pasos físicamente posibles por puertas y conexiones. No basta con pegar la ruta peatonal existente tras ocho segundos de introducción.

El modo `showcase` actual hace precisamente esa introducción corta más la ruta grabada. Debe figurar como **muestra de obra + recorrido** hasta que cumpla el vídeo resumen; no cuenta para cerrar esta fase. Los archivos se organizan en resultados separados: «Diseños» abre por defecto, «Recorridos» contiene rutas MP4 y «Vídeos» contiene muestras y, cuando exista, el resumen final. Ningún MP4 se muestra por encima de los diseños al abrir la página.

## Decisión de producto (30-09-2026): el recorrido va sobre las imágenes generadas

Paulo aclara el modelo: el plano editable son **solo las guías** del usuario (geometría, suelos, muebles clave) y la IA pone el resto en las imágenes (cortinas y demás decoración incluidas). Por tanto, el vídeo con recorrido se construye **sobre las imágenes generadas**, y esas imágenes deben componer **todos los ambientes, habitaciones y partes del inmueble**. Esto sustituye la idea de que el vídeo final salga solo de la escena 3D nativa; la grabación nativa se conserva como base (introducción de obra, verificación de rutas) y como alternativa fiel.

**Vía A — montaje con las imágenes existentes (hecha, sin consumo de IA):**
- `src/lib/editor-document/image-tour.ts`: elige una imagen por ámbito y vista (prefiere día, más fiel al plano y más reciente), abre con «Inmueble completo» y sigue por ámbitos; línea de tiempo determinista con zoom/desplazamiento lento y fundidos de 0,8 s. Pruebas en `tests/editor-document/image-tour.test.ts`.
- `src/components/deliverables/record-image-tour.ts`: codifica en el navegador un MP4 H.264 a 1080p con WebCodecs (misma técnica que el grabador nativo).
- Pestaña «Vídeos» de Diseños: galería por ámbito con la selección sugerida, aviso de ámbitos sin imagen y botón «Crear vídeo con N imágenes». El MP4 se guarda como entregable `VIDEO` con `mode: 'images'`, ligado a la aprobación vigente y a los IDs de las imágenes usadas (`src/server/walkthrough/image-tour-actions.ts`, ticket firmado).
- Comprobado con un vídeo real de FInca: 19 imágenes, 46 s, del inmueble completo a cada ambiente. **Limitación:** las imágenes existentes son exteriores, aéreas, isométricas y cenitales; no hay ninguna vista interior a altura de ojos por estancia, y falta la Entrada. El resultado es un recorrido por ambientes visto desde arriba, no un paseo interior.
- Riesgo de despliegue: el navegador lee las imágenes desde el almacenamiento; el almacenamiento de producción necesita CORS para el dominio de la app.

**Vía B — vídeo con IA entre imágenes (pendiente):** generar transiciones entre imágenes de ambientes contiguos (primero un modelo Kie que admita fotograma inicial y final), con coste previsto visible y confirmación previa. Requiere antes completar la cobertura de imágenes (vistas interiores por estancia, Entrada) y medir continuidad de distribución/muebles, latencia y coste frente al montaje A. Solo se integra si supera el umbral acordado; si no, se conserva A.

### Requisitos de realismo de las imágenes (Paulo, 30-09-2026)

Las imágenes generadas hasta ahora solo reproducen el 3D; el 3D es **solo la guía** y el resultado debe parecer una **casa bien terminada**, en el estilo elegido del proyecto (minimalista, moderno, japonés, mediterráneo…), claramente distinta de la maqueta.
1. **Más realistas y con decoración:** alfombras, muebles, cortinas y objetos de ambientación que distingan el diseño de la maqueta. Esto choca con el modo «Estricto» actual (que no añade objetos): hace falta Controlado o Libre con las categorías de decoración, con la geometría protegida.
2. **Sin alucinaciones:** nada de puertas con hueco, suelos con manchas, muros o ventanas inventados. Hace falta una puerta de calidad por imagen (auditor de visión contra el contrato estructural + decisión de Jev) con regeneración acotada de las rechazadas, y presupuesto de reintentos.
3. **Filtros por momento del día** (mañana, tarde, noche) en la galería y en el montaje; las imágenes de un mismo vídeo comparten luz.
4. **Asistente por etapas de obra:** elegir las imágenes conforme crece la construcción (terreno, suelos, estructura, acabados, amueblado), apoyándose en las etapas que ya genera la escena 3D.
5. **Mapa real aéreo de la ubicación** (foto de dron o satélite): el inmueble se «construye» sobre la imagen real de la parcela, como en el vídeo de referencia. Pendiente de decidir la fuente por licencia: foto propia de dron (sin problema), ortofoto PNOA del IGN (libre con atribución, solo España) o proveedores de satélite con condiciones de uso que hay que revisar. Hace falta la ubicación, el contorno de la parcela, la orientación y la escala.

**Cambio aplicado (30-09-2026): «Crear imágenes» ya no fuerza el modo Estricto.** Con el proyecto ya amueblado, el diálogo arrancaba bloqueado en Estricto («reproduce el diseño editable tal cual»), de ahí que las imágenes solo copiaran el 3D. Ahora arranca en **Controlado con todas las categorías** (plantas, espejos, lámparas, muebles, otros objetos decorativos como alfombras y cortinas); se puede bajar a Estricto. El aviso de que los objetos que añada la IA no existirán en el 3D editable se mantiene. Archivos: `editor-generate-dialog.tsx`, `render-options-controls.tsx`. Pendiente: el selector de tipo de espacio no tiene «casa completa» (solo habitación, patio, terraza, jardín, entrada y fachada); se usa «Fachada» para las vistas exteriores.

### Referencias de resultado final aportadas por Paulo (30-09-2026)

Cuatro vídeos de Pinterest (todos reels de Instagram, vistos solo por título, descripción y primer fotograma; no se reprodujeron):
1. `pin.it/7jOsljplL` — «Turn Your Rooftop into a Private Oasis» (Easylife, 10 s): azotea REAL de un edificio (foto aérea) sobre la que aparece un solárium acristalado con jardín y salón. Modelo de «construir sobre la imagen real de la parcela».
2. `pin.it/2q9Bpgh7R` — «Built My Dream Modern Village Home in Just 8 Months» (15 s): proceso de construcción con grúa y materiales; casa moderna de dos plantas con patio. Modelo del vídeo de obra.
3. `pin.it/2kv9RZOtW` — «Hermosa casa con 233 m² de construcción» (HOLA ARCHITECT, 22 s): recorrido interior en primera persona por una casa terminada (salón con luz lineal en techo, escalera, vistas). Modelo del paseo interior.
4. `pin.it/6bt3ZxTeI` — «Casa de 6×15 tipo loft con roof garden y sala doble altura» (Arqydiseño, 1:29): presentación completa de vivienda con rótulo de medidas («CASA 6X15 M»), fachada, coche, interiores. Modelo de pieza larga con medidas rotuladas.
Las cinco imágenes de referencia del resultado final no llegaron adjuntas en el mensaje; pendientes de recibirlas.

**Primera imagen con decoración (30-09-2026, Frontal · rev. 144, Controlado, día):** salto claro de realismo (cielo y campo reales, vegetación, pérgolas amuebladas). Pendiente de revisar al detalle por Paulo (alucinaciones). Coste: dos generaciones en KIE (≈0,16 $), porque el primer intento se perdió por el fallo siguiente.

**Fallo corregido: imagen generada y cobrada que se perdía por una descarga lenta.** KIE entrega el resultado en una URL de su CDN; `persistResult` (`kie-image.ts`) la descargaba con 30 s de tope y, si vencía, devolvía la URL temporal; después `readRenderReference` (`render-asset-reader.ts`) volvía a descargarla con otros 30 s y ese `TimeoutError` salía sin envolver («The operation was aborted due to timeout»), sin entregable y con la imagen ya cobrada. Ahora la descarga tiene 120 s por intento y se reintenta una vez, y el lector avisa en claro si aun así no llega. Prueba nueva en `tests/ai/kie-image-provider.test.ts` (ejecutar con vitest: `bun test` no implementa `vi.stubGlobal`).

**Segundo fallo corregido (30-09-2026): los PNG 4K de gpt-image superan los 12 MB.** La cenital rev. 144 pesaba 13,7 MB y `persistResult` (`kie-image.ts`) la rechazaba por tamaño («demasiado grande»), quedando el entregable solo con la URL temporal de KIE (caduca). El tope pasa a ser el mismo que admite el lector de renders propios (24 MB, `MAX_OWN_RENDER_BYTES`); la cenital se recuperó a mano al almacenamiento (`renders/kie/cc49616a…`). También se envuelve el corte de tiempo durante la lectura del cuerpo en `readRenderReference`. La CDN de KIE (`tempfile.aiquickdraw.com`) ha estado lenta esta mañana: dos intentos de dron fallaron por tiempo y la demo directa se quedó colgada en la descarga.

**Conjunto homogéneo en marcha (rev. 144, día, Controlado con toda la decoración, tipo «Fachada»):** frontal ✔, cenital ✔, isométrica ✔ (aspecto fotográfico, con jardín y piscina), dron en curso. Gasto acumulado de la ronda ≈0,72 $ de 2,50 $ (incluye 3 intentos perdidos).

**Decisiones de Paulo (30-09-2026, 12:05):** las 5 imágenes de referencia del resultado final las produce la IA como demo inicial; parcela en [ubicación privada] → ortofoto PNOA del IGN descargada por WMS (180 m de lado, 1440 px; muestra la finca vallada con placas solares y una construcción de tejado rojo); añadir «Casa completa» al tipo de espacio (hecho, también en el vocabulario de zonas como exterior); estilo Moderno para todo el conjunto; commit autorizado (hecho para la tanda anterior).

**Demo «casa sobre la parcela real»:** script directo contra KIE (mismo proveedor y modelo que la app) con dos referencias, ortofoto + cenital rev. 144, reducidas a ≤1600 px; pendiente de resultado. Cuando funcione, la integración en producto pasa por guardar en el proyecto la ubicación, el contorno de la parcela, la orientación y la escala, y añadir la ortofoto como referencia opcional en «Crear imágenes».

**Resultados 30-09-2026 (13:05):** conjunto rev. 144 completo (frontal, cenital, isométrica, dron) en `plans/reports/demo-260930-conjunto-rev144-inmueble.jpg`; ortofoto PNOA en `demo-260930-ortofoto-pnoa-parcela.jpg`; **demo de la casa sobre la parcela real** en `demo-260930-casa-sobre-parcela-real.jpg` (KIE gpt-image-2.5, referencias: ortofoto + cenital rev. 144; 93 s; la casa aparece construida en la parcela vallada con el entorno intacto). Gasto de la ronda ≈0,96 $ de 2,50 $.

**Valoración de Paulo del dron:** no es realista y tiene inventos (planta sobre la vitrocerámica, silla con una planta). Causa: la captura 3D del dron no tiene entorno y el modelo pinta un rectángulo de césped sobre fondo blanco; y de lejos el modelo decora sin criterio. **Método acordado:** decorar bien de cerca primero (cenital y vistas interiores por estancia), y derivar las vistas lejanas (isométrica, dron) a partir de esas imágenes ya validadas, con la ortofoto como entorno real; nunca generar el dron desde cero. Cambios aplicados: regla de «decoración con sentido» en el prompt de Controlado/Libre y en la auditoría de visión (nada sobre placas, fregaderos o inodoros; plantas solo en suelo, mesas, estanterías o jardineras; ningún mueble flotando o tapando huecos). Pendiente: lote secuencial con ancla obligatoria para vistas lejanas y la ortofoto como referencia de entorno.

**Tercer fallo corregido:** si el proveedor no consigue copiar el resultado (CDN lenta), `generateConceptRenderFromEditorImpl` guarda ahora en el almacenamiento los bytes que ya descargó para la auditoría, en vez de dejar el entregable con la URL temporal. Cenital y dron de la rev. 144 se recuperaron a mano.

**Regla de producto (Paulo, 30-09-2026, 13:10): qué puede cambiar la IA en las imágenes.** Los muebles móviles (sofás, mesas, sillas, lámparas, plantas, alfombras, cortinas) se pueden cambiar o sustituir libremente. Los fijos (muebles de cocina, isla, sanitarios, armarios empotrados) se conservan por defecto y solo cambian si el usuario abre esa opción de forma explícita porque quiere un diseño nuevo con más inversión; muros y huecos no cambian nunca por esta vía. El control está en las opciones al crear el diseño, en el prompt del usuario y en la decisión de Jev. Hoy los tres niveles (Estricto, Controlado, Libre) no tocan fijos: falta un cuarto nivel o casilla «Rediseño: permitir cambiar cocina y muebles fijos» que active esas categorías en el prompt, relaje solo esa parte de la auditoría y quede registrado en la imagen para que la puerta de homogeneidad no mezcle imágenes con y sin rediseño. Pendiente de implementar tras las vistas interiores.

**Requisitos nuevos de Paulo (30-09-2026, 13:15) sobre el diálogo «Crear imágenes»:**
1. **«Casa completa» significa solo la vivienda:** el terreno exterior no se toca. Casa + terreno sería otra opción («Inmueble completo» / «Toda la zona»). En «Qué parte del inmueble diseñar» falta el atajo **«Solo la casa»** (hoy hay que elegir «Zonas concretas» y marcar a mano lo que hay en la casa): construirlo con la mecánica de máscaras existente a partir de las estancias interiores y su envolvente, excluyendo las áreas exteriores. Ajustar el texto de la regla de `casa` en `entrega.ts` y en el prompt para que no incluya jardín ni terreno.
2. **Instrucciones guardadas por el usuario:** además de las de «Instrucciones de diseño» por defecto, guardar las propias con nombre y reutilizarlas.
3. **Configuración reutilizable entre inmuebles:** guardar toda la configuración del diálogo (luz, libertad y categorías, ámbito, vistas, tipo de espacio, estilo, objetivo, instrucciones) como plantilla por organización y aplicarla a otro proyecto. Pendiente de implementar tras las vistas interiores y el rediseño de fijos.

**Vistas interiores por estancia (30-09-2026, 13:15):** 5 de 8 generadas (terraza, pasillo, baño, dormitorio, salón-cocina), fotorrealistas y fieles a la distribución; hoja en `plans/reports/demo-260930-interiores-rev144.jpg`. Las 3 restantes fallaron con «terminated» (la CDN de KIE cortó la conexión a mitad de descarga); se añade ese caso a los cortes transitorios con reintento y aviso claro. Gasto de la ronda ≈1,6 $ de 2,50 $.

**Cierre 30-09-2026 (14:40):** las 8 vistas interiores están hechas (segunda hoja en `plans/reports/demo-260930-interiores-rev144-b.jpg`). La auditoría rechazó un intento por añadir una ventana inexistente (filtro anti-inventos funcionando) y la tanda se detuvo en ese punto; al reintentar salieron las dos que faltaban en 70 s. **Dron derivado** (`demo-260930-dron-derivado-parcela-real.jpg`): generado por script con ortofoto + isométrica + cenital rev. 144 como referencias; entorno real coherente y sin inventos, pero la casa no es idéntica (faltan las pérgolas y el volumen sale más compacto): para producto, el dron debe generarse con la isométrica como ancla obligatoria y comprobar la identidad del volumen en la auditoría. Gasto total de la ronda ≈2,1 $ de 2,50 $. Problema de proceso a corregir: una imagen rechazada detiene toda la tanda y obliga a reintentar a mano.

### Puerta de homogeneidad antes del vídeo con IA (30-09-2026)

**Verificación de referencias y emplazamiento (30/09, 18:04):** Paulo distingue presentación de la casa terminada, promoción del proceso de obra sobre la parcela real y recorrido en primera persona. Coordenadas exactas recibidas: [coordenada privada], [coordenada privada]; ortofoto guardada y examinada. Reconstrucción puede retirar visualmente la edificación existente dentro de la intervención y construir el nuevo diseño; reforma representa las partes conservadas/cambiadas. Luz coherente en parcela, casa e interiores (día/tarde/atardecer/noche); transición temporal solo si forma parte del guion. Examinados cuatro pins únicos y seis imágenes de acabado. El montaje existente es válido como presentación; la promoción geográfica aún necesita huella/orientación, escenario de obra, estados del modelo e integración/exportación. Informe y guion de 30 s en [verificación de promoción geográfica](../reports/verificacion-260930-1804-promocion-geografica-report.md). No se han generado nuevas imágenes ni clips de pago.

**Continuación de implementación (30/09, 17:30):** se han aplicado los seis puntos descritos arriba: identidad de estancia/zona y recuperación de cámaras históricas; continuación tras rechazo; anclas obligatorias cenital→isométrica→dron y auditoría de identidad completa (incluidas pérgolas); permiso de rediseño de fijos registrado y diferenciado por Jev; Solo la casa de la planta activa; plantillas por organización y carga independiente de instrucciones. En el diseño editable, el permiso solo modifica acabados de fijos existentes. Detalles y pruebas en [el informe](../reports/implementacion-260930-1730-continuacion-diseno.md). No se han ejecutado nuevas generaciones de pago: queda contrastar las vistas lejanas reales y producir las imágenes identificadas de Entrada/Patio. La película completa continúa pendiente.

Decisión de Paulo: el vídeo se hace con los diseños generados y, **antes de lanzarlo, el conjunto de imágenes tiene que ser homogéneo**; la confianza y la decisión las da **Jev**.
- **Comprobación automática** (`assessTourHomogeneity`, `src/lib/editor-document/image-tour.ts`): todas las imágenes deben proceder del diseño aprobado (su revisión o una con el mismo aspecto: se ignoran rutas, comentarios y nombres de zona, pero no el contorno ni el acabado de suelo de cada zona), con una sola luz, un solo nivel de fidelidad y sin ámbitos vacíos. Señala como discordantes las minoritarias.
- **Decisión de Jev** (punto de control `video_keyframes`, `src/server/quality/checkpoints-video.ts`): recibe la evidencia medida, nunca las imágenes, y responde `proceed` (animar), `confirm` (revisar) o `block` (regenerar), con puntuación y confianza. Acción `assessKeyframeSet` y botón «Comprobar homogeneidad con Jev» en la pestaña Vídeos. Informativa: el botón de vídeo con IA de la vía B la exigirá.
- **Resultado con las imágenes actuales de FInca:** Jev decide **regenerar** (puntuación 11 sobre 100, confianza del 99 %). 19 de las imágenes elegidas no son del diseño aprobado (revisiones 0, 70 a 137), se mezclan luz de día y de tarde, y tres niveles de fidelidad; falta la Entrada. **Conclusión: no se puede hacer la prueba de clips con las imágenes existentes.** Hace falta un conjunto nuevo generado desde la revisión aprobada, con luz de día y fidelidad estricta.
- **Conjunto mínimo a regenerar** (estimación de coste, por confirmar): inmueble completo (aérea, frontal, cenital, isométrica) + una isométrica por zona (Entrada, Patio, Salón, Cocina) = 8 imágenes, unos 0,64 $; con cenital por zona y vistas interiores por estancia, unas 20 imágenes, unos 1,6 $. Usar la referencia de estilo entre vistas del lote para mantener la coherencia.

### Referencia para la vía B: flujo de un tutorial de vídeo inmobiliario con IA (30-09-2026)

Paulo aportó el vídeo «Así vendo proyectos inmobiliarios con IA: mi sistema completo» (Aleksander Des, youtube.com/watch?v=X_dNq6G60bw). Solo se leyó la transcripción automática, no las imágenes. Ideas útiles para B, no requisitos:

- **Imágenes primero, clips después.** Cada clip se genera entre un fotograma inicial y otro final ya validados; los clips se unen en un editor. Coincide con el planteamiento de clips entre keyframes de esta fase.
- **Clips cortos para movimientos simples.** Usa 4 s para elevar la cámara, paneo, zoom y aparición de texto o medidas, y 8 s para la transformación terreno → casa construida con la cámara descendiendo. Dice que 4 s le dan menos saltos forzados en las transiciones; un clip de 4 s le costó 7 créditos en su plataforma. Es un dato de su herramienta, no de Kie.
- **Secuencia de clips tipo:** calle → vista picada; aparición del perímetro y las medidas; terreno vacío → edificio construido; paneo a la fachada; zoom a una ventana. El clip de construcción equivale al arranque «terreno vacío → obra» del vídeo resumen.
- **Prompts derivados del contexto del proyecto**, no copiados: un chat con las medidas, la ubicación y el estilo escribe el prompt de cada clip, y las correcciones se hacen enseñándole una captura del fallo. Equivale al prompt de cámara derivado de la ruta previsto más arriba.
- **Fidelidad:** conservar elementos reales (cables, postes, vecinos) y descartar imágenes que inventan o deforman. Es la misma puerta de publicación de esta fase.
- **Diferencia con Habiteka:** el tutorial es un exterior con 7 u 8 clips. Habiteka necesita además vistas interiores por estancia y que la distribución no cambie entre fotogramas, que es lo que debe medir la prueba de B antes de construir cola y adaptador.

## Avance en exportación de recorridos largos (27-09-2026)

- El límite del MP4 nativo es ahora 110 s, compartido por grabador y servidor; el montaje suma 8 s al recorrido. La vista 3D muestra la duración y los tramos bloqueados antes de iniciar la exportación. La revisión guardada 94 de «FInca» contiene «Recorrido Paulo» (44 puntos, unos 93 s, sin tramos bloqueados), que pasa la validación para paseo y montaje (unos 101 s).
- Una muestra aislada de 26 s completó la exportación en Chrome y mostró «MP4 descargado»; la muestra se restableció después de la prueba.
- «FInca» tiene aprobada la revisión 94, que incluye «Recorrido Paulo». Se exportó el recorrido real en Chrome: MP4 de 93,4 s, 1920 × 1080 y 72.468.926 bytes; se descargó y quedó guardado como entregable `video-93e44309-3391-4353-a559-32f577b7e7f8` en Diseños. Se comprobó su cabecera MP4 y que el navegador podía cargarlo sin error.
- La exportación se encuentra ahora al abrir la visita aprobada. El panel de recorrido del borrador enlaza con la visita conservando la ruta elegida, y los dos botones de vídeo aparecen destacados sobre la escena 3D. Pendiente: medir de forma repetible tiempo de codificación y pico de memoria del MP4 largo; el servidor mantiene 100 MB por archivo.

## Avance en muestra aislada (25–26-09-2026)

- La exportación MP4 desde el proyecto se habilita en la visita aprobada. El ticket de subida y el entregable registran ID, revisión y huella de esa aprobación; el panel de entregables enlaza de vuelta a la visita exacta. Las pruebas aisladas comprueban que una ruta del borrador no se puede atribuir a otra aprobación. Siguen pendientes 9:16, editor de tomas y validación de un vídeo de inmueble importado.

- La ruta automática busca otro punto libre de la estancia cuando el más céntrico queda aislado por muebles. El barrido de colisión se afinó para que la ruta aprobada coincida con los fotogramas del vídeo.
- El exportador nativo añade una opción de montaje de 8 s: suelo, estructura, huecos/techo, mobiliario, giro exterior y recorrido por estancias. Usa las entidades de la misma escena R3F y un guion temporal determinista; también conserva la exportación de solo recorrido.
- La exportación MP4 se completó en Chrome con la vivienda sintética y mostró «MP4 descargado». Una segunda prueba detectó que R3F podía redimensionar el lienzo durante la codificación; se corrigió con un lienzo de vídeo fijo a 1920×1080 y la repetición terminó correctamente.
- El recorrido entre plantas y el montaje «obra + visita» usan ahora la escena completa durante la grabación y posiciones de cámara absolutas al cruzar el forjado. Ambas exportaciones terminaron con «MP4 descargado» en Chrome sobre la muestra aislada de dos plantas, sin datos de proyecto. Las imágenes editoriales por punto siguen preparándose por planta.
- Pendiente para aceptar la fase: editor de tomas, vista previa completa de montaje, 9:16, audio opcional y comparación de fidelidad/coste antes de integrar vídeo IA. El vínculo a la versión aprobada ya está implementado.

## Objetivo

Obtener una pieza publicitaria donde el inmueble aparece por etapas, se muestra desde varios ángulos y la cámara entra para recorrerlo.

La pieza pedida el 27/09 es **automática y cinematográfica**: empieza con una construcción visual editorial, revela la vivienda terminada con cámaras aéreas exteriores tipo dron y entra suavemente para un paseo dirigido por sus estancias. Debe usar el mismo diseño 3D realista aprobado en el que se hace la visita libre de la fase 4. El paseo MP4 de «FInca» y el montaje actual de 8 s prueban grabación y vínculo a revisión; no se consideran la película terminada.

## Secuencia propuesta

1. Apertura: terreno vacío de la escena aprobada, sin edificio ni mobiliario, y después la huella del inmueble desde una cámara exterior.
2. Montaje visual: suelos y estructura, muros/huecos, escaleras y techos, acabados, muebles e iluminación. Es una animación editorial de la escena aprobada, no una simulación técnica de construcción.
3. Revelación: vuelo exterior tipo dron alrededor de la casa ya terminada, con vistas de fachada, volumen, jardín, terraza o piscina solo si figuran en la escena aprobada.
4. Vuelo interior rápido: transición continua por una entrada real y trayectoria cinematográfica que muestre todas las zonas del inmueble, terminando en una vista final. El espectador reproduce el montaje; en la visita libre decide su propio camino.

## Trabajo

1. Crear un guion reproducible que referencia la versión aprobada, capas por tipo de entidad, orden, tiempos, cámaras y escenas. Aprovechar `EditorScene` (`boxes`, `polygons`, `ramps`, `sourceEntityId`, roles) para revelar elementos sin crear otro modelo.
2. Añadir un editor sencillo de escenas: reordenar/activar tomas, elegir vistas de referencia, duración, cámara objetivo, velocidad y formato 16:9/9:16. Vista previa completa antes de generar.
3. Reusar la validación espacial de `WalkthroughPath` y `buildWalkthrough` donde sirva para comprobar accesos, pero definir una trayectoria de cámara propia para el vídeo resumen: vuelo exterior, entrada y recorrido interior breve por todas las zonas. Extender el grabador determinista por fotograma para cambios de visibilidad, cámaras, transiciones y segmentos; adaptar la resolución al formato. Evitar vuelos que crucen muros o muebles.
4. Exportar y guardar MP4 nativo desde la versión aprobada. El grabador limita ahora a 110 s, 1080p y H.264/WebCodecs; medir tiempo, tamaño y memoria de recorridos largos en navegador antes de ampliar más o incorporar montaje por segmentos. Mantener aviso de compatibilidad de navegador.
5. Incorporar una acción `video` en el enrutamiento de modelos y un adaptador de vídeo Kie distinto del de imágenes; ejecutar como trabajo asíncrono, con estado, fallos, reintentos acotados y coste previsto/real visible. Descargar el resultado al almacenamiento propio al completarse, sin depender de la URL temporal de Kie. Mantener contrato de proveedor intercambiable.
6. Ensayar tres clips cortos desde fotogramas del mismo modelo: construcción exterior, entrada/paseo interior y plano con un objeto de catálogo identificable. Comparar el MP4 nativo con candidatos de vídeo disponibles en Kie (primero uno que admita referencias inicial/final); medir continuidad, cambios en muebles/puertas, identidad del producto, latencia y coste. Solo integrar vídeo IA cuando supere el umbral acordado; de lo contrario conservar el vídeo nativo fiel.
7. Permitir que un modelo de texto (Astra o Claude Opus 5.5, si se configura) proponga guion/tomas/prompts sujetos a validación, sin tratarlo como generador de MP4 ni hacer que cambie el `EditorDocument` aprobado. Registrar modelo, parámetros, fotogramas y veredicto de calidad por clip.
8. Permitir pista musical, voz y efectos opcionales en el montaje, con volumen y silencio por escena. Guardar atribuciones y licencias de medios. El guion visual debe funcionar también sin audio.
9. Exponer al mismo chat la capacidad «director de vídeo»: proponer escenas, cámaras y ritmo como un guion editable vinculado a la revisión aprobada. La instrucción no lanza tareas Kie ni consume créditos de vídeo hasta que el usuario ve coste estimado y confirma. Verificar por reglas trayectorias y elementos; Jev puede clasificar el objetivo publicitario y puntuar una auditoría textual, no certificar el MP4.
10. Incorporar las referencias del usuario como secuencia editorial: fachada exterior, maqueta cenital amueblada, giro/isométrica con cubierta oculta y entrada a cámara interior. Probar además una toma a altura de persona por estancia principal; las maquetas de ejemplo no equivalen a una visita grabada.

## Código afectado

- `src/canvas/editor-v2/scene/types.ts`, `src/components/editor-v2/scene/editor-scene-view.tsx`, `scene/offline-recorder.ts`.
- `src/lib/editor-document/walkthrough.ts`, `walkthrough-geometry.ts`; componentes de edición de vídeo bajo `src/components/editor-v2/`.
- Reusar entregable `VIDEO` y subida existente. La vía IA se apoya en [F4 del plan previo](../260916-0135-plano-importado-y-recorridos-visuales/phase-04-video-ia-entre-keyframes.md), aún pendiente.
- `prisma/schema/base.prisma` (`ModelAction`), `src/server/ai/model-routing.ts`, nuevo adaptador de vídeo y trabajo persistente de exportación; no extender `kie-image.ts` con responsabilidad de vídeo.

## Criterios de aceptación

- Un MP4 resumen comienza con el terreno vacío de la escena aprobada, revela la construcción y los acabados por etapas, muestra el inmueble terminado mediante un vuelo exterior tipo dron y entra por un acceso real para un vuelo interior breve por todas las zonas, sin alterar la distribución aprobada ni reutilizar sin más la visita o el recorrido peatonal.
- El storyboard permite revisar por separado construcción visual, vuelo exterior, casa terminada y entrada/paseo interior. Las transiciones son comprensibles, las tomas no atraviesan sólidos y el exterior e interior mantienen el acabado aprobado.
- Exterior, cenital, maqueta e interior pertenecen al mismo inmueble y versión; una comparación por fotogramas verifica posiciones de muros, huecos, muebles y productos destacados.
- El mismo guion produce versión horizontal y vertical con encuadres revisables.
- Cada fotograma procede de la misma versión 3D; una edición posterior obliga a crear una nueva versión de vídeo.
- El vídeo IA no se presenta como fiel si introduce cambios físicos, aunque sea visualmente atractivo.
- La evaluación de Kie queda registrada con versión de escena, proveedor/modelo, coste, duración y discrepancias; ningún clip dependiente de URL temporal es el único original almacenado.
- El filtro de publicación rechaza cualquier clip que cambie la distribución, suprima una puerta o sustituya un SKU destacado; calidad estética y ahorro de tiempo/coste se puntúan aparte. El presupuesto máximo por vídeo se define antes del piloto con datos reales de créditos.
- Una toma que destaque un SKU solo se publica como producto exacto si conserva el activo 3D validado y su identidad visible; de otro modo se etiqueta como propuesta visual.
- El chat puede preparar un guion pero no alterar la geometría aprobada ni iniciar una generación de vídeo de pago sin confirmación; el coste y la versión quedan registrados.

## Riesgos

El vídeo de construcción no debe inventar fases de obra o piezas que no existen en el documento. Señal: un elemento aparece en vídeo sin `sourceEntityId` aprobado. Respuesta: excluirlo o incorporarlo al modelo tras revisión.

## Continuación 30/09/2026 — parcela y promoción

Implementados el panel de encaje sobre ortofoto versionada, la luz «Tarde» y la promoción geográfica nativa de 30 s sin depender de una ruta interior. La sustitución se limita al contorno confirmado; reforma pendiente de elementos conservados. Las referencias lejanas usan la ortofoto confirmada. Detalle: [informe de implementación](../reports/implementacion-260930-parcela-promocion.md).

Pendiente para la parcela aportada: marcar contorno, orientar el plano y confirmar acceso/escenario/luz. No se ha generado un MP4 geográfico del caso real. La promoción fotorrealista y su continuidad siguen pendientes; el modo implementado es una visualización conceptual 3D.

## Estado consolidado 30/09/2026 — vídeos y tejado exterior

La fase continúa en curso. El guion nativo actual tiene una introducción de **16 s** antes de la ruta; las referencias históricas a 8 s describen versiones anteriores. La promoción sobre ortofoto dura 30 s y aún necesita una exportación revisada del caso real.

Requisito añadido por Paulo: **tejado exterior independiente** del techo interior y falso techo de luminarias. Actualmente solo hay cara superior/canto/espesor de cubierta plana ligados a los techos. Pendientes tipos plana/una agua/dos aguas/cuatro aguas, pendiente, orientación, aleros, material, geometría 3D y conservación en aprobación, renders y vídeo. No cerrar las vistas del edificio completo sin esta cubierta.

Orden: tejado → MP4 geográfico conceptual real → fotogramas coherentes y guion → piloto IA con presupuesto → montaje profesional y formatos. Los modos nativos y el montaje de imágenes no acreditan que la película fotorrealista esté terminada.

Detalle y estado verificado: [reporte consolidado](../reports/estado-260930-2206-videos-tejado-documentacion-report.md). Manual: [guía de uso](../../docs/guia-de-uso.md); guía rápida incorporada a Ayuda.

## Corrección de identidad y cubierta — 01/10/2026

El usuario rechaza los MP4 como resultado final: no representan el acabado de su casa. No cerrar la fase por las mejoras de exportación nativa. La cubierta exterior está implementada y los muros ahora cierran hasta su intradós inclinado con el mismo acabado. Verificada la casa real desde frontal y lateral; no se ha aprobado automáticamente el borrador.

Se bloquean montajes con fuentes obsoletas o configuración visual discordante, también en el servidor; una aprobación anterior no permite presentar el borrador actualizado. Las exportaciones del editor se identifican como muestras 3D. En el caso revisado aún faltan imágenes del diseño actualizado y el escenario de reforma no define elementos conservados.

Pendientes: estados fotorrealistas de obra, tareas persistentes del proveedor de vídeo, tarifa y presupuesto, clips piloto de obra/visita y auditoría de fotogramas intermedios. La admisión de anclas inicial/final de Kling 2.5 en KIE se ha contrastado, sin llamadas de pago. Evidencia y pasos: [reporte de corrección](../../docs/reports/video-261001-cubierta-animacion-sonido-report.md).

## Estudio, galería y secuencia — 01/10/2026

Implementado un estudio único desde pestaña Vídeos y Crear vídeo, con construcción independiente sin ruta, publicidad con renders o modelo sobre parcela, primera persona y construcción + visita. Integra tejado, parcela, ruta, revisión, luz, efectos, cotas, creación, reproducción y resultados. No se cambian ni aprueban automáticamente diseños reales durante las verificaciones.

La construcción sola utiliza 30 s, cámara fija mientras crecen muros consecutivos, FX por muro y vuelo final. Solo la casa limita geometría, encuadre y cotas a interiores/tejado, manteniendo la ortofoto confirmada; elimina parcela modelada exterior. El tapado se recorta al ámbito y las caras de los muros se conservan completas. Las fuentes del vídeo nativo siguen siendo el editor, no los renders de interiorismo.

Cada tanda de renders forma una galería con estancia/zona y vista. Sus acciones se muestran al abrir la imagen. El recorte de referencia mantiene tabiques interiores. Se exige rediseño reconocible cuando se pide y se utiliza una vista aceptada como ancla de las siguientes; el montaje rechaza mezclar mobiliario conservado/rediseñado. Fondo v2 con referencia estable al render y control de ámbito/conflictos.

126 pruebas focalizadas, tipos y documentación construida verifican estos cambios. Hay exportaciones nativas reales de prueba, sin consumo de IA. Higgsfield/Kling 3.0 contrastado con anclas inicial/final y audio, sin integración ni llamadas de pago. La fase **continúa abierta**: preparar estados fotorrealistas, conectar proveedor/tareas/presupuesto y verificar identidad temporal y mobiliario de los diseños. Detalle técnico: [estudio y galería](../../docs/estudio-videos-galeria.md).

## Cotas y guion para MiniMax H3 — 01/10/2026, 13:49

Implementados modos de cotas animadas, solo al inicio, fijas y desactivadas. Líneas/etiquetas ancladas en 3D con profundidad y opción de ocultación detrás del edificio; se sustituyen los overlays 2D superpuestos. Guion portable editable/copiable con ámbito, luz, identidad, secuencia y sonido. Ajustes e indicaciones se conservan con el MP4; el texto libre no modifica la animación nativa.

API oficial de MiniMax H3 contrastada: referencias multimodales, primer/último fotograma, audio y variante H3 Max rápida con menor resolución. No hay generación conectada ni pruebas de latencia/fidelidad de H3; referencia de movimiento e imagen a vídeo son modos distintos. Las cotas sobre clips IA necesitan composición y validación de cámara. 37 pruebas enfocadas, tipos/lint/docs y MP4 real con cotas animadas verificados. Detalle: [reporte](../reports/video-261001-1349-cotas-guion-minimax-report.md). Mantener abierta la película profesional.

## Construcción breve desde diseños — 01/10/2026, 17:55

La construcción nativa dura ahora 8 s, con opción 12 s para dedicar más tiempo al mobiliario. Los muros crecen consecutivamente durante 3 s en ambas opciones. Cámara fija durante obra, tejado y muebles; vuelo final independiente. Ticket, límites, exportador y FX comparten tiempos. Verificado MP4 real 1080p H.264/AAC de 8.064 s, incluida la cola del audio. Esta vía continúa usando el modelo del editor.

Corregida la fuente del piloto solicitado: Construcción → Mis diseños prepara MiniMax H3 mediante KIE con imágenes generadas de una misma tanda compatible con la aprobación. Congela las selecciones de los renders, incluyendo zonas exteriores, y exige muebles según las imágenes, sin enviar el inventario del plano. Preparación sin transferencia ni gasto; confirmación explícita de referencias y presupuesto antes de reservar y enviar. Tarea persistente, envío único, consulta sin regenerar, descarga a almacenamiento propio y revisión humana. Los errores ambiguos nunca reenvían automáticamente.

Caso real FInca: preparada prueba `a417fe82-9687-4403-b548-39ed37594672`, seis vistas de revisión 156, doce zonas, 8 s/768P, previsión $0.34/34 créditos Habiteka. Sin identificador de tarea KIE: no ha habido generación ni transferencia al proveedor. Presupuesto pendiente de autorización. 41 pruebas nativas y 17 del piloto, tipos/lint/docs verificados. La fase sigue abierta: auditoría temporal de identidad y mobiliario, referencia exterior terminada con tejado, cotas compuestas sobre IA, primera persona continua desde diseños, worker y conciliación del coste real. [Reporte de esta intervención](../reports/video-261001-1712-construccion-desde-disenos-report.md).

## Veredicto del primer piloto H3 — 01/10/2026, 18:10

El usuario autorizó el único clip de $0.34 y las seis referencias. También autorizó habilitar temporalmente el cap global en $0.34 porque estaba en 0; restaurado a 0 y auditado inmediatamente tras aceptar KIE la tarea `9db0219df7bd9cfe3fff16721dd16a9d`. Resultado archivado: 8 s, 1344×768/24 fps, audio AAC estéreo, 286 s de generación según KIE.

**Rechazado**, no cumple muros uno a uno ni continuidad de la envolvente. Sí aparecen partes de terraza, pérgola, escaleras y mobiliario de las referencias; no se certifica identidad total ni todas las cantidades. Mezclar vistas seccionadas no fija un exterior cerrado durante el giro. Las referencias tenían fondo neutro, por lo que tampoco fijan encaje geográfico. Sin segunda generación. Antes de otro gasto, preparar estados de obra coherentes, exterior cerrado y referencia del conjunto sobre ortofoto. El guion solo no ha alcanzado el umbral. [Evaluación y fotogramas](../reports/video-261001-1756-piloto-h3-finca-report.md).

## Limpieza, nombres y pruebas del paseo — 02/10/2026

Publicidad vertical y cotas confirmadas en commit `2b159ac`. Añadida limpieza individual y por selección, con papelera durable y restauración, también para referencias rechazadas. Los vídeos se pueden nombrar antes de crear y renombrar después; los originales de publicidad utilizan esos nombres. No hay migraciones ni generaciones de pago.

Probados en Comet los flujos reales del recorrido aprobado completo y la pieza de construcción + visita: MP4 1920×1080 H.264 de 22,77 s y 30,83 s, respectivamente, con audio AAC de efectos en la pieza combinada. Guardados en MinIO local y comparados con las descargas mediante SHA-256. Estos resultados son muestras del modelo editable, no inmersión fotorrealista desde renders. Esta última y la fidelidad profesional de H3 siguen pendientes. No se aprobaron ni modificaron diseños durante estas pruebas.

## Preparación de primera persona desde diseños — 02/10/2026

Añadida opción `Primera persona → Mis diseños`, con piloto H3 de una estancia de 8/12 s, presupuesto, nombre, guion y revisión. Reutiliza el envío único y recuperación existentes; `walkthrough-ai` se conserva en el JSON sin migraciones. Comprueba cámara interior real, planta, techo/muros completos, misma estancia/tanda, revisión visual vigente y rechazo antes de preparar y enviar. Publicidad bloquea resultados H3 no aceptados de ambas modalidades.

El estudio muestra interiores por defecto y enlaza directamente a su preparación en el editor, sin generar automáticamente. Las referencias actuales verificadas en navegador son aéreas/exteriores: faltan interiores para una prueba real. No hay transferencia ni consumo IA en esta implementación. Continúan pendientes continuidad entre habitaciones, revisión del piloto interior pagado y montaje combinado con construcción; la muestra nativa conserva sus límites.
