# F-LUZ · Luces de primera clase + render con iluminación

**Estado: ✅ COMPLETADA (modelo/UI/prompt); render con luces PENDIENTE de validación del usuario
vía prototipo.** Rama: `feat/canvas/decoracion-materiales-luces`. Diferenciador.
Verificado: typecheck OK, eslint OK, 64 tests canvas (light.ts, serialize de light, prompt con luz).
Code-review agrupado con la tanda. El VÍDEO queda fuera (sub-fase futura).

## Objetivo

Las luces/focos no son un mueble: llevan color e intensidad. Modelarlas como objeto colocable con
esos atributos; la IA puede recomendarlas (F4) y el PROMPT del render las incorpora para que el
render refleje la iluminación. El VÍDEO con las luces "funcionando" queda FUERA (sub-fase futura).

## Decisiones tomadas con el usuario

- **Modelo = `StructObj.light?` opcional**, NO un tipo aparte. Las luces son kinds del catálogo
  (F-CAT) que además llevan `light: { color; intensidad }`. Todo el pipeline (store, serialize,
  selección, mover, formas) las trata como cualquier objeto; solo el render y un panel de UI miran
  `light`. Máxima reutilización (DRY, principio de escalabilidad).
- **Render con luz: modelo + UI + prompt ahora; la validación visual la hace el usuario** con un
  prototipo (sus claves), como en F2. El vídeo es sub-fase futura.

## Modelo

```ts
// types.ts
export interface LightProps { color: string; intensidad: number } // intensidad 0–100
// StructObj gana: light?: LightProps
export type LightKind = 'foco'
```

## Archivos a modificar/crear

- `src/canvas/types.ts` — `LightProps`, `LightKind = 'foco'` sumado a `StructKind`, `light?` en StructObj.
- `src/canvas/catalog.ts` — categoría `iluminacion` con `foco` (la `lampara` actual sigue en electrónica;
  el `foco` es la luz de 1ª clase con atributos).
- `src/canvas/light.ts` (nuevo) — helpers puros: `defaultLight()`, `describeLight(props)` para el prompt,
  `isLight(kind)`.
- `src/canvas/serialize.ts` — `parseStruct` parsea `light` defensivo (color string, intensidad 0–100).
- `src/components/canvas/object-shapes.tsx` — forma del `foco` (usa su color si lo tiene).
- `src/components/canvas/canvas-toolbar.tsx` — si el seleccionado es luz, panel color + intensidad
  (acción `updateObjects` con el patch `light`).
- `src/canvas/serialize-doc-to-prompt.ts` — describe las luces colocadas ("foco cálido, intensidad alta,
  en la esquina") en el prompt del render.
- `tests/spikes/vistas-por-angulo.spike.ts` o un spike nuevo — variante con luces para validar el render.

## TDD / Validación

- TDD piezas puras: `light.ts` (defaultLight, describeLight, isLight); parse defensivo de `light` en
  serialize (color/intensidad fuera de rango → acotado/omitido); `serialize-doc-to-prompt` describe
  luces solo si hay objetos-luz. Catálogo: el guardrail de F-CAT cubre que `foco` tenga entrada.
- NO se testea la calidad del render con luz (IA → prototipo visual del usuario).
- Verificación: typecheck, eslint, tests focales.

## Riesgos y rollback

- `light?` aditivo y opcional → no rompe objetos existentes; rollback = ignorarlo.
- El render con luz puede no reflejar bien la iluminación (riesgo de IA) → por eso el prototipo
  ANTES de prometerlo en producto. Aunque el render no respete la luz, el modelo/UI de luces es
  útil igual (lo aprovechará F6 3D real, que sí ilumina por geometría).

## Fuera de alcance (anotado)

- **Vídeo** con las luces encendidas (Veo/Hailuo) → sub-fase futura (coste + storage + modelo nuevo).
- Dirección/haz de la luz (spot vs. ambiente) → primera versión solo color + intensidad.
- Simulación física de la luz en el plano 2D → eso es F6 (3D real).

## Checklist de entrega

- [x] `LightProps` + `LightKind` + `light?` en StructObj; `foco` en el catálogo (categoría iluminación).
- [x] `light.ts` puro (defaultLight, describeLight, isLight, clampIntensity) + tests.
- [x] serialize parsea `light` defensivo (acota intensidad, descarta sin color) + tests round-trip.
- [x] forma del `foco` (usa su color) en object-shapes; alta con `defaultLight()` en el stage.
- [x] panel de color/intensidad en la toolbar para luces (`light-controls.tsx`).
- [x] el prompt del render describe las luces colocadas + pide reflejarlas + tests.
- [ ] prototipo de render con luces (`tests/spikes/render-con-luces.spike.ts`) — LO EJECUTA EL USUARIO.
- [x] Verificación: typecheck, eslint, tests focales.
