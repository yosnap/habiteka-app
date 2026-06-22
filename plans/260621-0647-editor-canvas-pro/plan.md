# Editor de canvas — funciones profesionales (sobre Konva)

**Decisión:** quedarse en Konva (no migrar a Fabric). Las features pedidas no
requieren otra librería; Konva las soporta, hay que cablearlas. Migrar a Fabric
costaría ~1,5 meses vs ~2-3 semanas de añadir features aquí, con peor rendimiento.

**Investigación:** tldraw (de pago en prod) y Excalidraw (estética boceto, no
planos) descartadas. Konva y Fabric eran las únicas libres viables.

## Fases (PR por fase; verificadas en navegador con Chrome DevTools MCP)

### PRO-0 · Arreglar "Voltear" (bug)
- El flip con `<Group scaleX=-1 x=width>` anidado no se aprecia (formas simétricas) o
  no compensa bien en asimétricas (puerta/inodoro). Revisar con una forma asimétrica
  real y corregir el offset/anidamiento. Verificar que la puerta cambia de lado.

### PRO-1 · Zoom y pan
- Zoom con rueda (Ctrl/Cmd+rueda) centrado en el cursor; pan arrastrando con
  barra espaciadora o botón central; atajos de teclado (Ctrl +/-/0).
- `Stage.scale`/`x`/`y`. Ajustar TODOS los cálculos de coordenadas afectados:
  `snap`, colocación en `onPointerDown`, `pixelRectToZone`. (getPointerPosition lo
  ajusta Konva solo, pero el snap/colocación deben dividir por la escala.)

### PRO-2 · Multiselección y redimensionar varios
- `CanvasSelection` pasa a soportar varios ids: `{ type:'objects'; objectIds:[] }`.
- Shift+clic añade/quita de la selección; arrastre de marco (marquee) selecciona
  los que toca. El Transformer recibe varios nodos (`tr.nodes([...])`, ya soportado).
- Mover/redimensionar el grupo seleccionado a la vez.

### PRO-3 · Z-order (frente/fondo)
- Acciones en el store: `bringToFront`, `sendToBack`, `bringForward`, `sendBackward`
  (reordenan `doc.objects`, que ya es el z-order).
- Expuestas en el menú contextual (PRO-5) y/o toolbar.

### PRO-4 · Portapapeles y duplicar (Ctrl+C/X/V, Ctrl+D)
- Store: `duplicateObjects(ids)`; portapapeles interno (estado, no el del SO) con
  copiar/cortar/pegar; pegar con pequeño offset. Atajos de teclado.

### PRO-5 · Menú contextual (clic derecho)
- `onContextMenu` en el stage/objeto → menú flotante (div posicionado) con:
  copiar, cortar, pegar, duplicar, girar, voltear, traer al frente, enviar al fondo,
  eliminar. Reutiliza las acciones de las fases anteriores.

### PRO-6 · Agrupar / desagrupar (si se mantiene tras multiselección)
- Agrupar varios objetos en un grupo lógico que se mueve/edita junto. Requiere un
  modelo de grupo en el doc. Evaluar si multiselección (PRO-2) ya cubre la necesidad
  antes de invertir aquí (YAGNI).

## Notas técnicas
- Konva 10.3 / react-konva 19.2.5 soportan todo (Transformer multi-nodo, Stage scale,
  Group scale, etc.).
- Undo/redo ya existe (store con history); cada nueva acción debe pasar por `mutate`
  para entrar en el historial.
- Serialización: ampliar `serialize` para cualquier campo nuevo (z no hace falta: es
  el orden del array). Subir `schemaVersion` solo si cambia la forma de los datos.
- Atajos de teclado: centralizarlos (ya hay un handler en canvas-workspace).

## Orden propuesto
PRO-0 (bug) → PRO-1 (zoom/pan) → PRO-2 (multiselección) → PRO-5 (menú contextual,
que da acceso a) → PRO-3 (z-order) + PRO-4 (portapapeles) → PRO-6 (grupos, si hace falta).

## Verificación
Cada fase: typecheck/lint/build + prueba en navegador por mí antes de darla por buena.
NO correr la suite de tests completa (comparte BD con dev).
