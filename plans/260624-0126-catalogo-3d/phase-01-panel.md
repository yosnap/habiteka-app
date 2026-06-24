# F1: Panel de catálogo en overlay 3D

## Contexto

- Overlay 3D: `src/components/canvas/3d/plan-3d-overlay.tsx`
- Ya tiene `use3DSelection` → `{ select, setMode }`, `sceneCoords`, `doc` en vivo
- `addObject` del store ya existe y es suficiente

## Archivos

| Acción | Archivo |
|--------|---------|
| NUEVO | `src/components/canvas/3d/catalog-panel-3d.tsx` |
| MODIFICA | `src/components/canvas/3d/plan-3d-overlay.tsx` |

## Implementación

### `catalog-panel-3d.tsx`

Componente presentacional + lógica de inserción.

```
Props:
  doc: CanvasDoc                       ← para calcular centro y escala
  onAdd: (kind: StructKind) => void    ← callback al hacer clic
```

Internamente:
- Estado local `[openCategory, setOpenCategory]` (string | null)
- Filtra `CATALOG` excluyendo la categoría `'estructura'`
- Renderiza tabs de categoría (horizontal o vertical compact)
- Renderiza grid de ítems del tab activo (texto + icono emoji del catálogo si existe, si no solo label)

Posición en pantalla: `absolute left-4 top-1/2 -translate-y-1/2 z-10`  
Panel abierto: panel blanco semitransparente con lista de categorías + ítems  
Botón toggle: `+` (cuando cerrado) / `×` (cuando abierto), redondeado, sobre el panel

### `plan-3d-overlay.tsx` — cambios

1. Importar `CatalogPanelFrom3D` (nuevo componente)
2. Importar `CATALOG`, `catalogSizePx` de `canvas/scale`, `isLight` + `defaultLight` de `canvas/light`
3. Leer `addObject` del store
4. Función `handleAdd(kind)`:

```ts
const handleAdd = (kind: StructKind) => {
  const entry = CATALOG.flatMap(c => c.items).find(i => i.kind === kind);
  if (!entry) return;
  const { w, h } = catalogSizePx(entry, { pxPerMeter: sceneCoords.pxPerMeter });
  const [cx, cy] = sceneCoords.planCenterPx;
  const id = `obj-${crypto.randomUUID()}`;
  addObject({
    id, kind,
    x: cx - w / 2,
    y: cy - h / 2,
    width: w, height: h,
    rotation: 0,
    ...(isLight(kind) ? { light: defaultLight() } : {}),
  });
  select(id);
  setMode('translate');
};
```

5. Montar `<CatalogPanelFrom3D doc={doc} onAdd={handleAdd} />` dentro del `<div className="fixed inset-0 ...">` junto al resto de controles.

## Criterios de verificación

- [ ] TypeScript sin errores (`npx tsc --noEmit`)
- [ ] ≥ 601 tests en verde
- [ ] Clic en ítem del catálogo → objeto aparece en 3D
- [ ] Gizmo translate activo automáticamente tras añadir
- [ ] Panel se abre/cierra con el botón `+`/`×`
- [ ] Categoría `estructura` NO aparece en el panel 3D

## Riesgos

- `catalogSizePx` requiere `CanvasScale` (`{ pxPerMeter }`): disponible en `sceneCoords` ✓
- Si `doc` no tiene objetos (sala vacía), `planCenterPx` = `[0, 0]` → el objeto aparece en el origen del plano (aceptable)
