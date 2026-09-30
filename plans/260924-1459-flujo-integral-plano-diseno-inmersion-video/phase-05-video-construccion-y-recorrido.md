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
