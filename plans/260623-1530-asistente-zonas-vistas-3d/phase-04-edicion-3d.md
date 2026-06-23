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

## Notas
- Es el bloque más ambicioso; va en su propio PR, después de las fases 1-3.
