# Fase 3 · Tiras LED: geometría, foseado y tramo libre

Esfuerzo: 9h · Depende de: fase 1 · Estado: pending

## Contexto

No existe nada de tiras. Lo aprovechable:
- `ceilingSurfaces` (`ceiling-geometry.ts:19`) da contorno de estancia y altura
  libre de cada techo, con el mínimo de 2,10 m (`:31`).
- `Ceiling.kind === 'suspended'` con `dropMm ≥ 80` es precisamente el falso
  techo donde cabe el foseado (`ceiling-validation.ts:17`).
- El presupuesto de luces reales es `MAX_LUMINAIRE_LIGHTS = 12`
  (`ceiling-scene-utils.ts:5`), repartido hoy solo entre luminarias
  (`ceiling-lighting-meshes.tsx:68`).
- El patrón de dibujo de polilíneas ya está resuelto en
  `render-region-draw.ts` (cierre, autointersección, límite de vértices) y en
  el trazado de tramos de cocina (`addKitchenRun`, `kitchen-run-commands.ts:24`,
  traza de punto a punto con longitud mínima).

Esta fase entrega dos de los tres tipos: `cove` (foseado) y `free` (tramo
libre). `under-cabinet` va en la fase 4 porque depende de los módulos altos.

## Requisitos

1. **Foseado**: un botón por estancia crea la tira `cove` del techo activo,
   sin pedir recorrido. Requiere `Ceiling.kind === 'suspended'` y `dropMm ≥ 80`;
   si no, el botón se deshabilita con el porqué (como ya hace el foco
   empotrado, `ceiling-lighting-panel.tsx` botón `recessed`).
2. El recorrido del foseado se **deriva**, no se guarda: contorno de la
   estancia retranqueado 150 mm hacia dentro, a la cota `heightMm` del techo,
   emitiendo hacia arriba (luz indirecta). Guardar solo `ceilingId` evita que
   el recorrido quede obsoleto al mover un muro.
3. **Tramo libre**: se dibuja como polilínea en el plano (2–24 puntos), con
   cota (`elevationMm`), color, temperatura y lm/m. Editable y desplazable.
4. 2D: `cove` como línea discontinua interior al contorno; `free` como línea
   gruesa con puntos de control y etiqueta de longitud en metros.
5. 3D: material emisivo siempre; como máximo 4 luces reales de tira, dentro del
   presupuesto global de 12. `cove` = luz hacia el techo; `free` = luz según su
   orientación (hacia fuera del muro más cercano si está adosada, si no hacia
   abajo).
6. Borrar un techo borra su `cove` (igual que `removeCeiling` borra las luces,
   `ceiling-commands.ts:32-37`).

## Geometría derivada

`src/lib/editor-document/light-strip-geometry.ts` (nuevo):

```ts
interface ResolvedStrip {
  strip: LightStrip;
  pathMm: Point[];        // recorrido resuelto en coordenadas del plano
  elevationMm: number;    // cota del emisor
  direction: 'up' | 'down' | 'out';
  lengthMm: number;
  roomId: string | null;  // estancia a la que pertenece (para escenas y zonas)
  lumens: number;         // lengthMm/1000 * lumensPerMeter
}
resolvedStrips(doc): ResolvedStrip[]     // omite las que tengan incidencia
lightStripIssue(doc, strip): string | null
```

Reglas de `lightStripIssue`:
- `cove`: su techo debe existir en `ceilingSurfaces` y ser `suspended` con
  `dropMm ≥ 80`; el contorno retranqueado 150 mm debe seguir siendo un
  polígono válido (estancias muy estrechas → «La estancia es demasiado
  estrecha para un foseado»).
- `free`: cada punto dentro de alguna estancia del documento; `elevationMm`
  entre 0 y la altura libre de esa estancia menos 50 mm; longitud total ≥ 300 mm.
- Límite de 48 tiras ya validado en fase 1.

`lightStripIssue` se agrega a `ceilingIssues` (`ceiling-geometry.ts:78`) para
que los avisos salgan por el mismo canal que hoy (`ceilingWarnings`, `:98`).

## Ficheros

Crear:
- `src/lib/editor-document/light-strip-geometry.ts`
- `src/lib/editor-document/light-strip-commands.ts` — `addCoveStrip`,
  `addFreeStrip`, `updateLightStrip`, `removeLightStrip`, `removeLightStrips`
  (todas sobre `upgradeLightingDocument` y cerrando con `parseEditorDocument`).
- `src/components/editor-v2/light-strip-fields.tsx` — campos de una tira y
  edición en bloque.
- `src/components/editor-v2/light-strip-layer.tsx` — capa Konva.
- `src/components/editor-v2/scene/light-strip-meshes.tsx` — mallas 3D.

Modificar:
- `src/lib/editor-document/ceiling-geometry.ts` — `ceilingIssues` incluye
  tiras.
- `src/lib/editor-document/ceiling-commands.ts` — `removeCeiling` arrastra las
  tiras `cove` de ese techo.
- `src/components/editor-v2/ceiling-lighting-panel.tsx` — sección «Tiras LED»
  (si el fichero se acerca a las 400 líneas, extraer
  `ceiling-strip-section.tsx`, igual que `ceiling-plan-section.tsx`).
- `src/components/editor-v2/scene/ceiling-lighting-meshes.tsx` — reparto del
  presupuesto entre luminarias y tiras.
- `src/components/editor-v2/scene/ceiling-scene-utils.ts` —
  `createStripEmitter` y `lightBudgetSplit(luminaires, strips, budget)`.
- La capa 2D donde se monta `CeilingLightingLayer` (misma condición de
  visibilidad «Iluminación», `visibility-menu.tsx:38`) y la herramienta de
  dibujo de tramo libre en el conjunto de herramientas del editor.

Tests: `tests/editor-document/light-strip-commands.test.ts`,
`tests/editor-document/light-strip-geometry.test.ts`,
`tests/editor-v2/light-strip-budget.test.ts` (nuevos).

## Pasos

1. Geometría pura primero (retranqueo del contorno, longitud, incidencias), con
   tests sobre estancias rectangulares, en L y estrechas.
2. Comandos + integración en `ceilingIssues` y `removeCeiling`.
3. Panel: botón «Foseado del falso techo» por estancia, lista de tiras con sus
   campos, botón «Dibujar tira libre» que activa la herramienta.
4. Herramienta de dibujo: reutilizar la validación de polilínea de
   `polygon-tools` (autointersección y límite de vértices) sin duplicarla.
5. Capa 2D: dibujo, selección (compatible con la selección múltiple existente
   por Mayús+clic) y arrastre de vértices en tramo libre.
6. 3D: mallas emisivas (`cove` = tubo/`TubeGeometry` fino sobre el contorno
   retranqueado; `free` = caja fina a lo largo del recorrido) y reparto de
   luces reales.
7. Repaso de rendimiento con un plano de 8 estancias, todas con foseado.

## Reparto del presupuesto WebGL

`lightBudgetSplit` es determinista y testeable:

1. Presupuesto total 12.
2. Máximo 4 luces reales de tira; se asignan por lúmenes totales descendentes,
   una por tira (no por metro), y solo si `enabled`.
3. El resto va a luminarias, en el orden actual (`resolvedLuminaires`).
4. Toda tira sin luz real conserva su material emisivo: se ve encendida aunque
   no ilumine.

## Validación

```bash
DATABASE_URL=… bun run scripts/test-isolated.ts run \
  tests/editor-document/light-strip-geometry.test.ts \
  tests/editor-document/light-strip-commands.test.ts \
  tests/editor-v2/light-strip-budget.test.ts \
  tests/editor-document/ceiling-commands.test.ts
```

Casos: foseado sobre techo plano → error; sobre falso techo de 150 mm → tira
creada con recorrido derivado de longitud ≈ perímetro − 8·150 mm; dos foseados
en el mismo techo → error; borrar el techo borra su foseado; tramo libre con
un punto fuera de toda estancia → error; tramo libre a 2,60 m en estancia de
2,50 m libres → error; `lightBudgetSplit` con 20 luminarias y 6 tiras devuelve
8 + 4 y nunca más de 12; con 3 luminarias y 1 tira devuelve 3 + 1.

## Riesgos

- **Rendimiento WebGL** (prob. media, impacto alto): las mallas de tira
  multiplican draw calls en planos grandes. Mitigación: una sola malla por
  tira, sin sombras (`castShadow: false`) y luz real solo para 4.
- **Retranqueo en estancias cóncavas** (prob. media, impacto medio): el offset
  de polígono puede autointersecarse. Mitigación: si el retranqueo falla o
  produce un polígono inválido, devolver incidencia «estancia demasiado
  estrecha» en vez de un recorrido roto.
- **Recorrido derivado vs. guardado** (prob. baja, impacto medio): al mover un
  muro el foseado se recalcula solo; es el comportamiento buscado, pero hay que
  documentarlo en la UI («sigue el contorno de la estancia»).
- **Crecimiento del panel** por encima de 1000 líneas: extraer sección propia.

## Rollback

Revertir los ficheros nuevos y las tres modificaciones puntuales. Los
documentos con `lightStrips` seguirán validando (fase 1) y las tiras
simplemente no se verán. Para limpiarlos, `removeLightStrips` sobre el
documento.

## Propiedad de ficheros

Exclusiva sobre todos los ficheros `light-strip-*`. Comparte con la fase 2
`ceiling-geometry.ts`, `ceiling-commands.ts`, `ceiling-lighting-panel.tsx`,
`ceiling-scene-utils.ts` y `ceiling-lighting-meshes.tsx`: si van en paralelo,
acordar que la fase 2 entra primero en esos cinco.
