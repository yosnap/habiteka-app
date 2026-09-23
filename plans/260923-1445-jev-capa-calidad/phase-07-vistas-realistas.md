---
phase: 7
title: "Vistas realistas desde el plano (3D del editor) y detección plano/foto"
status: completed
priority: P1
effort: "1d"
dependencies: [2, 3, 4]
---

# Phase 7: Vistas realistas desde el plano

## Problema (probado en local, 2026-09-23)
En la ruta «diseño» el usuario subió un plano en planta. El render hace img2img sobre esa
imagen con un prompt pensado para una foto → maqueta isométrica con muros reinterpretados.
Un modelo de imagen no puede dar perspectivas interiores realistas y fieles desde un 2D.

## Goal
- Detectar al subir si la imagen es un **plano en planta** o una **foto** de la estancia.
  Plano en la ruta «diseño» → avisar y ofrecer la ruta «plano» (sin generar una maqueta falsa).
- Ruta «plano» con Jev ≥ `proceed` (o `confirm` aceptado): tras aplicar al editor, «Generar
  vistas realistas» abre el editor con el diálogo de generación preparado (estilo elegido,
  una vista interior por estancia) y genera con el camino existente
  (`generateConceptRenderFromEditor` + captura 3D + puerta `editor_structure`).
- Nueva vista «interior por estancia»: cámara a 1,6 m en una esquina de cada estancia
  (derivada con `deriveRooms`), mirando al centroide, FOV de interiorismo; captura del 3D
  real para que el modelo de imagen solo ponga materiales/luz/muebles.
- Las vistas generadas se ven en «Diseños» (y en la vista previa del asistente al volver).
- Fotos reales: sin cambios (img2img es correcto porque la foto ya tiene perspectiva).

## Verification
- Tests puros de la cámara por estancia (posición dentro de la estancia, altura, mirada al
  centroide, estancias en L / pequeñas) y de la clasificación plano/foto.
- tsc, eslint y suite completa en verde.
- Prueba manual: plano del usuario → ruta plano → editor → vistas interiores realistas.

## Resultado (2026-09-23)
- `imageKind` ('floor_plan' | 'room_photo' | 'other') sale del mismo análisis de visión de la
  ingesta (un campo más en su esquema, sin llamada extra) y lo desempata el barrido ráster de
  muros solo cuando la visión responde `other`. Se persiste en `collected`.
- El paso 2 de la ruta de diseño avisa con un plano y ofrece convertirlo al editor llevándose la
  misma imagen (no se vuelve a subir); seguir igualmente sigue siendo posible.
- `roomInteriorCameras` da una `CameraPose` por estancia: ojo a 1,6 m sobre el suelo acabado de su
  estancia, en la esquina más alejada de la puerta más ancha, retraída hasta quedar dentro del
  polígono (planta en L), mirando al punto interior, FOV 65°.
- El diálogo del editor tiene la vista «interiores por estancia» (casillas, habitables marcadas por
  defecto); cada estancia es una captura del 3D real y un render por el camino existente
  (`generateConceptRenderFromEditor`), con su puerta `editor_structure` y su cobro por imagen.
  El prompt añade la regla de altura de ojos que prohíbe maqueta e isométrica.
- El paso final de la ruta del plano ofrece «Generar vistas realistas» con estilo elegible: abre
  `/projects/[id]?zona=…&generar=interiores&estilo=…` con el diálogo ya preparado. Con `block` no
  se ofrece. Los resultados se persisten como entregables `render3d` y se enlaza a «Diseños».

## Correcciones tras prueba en navegador (2026-09-23)
Probado el flujo completo con un plano real de vivienda (6 estancias).

1. **Cámara «fuera» de la estancia.** No era la geometría: las poses caían dentro del polígono
   en coordenadas de escena. El fallo estaba en el recorte de muros. `CutawayWall` decidía su
   visibilidad solo dentro de `useFrame`, y el lienzo va `frameloop="demand"`: una captura con
   `camera` no cambia ninguna propiedad de la escena (ese plano no tiene techos ni muebles), así
   que no se invalidaba nada, no se dibujaba ningún fotograma y `gl.render` pintaba con los muros
   todavía ocultos por la órbita anterior — de ahí el muro exterior flotando. Ahora la
   restauración es un efecto de layout (no depende de fotogramas) y la captura invalida
   explícitamente antes de renderizar.
2. **Encuadres encajonados.** El ojo ya no es «la esquina más lejana a la puerta»: se evalúan
   esquinas y puntos medios de muro retraídos 45/70/100/140 cm y gana el de mayor profundidad
   libre hacia el punto interior, con 45 cm mínimos a cualquier muro y 1 m a cualquier puerta
   (filtros que se relajan en cascada en estancias minúsculas). FOV adaptativo 65°–85° según
   superficie. Las estancias de menos de 4 m² dejan de marcarse por defecto (siguen elegibles).
3. **El diálogo no se abría solo** con `?generar=interiores`: se abría solo si la captura de
   cortesía terminaba bien. Ahora se abre nada más montar y la captura se rellena después; la
   petición se borra de la URL con `history.replaceState` (no `router.replace`: una navegación
   del App Router reejecuta el componente de servidor y reabre la rama de borrador del editor).
4. **«Ver vistas de referencia» desactivado sin explicación**: el modo interiores fija
   automáticamente «Habitación interior» y, en general, el motivo del bloqueo se muestra en texto
   junto al botón (también en el de propuesta editable).
5. **Libertad de decoración**: llegando en modo interiores, o con un plano sin muebles, arranca en
   «Libre» y la ayuda dice que la IA amueblará según el estilo sin tocar la construcción.
6. **Detalle visual**: el aviso junto al plano 2D usa la misma banda que la tarjeta de calidad
   (`qualityBandClassName`): verde con `proceed`, ámbar con `confirm`/aproximado, rojo con `block`.

Verificación: `tests/editor-document/room-interior-cameras-real-plan.test.ts` (fixture del plano
real: cámaras dentro del suelo de su estancia en coordenadas de escena, holgura a muro y FOV) y
tests de puerta, FOV adaptativo y umbral de 4 m² en `room-interior-cameras.test.ts`. tsc, eslint y
suite completa en verde.

## Segunda ronda de correcciones tras prueba en navegador (2026-09-23)
En este equipo la escena 3D tarda 15–20 s en cargar, y ahí se veía todo lo que faltaba.

7. **«Preparando…» sin fin al llegar del asistente.** El diálogo se abría al montar, con el 3D
   todavía cargando. La captura de cortesía sondeaba `captureView.current` con un plazo de 15 s —
   menos de lo que tarda la escena— y, cuando sí llegaba a capturar, lo hacía contra una escena a
   medio montar. Todas las capturas comparten una cola (`captureQueue`) y ningún `await` dentro de
   una captura tenía plazo: una captura atascada bloquea la cola y deja «Preparando…» para siempre,
   aunque el 3D ya se vea detrás. Ahora: (a) cada captura está acotada (`withTimeout`, 45 s) y la
   cola avanza con la promesa ya acotada, así que una captura atascada no puede bloquear a las
   siguientes; (b) toda espera de la escena pasa por `awaitScene` (`waitUntil` con plazo de 90 s y
   mensaje legible); (c) `onPrepare` y la previsualización ya no fallan con «abre la vista 3D»: se
   esperan; (d) la captura de cortesía es un extra silencioso, no un aviso rojo.
8. **«Diseñar con IA» en 2D.** Botón y llegada desde el asistente comparten ahora una sola ruta
   (`openGenerate`): conmuta a 3D, abre el diálogo de inmediato y la preparación espera sola. El
   diálogo recibe `sceneReady` y dice «Cargando el 3D… la preparación empezará sola al terminar»;
   el botón pasa a «Esperando al 3D…» mientras espera. Desaparece el aviso rojo «Espera a que
   termine de cargar la vista 3D.».
9. **Baño desmarcado.** El umbral de 4 m² excluía baños y aseos, que son justo lo que se quiere
   renderizar. Ahora manda el uso: se descarta lo que mide menos de 1,5 m², lo que no tiene
   etiqueta y mide menos de 4 m², y los nombres de paso o almacenaje (pasillo, distribuidor, hall,
   recibidor, vestíbulo, armario, trastero), comparados sin acentos ni mayúsculas.
10. **Modelo de render por defecto.** Un A/B real (mismo dormitorio, misma cámara, mismo prompt) dio
    calidad equivalente entre Sunburst (0,15 $) y Flare (0,08 $). En el perfil de validación
    arquitectónica, `render3d` pasa a Flare con Sunburst de primer respaldo; `inpaint` sigue en
    Sunburst, que es donde la edición sí se nota.

Verificación de esta ronda: `tests/lib/async-wait.test.ts` (espera con plazo y acotación de una
tarea que no termina), `tests/admin/model-profiles.test.ts` (modelos permitidos y reparto
generar/editar) y los casos nuevos de `room-interior-cameras*.test.ts` (baño pequeño marcado, pasos
y huecos no, acentos, «Estancia N» sin nombre). tsc, eslint y suite completa (1641) en verde.

## Ronda 3: zonas permitidas y prompt que cabe en los respaldos

11. **Zonas permitidas por estancia y punto a punto.** El selector de «Dónde puede decorar» solo
    dejaba arrastrar un rectángulo, aunque el esquema ya admite polígonos de 3 a 20 vértices. Ahora
    tiene tres modos: *Estancia* (una pulsación dentro de una estancia toma su contorno exacto y su
    etiqueta como nombre, con resalte bajo el cursor), *Punto a punto* (vértice por clic con línea
    elástica, cierre sobre el primer vértice, doble clic o Intro, Retroceso deshace, Escape cancela,
    con magnetismo a vértices y muros mediante `snapWallPoint`) y *Rectángulo* (lo de antes). Cada
    zona de la lista tiene nombre editable y botón de quitar; se dibujan todas sobre el mini plano.
    Los contornos de más de 20 vértices se simplifican (Douglas-Peucker) en vez de subir el tope del
    esquema, y los trazos con lazos se rechazan al cerrarlos. La lógica pura vive en
    `src/lib/editor-document/polygon-tools.ts` y `render-region-draw.ts`; el mini plano se partió en
    `render-region-map.tsx`. Los campos de nombre no reciben foco automático y llevan
    `autoComplete="off"`, `data-1p-ignore`, `data-lpignore` y `data-bwignore`, porque el gestor de
    contraseñas tapaba el input enfocado y bloqueaba la automatización del navegador.
12. **Prompt compacto dentro del tope de FLUX.** Los respaldos `flux-2/flex-image-to-image` y
    `flux-2/pro-image-to-image` fallaban con `kie_prompt_too_long` en todas las vistas interiores:
    con el plano real medía entre 7100 y 7124 caracteres frente a un límite de 5000. La causa era
    que el compacto llevaba la planta entera aunque la cámara esté dentro de una sola estancia. El
    contexto se acota ahora a la estancia de la cámara y a las que comparten muro con ella (lo que
    se ve por sus huecos), y si aún no cabe se degrada por prioridad explícita: redondeo de cotas,
    fuera nombres de muros y huecos, fuera detalle de forjado, solo la estancia de la cámara y, como
    último recurso, geometría esencial con contornos simplificados. Nunca se corta el JSON a mitad
    ni se tocan las reglas duras (`COMPACT_RENDER_POLICY`, `INTERIOR_EYE_LEVEL_RULE`, amueblado).
    Resultado con el plano real: 4124–4580 caracteres, con tope garantizado en 4800
    (`COMPACT_PROMPT_LIMIT`, 200 de margen sobre el límite duro).

Verificación de esta ronda: `tests/editor-document/render-region-draw.test.ts` (simplificación,
autointersección, cierre del trazo, hit-test de estancia sobre el plano real, compatibilidad con
`renderDesignOptionsSchema`) y `tests/agent/interior-prompt-length.test.ts` (≤ 4800 con el fixture
`plano-vivienda-real.json` y con una planta sintética de 20 estancias, reglas duras intactas y JSON
completo). tsc, eslint y suite completa (1656) en verde.
