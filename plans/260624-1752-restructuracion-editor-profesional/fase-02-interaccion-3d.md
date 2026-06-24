# Fase 2 — Interacción 3D correcta

**Depende de:** Fase 0  
**Objetivo:** Que cualquier elemento sea seleccionable, movible y manipulable en 3D sin bugs, con menú contextual radial tipo Planner5D, colisiones suaves, y placement correcto según tipo (suelo / pared / techo).

---

## Problemas actuales a resolver

| Problema | Causa raíz | Solución |
|---------|-----------|---------|
| Puertas no seleccionables | Muro bloquea el raycast; puerta no es hijo del muro | wall-child model + detección por userData |
| Ventanas en posición incorrecta | Se crean en el centro del muro sin respetar posición del usuario | Wall-child con offset a lo largo del muro |
| Luces flotan en el aire | No tienen placement ceiling → se colocan como muebles | ceiling placement → ancladas a `y = ceilingHeightM` |
| Muebles se incrustan en paredes | `computeAlignmentSnap` sobreescribe `computeWallSnap` | Ya parcialmente corregido; consolidar con BVH |
| Sin menú contextual | No implementado | Menú radial sobre objeto seleccionado |
| Sin colisión entre muebles | No implementado | BVH + resolución suave |

---

## 1. Wall-child: puertas y ventanas como hijos del muro

### Modelo de datos (de Fase 0)
```ts
// Una puerta queda vinculada a su muro
{ id: 'door-1', kind: 'door', parentId: 'wall-3', ... }
```

### `docToScene` — cálculo de posición

Para objetos con `placement === 'wall-child'`:
- Se usa `parentId` para encontrar el muro
- La posición se calcula como **offset a lo largo del eje del muro** desde el `x,y` del doc
- Si el muro rota, la puerta rota con él automáticamente
- Resultado: `cx, cz` siempre correcto sin importar orientación del muro

### Selección en 3D

- Los meshes de `OpeningFramesLayer` llevan `userData.openingId` (ya implementado)
- El onClick del muro comprueba `e.intersections` por `openingId` (ya implementado)
- El `OpeningBox` (hitbox invisible) ocupa el volumen del hueco completo
- `onPointerDown` sobre `OpeningBox` → selecciona + permite arrastrar

### Mover puerta/ventana a lo largo del muro

- Drag en 3D → proyecta posición sobre eje del muro (ya funciona parcialmente)
- Resultado se convierte a `{ x, y }` en doc → `translatePatch`
- Límites: la apertura no puede salir del tramo del muro (clamp con margen = halfWidth)

---

## 2. Placement correcto por tipo

### Floor (placement = 'floor')
- Posición Y en 3D: `elevationM ?? 0` desde el suelo
- Snap: al suelo por defecto, `computeWallSnap` solo si se acerca < SNAP_DIST a un muro
- Colisión: AABB contra otros floor objects (resolución suave — empuja, no bloquea)

### Ceiling (placement = 'ceiling')
- Posición Y en 3D: `ceilingHeightM - (heightM ?? 0.2)` → cuelgan del techo
- `elevationM` = distancia desde el techo hacia abajo (0 = pegado al techo)
- En 2D: se muestran con icono de techo (círculo punteado) sobre el plano
- Drag en 3D: restringido al plano XZ (`y` fijo al techo)
- Recessed lights (`recessed_light`): enrasados al techo, `y = ceilingHeightM`

### Wall-surface (placement = 'wall-surface')
- Posición: anclada al muro más cercano, `elevationM` = altura desde suelo
- En 2D: pequeño rectángulo sobre la línea del muro
- Drag en 3D: desliza sobre la superficie del muro (proyección sobre plano del muro)
- No colapsa con furniture (planos diferentes)

---

## 3. Menú contextual radial (Planner5D style)

### UX

Al seleccionar cualquier objeto en 3D → aparece corona de botones circulares sobre el objeto:

```
          [Mover ↕]
    [Copiar]     [Rotar]
  [Material]  ●  [Espejo]
    [Subir↑]     [Bajar↓]
          [Eliminar 🗑]
```

Botones disponibles según `placement`:
- **Todos:** Mover, Rotar, Copiar, Eliminar
- **floor:** Elevar (subir/bajar del suelo), Material/Color
- **ceiling:** Bajar distancia del techo, On/Off (luces), Temperatura de color (luces)
- **wall-child:** Mover a lo largo del muro, Espejo (hoja izquierda/derecha)
- **wall-surface:** Subir/bajar en el muro, On/Off (enchufes/interruptores)

### Implementación

`src/components/canvas/3d/radial-context-menu.tsx`:
- Proyecta la posición 3D del objeto al espacio de pantalla (`camera.project`)
- Renderiza `<div>` absolutamente posicionado sobre el canvas
- Se actualiza en `useFrame` para seguir al objeto si se mueve
- Desaparece al hacer clic fuera o presionar Escape

---

## 4. Colisión suave entre muebles (floor objects)

### Algoritmo

No usar physics engine completo (demasiado pesado). En cambio:

1. Al soltar un mueble (`onPointerUp`), calcular su AABB en el plano XZ
2. Buscar todos los objetos `floor` que intersecten ese AABB
3. Si hay colisión → calcular vector de separación mínima (MTV)
4. Desplazar el objeto en esa dirección (resolución de penetración)
5. Repetir máximo 3 iteraciones

Lógica pura en `src/canvas/3d/collision.ts`:
```ts
export function resolveFloorCollisions(
  item: { id: string; cx: number; cz: number; hw: number; hd: number },
  others: Array<{ id: string; cx: number; cz: number; hw: number; hd: number; rot: number }>,
): [number, number]  // posición final [x, z]
```

**Solo al soltar** (no en tiempo real durante el drag → evita jitter).

---

## 5. Gizmos de transformación mejorados

Problema actual: `TransformGizmo` usa `@react-three/drei` `TransformControls` que es potente pero confuso para usuarios no técnicos.

Propuesta: conservar `TransformControls` pero mostrar **solo los handles relevantes**:
- `floor` items: translate XZ + rotate Y (no translate Y por defecto)
- `ceiling` items: translate XZ solamente (Y fija al techo)
- `wall-child`: translate a lo largo del eje del muro solamente (1 eje)
- `wall-surface`: translate a lo largo de la superficie del muro (2 ejes restringidos)

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `src/canvas/3d/doc-to-scene.ts` | wall-child position desde parentId + eje del muro |
| `src/canvas/3d/collision.ts` | NUEVO: resolveFloorCollisions() |
| `src/canvas/3d/placement.ts` | NUEVO: posición 3D según PlacementRule |
| `src/components/canvas/3d/radial-context-menu.tsx` | NUEVO |
| `src/components/canvas/3d/opening-interaction-layer.tsx` | Refactor con wall-child model |
| `src/components/canvas/3d/furniture-layer.tsx` | Integrar collision.ts |
| `src/components/canvas/3d/ceiling-layer.tsx` | NUEVO: render de elementos de techo |
| `src/components/canvas/3d/wall-surface-layer.tsx` | NUEVO: render de enchufes, cuadros, etc. |
| `tests/canvas/3d/collision.test.ts` | NUEVO |
| `tests/canvas/3d/placement.test.ts` | NUEVO |

---

## Criterios de aceptación

- [ ] Clic en marco de puerta → selecciona la puerta (no el muro)
- [ ] Arrastrar puerta a lo largo del muro → se mueve solo en ese eje
- [ ] Puerta rota automáticamente si el muro al que pertenece está rotado
- [ ] Luz de techo colocada desde catálogo → aparece pegada al techo en 3D
- [ ] Drag de luz de techo restringido al plano XZ del techo
- [ ] Al soltar un mueble sobre otro → se empuja a posición libre (sin solapamiento)
- [ ] Menú radial aparece al seleccionar cualquier objeto en 3D
- [ ] Escape cierra el menú radial y deselecciona
- [ ] Eliminar desde menú radial funciona
- [ ] Copiar desde menú radial coloca copia desplazada 30 cm
