# Handoff: Habiteka, diseño por zonas y esquina de Cocina

Fecha: 29/09/2026. Rama: `feat/diseno-aprobado-visita-video`.

## Objetivo confirmado por Paulo

Diseñar por partes (Entrada, Patio, Salón, Cocina), combinar propuestas editables homogéneas en una sola escena 3D y aprobar esa revisión completa. La visita libre y el vídeo automático deben partir del diseño final aprobado. El vídeo debe mostrar terreno vacío, construcción, vuelo exterior tipo dron y paseo interior rápido. Las imágenes IA aisladas sirven para evaluar el aspecto; no constituyen una escena navegable.

## Estado comprobado

- Proyecto «FInca»: `cmu7nm84n0001evmsi8nyt1ee`. Revisión guardada **130**, con contenido de diseño igual a la 129; última aprobación **107**. No se aprobó la 130.
- Las cuatro zonas están guardadas. El plan principal y la fase 3 reflejan tareas pendientes: [plan](../260924-1459-flujo-integral-plano-diseno-inmersion-video/plan.md) y [fase 3](../260924-1459-flujo-integral-plano-diseno-inmersion-video/phase-03-diseno-aprobado.md).
- El hueco de Cocina tenía dos causas geométricas: el pilar trasero vaciaba toda la carcasa/zócalo bajo la encimera y los zócalos retranqueados de los dos tramos en L dejaban suelo visible en la unión. Se corrigieron en `kitchen-run-obstacles.ts` y `kitchen-run-volumes.ts`. El segundo cierre ocupa todo el fondo del tramo perpendicular; una prueba con medidas reales de FInca sitúa las piezas a menos de 5 mm.
- Se generaron nuevas imágenes de Cocina aislada, isométrica, día y libertad estricta. La más reciente es la primera tarjeta de [Diseños de FInca](http://localhost:3040/projects/cmu7nm84n0001evmsi8nyt1ee/deliverables), «Cocina · Isométrica · Plano rev. 130». La encimera y los frentes ya aparecen unidos. Queda una sombra estrecha bajo el apoyo negro; la vista 3D frontal gratuita muestra ese apoyo sin hueco geométrico. Las imágenes anteriores no se actualizan.
- Se pasaron 13 pruebas de cocina, TypeScript y ESLint. Últimos commits: `ad3dcf6` (tonos y esquina), `a638b1c` (módulos junto al pilar), `f2eec53` (ámbito exterior y Entrada), `71c1d7f` (zócalo de la L y planes).
- Hay archivos sin seguimiento previos (`.skill-map/`, otro `plans/handoffs/`, dos informes, `pnpm-lock.yaml`, `pnpm-workspace.yaml`). No mezclarlos con el trabajo nuevo.

## Comprobación de la sombra de Cocina (29/09, noche)

Se contrastó la imagen «Cocina · Isométrica · Plano rev. 130» con el 3D editable de FInca (Salón / Cocina, primera persona, cámara a altura de ojos inclinada hacia el suelo, luz de día). En la imagen, la banda oscura entre el último frente mostaza y el apoyo negro parece un hueco. En el 3D editable, la encimera es continua en la esquina, los frentes mostaza y negros se tocan sin separación y el zócalo oscuro rodea la esquina sin dejar suelo visible. Lo que se ve oscuro es la cara del tramo con frentes negros en sombra. Conclusión: es sombreado y una interpretación del modelo de imagen, no un hueco geométrico. Único detalle menor: un pequeño escalón de zócalo en la unión de los dos tramos, de pocos centímetros, que no justifica otra corrección ni generar otra imagen de pago. No se modificó el proyecto ni se guardó nada.

## Rincón del bloque negro de Cocina (30/09, madrugada) — diagnóstico

Paulo confirma que el defecto es el extremo del tramo negro (derecho) en la esquina de la L, visible en las imágenes rev. 130: el bloque acaba en un corte con suelo visible y sin nada que explique el hueco.

Datos de FInca rev. 130 (medidos, sin modificar el proyecto):
- Dos tramos: A `463d65…` (muro derecho, rot 90,04°, 3594 × 600) y B `af50ee…` (muro inferior, 4800 × 626). A conserva la esquina; B cede 600 mm.
- Columna `707ce0…` 400 × 400 × 3700 en (13340, 12274,5). Invade 96 mm en x y 125 mm en y los dos tramos. El código ya recorta zócalo, bajos y encimera de A alrededor de ella (`kitchen-run-obstacles.ts`) y el 2D dibuja ese recorte.
- Ningún muro invade los tramos. El muro derecho (`w11`) está inclinado 0,18° y A solo 0,04°: rendija de 9 mm en un extremo, hasta 23 mm en la esquina. Los tramos de cocina se excluyen de `alignBackToWall` (`spatial-placement.ts`, `!isKitchenRun(result)`), así que al pegarlos se trasladan pero no giran. B está pegado a su muro (exacto).
- Zona «Cocina»: rectángulo x 6072–13300, y 7996–12267. Queda 136 mm antes de la cara interior del muro derecho y 132 mm antes de la del inferior, así que la columna está entera fuera del contorno.
- `zoneCaptureRegions` ya añade la huella de esa columna (comprobado con el documento real: 2 regiones, la segunda 13340,12274 → 13740,12674).

Causa encontrada y corregida (sin commitear): `editor-shell.tsx`, en `onPrepare` (la captura que sí se envía al generador), construía `maskRegions` con los polígonos de zona tal cual, sin pasar por `zoneCaptureRegions`. Solo la vista previa (`previewRender`) aplicaba la regla del pilar. Por eso las imágenes rev. 130 salieron sin la columna en la esquina y el generador interpretó la muesca como hueco. Ahora ambos caminos usan `zoneCaptureRegions`. Comprobado en Chrome: la referencia gratuita de Cocina · Isométrica muestra la columna blanca pegada al bloque negro. (Ojo: al abrir la vista previa aparece primero la captura inicial sin columna y se sustituye unos segundos después.) No se ha generado ninguna imagen nueva para confirmarlo de extremo a extremo.

Rendija contra el muro inclinado (corregida en el editor, no aplicada a FInca): nuevo `alignKitchenRunToWall` en `wall-back-alignment.ts`, conectado en `snapObject` (`spatial-placement.ts`). Un tramo de cocina se endereza hasta 3° para apoyar toda la trasera en la cara del muro; si exigiera más giro se queda como está. Tests nuevos en `tests/editor-v2/kitchen-run-wall-align.test.ts` (3 pasan). Solo actúa al mover o pegar un tramo; el tramo A de FInca (rendija de 23 mm) sigue como estaba hasta que se reposicione.

Verificación: eslint y tsc limpios; `bun test tests/canvas tests/editor-v2 tests/editor-document`: 1231 pasan y 22 líneas de fallo idénticas con y sin estos cambios (ya existían).

Intentos del 30/09 (madrugada) con el ok de Paulo:
- Imagen de Cocina · Isométrica tras la corrección de la columna: el primer intento la auditoría lo DESCARTÓ («no respeta la vista 3D… se añaden construcciones fuera de los límites») y el segundo intento (sin cambios de código entre ambos) pasó. Aparece como «Cocina · Isométrica · Plano rev. 132», primera tarjeta de Diseños (45). Resultado: la columna blanca aparece pegada al bloque negro y el rincón ya no muestra hueco ni corte oblicuo. Queda solo una franja fina de suelo bajo el zócalo (retranqueo normal de 50 mm). Coste total ≈0,16 $ (dos generaciones). El descarte parece variabilidad del generador; si vuelve a ocurrir de forma repetida, investigar el encuadre ampliado por la región de la columna.
- Reposicionar el tramo A (89,82°, x 13445,21, y 8804,15) NO se aplicó: el editor lo rechaza porque el grifo del fregadero (cilindro a 60–100 mm de la trasera, hasta 280 mm sobre la encimera) atraviesa 1 cm el «Estor enrollable» (elevación 1900, fondo 79 mm) al quedar pegado al muro. Los estores están 11 mm separados de la cara del muro y giran 89,8°. Opciones: dejar la cuña de ≤23 mm; girar a paralelo con holgura uniforme ≈11 mm; o mover/reducir el estor o el grifo (decisión de diseño). Los cambios de prueba se deshicieron; las revisiones 131 y 132 del servidor tienen el mismo diseño que la 130 (solo cambia el número por sincronización).

Actualización posterior (30/09, 00:45), con el ok de Paulo:
- El editor ya no bloquea pegar el tramo A: nueva regla en `collisions()` (`spatial-placement.ts`) por la que una cubierta de ventana (estor, persiana, cortina; helper `isWindowCovering` en `wall-back-alignment.ts`) no cuenta como choque con un tramo de cocina. El choque real era el grifo del fregadero contra el estor (2,4 mm al alinear). Prueba nueva: `tests/canvas/kitchen-run-window-covering.test.ts` (falló antes de la regla y pasa después).
- Tramo A reposicionado desde el editor y guardado: revisión 134, rot 89,82°, x 13445,21, y 8804,15; trasera a 0,0–0,1 mm de la cara del muro. Respaldo del documento rev. 130 en el scratchpad de la sesión (`doc-rev130-backup.json`). Ojo: un simple clic de selección ya lo había movido 9,6 mm por el ajuste automático (revisión 133); las revisiones 131–132 no cambian el diseño.
- Imagen de comprobación con el tramo alineado (rev. 134): DESCARTADA por la auditoría («se ha alterado la geometría interior añadiendo una piscina en el suelo»). Van 3 generaciones de Cocina esta noche (≈0,24 $): 2 descartadas por alucinaciones distintas, 1 aceptada (rev. 132, con la columna). Antes de más intentos, investigar por qué el generador inventa entorno (relleno gris del encuadre ampliado por la columna, resolución, prompt) en vez de reintentar.

Propuesta editable del Patio (30/09, 01:40): la IA propuso lámpara de pie de interior, dos jardineras y una planta de interior, con la lámpara tapando el acceso a una escalera y las plantas en mitad del patio. Paulo la rechazó («no es un diseño inteligente»); se deshizo sin guardar. Causa: `assessFurniturePlacement` (`src/lib/editor-document/native-design-proposal.ts`) solo comprobaba que el objeto cupiera y dejara 250 mm; no distinguía interior de exterior, ni protegía el paso, ni exigía bordes, y el modelo elige coordenadas a ciegas. Corrección (sin commitear): tres motivos de descarte nuevos —`environment` (iluminación/decoración de interior en zona exterior), `circulation` (1000 mm alrededor de escaleras y rampas, 800 mm ante una puerta) y `edge` (plantas, jardineras y lámparas de suelo a ≤900 mm de un muro o del borde de la zona; se exime la tira LED y lo apoyado sobre mesas)—, con etiquetas legibles en el resumen y una instrucción nueva en el prompt del servidor. Pruebas nuevas: `tests/editor-document/native-design-placement-sense.test.ts` (3); se movió la planta de `proposal-permissions.test.ts` junto a un muro. Sin fallos nuevos frente a la línea base. Pendiente: repetir la propuesta del Patio con estas reglas (la anterior sigue sin verse en `Diseños`, no era imagen).
- Docker Desktop dejó de responder a `docker ps` durante la sesión (también colgó el navegador de pruebas); no se tocó. Comprobar `habiteka-postgres` y MinIO antes de seguir.

Cierre de la noche 29–30/09 (estado del proyecto FInca):
- Revisiones 136–137 (pruebas de Paulo): se aplicó la propuesta del Patio (mesa de jardín y 2 jardineras, 46 → 49 muebles) y se eliminó la zona «Patio» con «Quitar» en el diálogo (aplicar una propuesta no toca zonas). Revisión 138: zona recreada pero desplazada por un desfase del mapa (−3014 mm en x, +613 mm en y). **Revisión 139: zona «Patio» de nuevo en su sitio** (x 2791–13383, y 12529–17463; original 2787–13366, 12530–17458).
- «Quitar zona» ahora pide confirmación en dos pasos (`design-scope-picker.tsx`).
- Descargar las vistas de referencia sin IA (`editor-generate-dialog.tsx`, `capture-file-name.ts`) y referencia de estilo opcional entre vistas de un lote (casilla apagada por defecto, `batch-style-anchor.ts`). Prueba con Cocina: la vista con ancla se descartó por geometría alterada; la Cenital sin ancla fue aceptada. Coste de la prueba ≈0,16 $.
- Dibujar zonas por automatización del navegador: el mapa del diálogo usa `setPointerCapture`, que falla con eventos simulados; hay que anularlo en la pestaña, y el mapa tiene un desfase respecto a las coordenadas del plano.

Pendiente:
- Confirmar con una imagen aceptada que el rincón queda bien con el tramo alineado (rev. 134).
- Propiedad explícita de catálogo «adaptable a esquina» por categoría (cocina modular sí; cama, lavadora, armario no) y recorte también contra muros que invadan la huella. Hoy el comportamiento ya existe solo para columnas y cocina.

## Siguiente paso

Contrastar la sombra de Cocina desde una cámara baja en el 3D editable y en una imagen de referencia gratuita. Si representa un hueco real, corregir la geometría y verificar visualmente antes de generar otra imagen de pago. Si es solo sombreado, documentarlo con precisión y seguir con la composición editable y la validación de Entrada, Patio y Salón. No dar por cerrada la fase 3 ni pasar a visitas o vídeo final hasta aprobar una revisión conjunta con calidad visual suficiente.

## Prompt para la nueva sesión

«Continúa Habiteka desde `plans/handoffs/habiteka-diseno-zonas-20260929.md`. Verifica la rama y el estado del repositorio, revisa la primera imagen de Cocina rev. 130 y la sombra de su esquina en el 3D editable. Después sigue la fase 3 del plan: diseño homogéneo por zonas y aprobación conjunta antes de visita y vídeo. Háblame siempre en español.»
