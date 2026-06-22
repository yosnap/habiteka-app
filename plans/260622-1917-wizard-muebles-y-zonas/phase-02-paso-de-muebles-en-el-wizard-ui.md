---
phase: 2
title: Paso de muebles en el wizard (UI)
status: completed
effort: ''
---

# Phase 2: Paso de muebles en el wizard (UI)

## Overview
Convertir el wizard en multipaso: medidas+tipo → muebles. El paso de muebles muestra las opciones
del tipo (casillas marcadas por defecto), un control de cantidad para los repetibles y los
opcionales. Al crear, pasa la selección a `autofurnish`.

## Requirements
- Funcional: paso 2 con casillas por `ROOM_FURNITURE[tipo]`; defaults marcados; cantidad (stepper)
  para repetibles; opcionales desmarcados por defecto.
- Funcional: "Atrás" vuelve a medidas; "Crear sala" usa la selección. "Dibujar a mano" sigue.
- No-funcional: accesible (labels, foco), reusa el estilo actual del modal.

## Architecture
- `design-wizard.tsx` gana `step: 'room' | 'furniture'` y `selection: FurnitureSelection`.
- **Reset de selección SOLO al cambiar el tipo (M2):** guardar el `roomType` con el que se calculó la
  selección; al avanzar al paso 2, si el tipo cambió respecto al guardado → `selection =
  defaultSelection(roomType)`; si NO cambió (p. ej. el usuario solo tocó medidas y volvió) →
  conservar la selección del usuario. Cambiar medidas nunca borra la selección.
- Render del paso 2: lista de `ROOM_FURNITURE[roomType]` con checkbox (marcado si `selection[kind]>0`);
  para `repeatable`, un stepper −/＋ (acota a `maxQty`); opcionales igual pero desmarcados.
- `onCreate(doc, roomType, selection)` — ampliar la firma del prop y el handler de `canvas-workspace`
  para pasar `selection` a `autofurnish(furnished, roomType, selection)` (que ahora devuelve
  `{ objects, omitted }`).
- **Aviso de omitidos (decisión usuario "avisar y no colocar"):** si `omitted` no está vacío tras
  crear, mostrar un aviso no bloqueante (toast/línea en el workspace) listando qué no cupo
  (p. ej. "La isla no cabe en esta cocina"). KISS: un mensaje temporal, sin bloquear el flujo.
- Mantener el preview SVG de medidas en el paso 1.

## Related Code Files
- Modify: `src/components/canvas/wizard/design-wizard.tsx` (multipaso + selección).
- Modify: `src/components/canvas/canvas-workspace.tsx` (handler `onCreate` recibe y pasa `selection`).
- (Opcional) Create: `tests/components/...` solo si hay infra de test de componentes; si no, la
  lógica ya está cubierta en fase 1 y se valida en navegador.

## Implementation Steps
1. Añadir estado de paso y selección al wizard; navegación Atrás/Siguiente.
2. Render del paso de muebles: casillas + steppers de cantidad + opcionales.
3. Ampliar `onCreate` (wizard prop + canvas-workspace) para propagar `selection` a `autofurnish`.
4. tsc + eslint; verificación visual en navegador (fase 4).

## Success Criteria
- [ ] El wizard muestra el paso de muebles tras el tipo; defaults marcados; cantidades y opcionales.
- [ ] "Crear sala" coloca exactamente lo seleccionado (vía `autofurnish(selection)`).
- [ ] "Atrás" y "Dibujar a mano" funcionan; modal accesible.
- [ ] tsc + eslint limpios.

## Risk Assessment
- **Cambio de tipo tras tocar selección:** al cambiar de tipo, resetear a `defaultSelection` del nuevo
  tipo (evita arrastrar kinds de otro tipo). Documentar el reseteo.
- **Firma de `onCreate`:** es un cambio de contrato del componente; actualizar el único consumidor
  (`canvas-workspace`) en el mismo commit.
