---
title: "Fase 5: Vídeo de construcción visual y recorrido"
status: in_progress
---

# Fase 5: Vídeo de construcción visual y recorrido

## Avance en muestra aislada (25–26-09-2026)

- La ruta automática busca otro punto libre de la estancia cuando el más céntrico queda aislado por muebles. El barrido de colisión se afinó para que la ruta aprobada coincida con los fotogramas del vídeo.
- El exportador nativo añade una opción de montaje de 8 s: suelo, estructura, huecos/techo, mobiliario, giro exterior y recorrido por estancias. Usa las entidades de la misma escena R3F y un guion temporal determinista; también conserva la exportación de solo recorrido.
- La exportación MP4 se completó en Chrome con la vivienda sintética y mostró «MP4 descargado». Una segunda prueba detectó que R3F podía redimensionar el lienzo durante la codificación; se corrigió con un lienzo de vídeo fijo a 1920×1080 y la repetición terminó correctamente.
- El recorrido entre plantas y el montaje «obra + visita» usan ahora la escena completa durante la grabación y posiciones de cámara absolutas al cruzar el forjado. Ambas exportaciones terminaron con «MP4 descargado» en Chrome sobre la muestra aislada de dos plantas, sin datos de proyecto. Las imágenes editoriales por punto siguen preparándose por planta.
- Pendiente para aceptar la fase: editor de tomas, vista previa completa de montaje, 9:16, audio opcional, vínculo a versión aprobada y comparación de fidelidad/coste antes de integrar vídeo IA.

## Objetivo

Obtener una pieza publicitaria donde el inmueble aparece por etapas, se muestra desde varios ángulos y la cámara entra para recorrerlo.

## Secuencia propuesta

1. Apertura: parcela/base y huella del inmueble desde una cámara exterior.
2. Montaje visual: suelos y estructura, muros/huecos, escaleras y techos, acabados, muebles e iluminación. Es una animación editorial de la escena aprobada, no una simulación técnica de construcción.
3. Revelación: vistas exteriores e interiores clave con movimientos de cámara controlados.
4. Paseo rápido: transición por la entrada y ruta cinematográfica por estancias, terminando en una vista final del inmueble.

## Trabajo

1. Crear un guion reproducible que referencia la versión aprobada, capas por tipo de entidad, orden, tiempos, cámaras y escenas. Aprovechar `EditorScene` (`boxes`, `polygons`, `ramps`, `sourceEntityId`, roles) para revelar elementos sin crear otro modelo.
2. Añadir un editor sencillo de escenas: reordenar/activar tomas, elegir vistas de referencia, duración, cámara objetivo, velocidad y formato 16:9/9:16. Vista previa completa antes de generar.
3. Reusar `WalkthroughPath`, `buildWalkthrough` y `recordWalkthrough` para el tramo de paseo. Extender el grabador determinista por fotograma para cambios de visibilidad y cámara exterior, transiciones y segmentos; adaptar la resolución al formato. Evitar vuelos que crucen muros o muebles.
4. Exportar y guardar MP4 nativo desde la versión aprobada. El grabador actual limita a 60 s, 1080p y H.264/WebCodecs: medir duración y memoria por segmento antes de ampliar. Mantener aviso de compatibilidad de navegador.
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

- Un MP4 muestra montaje visual, revelación por varios ángulos y entrada/paseo rápido sin alterar la distribución aprobada.
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
