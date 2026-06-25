# Plan: Restructuración Editor Profesional (Habiteka 2.0)

**Estado:** VALIDADO — predict CAUTION → ajustes aplicados (2026-06-24)  
**Rama base:** fix/asistente-atasco-generacion → después de revisión → main  
**Referencia visual:** Planner5D  
**Objetivo:** Editor de interiores profesional, escalable, comercializable

---

## Diagnóstico del estado actual

### Qué funciona y se conserva
- Wizard Draw Walls (cotas, snap, formas L/U/T)
- Canvas store (Zustand + undo/redo)
- Render 3D base (Three.js + R3F, 60fps)
- Generación IA de vistas (img2img)
- Tests de lógica pura (>600 passing)

### Qué está roto o es insuficiente
- **Muros como rectángulos rotados** → colisiones posibles, "ordenar bordes" frágil (bug raíz)
- Puertas/ventanas como objetos independientes → selección fallida en 3D
- Catálogo hardcoded → imposible extender sin código
- Snapping agresivo → muebles se incrustan en paredes
- Luces no tienen posición en techo → flotan libremente
- Sin menú contextual 3D → UX pobre
- Sin colliders → objetos se solapan
- Sin exportación profesional

---

## Modelo de datos objetivo (Arquitectura base)

Todo el sistema gira en torno a un `SceneObject` tipado por `placement`:

```
SceneObject {
  id: string (UUID)
  catalogId: string          ← referencia al catálogo (no kind hardcoded)
  kind: ObjectKind           ← tipo semántico (ver abajo)
  placement: PlacementRule   ← 'floor' | 'wall' | 'ceiling' | 'wall-child'
  x, y: number               ← posición canvas 2D
  width, height: number      ← tamaño canvas 2D
  rotation: number
  elevationM?: number        ← altura desde suelo (aplica a wall y ceiling)
  parentId?: string          ← para wall-child (puerta/ventana → muro)
  meta: Record<string, unknown>  ← datos específicos: color, material, power, etc.
}
```

### ObjectKind por placement

| placement    | kinds                                              |
|-------------|-----------------------------------------------------|
| floor       | sofa, chair, table, bed, wardrobe, plant, rug, ...  |
| wall-child  | door, window                                        |
| wall        | outlet, switch, sconce, art, radiator, thermostat   |
| ceiling     | ceiling_light, fan, beam, cornice, skylight         |

---

## Decisiones validadas (predict 2026-06-24)

| Decisión | Elegido |
|----------|---------|
| Orden de fases | **F0 → F2 → F1 → F3 → F4** (3D antes que catálogo) |
| Migration docs en BD | **SQL batch script** antes de desplegar F0 |
| GLB upload | **Fase 1 con validaciones básicas** (size, MIME, timeout) |
| Timeline objetivo | **16–21 días** (ambicioso, sin interrupciones) |

---

## Secuencia de implementación

```
F0 (Modelo datos + migration SQL)
└── F2 (Interacción 3D) ─────────── F4 (Vistas y exportación)
    └── F1 (Catálogo) ───────────── F3 (Elementos avanzados)
                └── F5 (Tiendas) [FUTURO]
```

F2 empieza cuando F0 tiene los tipos definidos (día 3 aprox).  
F1 empieza cuando F2 tiene el wall-child model estable.

---

## Fases

| Fase | Nombre | Dependencias | Esfuerzo est. | Estado |
|------|--------|-------------|--------------|--------|
| F0 | [Modelo de datos + WallSegment + migration SQL](fase-00-modelo-datos.md) | ninguna | 3–4 días | ✅ HECHO (2026-06-24) |
| F2 | [Interacción 3D correcta](fase-02-interaccion-3d.md) | F0 | 4–5 días | 🔶 PARCIAL (2026-06-24) |
| F1 | [Catálogo extensible](fase-01-catalogo-extensible.md) | F0 | 4–5 días | 🔶 PARCIAL (2026-06-24) |
| F3 | [Elementos avanzados (techo, pared)](fase-03-elementos-avanzados.md) | F1, F2 | 3–4 días | PENDIENTE |
| F4 | [Vistas profesionales y exportación](fase-04-vistas-exportacion.md) | F2 | 3–4 días | PENDIENTE |
| F5 | [Integración tiendas externas](fase-05-integracion-tiendas.md) | F1 | TBD | FUTURO |

**Total objetivo F0–F4:** 17–23 días (F0 expandida por rework de WallSegment).

---

## Qué NO se rehace desde cero

Para evitar tirar trabajo funcionando:

| Subsistema | Acción |
|-----------|--------|
| Draw Walls wizard | Se conserva tal cual |
| Canvas store (Zustand + undo/redo) | Se conserva, se añaden campos a StructObj |
| Three.js + R3F render base | Se conserva, se añaden layers (ceiling, wall-surface) |
| Generación IA img2img | Se mejora el flujo, no se rehace |
| Sistema de zonas y multizona | Se conserva |
| Auth / proyectos / BD base | Se conserva, solo se añade tabla catalog_items |
| Tests de lógica pura existentes | No regresión: deben seguir pasando |

---

## Aceptación global del proyecto

- [ ] Puerta/ventana seleccionable y movible en 3D sin bugs
- [ ] Luz de techo anclada al techo, no flotando
- [ ] Catálogo con categorías + fotos navegable, añadir item custom funciona
- [ ] Muebles no se solapan entre ellos al soltar (colisión soft)
- [ ] Menú contextual radial sobre objeto seleccionado en 3D (mover, rotar, copiar, eliminar)
- [ ] Export: render IA en lote + PDF con planta y alzados
- [ ] Link de sharing para clientes (solo lectura, embed 3D)
- [ ] Infraestructura lista para integración IKEA / tiendas externas (Fase 5)
- [ ] Tests de lógica pura ≥ 600 sin regresión en ninguna fase
