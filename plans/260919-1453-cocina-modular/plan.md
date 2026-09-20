# Cocina modular: mobiliario lineal con huecos y altura

Estado: aprobado por Paulo el 2026-09-19. Fases 1, 2 y 3 HECHAS el 2026-09-19 (sin commit; ver `plans/reports/impl-260919-1644-cocina-modular-f1-f2.md`). Pendiente de prueba en navegador por Paulo. Siguiente: fase 4 (catálogo de aparatos, ventanas y columnas).

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

1. ✅ Contrato y validación (`kitchen-run-types/validation/commands`); esquema 11 con colección `kitchenRuns`, migración explícita `upgradeKitchenDocument`.
2. ✅ Geometría compartida 2D/3D/colisiones/imanes (`kitchen-run-volumes`), mismo enfoque que `boundary-volumes.ts`. Los huecos de aparatos ya recortan (fase 4 solo añade catálogo UI, ventanas y columnas).
3. ✅ Herramienta «Cocina» en Construir (imán a caras de muro, cuerpo siempre hacia la estancia), aparatos arrastrables en planta (`linear-part-owner.ts`) e inspector `kitchen-fields.tsx`. Los aparatos se añaden desde el inspector con un desplegable, no arrastrando desde el catálogo.
4. ✅ Recorte alrededor de pilares (bajos y altos vaciados en la huella; la encimera continúa por delante si el pilar no ocupa todo el fondo, se interrumpe si lo ocupa), altos omitidos sobre ventanas del muro de apoyo, aparato prohibido sobre el hueco de un pilar, y aparato del catálogo Amueblar soltado sobre el tramo se encaja como hueco (`kitchen-run-obstacles.ts`, `kitchen-slot-drop.ts`).
5. Apoyo de objetos sobre encimera; contexto de generación IA con la composición.
6. ✅ Catálogo: sofá con chaise longue, rinconero, modular de tres módulos y sofá cama (con variante abierta), perfiles 2D/3D propios sin patas bajo el hueco de la L.

## Riesgos

Encuentros en esquina y huecos que cruzan una esquina; colisiones entre módulos altos y aberturas; rendimiento del recorte de encimera en 3D.

## Decisiones tomadas en fases 1–2 (2026-09-19)

- **Marco local del tramo:** el origen es el extremo inicial de la línea trasera (la que apoya en el muro), `x` recorre el tramo, el cuerpo ocupa `depthMm` hacia `+y` local (a la izquierda del sentido de trazado). `heightMm` es la cota de la cara superior de la encimera; los altos se miden desde el suelo del tramo (`uppers.bottomMm`).
- **Campo discriminador `kitchen`** (no `construction`) para que `isBoundary` y `isKitchenRun` no se confundan; `planObjects` devuelve también cocinas, así buscador, imanes, marquesina, portapapeles, escena 3D y navegación las cubren sin código propio.
- **Recortes por capa** (`kitchenRunCuts`: zócalo, base, encimera, altos): horno y lavavajillas vacían la base; el frigorífico columna atraviesa todo hasta la coronación de los altos; fregadero y vitro no recortan (aportan cubeta+grifo y placa). Las ventanas y columnas de la fase 4 entrarán por este mismo contrato de tramos.
- **Esquina en L:** dos tramos cuyas líneas traseras se tocan en ángulo son «junta» (`isKitchenJoint`): su solape no es colisión. En dibujo/3D el tramo de id menor conserva el módulo de esquina y el otro cede el fondo del vecino (`kitchenRunDisplayVolumes`), sin encimeras solapadas.
- **Pilar sobre el tramo** ya no bloquea la colocación (misma excepción que columnas embebidas en muros); el recorte visual alrededor del pilar queda para la fase 4.
- **Apoyo en suelo:** `addKitchenRun` toma la cota del suelo de la estancia y `restObjectsOnFloors` levanta cocinas enterradas igual que muebles.
- Corregido de paso: `upgradeBoundaryDocument` fijaba `schemaVersion = 10` sin condición y degradaba documentos más nuevos.

## Petición de Paulo (2026-09-19 18:19) · amplía la fase 5

- **Apoyo sobre mueble:** un objeto colocado sobre otro (televisor sobre mueble de TV, microondas sobre encimera, lámpara sobre mesita) toma la cota de la cara superior del anfitrión, no colisiona con él y lo sigue si el anfitrión se mueve o cambia de altura. Generaliza `object-floor-rest.ts`: el «suelo» de un objeto es la superficie más alta que contiene su centro (suelo de la estancia, encimera, mueble).
- **Alineación al anfitrión y al muro:** al soltar un objeto sobre un mueble se orienta como el mueble; al pegarlo a un muro se gira paralelo con la trasera (y=0 local) contra la cara, igual que puertas y ventanas. Hoy `snapObject` → `snapToWallFace` solo desplaza; falta la rotación.
- Borradores: añadido «Descartar» por borrador en la pantalla de recuperación (`durable-editor.tsx`); los borradores viven en IndexedDB del navegador hasta que se sincronizan, se descartan o se cierra sesión.

## Petición de Paulo (2026-09-19 19:45) · bloque de catálogo pendiente

- **Pérgola:** material (madera, metal, aluminio…) y color editables.
- **Carpa** tipo bar, con laterales transparentes.
- **Cortinas:** abiertas, enrollables y otras variantes, con colores.
- **Persianas** y sus variedades.
✅ HECHO 2026-09-20: pérgola en madera, aluminio y acero (color editable con Pintar); carpa con cubierta a niveles y lona transparente en fondo y laterales, frente abierto (transparencia nueva en planta y 3D vía `opacity`); cortina abierta de dos paños, estor enrollable, persiana veneciana, de lamas verticales y enrollable exterior, con variantes de color (gris, azul, blanco, madera, negra). Pendiente si Paulo lo pide: material fotografiado (textura) sobre muebles sueltos, hoy solo color.
