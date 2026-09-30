---
title: "Fase 5: Vídeo de construcción visual y recorrido"
status: in-progress
---

# Fase 5: Vídeo de construcción visual y recorrido

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

**Decisiones de Paulo (30-09-2026, 12:05):** las 5 imágenes de referencia del resultado final las produce la IA como demo inicial; parcela en 40.709521, -3.530312 (Madrid) → ortofoto PNOA del IGN descargada por WMS (180 m de lado, 1440 px; muestra la finca vallada con placas solares y una construcción de tejado rojo); añadir «Casa completa» al tipo de espacio (hecho, también en el vocabulario de zonas como exterior); estilo Moderno para todo el conjunto; commit autorizado (hecho para la tanda anterior).

**Demo «casa sobre la parcela real»:** script directo contra KIE (mismo proveedor y modelo que la app) con dos referencias, ortofoto + cenital rev. 144, reducidas a ≤1600 px; pendiente de resultado. Cuando funcione, la integración en producto pasa por guardar en el proyecto la ubicación, el contorno de la parcela, la orientación y la escala, y añadir la ortofoto como referencia opcional en «Crear imágenes».

**Resultados 30-09-2026 (13:05):** conjunto rev. 144 completo (frontal, cenital, isométrica, dron) en `plans/reports/demo-260930-conjunto-rev144-inmueble.jpg`; ortofoto PNOA en `demo-260930-ortofoto-pnoa-parcela.jpg`; **demo de la casa sobre la parcela real** en `demo-260930-casa-sobre-parcela-real.jpg` (KIE gpt-image-2.5, referencias: ortofoto + cenital rev. 144; 93 s; la casa aparece construida en la parcela vallada con el entorno intacto). Gasto de la ronda ≈0,96 $ de 2,50 $.

**Valoración de Paulo del dron:** no es realista y tiene inventos (planta sobre la vitrocerámica, silla con una planta). Causa: la captura 3D del dron no tiene entorno y el modelo pinta un rectángulo de césped sobre fondo blanco; y de lejos el modelo decora sin criterio. **Método acordado:** decorar bien de cerca primero (cenital y vistas interiores por estancia), y derivar las vistas lejanas (isométrica, dron) a partir de esas imágenes ya validadas, con la ortofoto como entorno real; nunca generar el dron desde cero. Cambios aplicados: regla de «decoración con sentido» en el prompt de Controlado/Libre y en la auditoría de visión (nada sobre placas, fregaderos o inodoros; plantas solo en suelo, mesas, estanterías o jardineras; ningún mueble flotando o tapando huecos). Pendiente: lote secuencial con ancla obligatoria para vistas lejanas y la ortofoto como referencia de entorno.

**Tercer fallo corregido:** si el proveedor no consigue copiar el resultado (CDN lenta), `generateConceptRenderFromEditorImpl` guarda ahora en el almacenamiento los bytes que ya descargó para la auditoría, en vez de dejar el entregable con la URL temporal. Cenital y dron de la rev. 144 se recuperaron a mano.

**Regla de producto (Paulo, 30-09-2026, 13:10): qué puede cambiar la IA en las imágenes.** Los muebles móviles (sofás, mesas, sillas, lámparas, plantas, alfombras, cortinas) se pueden cambiar o sustituir libremente. Los fijos (muebles de cocina, isla, sanitarios, armarios empotrados) se conservan por defecto y solo cambian si el usuario abre esa opción de forma explícita porque quiere un diseño nuevo con más inversión; muros y huecos no cambian nunca por esta vía. El control está en las opciones al crear el diseño, en el prompt del usuario y en la decisión de Jev. Hoy los tres niveles (Estricto, Controlado, Libre) no tocan fijos: falta un cuarto nivel o casilla «Rediseño: permitir cambiar cocina y muebles fijos» que active esas categorías en el prompt, relaje solo esa parte de la auditoría y quede registrado en la imagen para que la puerta de homogeneidad no mezcle imágenes con y sin rediseño. Pendiente de implementar tras las vistas interiores.

**Requisitos nuevos de Paulo (30-09-2026, 13:15) sobre el diálogo «Crear imágenes»:**
1. **«Casa completa» significa solo la vivienda:** el terreno exterior no se toca. Casa + terreno sería otra opción («Inmueble completo» / «Toda la zona»). En «Qué parte del inmueble diseñar» falta el atajo **«Solo la casa»** (hoy hay que elegir «Zonas concretas» y marcar a mano lo que hay en la casa): construirlo con la mecánica de máscaras existente a partir de las estancias interiores y su envolvente, excluyendo las áreas exteriores. Ajustar el texto de la regla de `casa` en `entrega.ts` y en el prompt para que no incluya jardín ni terreno.
2. **Instrucciones guardadas por el usuario:** además de las de «Instrucciones de diseño» por defecto, guardar las propias con nombre y reutilizarlas.
3. **Configuración reutilizable entre inmuebles:** guardar toda la configuración del diálogo (luz, libertad y categorías, ámbito, vistas, tipo de espacio, estilo, objetivo, instrucciones) como plantilla por organización y aplicarla a otro proyecto. Pendiente de implementar tras las vistas interiores y el rediseño de fijos.

### Puerta de homogeneidad antes del vídeo con IA (30-09-2026)

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
