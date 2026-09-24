# Revisión de código — Iluminación a fondo (feat/iluminacion-a-fondo vs develop)

Fecha: 2026-09-24 · Alcance: `git diff develop` (44 ficheros) + 33 ficheros sin seguimiento.
Solo lectura: no se han ejecutado tests ni builds.

## Veredicto

Dos defectos bloqueantes, ambos con reproducción clara y ambos en caminos que los
tests nuevos no tocan. El resto del trabajo está sólido: la migración v12 es un
único bump, leer un documento v≤11 no lo cambia, las puertas por versión están
bien puestas (`ceiling-validation.ts:41` con el parámetro `version`), los comandos
clonan antes de mutar (`parseEditorDocument` → `structuredClone`,
`validation.ts:416`) y las zonas de luces no viajan a la IA (verificado: no hay
ninguna referencia a `lightZones` en `src/server`).

## BLOQUEANTE

### B1. Borrar una luz o una tira desde el lienzo revienta si alguna escena la apagaba

`src/canvas/editor-v2/editing-operations.ts:214-217` filtra `luminaires` y
`lightStrips`, pero no poda las escenas. `editDocument` cierra con
`assertEditorDocument` (`editing-operations.ts:27`), y
`assertLightingSceneFields` exige que todo id de `offLightIds`/`offStripIds`
exista (`lighting-scene-validation.ts:41`, `references()`):

```
if (typeof id !== 'string' || !known.has(id)) fail(`La escena apaga ${name} que ya no existen`);
```

Repro: crear escena en una estancia con una luz apagada → seleccionar esa luz en
el plano → Supr → «La escena apaga luminarias que ya no existen» y el borrado no
se aplica. Lo mismo al borrar un tramo de cocina con tira apagada en escena
(`dropStripsOfKitchenRuns`, `kitchen-run-commands.ts:43`).

Todos los comandos equivalentes sí podan (`ceiling-commands.ts:42,90,136`,
`light-strip-commands.ts:174`); aquí falta. Arreglo: llamar a
`pruneLightingScenes(next)` dentro del mismo `editDocument`.

### B2. El presupuesto de 12 luces reales se supera con varias plantas

`src/components/editor-v2/scene/editor-scene-view.tsx:247-252` reparte el
presupuesto entre plantas contando **solo luminarias**:

```ts
.map((doc) => resolvedLuminaires(doc).filter(({ luminaire }) => luminaire.enabled).length);
```

`CeilingLightingMeshes` ya no gasta solo en luminarias: `lightBudgetSplit`
(`ceiling-scene-utils.ts:83`) reserva hasta `MAX_STRIP_LIGHTS = 4` por planta.
Con la planta activa en 2 luminarias + 4 tiras y la siguiente en 6 luminarias +
4 tiras se encienden 16 `SpotLight` reales frente a `MAX_LUMINAIRE_LIGHTS = 12`.
Es el criterio de aceptación «En 3D nunca se superan 12 luces reales simultáneas
con cualquier combinación de luminarias y tiras».

`tests/editor-v2/light-strip-budget.test.ts` prueba `lightBudgetSplit` aislado,
así que el criterio queda verde sin cubrir el caso que falla. Arreglo: contar
también las tiras en `lightBudgets` (o mejor, repartir una sola vez a nivel de
escena y pasar los ids por planta).

Detalle relacionado: ese mismo cálculo usa `luminaire.enabled` en lugar de
`effectiveEnabled`, incoherente con `lightBudgetSplit`, que sí descuenta lo que
la escena apaga.

## IMPORTANTE

### I1. Fuga de geometrías y emisores en las tiras 3D

`src/components/editor-v2/scene/light-strip-meshes.tsx:32`:

```ts
useMountEffect(() => () => { geometry.dispose(); emitter.dispose(); });
```

`useMountEffect` es `useEffect(fn, [])`, así que la limpieza captura la PRIMERA
`TubeGeometry` y el PRIMER `SpotLight`. Ambos son `useMemo` con dependencias:
cambiar color/temperatura/lm crea un emisor nuevo sin liberar el anterior, y
arrastrar un punto de la tira crea una geometría nueva si la `key` no cambia
(la clave usa solo `pathMm.length` y `lengthMm.toFixed(0)`: mover un vértice a
lo largo de la tira mantiene ambos). `LuminaireMesh` lo hace bien
(`ceiling-lighting-meshes.tsx:38`: `useEffect(() => () => emitter.dispose(), [emitter])`).

### I2. `stripEndpointsOnly` degenera un foseado retocado a mano

`src/server/agent/editor-v2/interior-prompt-scope.ts:474-479` recorta cualquier
`pathM` de más de 2 puntos a sus extremos. Solo llevan `pathM` las tiras con
`derived: false` (`ceiling-design-context.ts:44`), y un foseado retocado a mano
sigue siendo un anillo cerrado: su primer y último punto coinciden
(`coveRing`, `light-strip-geometry.ts:278`). El paso lo convierte en un segmento
de longitud cero, que es peor que no mandar recorrido. Excluir las tiras `cove`
(o los recorridos cerrados) de ese paso.

### I3. N+1 al resolver la estancia de cada tira

`lighting-scene.ts:540-543`:

```ts
return doc.lightStrips.filter((strip) => stripRoomId(doc, strip) === roomId);
```

`stripRoomId` toma `surfaces = ceilingSurfaces(doc)` y `rooms = deriveRoomsSafe(doc)`
por defecto (`light-strip-geometry.ts:451`), así que con 48 tiras se derivan las
estancias 48 veces. `roomStrips` lo llama en `captureScene` y en el panel de
escenas. Calcular `surfaces`/`rooms` una vez y pasarlos.

### I4. `resolvedStrips` se calcula dos veces por fotograma 3D

`ceiling-lighting-meshes.tsx:77` lo memoiza y `LightStripMeshes`
(`light-strip-meshes.tsx:52`) lo vuelve a calcular con el mismo documento; cada
llamada arrastra `ceilingSurfaces` + `deriveRoomsSafe`. Pasar el resultado ya
calculado por props.

### I5. Coste de `upgradeLightingDocument` en ediciones en bloque

La cadena `lighting → kitchen → boundary → walkthrough → …` encadena un
`structuredClone` + una validación completa **por eslabón** y ahora se invoca en
`addLuminaire`, `updateLuminaire` (cuando hay campos de foco), todos los comandos
de tiras, escenas y zonas. `updateLightStrips` (`light-strip-commands.ts:126`) y
`updateLuminaires` (`ceiling-commands.ts:125`) la repiten **por cada id**: editar
en bloque 40 luces son ~240 clones y validaciones del documento entero
(incluida `assertPlanarTopology`). El patrón es preexistente, pero la fase 6 y 7
lo llevan a bucles. Conviene migrar una sola vez y aplicar el bucle sobre el
documento ya migrado.

### I6. `fitCompactPrompt` puede devolver un prompt por encima del tope sin avisar

`interior-prompt-scope.ts:541`: agotados los pasos y las tolerancias, se hace
`return prompt` sin comprobar la longitud ni señalarlo. Es preexistente, pero la
fase 7 añade tres pasos más al mismo presupuesto y el tope se describe en el plan
como «duro». Si no se quiere fallar, al menos debería dejar traza.

## MENOR

- `canvas-view.tsx:158-160`: `store.getState().document.lightStrips!.at(-1)!.id`
  asume que `apply` ha cuajado y que la tira nueva es la última. En modo lectura
  o si `apply` no aplica, es un `TypeError` en vez de un aviso. Además cada clic
  de la tira libre genera un paso de deshacer propio.
- `render-contract.ts:86-96` recorre `overhead.ceilings` y `overhead.luminaires`
  pero no `lightStrips` ni `lightingScenes`: el contrato de render completo no
  conoce las tiras, a diferencia de `design-context.ts:69`.
- Casts que mienten sobre la forma emitida tras quitar claves obligatorias:
  `as unknown as ScopeFloor` (`interior-prompt-scope.ts:244`),
  `as ScopeRoom[]` (`:265`), `as unknown as ScopeStrip[]` (`:492`). Funciona
  porque el tipo tiene índice abierto, pero el tipo deja de describir el dato.
- `tests/ui/no-native-dialogs.test.ts` recorre `src` con una ruta relativa al CWD
  y compara línea a línea con una regex; sirve como guarda, pero es frágil
  (comentarios multilínea, ficheros fuera de `src`).
- `lighting-scene-commands.ts:82,90`: `setLightingSceneLight/Strip` hacen `find`
  sobre `source` y luego `updateLightingScene` vuelve a migrar y buscar; dos
  recorridos donde bastaba uno.

## Comprobado y correcto

- Leer v≤11 no migra: los campos v12 solo se exigen con `schemaVersion >= 12`
  (`validation.ts:61,355`), y `spot`/`mount`/`tiltDeg`/`azimuthDeg` se rechazan en
  documentos anteriores (`ceiling-validation.ts:34-36`).
- `upgradeLightingDocument` migra también `levels[].document` recursivamente y
  cierra con `parseEditorDocument` (`lighting-migration.ts:16-18`).
- Referencias cruzadas cubiertas: foseado→techo único, tira→tramo único,
  escena→luces/tiras existentes, máximo una escena activa por estancia, nombre de
  zona único.
- Los ciclos declarados (`ceiling-geometry ↔ light-strip-geometry ↔ lighting-scene`,
  `ceiling-commands → lighting-migration → kitchen-run-commands`) solo se resuelven
  dentro de funciones; no hay constantes de módulo leídas en tiempo de carga a
  través del ciclo.
- Las zonas de luces son estado de documento pero **no** viajan al prompt ni al
  contexto de diseño; la zona activa vive en el store (`store.ts:38-39`).
- UI: sin `useEffect` directo ni `<select>` nativo en los componentes nuevos, todos
  por debajo de 300 líneas, y el cierre de sesión en dos fases no se bloquea
  (`finally { setPending(false) }` se ejecuta también en el retorno temprano,
  `sign-out-button.tsx:31,44`).

## Acciones recomendadas

1. B1: podar escenas en `deleteEntities`.
2. B2: incluir las tiras en el reparto de presupuesto entre plantas.
3. I1: liberar geometría y emisor con `useEffect` por dependencia, como en `LuminaireMesh`.
4. I2: excluir recorridos cerrados de `stripEndpointsOnly`.
5. I3–I5: reutilizar `surfaces`/`rooms`/`resolvedStrips` y migrar una sola vez en los comandos en bloque.
6. Añadir un test que borre una luminaria apagada por una escena y otro que mida el total de luces reales con dos plantas.

## Preguntas abiertas

- ¿El tope de 4800 debe fallar de forma explícita cuando ni la degradación máxima
  cabe, o se acepta enviarlo largo?
- ¿Las tiras deben aparecer también en `render-contract.ts` (gate de calidad e
  inventario) o se deja solo en el contexto de diseño a propósito?
