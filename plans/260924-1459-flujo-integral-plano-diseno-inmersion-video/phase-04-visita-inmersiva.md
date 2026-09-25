---
title: "Fase 4: Visita inmersiva en primera persona"
status: in_progress
---

# Fase 4: Visita inmersiva en primera persona

## Avance en muestra aislada (25-09-2026)

- La vista 3D del Editor v2 ofrece «Visita» sobre la misma escena: cámara a 1,6 m, movimiento WASD/flechas, mirada con ratón o arrastre, pausa, salida y controles táctiles.
- El paseo usa `walkthroughNavigation` para radio, puertas, muebles y muros; el movimiento continuo desliza junto a obstáculos. Pruebas con puerta abierta/cerrada y estancia amueblada.
- Entrada, pausa y salida comprobadas en `/dev/editor-v2?muestra=visual`, sin modificar el proyecto real. El recorrido guiado de cuatro estancias de esa muestra ya se genera y se previsualiza.
- Pendiente para aceptar la fase: medir fluidez y móvil, resolver conexiones entre plantas y zonas exteriores, mini plano/POI, propuestas desde la visita y validar contra un diseño aprobado de plano fiel.

## Objetivo

Recorrer libremente el diseño aprobado con teclado, flechas, ratón y controles táctiles, como en un videojuego.

## Trabajo

1. Añadir «Entrar al diseño» sobre la escena Three/R3F existente. Usar la versión aprobada, controles de mirada en primera persona, WASD/flechas, pausa y salida. En móvil, giro táctil y desplazamiento por toque/joystick simple.
2. Extender la colisión actual de `walkthroughNavigation` para movimiento continuo, radio de cámara, deslizamiento junto a paredes y puertas, alturas de suelo/techo y bloqueo de muebles. El modo editor y la visita no deben competir por la cámara.
3. Resolver conexiones verticales reales. Hoy rutas y vídeo nativos pertenecen a una planta y las escaleras/rampas figuran como obstáculos: crear superficies caminables y enlaces entre plantas, con pruebas de subida/bajada. Incluir patios y terrazas transitables.
4. Ofrecer ruta guiada y puntos de interés como ayuda dentro de la misma visita, además del paseo libre. Un mini plano muestra posición y siguiente estancia sin imponer orden.
5. Cargar modelos/texturas según visibilidad y medir FPS, memoria y tiempo hasta entrar. Ajustar resolución, luces y sombras según dispositivo; conservar fallback claro si WebGL falla.
6. Si el usuario solicita un cambio desde la visita («este sofá no me convence»), enviar al chat el ID del objeto, estancia y revisión visible. Mostrar una propuesta de edición en un borrador; no alterar la visita publicada ni ejecutar cambios durante el movimiento de cámara.
7. Conectar la entrada desde la maqueta cenital: transición comprensible a cámara a altura de los ojos, con la misma luz/materiales/productos de la revisión aprobada. Evaluar interiores reales a altura de persona además de las referencias isométricas; un resultado bonito visto desde arriba no valida la inmersión.

## Código afectado

- `src/components/editor-v2/scene/editor-scene-view.tsx`, `scene-camera.tsx`, `walk-camera.tsx`; nuevo módulo pequeño de control de paseo.
- `src/lib/editor-document/walkthrough-navigation.ts`, `building-levels.ts`, `auto-tour.ts`.
- Reusar `furniture-model.tsx` y materiales actuales; evitar duplicar la escena para visita.

## Criterios de aceptación

- Caminar desde la entrada por tres estancias, subir y bajar una planta y salir a una zona exterior sin atravesar sólidos.
- Las puertas cerradas bloquean; las transitables permiten paso; el ojo conserva altura adecuada sobre suelo y rampas.
- Teclado/flechas, ratón y móvil permiten entrar, orientarse y salir. La ruta guiada y paseo libre usan la misma versión.
- Se publican mediciones de carga/FPS/memoria con el inmueble de referencia en escritorio y móvil; los umbrales se fijan a partir de esa medición.
- Una orden desde la visita identifica el objeto correcto y crea una propuesta para nueva revisión; la visita aprobada permanece idéntica hasta republicación.
- La transición maqueta→primera persona no cambia distribución ni mobiliario y la luz sigue siendo coherente; se documentan capturas comparables de ambas cámaras del mismo inmueble.

## Riesgos

La escena de una planta no equivale a navegación multizona del edificio. Señal: salto o bloqueo en escaleras, forjados o patios. Respuesta: detener la publicación de esa ruta hasta que exista conexión caminable validada.
