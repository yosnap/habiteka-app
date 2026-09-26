---
title: "Fase 4: Visita inmersiva en primera persona"
status: in_progress
---

# Fase 4: Visita inmersiva en primera persona

## Avance en muestra aislada (25–26-09-2026)

- La vista 3D del Editor v2 ofrece «Visita» sobre la misma escena: cámara a 1,6 m, movimiento WASD/flechas, mirada con ratón o arrastre, pausa, salida y controles táctiles.
- El paseo usa `walkthroughNavigation` para radio, puertas, muebles y muros; el movimiento continuo desliza junto a obstáculos. Pruebas con puerta abierta/cerrada y estancia amueblada.
- Entrada, pausa y salida comprobadas en `/dev/editor-v2?muestra=visual`, sin modificar el proyecto real. El recorrido guiado de cuatro estancias de esa muestra ya se genera y se previsualiza.
- El paseo libre muestra un mini plano del mismo documento con muros curvos, huecos de puertas, ventanas, posición, orientación y estancia actual. Comprobado visualmente en escritorio y en un ancho de 390 px; el giro de cámara actualiza el indicador.
- La navegación atraviesa puertas hacia patios y sube rampas rectas o con giro siguiendo su superficie 3D. Una ruta guiada entre patio y estancia elevada pasa por el hueco real del muro. El mini plano distingue el contorno exterior con línea discontinua.
- La cámara también sigue los peldaños y descansillos de escaleras rectas, en L y en U del mismo modelo 3D. Se verificó subida, bajada, bloqueo lateral y paso por un hueco a otra estancia con suelo elevado dentro de una misma planta; un peldaño desproporcionado no se acepta como paso.
- La visita libre enlaza dos plantas contiguas solo cuando una escalera alcanza la cota superior y tiene salida libre. Recorta el techo inferior y el suelo superior con la misma huella; la cámara conserva su altura absoluta al subir y bajar y el mini plano cambia de planta. Pruebas sintéticas de subida, bajada, huecos y enlaces rechazados por altura o salida ocupada. La muestra aislada `/dev/editor-v2?muestra=plantas` permite revisar el hueco y entrar en 3D sin datos reales.
- Las rutas guiadas ya usan los mismos enlaces validados: generan puntos sobre peldaños y descansillos, conservan la altura absoluta de la cámara y permiten subir o bajar. La reproducción monta ambas plantas de la misma escena; la ruta guardada conserva los puntos en su planta inicial. Probado en escaleras rectas, L y U, con salida bloqueada y cotas incorrectas, y en la muestra aislada de dos plantas.
- Pendiente para aceptar la fase: medir fluidez y controles táctiles en móvil, añadir puntos de interés y propuestas desde la visita y validar contra un diseño aprobado de plano fiel.

## Objetivo

Recorrer libremente el diseño aprobado con teclado, flechas, ratón y controles táctiles, como en un videojuego.

## Trabajo

1. Añadir «Entrar al diseño» sobre la escena Three/R3F existente. Usar la versión aprobada, controles de mirada en primera persona, WASD/flechas, pausa y salida. En móvil, giro táctil y desplazamiento por toque/joystick simple.
2. Extender la colisión actual de `walkthroughNavigation` para movimiento continuo, radio de cámara, deslizamiento junto a paredes y puertas, alturas de suelo/techo y bloqueo de muebles. El modo editor y la visita no deben competir por la cámara.
3. Resolver conexiones verticales reales. La visita libre, la ruta guiada y el vídeo nativo ya cruzan escaleras validadas entre plantas contiguas con la misma geometría. Completar recorridos de patios y terrazas transitables entre plantas.
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
