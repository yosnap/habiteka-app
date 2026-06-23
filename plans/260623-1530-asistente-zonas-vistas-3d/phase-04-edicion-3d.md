# Fase 4 — Edición en 3D: clic derecho para luces y color de pared

## PREDICT HECHO — veredicto CAUTION (2026-06-23). Acotado a luces + color de pared. PR PROPIO.

## Objetivo
Que al hacer clic derecho sobre un elemento en la vista 3D se pueda actuar sobre él: cambiar
material / pintar paredes, encender/apagar o ajustar luces, etc. — edición directa en 3D.

## Contexto (scout + memoria)
- `Plan3DView` (R3F) renderiza muros, suelo, muebles glTF y luces (F-LUZ). El doc es la fuente
  de verdad; el 2D ya tiene menús/clic derecho, el 3D NO.
- Luces ya son objetos de primera clase (`light` en StructObj); materiales de muro/suelo hoy
  son colores fijos en el render.
- Editar en 3D implica: raycasting para seleccionar el objeto bajo el cursor, un menú
  contextual, y escribir cambios en el doc (store) que el 3D lea de vuelta.

## Alcance a decidir en el predict
- Qué propiedades se editan primero (material/color de pared, on/off + intensidad/color de luz,
  material de mueble).
- Persistencia: añadir color/material de pared y suelo al modelo (hoy no existen como dato).
- Selección 3D (raycast) + menú contextual 3D (HTML overlay vs in-canvas).
- Coherencia 2D↔3D: ¿los cambios de material se ven también en 2D? ¿solo en 3D?

## Decisión (CERRADA — predict + usuario): luces + color de pared
- **(a) Luces**: encender/apagar + ajustar intensidad/color desde el 3D. Reusa el modelo ya
  existente (`StructObj.light: LightProps`); escribir vía store da undo/redo gratis.
- **(b) Color de pared**: añadir un campo OPCIONAL aditivo a `StructObj` (p. ej. `color?`),
  igual que se hizo con `light`/`heightM`/`floorOutline`; el render 3D lo usa en el
  `meshStandardMaterial` (hoy color fijo). Persistir en `serialize`.
- **Selección 3D**: raycast del objeto bajo el cursor (R3F `onClick`/`onContextMenu` del mesh)
  + menú contextual (overlay HTML sobre el Canvas).
- **Coherencia 2D↔3D**: el color vive en el doc; el 3D lo aplica. El 2D puede ignorarlo de
  inicio (no rompe nada); mostrarlo en 2D = mejora.
- **Materiales/texturas ricas = FUTURO** (fuera de este PR).

## Tests / validación
- Lógica de selección/edición testeable donde sea pura; verificación en navegador.
- tsc+eslint limpios; suite verde.

## Estado (2026-06-23)
- **HECHO: color de pared.** Campo `color?` aditivo en `StructObj` (persistido en serialize con
  validación hex); `WallBox.color`/`sourceId` en docToScene; el render usa `w.color ?? default`.
  Clic derecho sobre una pared en el 3D abre un menú con selector de color que escribe en el
  store (`updateObject` → undo/redo gratis) y el 3D lo refleja en vivo (doc del store).
  Tests: serialize (round-trip + hex inválido) y docToScene (color→WallBox). 549 verdes.
- **PENDIENTE (continuación): editar LUCES desde el 3D** (encender/apagar + intensidad/color).
  El modelo ya existe (`StructObj.light`) y hay panel 2D (`light-controls`); falta el clic
  derecho sobre la luz en 3D + reusar ese panel. Va como siguiente entrega.

## Notas
- Materiales/texturas ricas y luces-en-3D = continuación.
