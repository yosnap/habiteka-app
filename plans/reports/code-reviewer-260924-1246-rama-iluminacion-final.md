# Revisión de `feat/iluminacion-a-fondo` (lo nuevo tras el informe 1114)

Alcance: `git diff develop...feat/iluminacion-a-fondo` (111 ficheros, +6526/-682). Solo lectura;
no se ha ejecutado nada. Se da por revisada la parte de iluminación ya auditada en
`code-reviewer-260924-1114-iluminacion-a-fondo.md`.

## Veredicto

Sin bloqueantes de seguridad ni de pérdida de datos irreversible. Sí hay tres defectos de
comportamiento reales (foco de cámara, gate de calidad, Escape global) que conviene arreglar antes
de merge o inmediatamente después, porque los tres son fáciles de reproducir por el usuario.

## IMPORTANTE

### 1. Salir de la vista interior no devuelve el campo de visión de la cámara
`scene-camera.tsx:60-70` escribe `camera.fov = fovDeg` (interior, 60–90° según
`room-interior-cameras.ts:89-92` e `interiorFovDeg`) y nunca lo restaura. Al salir
(`editor-scene-view.tsx:287-293` manda `action: 'fit'`) la rama de encuadre (`scene-camera.tsx:75-93`)
recalcula `near`/`far` y la distancia usando `getEffectiveFOV()`, pero deja el FOV interior puesto:
la vista exterior queda gran angular hasta recargar, y también las capturas PNG/IA que no pasan por
`options.camera` (esa ruta sí restaura, `editor-scene-view.tsx:226`). Arreglo: guardar el FOV
original (45, `editor-scene-view.tsx:367`) al entrar y reponerlo en cualquier acción distinta de
`interior`.

### 2. El gate de calidad puede quedar con `ack` viejo y con respuestas fuera de orden
`editor-quality-gate.tsx`:
- `reevaluate()` hace `setAck(false)` pero NO llama a `onChange`. Si la nueva evaluación falla
  (rama `catch`), el padre conserva el estado anterior con `ack: true` mientras la casilla aparece
  desmarcada: se puede generar con una confirmación que el usuario ya no ve dada, sobre un documento
  distinto del que confirmó.
- `load()` no lleva testigo por petición: dos reparaciones seguidas lanzan dos `evaluate()` y gana la
  que responda última, no la última pedida. `alive` solo distingue montado/desmontado.
Arreglo: `onChange({ quality, ack: false, ... })` al reevaluar y un contador de secuencia que
descarte respuestas obsoletas.

### 3. El Escape del panel lateral no respeta ni los campos de texto ni las preferencias
`editor-side-panel.tsx:33-38` registra un `keydown` en `document` que cierra el panel con Escape sin
ninguna guarda, a diferencia del atajo equivalente del shell (`editor-shell.tsx:450-466`), que
comprueba `shortcutsEnabled` y descarta `INPUT/TEXTAREA/contentEditable`. Consecuencias verificables:
- Escape dentro de `InlineRenameField` (`inline-rename-field.tsx:29`, usado en
  `lighting-zone-section.tsx` y `lighting-scene-section.tsx`) cancela el renombrado Y cierra el panel
  entero: ese componente no hace `stopPropagation`, y el oyente está en `document`.
- El usuario que desactiva los atajos sigue perdiendo el panel con Escape.
- Con el diálogo «Diseñar con IA» abierto (`editor-generate-dialog.tsx:321`), Escape cierra además el
  panel que hay detrás; y el `pointerdown` de cierre por clic fuera (`editor-side-panel.tsx:27-32`)
  solo excluye `[data-radix-popper-content-wrapper]` y `[data-side-panel-toggle]`, así que cualquier
  clic dentro de un diálogo modal propio también cierra el panel de fondo.
Arreglo: replicar la guarda de campos de texto, respetar `shortcutsEnabled` y excluir del clic-fuera
lo que esté dentro de un `[role="dialog"]` distinto del propio panel.

### 4. `collapseDegenerateWalls` puede borrar huecos sin avisar
`plan-repairs.ts:19-29` llama a `mergeVertexInto`, que descarta los muros que quedan duplicados y con
ellos sus huecos: `vertex-merge.ts:19-21` (`openings: doc.openings.filter(... !dropped ...)`). El
botón «Fundir los muros» (`plan-issues-panel.tsx:23`) promete solo fundir. Es deshacible con ⌘Z, pero
el usuario puede perder una puerta o ventana sin enterarse. Arreglo mínimo: contar los huecos que se
van a retirar y decirlo en el texto del botón o en un aviso posterior.

## MENOR

- `plan-issues.ts:160-185` (`danglingEnds`) es O(nº muros²) y ahora se ejecuta también en el panel de
  incidencias, que lo recalcula vía `useMemo` en cada cambio de documento (`plan-issues-panel.tsx:38`)
  además de en la evidencia del servidor. Con planos grandes (varios cientos de muros) se nota al
  teclear en el diálogo de calidad. Reutilizar `planDefects` ya memoizado o indexar por rejilla.
- Cambio real en la evidencia que va a Jev: `editor-evidence.ts` ya no cuenta como incoherente una
  rampa con `riseMm <= 0` si es descansillo (`plan-issues.ts:100-104`, `isRampLanding`). Es una mejora
  deliberada y coherente con la tarjeta, pero cambia el número histórico de `rampasIncoherentes`; si
  hay veredictos guardados comparables, no serán equiparables con los nuevos.
- `upgradeLightingDocument` (`lighting-migration.ts`) recorre y vuelve a parsear todas las plantas en
  cada alta de luminaria (`ceiling-commands.ts:58, 82`). En un edificio de varias plantas es un parse
  completo por clic; hoy es asumible, conviene vigilarlo.
- `freeLuminairePoint` (`ceiling-commands.ts`) muestrea una rejilla 15×15 del *bounding box* y clona
  el documento en cada sondeo: hasta 225 validaciones completas por alta sin punto. Funciona, pero es
  el punto caliente si crece el número de luces.
- `light-zone-draw.ts` no acota los vértices mientras se dibuja: el tope `MAX_ZONE_VERTICES = 20`
  (`light-zone-validation.ts:13`) solo salta al guardar, y el usuario descubre el límite tras marcar
  25 puntos. Cortar en el propio `addZoneVertex` con el mismo mensaje sería más honesto.
- `InlineConfirmButton` (`src/components/ui/inline-confirm-button.tsx`) no se cancela al hacer clic
  fuera ni al desmontar la fila: la pregunta queda colgada indefinidamente. No es un defecto, pero en
  `zone-switcher.tsx` ensancha la fila de chips mientras está preguntando.

## Verificado y correcto (no hace falta acción)

- Presupuesto de luces: `levelLightBudgets`/`splitLevels` (`ceiling-scene-utils.ts:155-188`) reparte
  un único `MAX_LUMINAIRE_LIGHTS` entre plantas y `editor-scene-view.tsx:269, 396-397` da el resto a
  las plantas inactivas con `shadowBudget={0}`. La planta activa consume el tope global. No se puede
  superar ni el tope de luces ni el de sombras (`MAX_SHADOW_LIGHTS = 2`, más una direccional por
  preset tras quitar el `castShadow` del `pointLight` en `scene-lighting.tsx`).
- `store.apply` pasa por `inheritFloorFinishes` y `reconcileCeilings` (`store.ts:204`), así que fundir
  muros no deja acabados ni techos huérfanos; la reparación de suelos es, como dice su comentario,
  manual y se niega si las estancias no se pueden derivar (`plan-repairs.ts:44-49`).
- `EditorSidePanel` devuelve la limpieza desde una *ref callback*; con React 19.2.4
  (`package.json:46`) eso sí se ejecuta, los oyentes no se acumulan.
- Coherencia del panel con selección, herramienta y undo/redo: `sidePanelForSelection`
  (`store.ts:27-37`) más `undo/redo` (`store.ts:220-231`, que además vacían `selection`) y `setTool`
  (`store.ts:242`). Cubierto por `tests/editor-v2/side-panel.test.ts`.
- `sign-out-button.tsx`: la confirmación en línea mantiene `stopEditorSessions` + `clearUserDrafts`
  tras el «Salir igualmente» y el `finally` repone `pending`, así que el botón no queda inutilizable.
- Nada de `<select>` nativo (todo `ModernSelect`), sin `useEffect` directo en componentes nuevos y
  ningún fichero nuevo pasa de 1000 líneas (máximo tocado: `editor-shell.tsx`, 893).
- `tests/ui/no-native-dialogs.test.ts` fija la norma de no usar `confirm/alert/prompt`.

## Acciones recomendadas (por orden)

1. Restaurar el FOV al salir de la vista interior.
2. Propagar `ack: false` y añadir secuencia a las reevaluaciones del gate de calidad.
3. Guardar el Escape/clic-fuera del panel lateral (campos de texto, preferencia de atajos, diálogos).
4. Avisar de los huecos que retira la reparación «Fundir los muros».

## Preguntas abiertas

- ¿Los veredictos de Jev ya emitidos se comparan entre sí en algún panel? Si es así, el cambio del
  criterio de rampas descansillo hace que los números antiguos y nuevos no sean equiparables.

Status: DONE_WITH_CONCERNS
Summary: la rama es mergeable en local a develop; no hay bloqueantes, pero conviene corregir antes de publicar el FOV que no se restaura al salir de la vista interior, el `ack` obsoleto y las respuestas fuera de orden del gate de calidad, y el Escape global del panel lateral.
