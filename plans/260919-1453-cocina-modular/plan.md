# Cocina modular: mobiliario lineal con huecos y altura

Estado: aprobado por Paulo el 2026-09-19; arranca en sesión nueva por la fase 1 (contrato y geometría).

## Necesidad

Trazar el mueble de cocina como se traza una pared: un tramo continuo de módulos bajos con encimera, y sobre él módulos altos a una altura dada. Encajar después en el tramo los aparatos (fregadero, vitrocerámica, lavavajillas, horno) como huecos que recortan el mueble, y apoyar encima aparatos sueltos (microondas). Respetar ventanas: un módulo alto no puede tapar una ventana. Catálogo de sofás más rico.

## Modelo propuesto

Reutilizar el patrón del cerramiento compuesto (`Boundary`): entidad lineal `KitchenRun` con extremos, espesor (fondo) y composición por tramo.

- Base: fondo 600, altura 900, encimera (material, grosor 30–40), zócalo.
- Módulos altos: opcional; cota inferior (p. ej. 1,40 m), altura, fondo 350; se omiten automáticamente donde hay ventana en el muro de apoyo.
- Huecos vinculados al tramo (como las puertas de una valla): fregadero, vitrocerámica, lavavajillas, horno, frigorífico columna. Cada hueco recorta base y encimera y aporta su volumen 3D (catálogo `kitchen-slot`).
- Aparatos sobre encimera (microondas, cafetera): muebles normales con elevación = cota de encimera; el apoyo en «superficie de mueble» se generaliza a partir de `object-floor-rest.ts`.
- Esquinas: tramo en L con módulo de esquina compartido (como el poste único de la valla).
- Columnas: un pilar que cae sobre el tramo no es una colisión, es un recorte. El mueble se ajusta a la columna
  igual que en obra: la base y los módulos altos se cortan alrededor de su huella dejando el hueco justo, y la
  encimera continúa por delante si el pilar no ocupa todo el fondo (si lo ocupa, la encimera se interrumpe).
  El recorte se recalcula al mover la columna o el tramo; el hueco no se puede ocupar con un aparato.

## Interacción

- Herramienta «Cocina» en Construir: primer clic inicia, cada clic confirma tramo, imanes a caras de muro (fondo pegado al muro), Esc termina.
- Inspector: composición, altura de módulos altos, encimera, lista de huecos con posición longitudinal y ancho; añadir hueco desde catálogo arrastrando sobre el tramo.
- Edición en bloque y buscador ya cubren la entidad si se registra en `plan-element-index.ts` y `bulk-edit.ts`.

## Fases

1. Contrato y validación (`kitchen-run-types/validation/commands`), migración no necesaria (entidad nueva).
2. Geometría compartida 2D/3D/colisiones/imanes (`kitchen-run-volumes`), reutilizando el enfoque de `boundary-volumes.ts`.
3. Herramienta de trazado y capa de dibujo; inspector con campos.
4. Huecos de aparatos con catálogo y recorte; regla de ventanas para módulos altos; recorte automático alrededor de columnas.
5. Apoyo de objetos sobre encimera; contexto de generación IA con la composición.
6. Catálogo: ampliar sofás (chaise longue, rinconera, tres plazas modular, cama-sofá) con perfiles 2D y volúmenes 3D.

## Riesgos

Encuentros en esquina y huecos que cruzan una esquina; colisiones entre módulos altos y aberturas; rendimiento del recorte de encimera en 3D.
