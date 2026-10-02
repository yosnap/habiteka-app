---
title: "Fase 2: Navegación libre por el inmueble"
status: todo
---

# Fase 2: Navegación libre por el inmueble

## Objetivo

Entrar en la escena aprobada y recorrerla en primera persona, con control libre y pasos físicamente válidos.

## Trabajo

1. Añadir un modo «Entrar al diseño» al visor R3F existente. Control de mirada con ratón, movimiento WASD/flechas, velocidad de paseo, pausa y salida clara; soporte táctil mediante toque para desplazarse y giro táctil. Usar el mismo documento aprobado para vista y colisiones.
2. Reutilizar `walkthroughNavigation` para puertas, muros y objetos, pero extenderlo a movimiento incremental con radio de cámara y deslizamiento en obstáculos; no permitir atravesar paredes, puertas cerradas o mobiliario. Posicionar el ojo sobre el suelo acabado y respetar techo y desniveles.
3. Resolver todas las plantas y exteriores transitables. Las escaleras y rampas hoy se tratan como obstáculos para rutas de una planta: modelar conexiones verticales explícitas y probar el cambio de altura/planta antes de declarar que el inmueble completo es navegable.
4. Alternar sin perder contexto entre paseo libre, puntos de interés y recorrido automático existente. Mini plano y controles de orientación accesibles; no exponer herramientas de edición durante la visita publicada.
5. Medir tiempo de carga, memoria y FPS en un inmueble representativo; cargar modelos y texturas por demanda, limitar luces/sombras y escalar resolución. Mantener WebGL como base; evaluar WebGPU solo si una medición demuestra beneficio compatible con la escena.

## Código afectado (orientativo)

- `src/components/editor-v2/scene/editor-scene-view.tsx`, `scene-camera.tsx`; nuevo controlador de paseo en `scene/`.
- `src/lib/editor-document/walkthrough-navigation.ts`, `building-levels.ts`; pruebas de colisión y conexiones entre plantas.
- Reutilizar `src/components/editor-v2/scene/furniture-model.tsx` y los catálogos existentes.

## Verificación

- Recorrido de entrada, tres estancias y exterior sin atravesar muros ni muebles; puertas cerradas bloquean.
- Subida/bajada real por una escalera y una rampa entre plantas cuando existan en el inmueble.
- Ratón/teclado y táctil permiten entrar, orientarse y salir; la cámara no salta al cambiar de modo.
- Objetivo inicial medido: interacción fluida en portátil medio y móvil representativo; fijar límites de MB/FPS con perfilado real, no estimaciones en este plan.

## Riesgo

La colisión actual se diseñó para validar rutas sobre una sola planta. Señal: cámara bloqueada en escalera/rampa o atraviesa forjado. Respuesta: no publicar recorridos entre plantas hasta añadir superficies caminables y enlaces verticales válidos.
