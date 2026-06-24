# Fase 1 — Catálogo extensible

**Depende de:** Fase 0  
**Objetivo:** Panel de catálogo con categorías + fotos reales, soporte para items custom, y la infraestructura que permitirá integrar tiendas externas (IKEA, etc.) sin cambios arquitectónicos.

---

## UX objetivo (referencia Planner5D)

Panel lateral izquierdo, siempre visible tanto en 2D como en 3D:

```
┌─────────────────────────┐
│ 🔍  Buscar...           │
├─────────────────────────┤
│ [foto grande]           │
│  Sala de estar  >       │
├─────────────────────────┤
│ [foto grande]           │
│  Dormitorio     >       │
├─────────────────────────┤
│ [foto grande]           │
│  Cocina         >       │
├─────────────────────────┤
│ [foto grande]           │
│  Iluminación    >       │
├─────────────────────────┤
│ + Añadir elemento       │  ← upload custom
└─────────────────────────┘

Al entrar en categoría:
┌─────────────────────────┐
│ ← Sala de estar         │
│ 🔍  Buscar...           │
├──────────┬──────────────┤
│ [foto]   │ [foto]       │
│ Sofás    │ Sillones     │
├──────────┼──────────────┤
│ [foto]   │ [foto]       │
│ Mesas    │ Almacenaje   │
└──────────┴──────────────┘

Al entrar en subcategoría → grid de items con foto real:
┌──────┬──────┬──────┐
│[img] │[img] │[img] │
│Sofá  │Sofá L│Sofá U│
│      │      │      │
│90×80 │160×80│200×80│
└──────┴──────┴──────┘
```

Drag desde el grid → suelta en el canvas 2D o en la escena 3D.

---

## Categorías de catálogo

| category | subcategorías | placement |
|----------|--------------|-----------|
| living_room | sofas, armchairs, tables, storage, lighting, rugs | floor / ceiling |
| bedroom | beds, wardrobes, nightstands, desks, lighting | floor / ceiling |
| dining | tables, chairs, storage | floor |
| kitchen | counters, appliances, stools | floor |
| bathroom | bathtub, toilet, sink, towel_rack | floor / wall-surface |
| lighting | ceiling, floor_lamp, wall_sconce, pendant | ceiling / floor / wall-surface |
| decoration | plants, art, rugs, cushions, vases | floor / wall-surface |
| structure | doors, windows, stairs | wall-child |
| architecture | outlets, switches, cornices, beams, led_strip | wall-surface / ceiling |

---

## Arquitectura backend

### Tabla `catalog_items` (PostgreSQL/Drizzle)

```sql
catalog_items (
  id          text PRIMARY KEY,         -- 'builtin:sofa_grande', 'org:uuid', 'store:ikea:xyz'
  org_id      text REFERENCES orgs,     -- null = builtin global
  name        text NOT NULL,
  category    text NOT NULL,
  subcategory text,
  kind        text NOT NULL,            -- StructKind
  placement   text NOT NULL,            -- PlacementRule
  thumbnail_url text NOT NULL,
  model_url   text,                     -- .glb en S3/R2
  width_m     real NOT NULL,
  height_m    real NOT NULL,            -- profundidad (depth)
  height_3d_m real,                     -- altura vertical en 3D
  source      text NOT NULL DEFAULT 'builtin',
  store_name  text,
  store_product_id text,
  store_price real,
  store_url   text,
  tags        text[],
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
)
```

### API Routes

```
GET  /api/catalog                     → lista categorías con conteo
GET  /api/catalog/[category]          → items de una categoría
GET  /api/catalog/search?q=sofa       → búsqueda full-text
POST /api/catalog/custom              → subir item custom (multipart: thumbnail + glb)
GET  /api/catalog/item/[id]           → detalle de un item
```

---

## Upload de item custom

Flujo:
1. Usuario hace clic en "＋ Añadir elemento" 
2. Modal: nombre, categoría, placement, foto (JPG/PNG), modelo 3D (GLB, opcional)
3. Upload foto a R2 → thumbnail_url
4. Upload GLB a R2 → model_url (si se proporciona)
5. Insert en `catalog_items` con `org_id` del usuario y `source: 'custom'`
6. Aparece inmediatamente en el catálogo

### Validaciones GLB (decisión validada: incluir en Fase 1 con controles básicos)

Server-side en la API route de upload:
- **Tipo**: verificar magic bytes `glTF` (primeros 4 bytes = `0x676C5446`) — no confiar solo en extensión
- **Tamaño**: máximo **25 MB** por archivo GLB
- **Timeout**: procesamiento máximo 30s; si supera → rechazar con error claro
- **Rate limit**: máximo 10 uploads por org por hora
- **Org scope**: `org_id` se extrae siempre del JWT de sesión, nunca del body del request

El GLB se sirve directamente desde R2. No se procesa con Draco en Fase 1 (se añade en Fase 1b si hay problemas de rendimiento documentados con usuarios reales).

---

## Infraestructura tiendas externas (sin implementar aún)

El modelo de datos ya lo soporta con `source: 'store'` y `store_*` fields. La integración real (crawler IKEA, Wayfair API, etc.) es Fase 5. Lo que preparamos ahora:

- Columnas `store_*` en BD
- Componente `<StoreLabel />` que muestra precio + logo de tienda
- Botón "Ver en tienda" que abre la URL del producto
- Import manual: CSV con columnas name, category, thumbnail_url, model_url, price, store_url

---

## Plantillas de diseño (referencia: Planner5D "Comience con plantillas")

Una plantilla es un `CanvasDoc` completo pre-construido + un render fotorrealista de thumbnail.  
El usuario selecciona una → se crea una copia como nuevo proyecto (no modifica la plantilla original).

### Tabla `project_templates`

```sql
project_templates (
  id           text PRIMARY KEY,
  name         text NOT NULL,           -- "Dormitorio moderno", "Cocina abierta"...
  category     text NOT NULL,           -- "bedroom" | "living_room" | "kitchen" | "full_house"
  thumbnail_url text NOT NULL,          -- render fotorrealista (IA-generado o manual)
  doc_json     jsonb NOT NULL,          -- CanvasDoc serializado (muros + muebles + zonas)
  is_global    boolean DEFAULT true,    -- false = plantilla privada de una org
  org_id       text REFERENCES orgs,   -- null si is_global
  tags         text[],
  active       boolean DEFAULT true
)
```

### UX — Modal "Empieza con una plantilla"

Se muestra al crear nuevo proyecto (antes del editor):

```
┌─────────────────────────────────┐
│  Empieza desde cero             │  ← botón principal
│  o elige una plantilla:         │
├────────────┬────────────────────┤
│ [render]   │ [render]           │
│ Dormitorio │ Salón moderno      │
├────────────┼────────────────────┤
│ [render]   │ [render]           │
│ Cocina abi.│ Oficina en casa    │
└────────────┴────────────────────┘
```

Al elegir plantilla → `POST /api/projects` con `{ templateId }` → BD crea nuevo proyecto copiando el `doc_json` de la plantilla → redirige al editor con el doc pre-cargado.

### Plantillas iniciales (builtin, a crear manualmente)

| Plantilla | Habitaciones | Muebles aprox. |
|-----------|-------------|----------------|
| Dormitorio principal | 1 | cama, mesitas, armario, escritorio |
| Salón con comedor | 2 zonas | sofá, TV, mesa dining, sillas |
| Cocina abierta | 1 | encimeras, isla, electrodomésticos |
| Estudio/oficina | 1 | escritorio, silla, estantería |
| Apartamento estudio | open plan | todo en un espacio |

Los thumbnails se generan haciendo un render IA del doc de la plantilla (flujo ya existente de Fase 4).

---

## Panel lateral — sección "Construcciones" (referencia Planner5D)

El panel tiene dos secciones diferenciadas:

**Sección "Construir"** (siempre arriba):
- **Smart Wizard** — flujo guiado 3 pasos (nuevo, ver sección siguiente)
- **Habitaciones** — añadir nueva sala con Smart Wizard
- **Dibujar paredes** — dibujo libre (wizard existente, se conserva)
- Construcciones: puertas, ventanas, escaleras, arcadas, chimeneas, columnas, tabicas, tejados

**Sección "Amueblar"** (categorías de catálogo):
- Sala de estar, Dormitorio, Cocina, Baño, Iluminación, Decoración...

La sección "Construcciones" mapea a `WallChildKind` + structural kinds del modelo de datos de F0.

---

## Smart Wizard — flujo guiado de 3 pasos

El Smart Wizard es una alternativa al dibujo libre que guía al usuario en 3 pasos:

```
Paso 1 de 3: Elegir la forma de la habitación
┌──────────────────────────────────────────────┐
│  [□] [⌐] [◺]                                │  ← 6 formas: rectangular, L, diagonal,
│  [⌐] [⊓] [◸]                                │    U, T, esquina curva                  │
│                                              │
│  ↺ Girar                                    │
│  ↔ Girar horizontalmente                    │
│  ↕ Girar verticalmente                      │
│                                              │
│  [Preview 2D en tiempo real — 5m × 5m]      │
│                                              │
│  [Volver]    Paso 1 de 3    [Siguiente paso →]│
└──────────────────────────────────────────────┘

Paso 2 de 3: Añadir las dimensiones de la habitación
┌──────────────────────────────────────────────┐
│  ——●——  [500.00 cm]  (ancho)                │
│  ——●——  [500.00 cm]  (profundidad)          │
│  [Cm] [Inch]                                │
│                                              │
│  [Preview 2D actualizado con las dimensiones]│
│  Los muros resaltados en naranja/azul        │
│                                              │
│  [Volver]    Paso 2 de 3    [Siguiente paso →]│
└──────────────────────────────────────────────┘

Paso 3 de 3 (Último paso): Tipo y estilo de habitación
┌────────────────────────────────────────────────────┐
│ [Salón] [Cocina] [Dormitorio ✓] [Despacho] [Baño]  │  ← tabs de tipo
│ [Infantil] ...                                      │
├────────┬──────────────────────────────────────────┤
│[foto]  │ ╔══════════════════════════════════╗    │
│ mod.1  │ ║  Preview 3D isométrico           ║    │
│[foto]  │ ║  (se rellena con muebles         ║    │
│ clas.  │ ║   del estilo seleccionado)       ║    │
│[foto]  │ ║                                  ║    │
│ boho   │ ║   🔄 Creando magia...            ║    │  ← spinner mientras carga
│[foto]  │ ╚══════════════════════════════════╝    │
│ rust.  │          ↺ Aleatorio                    │  ← redistribuye sin cambiar estilo
└────────┴──────────────────────────────────────────┘
│  [Volver]          Último paso          [Completo ✓]│
└──────────────────────────────────────────────────────┘
```

### Comportamiento por paso

**Paso 1 — Forma:**
- 6 iconos de forma (las mismas formas L/U/T que ya soporta Draw Walls)
- 3 botones: Girar, Girar horizontalmente, Girar verticalmente
- El canvas 2D muestra preview en tiempo real
- Al hacer clic en "Siguiente" se fija la forma y se pasa al paso 2

**Paso 2 — Dimensiones:**
- Dos sliders: ancho y profundidad (rango 200 cm – 2000 cm)
- Toggle Cm / Inch (convierte y muestra en la unidad elegida)
- Los muros del preview se resaltan en colores para indicar cuál dimensión corresponde a cada eje
- Al cambiar slider → el canvas 2D se redibuja con las nuevas dimensiones

**Paso 3 — Tipo y estilo:**
- Tabs horizontales: Salón, Cocina, Dormitorio, Despacho, Cuarto de baño, Habitación infantil, Estudio, Comedor...
- Grid de fotos de estilo (fotos reales de interiores, no renders del producto)
- Al seleccionar foto → se ejecuta auto-amueblado procedural (lógica existente, adaptada al tipo de habitación) → preview 3D se actualiza
- Spinner "Creando magia..." durante el cálculo del auto-amueblado
- Botón **"Aleatorio"** → llama de nuevo al auto-amueblado con seed diferente → nuevo layout de muebles sin cambiar forma ni estilo
- Al hacer clic en "Completo" → el wizard cierra y el doc queda guardado

### Fotos de estilo

Las fotos del grid son referencias visuales, no se usan en renders. Son imágenes estáticas (JPG) que categorizan un conjunto de muebles:
- `style_id`: clave interna (ej. `bedroom_modern_1`, `bedroom_classic_2`)
- Al seleccionar un estilo, el auto-amueblado filtra el catálogo por `category = tipo` y `tags includes style_id`
- Las fotos se almacenan en `public/styles/` o en R2 — no requieren BD

### "Habitaciones" — añadir sala adicional

Botón "Habitaciones" en el panel Construya:
- Abre el Smart Wizard en Paso 1 (forma)
- Al completar, la nueva sala se añade al canvas como un segundo contorno independiente
- El usuario puede arrastrar para posicionar las salas entre ellas
- Las salas comparten el mismo `CanvasDoc` (array de objetos)

### Datos generados por el wizard

El wizard produce un `CanvasDoc` parcial con:
- Los muros del contorno (kind: 'wall')
- Los muebles auto-colocados (kind: FloorKind, con `catalogId` del catálogo)
- Una zona automática (kind: 'zone') con el nombre del tipo de habitación
- Una puerta de entrada colocada en el muro más largo (kind: 'door')

---

## Componentes a crear/modificar

| Componente | Descripción |
|-----------|-------------|
| `src/components/catalog/catalog-sidebar.tsx` | Panel principal — sección Construir + sección Amueblar |
| `src/components/catalog/construir-section.tsx` | NUEVO: Smart Wizard, Habitaciones, Dibujar paredes, construcciones |
| `src/components/wizard/smart-wizard.tsx` | NUEVO: flujo 3 pasos (forma → dimensiones → tipo+estilo) |
| `src/components/wizard/step-shape.tsx` | NUEVO: paso 1 — 6 formas + girar/voltear + preview 2D |
| `src/components/wizard/step-dimensions.tsx` | NUEVO: paso 2 — sliders ancho/prof + toggle cm/inch |
| `src/components/wizard/step-style.tsx` | NUEVO: paso 3 — tabs tipo + grid fotos + preview 3D + Aleatorio |
| `src/components/catalog/category-grid.tsx` | Grid de subcategorías con foto |
| `src/components/catalog/item-grid.tsx` | Grid de items con foto, nombre, tamaño |
| `src/components/catalog/item-card.tsx` | Card individual — foto, nombre, tamaño, precio (si store) |
| `src/components/catalog/upload-item-modal.tsx` | Modal para subir item custom |
| `src/components/catalog/store-label.tsx` | Badge de tienda + precio |
| `src/components/templates/template-picker-modal.tsx` | NUEVO: modal "Empieza con plantilla" |
| `src/app/api/catalog/route.ts` | API routes del catálogo |
| `src/app/api/templates/route.ts` | NUEVO: GET lista plantillas, POST usar plantilla |
| `src/canvas/catalog.ts` | Reescribir: delegar a API, cache local |

---

## Criterios de aceptación

**Panel y catálogo:**
- [ ] Panel lateral visible en 2D (siempre) y en overlay 3D
- [ ] Sección "Construir" diferenciada: Smart Wizard, Habitaciones, Dibujar paredes, construcciones
- [ ] Draw Walls (libre) se conserva intacto — ambos modos coexisten
- [ ] Navegación: Categorías → Subcategorías → Items con foto
- [ ] Búsqueda en tiempo real sobre nombre y tags
- [ ] Drag desde item card → suelta en canvas 2D coloca el elemento
- [ ] Drag desde item card → suelta en escena 3D coloca en posición
- [ ] "Añadir elemento" → upload foto + GLB → aparece en catálogo
- [ ] Items custom visibles solo para la org del usuario
- [ ] Columnas store_* presentes en BD (sin UI de integración aún)
- [ ] Modelo GLB custom se renderiza en 3D si se sube

**Smart Wizard:**
- [ ] 3 pasos navegables con Volver / Siguiente / Completo
- [ ] Paso 1: 6 formas + girar/voltear + preview 2D actualiza al instante
- [ ] Paso 2: sliders de dimensiones (200–2000 cm) + toggle cm/inch + preview actualiza
- [ ] Paso 3: tabs de tipo (≥ 6 tipos) + grid de fotos de estilo + preview 3D
- [ ] Spinner "Creando magia..." mientras se calcula el auto-amueblado
- [ ] Botón "Aleatorio" redistribuye muebles sin cambiar forma ni estilo
- [ ] "Completo" guarda el doc en el canvas y cierra el wizard
- [ ] "Habitaciones" abre el wizard para añadir una sala adicional al mismo doc
- [ ] El Smart Wizard y el Draw Walls libre son independientes — ninguno deshabilita el otro

**Plantillas:**
- [ ] Modal "Empieza con plantilla" aparece al crear nuevo proyecto
- [ ] Seleccionar plantilla crea una copia del doc como nuevo proyecto
- [ ] Al menos 5 plantillas builtin disponibles con thumbnail
