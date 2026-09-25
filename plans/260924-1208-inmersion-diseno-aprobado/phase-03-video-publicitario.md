---
title: "Fase 3: Cámara cinematográfica y vídeos"
status: todo
---

# Fase 3: Cámara cinematográfica y vídeos

## Objetivo

Crear vídeos de anuncio desde la misma versión aprobada que se puede visitar.

## Trabajo

1. Reutilizar `WalkthroughPath`, `buildWalkthrough` y `recordWalkthrough` como primera salida: ruta automática por estancias y MP4 local. Vincular el resultado a la revisión aprobada para evitar mezclar vídeo y visita de diseños distintos.
2. Añadir un modo de cámara cinematográfica: ruta editable con puntos, orientación y objetivo de mirada, velocidad, pausas y transiciones suaves. Presets de entrada desde fachada, paseo interior y toma elevada exterior tipo dron; el vuelo podrá pasar por espacios abiertos y puertas válidas, pero no atravesar sólidos.
3. Permitir previsualizar y escoger formato horizontal/vertical y duración; render determinista por fotograma con WebCodecs/Mediabunny. Conservar los límites actuales de 60 s/1080p hasta medir exportación en equipos reales; para anuncios más largos, componer secuencias de clips sin congelar el editor.
4. Comparar el vídeo nativo con una muestra corta de vídeo IA sobre el mismo diseño aprobado. Ofrecer la mejora IA solo si pasa revisión de continuidad de muros, puertas, materiales y muebles; comunicar coste antes de generar. Voz, música y montaje pertenecen al entregable audiovisual, no al modelo navegable.

## Código afectado (orientativo)

- `src/lib/editor-document/walkthrough.ts`, `walkthrough-geometry.ts`.
- `src/components/editor-v2/walkthrough-panel.tsx`, `scene/offline-recorder.ts`, `scene/editor-scene-view.tsx`.
- Integración con el entregable `VIDEO` existente; la vía IA se conecta al plan previo F4 solo tras el ensayo de continuidad.

## Verificación

- La misma escena aprobada se ve en visita libre y en MP4, con muebles/luces/puertas coincidentes.
- Exportación reproducible en 16:9 y 9:16; encuadres sin atravesar sólidos ni mostrar huecos en paredes/techo.
- Un cambio de diseño posterior obliga a revisar o regenerar el vídeo antes de presentarlo como correspondiente al nuevo diseño.

## Riesgo

Los vídeos IA pueden alterar la distribución entre fotogramas. Señal: cambia un elemento fijo del inmueble. Respuesta: entregar el MP4 nativo y no etiquetar el clip IA como representación fiel.

## Implementation Steps

1. Step 1
2. Step 2

## Todo

- [ ] Task A
- [ ] Task B

## Success Criteria

_Define done._
