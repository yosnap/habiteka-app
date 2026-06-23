# Fase 4 — Mover muros con precisión (contorno coherente)

## ⚠️ Predict recomendado antes de implementar (riesgo Alto)

Mover un muro suelto sin más rompe el contorno: las esquinas comparten geometría con los
muros adyacentes; desplazar uno deja huecos o solapes. Es la pieza más delicada.

## Contexto
- Muros = `StructObj{kind:'wall', x,y,width,height,rotation}`. El contorno lo generan
  `room-shapes.ts`/`build-room-doc.ts` (Fase formas) pero el usuario también dibuja a mano
  (draw-wall.ts) y edita objetos sueltos.
- Hoy un muro se arrastra como cualquier objeto (Group draggable) → se mueve aislado.

## Requisitos
Que arrastrar un muro mantenga el contorno de la sala coherente (sin huecos nuevos en las
esquinas con los muros contiguos).

## Opciones a evaluar en el predict
1. **Snap del muro a ejes de muros vecinos** (mínimo): el muro engancha su borde a la
   prolongación de los muros contiguos; no reescribe el contorno. Barato, no garantiza cierre.
2. **Mover por ARISTA del contorno**: si el doc conoce el contorno (`floorOutline`), arrastrar
   un muro mueve su arista y recalcula los muros contiguos para cerrar. Coherente pero acoplado
   a que el contorno exista (no para muros dibujados a mano sueltos).
3. **Vértices arrastrables**: editar el contorno por vértices (cambia el modelo de edición).
   Mayor alcance; probablemente fuera de este PR.

## Decisión (PREDICT HECHO — veredicto CAUTION, 2026-06-23)

**Hallazgo del predict (lee el código, no asunción):** NO existe "el contorno" como
estructura editable — hay una LISTA DE CAJAS independientes. Además coexisten DOS modelos de
muro: los de formas (room-shapes, axis-aligned `rotation:0`) y los dibujados a mano
(draw-wall, con `rotation` y esquina desplazada por la normal). Y `floorOutline` es una FOTO
del polígono al crear la sala: no se recalcula al editar muros.

**Consecuencia:** las opciones 2 y 3 presuponen un grafo de vértices/aristas conectadas que
HABRÍA QUE CONSTRUIR primero (refactor del modelo de datos) → fuera de alcance de este PR.

**Decisión:**
- **Este PR → Opción 1** (snap del muro a ejes/bordes de muros vecinos), reusando el núcleo
  de snap de las Fases 1-3. No cambia el modelo de datos. Snap sobre AABB (muros rotados =
  aproximado, coherente con live-dimensions).
- **`floorOutline`**: si el muro arrastrado pertenece a una sala con `floorOutline` (forma
  L/U/T), NO intentar recoser el polígono (eso es Opción 2). En su lugar: avisar que el
  contorno de formas se edita desde el wizard, o anotar como deuda. Evita 2D/3D divergentes.
- **Opción 2** (mover por arista recalculando contiguos): PR propio con su propio predict,
  condicionado a construir antes un modelo de contorno como aristas conectadas. Deuda anotada.
- **Opción 3** (vértices arrastrables): fuera de alcance previsible (es un editor de contorno).

## Tests / validación
- Tests puros del snap de muros; verificación en navegador (mover muro → no aparece hueco).
- `bunx tsc` + `eslint` limpios; suite verde.
