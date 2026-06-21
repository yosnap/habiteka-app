# Escala y medidas en el editor de planos — plan

**Objetivo:** convertir el lienzo de "píxeles sueltos" en un plano a escala real,
con medidas visibles de los muros/objetos en cm/m, como un plano de verdad.

**Estado actual:** el canvas trabaja en píxeles de stage sin escala ni cotas. Los
objetos tienen `width/height` en px; la rejilla es de 20px.

## Fases

### ES-1 · Escala configurable (px ↔ cm)
- Definir una escala del proyecto: cuántos cm equivale 1 px (o 1 celda de rejilla).
  Guardar en el `CanvasDoc` (`schemaVersion` sube; migración: escala por defecto).
- Selector de escala en la UI (p. ej. "1 celda = 50 cm", presets habituales).
- Hacer que la rejilla represente una medida redonda (p. ej. cada celda = 50 cm).

### ES-2 · Medidas visibles de muros y objetos
- Al seleccionar (o siempre, configurable) mostrar la dimensión de cada muro:
  largo en m/cm sobre la línea del muro.
- Para objetos: mostrar ancho×alto reales (derivados de px × escala).
- Etiquetas legibles, que no saturen el plano (mostrar al hover/selección).

### ES-3 · Acotación (cotas entre puntos)
- Herramienta "Cota": el usuario marca dos puntos y se dibuja una línea de cota con
  su medida (como en un plano técnico). Se guarda en el doc.
- Aprovechar `PlanDimension` del contrato de plano (ya existe el tipo).

### ES-4 · Entrada por medidas
- Poder fijar el tamaño de un objeto/muro escribiendo su medida real (no solo
  arrastrando): campo "ancho (cm)" / "alto (cm)" en la selección.

## Decisiones a confirmar (al abordar la tanda)
- **Unidad por defecto**: ¿cm o m? ¿escala por defecto (1 celda = 50 cm)?
- **Medidas siempre visibles** o solo al seleccionar/hover (para no saturar).
- ¿ES-3 (acotación libre) entra o basta con las medidas automáticas de muros (ES-2)?

## Notas técnicas
- La escala vive en el `CanvasDoc` (persiste por proyecto), no global.
- Todo el render de medidas deriva de px × escala; no se cambia el modelo geométrico
  (sigue en px), solo se MUESTRA en unidades reales.
- Verificación en navegador por fase (Chrome DevTools MCP).
