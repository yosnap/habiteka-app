# Fase 0 — Modelo de datos y migración

**Objetivo:** Redefinir `StructObj` para soportar todos los tipos de elemento con reglas de placement, y migrar el doc existente sin romper la suite.

---

## Contexto

El `StructObj` actual tiene `kind` hardcodeado como union type plano. No existe concepto de "este objeto pertenece a un muro" ni "este objeto va en el techo". Esto obliga a parchear cada capa 3D por separado.

---

## Cambios en `src/canvas/types.ts`

### ObjectKind actualizado

```ts
// Placement — regla que gobierna cómo se coloca en 2D y 3D
export type PlacementRule = 'floor' | 'wall-child' | 'wall-surface' | 'ceiling';

// Kinds agrupados por placement
export type FloorKind =
  | 'sofa' | 'sofa_grande' | 'armchair' | 'butaca'
  | 'chair' | 'table' | 'dining_table' | 'coffee_table'
  | 'bed' | 'wardrobe' | 'bookshelf' | 'desk' | 'tv_stand'
  | 'plant' | 'rug' | 'bathtub' | 'toilet' | 'sink'
  | 'kitchen_counter' | 'fridge' | 'nevera_americana' | 'nevera_mini'
  | 'microwave' | 'washing_machine'
  | 'spotlight' | 'floor_lamp' | 'table_lamp';  // luces de suelo/mesa

export type WallChildKind = 'door' | 'window';

export type WallSurfaceKind =
  | 'outlet' | 'switch' | 'thermostat'
  | 'wall_sconce' | 'art_frame' | 'radiator' | 'tv_mount';

export type CeilingKind =
  | 'ceiling_light' | 'ceiling_fan' | 'pendant_lamp'
  | 'recessed_light' | 'led_strip' | 'beam' | 'cornice' | 'skylight';

export type StructKind = 'wall' | FloorKind | WallChildKind | WallSurfaceKind | CeilingKind;

// Lookup: dado un kind, devuelve su placement
export function placementOf(kind: StructKind): PlacementRule | 'wall' {
  if (kind === 'wall') return 'wall';
  if ((kind as WallChildKind) === 'door' || (kind as WallChildKind) === 'window') return 'wall-child';
  if (CEILING_KINDS.has(kind as CeilingKind)) return 'ceiling';
  if (WALL_SURFACE_KINDS.has(kind as WallSurfaceKind)) return 'wall-surface';
  return 'floor';
}

export const CEILING_KINDS = new Set<StructKind>([
  'ceiling_light', 'ceiling_fan', 'pendant_lamp', 'recessed_light',
  'led_strip', 'beam', 'cornice', 'skylight',
]);

export const WALL_SURFACE_KINDS = new Set<StructKind>([
  'outlet', 'switch', 'thermostat', 'wall_sconce', 'art_frame', 'radiator', 'tv_mount',
]);
```

### StructObj actualizado

```ts
export interface StructObj {
  id: string;
  kind: StructKind;
  catalogId?: string;      // ← nuevo: ref al CatalogItem (null = builtin legacy)
  parentId?: string;       // ← nuevo: para wall-child (door/window → wall id)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  elevationM?: number;     // puertas: 0; ventanas: alféizar; wall-surface: centro; ceiling: altura
  heightM?: number;
  color?: string;
  hidden?: boolean;
  light?: LightProps;
  meta?: Record<string, unknown>;  // ← nuevo: datos específicos por kind
}
```

---

## Migración del doc existente

### Estrategia: SQL batch script (decisión validada 2026-06-24)

Script SQL que corre **una sola vez antes del despliegue de F0** sobre todos los docs en BD.

Pasos:
1. Añadir campo `version: int DEFAULT 1` a la tabla `canvas_docs` (o al JSONB del doc)
2. Para cada doc con `version = 1`:
   - Asignar `catalogId = 'builtin:' + kind` a todos los objetos
   - Para puertas/ventanas: buscar el muro más cercano geométricamente en el mismo doc y asignar `parentId`. Si no hay muro a < 150px, dejar `parentId = undefined` (fallback seguro)
   - Marcar doc con `version = 2`
3. Script idempotente: si falla a mitad, re-ejecutar es seguro (solo procesa `version = 1`)
4. Backup de BD antes de ejecutar (obligatorio)

### Función de apoyo `migrateDoc(doc: CanvasDoc): CanvasDoc`

Se conserva como función pura en `src/canvas/migrations.ts` para:
- Tests unitarios de la lógica de migración
- Migrar docs importados (JSON) que llegan sin versionar
- Validar en CI que ningún doc existente falla la migración

---

## Cambios en `src/canvas/catalog.ts`

```ts
export interface CatalogItem {
  id: string;                    // slug único: 'builtin:sofa', 'store:ikea:kivik', 'custom:uuid'
  name: string;
  category: string;              // 'living_room' | 'bedroom' | 'kitchen' | 'lighting' | ...
  subcategory?: string;          // 'sofas' | 'chairs' | 'tables' | ...
  kind: StructKind;
  placement: PlacementRule;
  thumbnailUrl: string;          // imagen de previsualización
  modelUrl?: string;             // .glb para 3D (null = usar geometría procedural)
  defaultDimensions: { wM: number; hM: number; heightM?: number };
  source: 'builtin' | 'custom' | 'store';
  storeInfo?: { store: string; productId: string; price?: number; productUrl?: string };
  tags?: string[];
}
```

Función `getCatalogItems(): CatalogItem[]` que retorna todos los items (builtin + custom desde BD).

---

## Rework del modelo de muros (wall segments)

### Problema del modelo actual

Los muros actuales se almacenan como rectángulos rotados (`StructObj` con `kind: 'wall'`, `x/y/width/height/rotation`). Esto causa:

1. **Colisiones**: dos rectángulos pueden superponerse aunque visualmente parezcan unidos
2. **"Ordenar bordes" frágil**: para calcular el polígono del suelo hay que reconstruir qué extremos de qué rectángulos están conectados → fuente de bugs
3. **Puertas/ventanas sin parentId real**: sin saber cuáles son los dos puntos del muro, no se puede posicionar una puerta sobre el segmento de forma robusta

### Nuevo modelo: `WallSegment`

```ts
// Sustituye al StructObj con kind:'wall'
export interface WallSegment {
  id: string;           // UUID
  p1: Point2D;          // extremo A del muro en coordenadas canvas
  p2: Point2D;          // extremo B del muro en coordenadas canvas
  thicknessPx: number;  // grosor en px canvas (default: equiv. a 15 cm)
  heightM?: number;     // altura en metros (default: 2.6)
  color?: string;
  material?: string;
  meta?: Record<string, unknown>;
}

export interface Point2D { x: number; y: number; }
```

### `CanvasDoc` actualizado

```ts
export interface CanvasDoc {
  version: number;
  walls: WallSegment[];    // ← NUEVO: antes eran StructObj con kind:'wall'
  objects: StructObj[];    // muebles, puertas, ventanas, luces, etc.
  zones?: Zone[];
  rooms?: DetectedRoom[];  // ← NUEVO: derivado automáticamente (no se guarda en BD, se calcula)
}

// Un "room" es un ciclo cerrado de WallSegments detectado automáticamente
// Se usa para render del suelo y cálculo de m²
export interface DetectedRoom {
  id: string;
  segmentIds: string[];   // IDs de segmentos que forman el contorno
  vertices: Point2D[];    // polígono ya ordenado — derivado, no manual
  areaM2: number;
  name?: string;
}
```

### Por qué desaparece "Ordenar bordes"

Con el modelo de segmentos, el polígono de la sala es simplemente:

```
roomGraph = grafo donde los nodos son los extremos snapeados de los segmentos
           (dos extremos que difieren < SNAP_THRESHOLD se consideran el mismo nodo)
ciclosCerrados = encontrar todos los ciclos en el grafo
→ cada ciclo es un Room automáticamente
```

No se necesita "ordenar bordes" a mano. Si el usuario dibuja un contorno cerrado → sala. Si deja un hueco → no hay sala (se le avisa). Esto es exactamente lo que hace Planner5D.

### Draw Walls en el nuevo modelo

```
Click 1: crear nodo A en (x₁, y₁)
Click 2: crear WallSegment {p1: A, p2: B}
  → si B está a < SNAP_THRESHOLD de un nodo existente C, usar C (snap automático)
  → si B == A (primer click), cerrar el polígono
Click 3: crear WallSegment {p1: B, p2: C}
...
```

No hay colisiones posibles porque los segmentos son líneas. El "cruce" de dos segmentos no superpone geometría — es solo un nodo compartido.

### Migración de docs existentes

Los docs actuales tienen `objects` con `kind: 'wall'` y `{x, y, width, height, rotation}`. La función `migrateDoc()` convertirá:

```
wallRect → WallSegment:
  p1 = { x: rect.x,                y: rect.y + rect.height/2 }  // centro extremo izquierdo
  p2 = { x: rect.x + rect.width,   y: rect.y + rect.height/2 }  // centro extremo derecho
  luego rotar p1/p2 alrededor del centro del rectángulo por rect.rotation
  thicknessPx = rect.height
```

Esta conversión es exacta para muros horizontales/verticales (los más comunes). Para muros diagonales es una aproximación — el muro migrado puede tener endpoints ligeramente distintos a los originales, pero el contorno visual será prácticamente idéntico.

Después de migrar, se re-ejecuta la detección de ciclos para generar `rooms[]`.

---

## Tests a escribir

- `placementOf('door')` → `'wall-child'`
- `placementOf('ceiling_light')` → `'ceiling'`
- `placementOf('sofa')` → `'floor'`
- `migrateDoc`: un doc con puertas asigna `parentId` al muro correcto
- `migrateDoc`: objetos de suelo preservan todos sus campos
- `migrateDoc`: muros rectángulos se convierten a `WallSegment` con endpoints correctos
- `detectRooms`: 4 segmentos que forman un cuadrado → 1 room detectado
- `detectRooms`: polígono L (6 segmentos) → 1 room detectado
- `detectRooms`: 3 segmentos en U sin cerrar → 0 rooms detectados

---

## Archivos a modificar

| Archivo | Acción |
|---------|--------|
| `src/canvas/types.ts` | Actualizar StructKind, StructObj, añadir WallSegment, CanvasDoc, Point2D |
| `src/canvas/catalog.ts` | Reemplazar CATALOG array con CatalogItem[] |
| `src/canvas/scale.ts` | Adaptar a nuevas dimensiones y WallSegment |
| `src/canvas/wall-graph.ts` | NUEVO: detectRooms(), snapEndpoints(), findCycles() |
| `src/canvas/migrations.ts` | NUEVO: migrateDoc() — incluye conversión wall rect → WallSegment |
| `tests/canvas/types.test.ts` | NUEVO: tests de placementOf |
| `tests/canvas/migrations.test.ts` | NUEVO: tests de migrateDoc y conversión de muros |
| `tests/canvas/wall-graph.test.ts` | NUEVO: tests de detectRooms |

---

## Estado: ✅ HECHO (2026-06-24)

## Criterios de aceptación

- [x] `placementOf()` devuelve el placement correcto para todos los kinds
- [x] `migrateDoc()` no rompe ningún doc existente (snapshot test en migrations.test.ts)
- [x] `WallSegment` exportado y tipado correctamente en `types.ts`
- [x] `detectRooms()` detecta correctamente salas cuadradas, L, U y T (wall-graph.test.ts)
- [x] Docs migrados de v1 → v2 tienen `walls: WallSegment[]` derivados de los muros existentes
- [x] `CatalogItem` exportado y tipado correctamente
- [x] Suite completa pasa sin regresión (665 tests verdes)
