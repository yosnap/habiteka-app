# Fase 1 · Modelo v12 + migración compartida

Esfuerzo: 7h · Depende de: — · Estado: done

## Contexto

Hoy `EditorDocument.schemaVersion` llega a 11 (`schema.ts:181`) y la validación
abre campos por versión en una sola cadena (`validation.ts:58`), delegando en
`assertCeilingFields` para techos y luminarias (`validation.ts:349`,
`ceiling-validation.ts:2`). La migración de techos vive en
`upgradeCeilingDocument` (`ceiling-commands.ts:9`, sube a 8) y la de cocina en
`upgradeKitchenDocument` (`kitchen-run-commands.ts:11`, sube a 11, encadena
`upgradeBoundaryDocument` y recorre `doc.levels`).

Las cuatro funcionalidades (foco orientable, tiras LED, escenas y zonas de
luces) necesitan campos nuevos. Un único bump 11 → 12 evita cuatro migraciones
y cuatro estados intermedios.

## Requisitos

1. `schemaVersion` admite 12; 11 y anteriores siguen siendo válidas y no se
   tocan al leer.
2. `Luminaire` admite `kind: 'spot'` y los campos opcionales `mount`,
   `tiltDeg`, `azimuthDeg` **solo** en v ≥ 12.
3. Colecciones nuevas `lightStrips`, `lightingScenes` y `lightZones`,
   permitidas solo en v ≥ 12.
4. `upgradeLightingDocument(source)` encadena `upgradeKitchenDocument`, sube a
   12 si hace falta, inicializa `lightStrips ??= []`, `lightingScenes ??= []` y
   `lightZones ??= []`, y recorre `doc.levels[].document` igual que la de
   cocina.
5. Validación estructural completa de los campos nuevos, sin derivar estancias
   (misma regla que `ceiling-validation.ts`: nada de `deriveRooms` para evitar
   ciclos).
6. Un documento v11 que ya contiene `ceilings`/`luminaires` sigue validando sin
   `mount`/`tiltDeg`/`azimuthDeg` ni las colecciones nuevas.

## Reglas de validación (unidades y límites)

`Luminaire` (ampliación de `ceiling-validation.ts:21-31`):

| Campo | Tipo | Regla |
|---|---|---|
| `kind` | enum | `pendant\|flush\|recessed` en toda versión; `spot` solo v ≥ 12 |
| `mount` | `'recessed'\|'surface'` | obligatorio si `kind === 'spot'`, prohibido en el resto |
| `tiltDeg` | número | solo `spot`, 0–60, grados sexagesimales, 0 = vertical hacia abajo |
| `azimuthDeg` | número | solo `spot`, 0–360, 0 = eje +X del plano, sentido horario en planta |
| `dropMm` | número | sigue 0–5000; `spot` con `mount: 'surface'` admite 0–300, `recessed` exige 0 |

`LightStrip` (`light-strip-validation.ts`, nuevo):

| Campo | Regla |
|---|---|
| `id` | string 1–200, único en el documento (mismo `ids: Set<string>`) |
| `kind` | `cove` \| `under-cabinet` \| `free` |
| `ceilingId` | obligatorio y existente si `cove`; prohibido si no. Un `cove` por techo |
| `kitchenRunId` | obligatorio y existente en `doc.kitchenRuns` si `under-cabinet`; prohibido si no. Uno por tramo |
| `pathMm` | **obligatorio en todos los tipos**: 2–24 puntos, cada coordenada ±1e8, sin dos puntos consecutivos a < 50 mm, longitud total ≤ 60 000 mm |
| `derived` | booleano obligatorio. `free` exige `derived === false`; `cove` y `under-cabinet` admiten ambos |
| `elevationMm` | obligatorio: 0–4000 mm desde el suelo acabado |
| `color` | `#rrggbb` |
| `temperatureK` | 1800–6500 |
| `lumensPerMeter` | 50–2000 |
| `enabled` | booleano |
| colección | máximo 48 tiras |

`pathMm` se guarda siempre, también en las derivadas: ahí es la **instantánea**
del último recorrido calculado (la usan el 2D, el prompt y el histórico si la
geometría de origen desaparece). Mientras `derived === true`, la geometría
recalcula el recorrido y los comandos refrescan la instantánea; con
`derived === false`, `pathMm` manda y no se recalcula nada. La validación no
comprueba que la instantánea coincida con la geometría: eso es trabajo de la
fase 3 (incidencias), no del esquema.

`LightZone` (`light-zone-validation.ts`, nuevo):

| Campo | Regla |
|---|---|
| `id` | string 1–200, único |
| `name` | 1–40 caracteres, no vacío tras recortar, sin duplicados en el documento |
| `polygonMm` | 3–20 vértices finitos, sin autointersección, área > 0 (mismo contrato que `renderDesignOptionsSchema.regions`, `render-design-options.ts:12`) |
| colección | máximo 12 zonas, igual que `MAX_REGIONS` (`render-region-draw.ts:24`) |

`LightingScene` (`lighting-scene-validation.ts`, nuevo):

| Campo | Regla |
|---|---|
| `id` | string 1–200, único |
| `roomId` | mismo formato `room:[...]` que `Ceiling.roomId`, validado igual que `ceiling-validation.ts:8-11` |
| `name` | 1–40 caracteres, recortado |
| `temperatureK` | 1800–6500 |
| `intensityPct` | 10–150 (entero) |
| `offLightIds` / `offStripIds` | máx. 64 ids cada uno, sin duplicados, existentes en el documento |
| `active` | booleano; máximo una escena activa por `roomId` |
| colección | máximo 24 escenas, máximo 4 por estancia |

## Ficheros

Modificar:
- `src/lib/editor-document/schema.ts` — tipos `Luminaire` ampliado,
  `LightStrip`, `LightingScene`, `LightZone`, `EditorDocument.schemaVersion`
  con 12 y las tres colecciones opcionales.
- `src/lib/editor-document/validation.ts` — `[…,12]` en la lista de versiones
  (`:50`), cadena de campos permitidos
  `${v>=12 ? ' lightStrips lightingScenes lightZones' : ''}` (`:58`), llamadas
  a los tres asserts nuevos junto a `assertCeilingFields` (`:349`).
- `src/lib/editor-document/ceiling-validation.ts` — campos nuevos de
  `Luminaire` con gate por versión (recibe la versión como argumento).

Crear:
- `src/lib/editor-document/light-strip-types.ts` — tipos + constantes
  compartidas (`STRIP_KINDS`, etiquetas en castellano, defaults por tipo).
- `src/lib/editor-document/light-strip-validation.ts`
- `src/lib/editor-document/lighting-scene-validation.ts`
- `src/lib/editor-document/light-zone-validation.ts`
- `src/lib/editor-document/lighting-migration.ts` — `upgradeLightingDocument`.

Tests: `tests/editor-document/lighting-schema-v12.test.ts` (nuevo).

## Pasos

1. Añadir tipos en `schema.ts` y las constantes de catálogo en
   `light-strip-types.ts` (un único sitio para etiquetas y defaults, como
   `kitchen-run-types.ts`).
2. Parametrizar `assertCeilingFields(doc, ids, version)` y ampliar la cadena
   `allowed` de luminarias solo cuando `version >= 12`. Mantener el fallo
   «Campo de techo o luminaria desconocido» para v < 12 con campos nuevos.
3. Escribir `light-strip-validation.ts`, `lighting-scene-validation.ts` y
   `light-zone-validation.ts` siguiendo el estilo de `ceiling-validation.ts`
   (helpers `fail/collection/entity/number/color` locales; no importar
   `deriveRooms`). La comprobación de polígono de `LightZone` reutiliza
   `polygonSelfIntersects` de `polygon-tools` (ya usado por
   `render-region-draw.ts`), sin duplicar la lógica.
4. Enganchar los tres en `validation.ts` tras `assertKitchenRunFields`.
5. Escribir `upgradeLightingDocument` en `lighting-migration.ts`, encadenando
   `upgradeKitchenDocument` y recorriendo niveles.
6. Cambiar las llamadas de `upgradeCeilingDocument` dentro de
   `ceiling-commands.ts` (`:20`, `:39`, `:67`, `:83`) por
   `upgradeLightingDocument`, de modo que cualquier edición de iluminación
   migre a 12 de una vez. `upgradeCeilingDocument` se conserva exportada para
   quien solo necesite techos.
7. Ejecutar los tests existentes de documento para detectar regresiones de
   validación.

## Validación

```bash
DATABASE_URL=postgres://…/habiteka_test_editor_v2 bun run scripts/test-isolated.ts run \
  tests/editor-document/lighting-schema-v12.test.ts \
  tests/editor-document/validation.test.ts \
  tests/editor-document/ceiling-commands.test.ts \
  tests/editor-document/ceiling-bulk-commands.test.ts \
  tests/editor-document/kitchen-run.test.ts
```

Casos que debe cubrir el test nuevo:
- v11 con techos y luces valida; añadirle `lightStrips` falla.
- v12 acepta `spot` con `mount/tiltDeg/azimuthDeg` y rechaza `tiltDeg` en
  `flush`, `tiltDeg: 61`, `azimuthDeg: -1`, `spot` sin `mount`.
- `cove` sin `ceilingId`, dos `cove` sobre el mismo techo, `free` con 1 punto,
  `free` de 70 m, `free` con `derived: true`, tira sin `pathMm`,
  `lumensPerMeter: 0` → error con mensaje en castellano.
- `lightZones`: zona sin nombre, con 2 vértices, con 21, con polígono
  autointersecado, dos zonas con el mismo nombre y 13 zonas → error; una zona
  válida sobrevive a `parseEditorDocument` sin cambios.
- dos escenas activas en la misma estancia → error; `intensityPct: 200` → error.
- `upgradeLightingDocument` sobre un doc v8 lo deja en 12 con colecciones
  vacías, es idempotente y migra `levels[].document`.
- leer (`parseEditorDocument`) un v11 no altera `schemaVersion`.

## Riesgos

- **Gate por versión mal puesto** (prob. media, impacto alto): un v11 con
  `tiltDeg` debe fallar; si no, los documentos viejos aceptan campos que sus
  lectores ignoran. Mitigación: test explícito en ambos sentidos.
- **Ciclo de imports**: importar `ceiling-geometry` desde la validación crearía
  un ciclo (por eso existe `ceiling-validation.ts`). Mitigación: validación
  estructural pura; la comprobación de recorrido real va en la fase 3.
- **`entity()` con `allowed` por versión** (prob. baja): olvidar un campo deja
  «campo desconocido» en producción. Mitigación: test de ida y vuelta con un
  documento que lleve todos los campos nuevos.

## Rollback

Revertir los ficheros de esta fase deja `schemaVersion` en 11. Los documentos
ya migrados a 12 dejarían de validar: si la fase se revierte tras haberse usado
en producción, hay que mantener 12 en la lista de versiones aceptadas y tratar
las colecciones nuevas como ignoradas. Mientras el trabajo esté en rama local
sin desplegar, revertir es seguro.
