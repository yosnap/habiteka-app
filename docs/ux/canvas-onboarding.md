# Onboarding del canvas y affordances

> Dos problemas de descubribilidad que el diseño resuelve: la parálisis del
> lienzo en blanco y la edición por zona (no evidente sola).

## Estado vacío guiado (anti-parálisis)

El canvas nunca aparece desnudo. Al entrar sin imagen:

- **Dropzone protagonista** con tres caminos claros: arrastrar foto, dibujar
  in-app, subir plano.
- **Plantillas/ejemplos de arranque:** tarjetas con espacios de muestra
  (salón, cocina, baño) que el usuario puede abrir para ver el flujo completo
  antes de aportar su imagen.
- Copy cercano: *"Empieza subiendo una foto de tu espacio — o prueba con un
  ejemplo."*

## Affordance de feedback por zona

La edición selectiva se descubre con señales visuales:

- **Hover-highlight:** al pasar el cursor sobre una zona del diseño (pared,
  estancia), esta se resalta con borde `brand-500`.
- **Hint contextual:** primera vez en la fase de ajuste, tooltip *"Haz clic en
  una pared para modificarla"*. Se descarta tras la primera interacción.
- **Cursor:** `pointer` sobre zonas editables.

## Mapa de copy: fase interna → lenguaje de producto

| Interno | En la UI |
|---|---|
| Ingesta | "Sube tu espacio" |
| Cualificación | "Cuéntanos qué quieres" |
| Entrega | "Tus diseños" |
| Feedback | "Ajusta tu diseño" |
| Add-ons | "Comparte y compra" |

**Regla:** nunca aparece "Fase 1/2/3…", "Ingesta", "Cualificación" ni jerga de
máquina de estados en pantalla.
