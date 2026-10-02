# Revisión: costes de lote + ModernSelect (feat/iluminacion-y-costes-zonas)

Diff revisado: `git diff develop...feat/iluminacion-y-costes-zonas` (76130e6, 120f523, 80e8272).
27 ficheros, +1283/-43 (de los cuales 8 ficheros son plan/docs). Solo lectura: no se ha
ejecutado build, servidor ni suite.

## Veredicto

Sin bloqueantes. Los cambios de servidor (estimación, tope, indexado de vértices) son
correctos y verificables. Lo que queda son regresiones de estilo/maquetación provocadas por
sustituir `<select>` nativo (que llevaba CSS de módulo) por `ModernSelect` (que lleva
Tailwind propio), más un par de detalles de robustez.

`src/components/ui/modern-select.tsx` **no cambia** en este diff (ya existía y se usaba en 17
ficheros); lo nuevo son 10 puntos de uso más. Las observaciones sobre el componente son sobre
cómo se comporta en esos puntos nuevos.

---

## BLOQUEANTE

Ninguno.

---

## IMPORTANTE

### 1. `w-full` del trigger rompe la fila de «Aparatos» de cocina

`src/components/editor-v2/kitchen-fields.tsx:52` — el select vive dentro de
`<div className={styles.actions}>` junto al botón «Añadir aparato», y `.actions` es
`display:flex; flex-wrap:wrap` (`src/components/editor-v2/editor.module.css:106-111`).
El trigger de `ModernSelect` lleva `flex w-full` fijo en su clase base
(`src/components/ui/modern-select.tsx:29`), así que ocupa el 100 % de la fila y empuja el
botón a la línea siguiente. El `<select>` nativo se auto-dimensionaba al contenido.

Fix: pasar una clase que lo acote (`className="w-auto min-w-[12rem] flex-1"`) o envolverlo en
un `<div className="flex-1 min-w-0">`. Ojo: el `className` se **concatena**, no se fusiona con
`tw-merge`, así que `w-auto` no gana a `w-full` por orden de clase; hay que comprobarlo o
envolver.

### 2. Se pierde el objetivo táctil de 44 px y el tema del panel de techo/luces

Las reglas `.panel button, .panel select, .panel input { min-height: 44px; ... background: var(--ceiling-paper) }`
y `.panel input, .panel select { width:100%; font-size:1rem }`
(`src/components/editor-v2/ceiling-lighting.module.css:8-9`) ya no aplican: ahora el control
es un `<button>` de Radix con `py-1.5 ... text-sm` (≈32 px de alto).

Afecta a `ceiling-lighting-panel.tsx:20,65,82,88,107`, `ceiling-plan-section.tsx:46,58`,
`luminaire-bulk-fields.tsx:34` y `walkthrough-panel.tsx:47`. Consecuencias verificables:

- altura ≈32 px frente a los 44 px que el panel impone al resto de controles (los
  `<input type="color">` hermanos siguen en 44 px → filas desalineadas);
- fondo `bg-surface` (token `--surface`) frente a `var(--ceiling-paper)` (= `--paper`) del
  resto de campos del mismo panel → dos colores de control en la misma rejilla;
- `font-size` baja de `1rem` a `text-sm`.

Lo mismo, en menor grado, en `editor.module.css:29-39` (`.shell select`, `min-height:44px`)
para `boundary-fields.tsx` y `kitchen-fields.tsx`, y en
`storyboard-panel.module.css:5` (`.panel .header select { min-height:32px }`, que ahí sí
coincide casi con el nuevo alto).

Fix: añadir en los CSS de módulo la regla equivalente para el trigger (p. ej. exportar una
clase estable desde `ModernSelect` o usar `.panel [data-radix-select-trigger]`), o pasar
`className="min-h-[44px] text-base"` en los paneles afectados. Es una decisión de una sola
vez; ahora mismo cada uso lo arrastra.

### 3. La estimación dispara una Server Action por cada clic del usuario

`src/components/editor-v2/editor-generate-dialog.tsx:481-483` — `key={renderPassCount(options)}`
remonta `RenderCostEstimate` cada vez que cambia el número de pasadas, y el efecto de montaje
(`render-cost-estimate.tsx:357-361`) llama a `onEstimate`, que es
`estimateConceptRenderFromEditor` → `requireOrgContext()` + `assertProjectInOrg()` +
`resolveRoutes('render3d')` (`agent-actions.ts:612-617`), es decir, varias consultas a BD por
pulsación. Marcar 8 vistas una a una = 8 roundtrips.

No hay bug de estado (el `active` del cleanup evita escrituras obsoletas y el remonte por
`key` descarta la respuesta vieja), es solo coste. Dado que el precio sale de una allowlist en
memoria y la ruta de una config, lo razonable es resolver el precio una vez al abrir el
diálogo y multiplicar en cliente, o cachear la ruta. Como mínimo, un debounce de ~300 ms.

---

## MENOR

### 4. El motivo real del fallo de estimación se pierde

`render-cost-estimate.tsx:359-362` colapsa cualquier rechazo en «No se pudo estimar el coste
de este lote». Pero `estimateConceptRenderFromEditorImpl` produce mensajes accionables vía
`fail()`: «No hay modelo de render configurado.» y «No hay precio estimado conocido para
`provider:model`.» (`agent-actions.ts:616-619`), que `callAction` relanza como `Error` con ese
texto (`src/lib/action-result.ts:33-36`). Son exactamente los avisos que el admin necesita
(memoria del proyecto: faltan claves/precios de IA en el panel de producción). Guarda el
`error.message` y muéstralo.

### 5. Precio 0 se muestra como «0,00 $»

La guarda acepta `price === 0` (`agent-actions.ts:617-618`: solo rechaza `< 0`) y el formato
fija 2 decimales (`render-cost-estimate.tsx:364`). Con la allowlist actual (mínimo 0,03 $/ud.,
`model-allowlist.ts`) no se da, pero un precio configurado a 0 o por debajo de 0,005 rinde
«Coste estimado: 0,00 $», que parece «gratis». Redondea hacia arriba o muestra «< 0,01 $».

### 6. `MAX_RENDER_PASSES` coherente, comentario ligeramente engañoso

`render-design-options.ts:57` fija 24 y el schema topa `interiorRoomIds` en 12 y `views` en 8
(líneas 23 y 16), luego `renderPassCount` ≤ 24 siempre: el tope no puede rechazar una petición
legítima de la UI. Verificado. El comentario dice «12 estancias con zonas»; el caso de vistas
(8 × 2 = 16) queda holgado, que está bien, pero conviene que el comentario diga que es el
máximo de ambos modos para que nadie lo baje a 16.

### 7. `indexWallVertices`: correcto, con dos matices

`interior-prompt-scope.ts:344-360`. Verificado:

- solo `walls` tiene `pathM` en el payload de scope (`interior-prompt-scope.ts:43,252`), así
  que ninguna otra entidad se ve afectada por la nota de política;
- los muros con `pathM` de >2 puntos se dejan intactos (test en
  `tests/agent/compact-prompt-lossless.test.ts:545-555`);
- si no hay ningún muro recto, `vertices.length === 0` y se devuelve el nivel original, sin
  `verticesM` huérfano;
- los huecos referencian muros por `id`, no por coordenadas → no se rompen;
- orden: `hoistSharedDefaults` hoistea `thicknessM/heightM/baseElevationM`
  (`interior-prompt-scope.ts:301-305`), nunca `pathM`, así que aplicarlo antes es seguro;
- `compactRenderContext` convierte `{x,y}` en `[x,y]` (`compact-render-context.ts:20-22`),
  de modo que un tramo curvo queda `[[x,y],...]` y uno recto `[i,j]`: estructuralmente
  distinguibles.

Matices: (a) la reversibilidad depende de una frase del prompt
(`compact-render-context.ts:33`), y no hay ninguna prueba de que el modelo la decodifique —
solo de que la transformación es reversible; conviene una comprobación sobre una salida real
antes de desplegar. (b) `at()` fusiona vértices con coordenadas idénticas por clave de texto
`"x,y"`; es lo deseado, pero significa que dos muros que se tocan con redondeos distintos
(6.0 vs 6.000001) no comparten índice y el ahorro desaparece sin aviso.

### 8. `<option>` sin `value` en el catálogo exterior

`outdoor-construction-catalog.tsx:16`: `<option key={g}>{g}</option>`. Funciona porque
`readOptions` cae en `textOf(label)` (`modern-select.tsx:59-62`), pero es una dependencia
frágil de un fallback; conviene `value={g}` explícito.

### 9. `className` no se fusiona

`deliverable-actions.tsx:133` pasa `p-1 text-sm ... bg-white`, que se concatena tras la clase
base con `py-1.5 pl-2 pr-2 ... bg-surface` (`modern-select.tsx:29`). Al no haber `tw-merge`,
quién gana lo decide el orden en el CSS generado, no el orden en el atributo. Aquí sale bien
(`pl/pr/py` van después de `p` en el orden de Tailwind), pero es una trampa para el siguiente
que pase un `px-*`.

### 10. El test de guarda es razonable pero laxo

`tests/ui/modern-selects-only.test.ts` recorre `src` y falla con cualquier `<select` JSX. El
único acierto actual es un comentario en `style-gallery.tsx:5`, ya excluido por el backtick.
Dos huecos: recorre todo `src` en cada ejecución con `statSync` por fichero (lento y crece), y
la heurística del backtick fallará con un `<select>` citado con comillas normales en un
comentario. Aceptable como red de seguridad; no bloquea.

---

## Comprobaciones hechas que NO dieron problema

- **z-index del Portal**: `z-[100]` (`modern-select.tsx:35`) frente a los diálogos, que son
  `z-50`/`z-[60]` (`editor-generate-dialog.tsx:302,640`, `walkthrough-batch-dialog.tsx:112`) y
  los paneles del editor (máx. `z-index:60` en `editor.module.css:260`). Ningún componente usa
  el elemento nativo `<dialog>`, que sí habría puesto el modal en top-layer por encima del
  portal. Sin conflicto.
- **Desplegable de acción de `storyboard-panel.tsx:71`** (`value=""` que se reinicia): la
  opción vacía se mapea a un centinela interno (`modern-select.tsx:16-18`), el
  `onValueChange` emite `""`→valor real, el padre vuelve a `""` y Radix lo detecta como
  cambio. Además el punto elegido desaparece de `available`, así que no hay caso de
  «reseleccionar el mismo valor». Funciona.
- **«Elige un recorrido»** (`walkthrough-panel.tsx:47-48`): `value=""` con
  `<option value="">` presente → el trigger muestra la etiqueta correcta. Funciona.
- **Selects dentro de `<fieldset disabled>`** (`ceiling-lighting-panel.tsx:85`,
  `walkthrough-batch-dialog.tsx:114`): el trigger de Radix es un `<button>`, que sí se
  deshabilita por el fieldset nativo. Queda una discrepancia menor (`aria-disabled` no se
  refleja porque el `disabled` no llega a `Select.Root`), pero el control no es operable.
- **Selects dentro de `<label>`**: `<button>` es labelable, así que el reenvío de clic del
  label abre el desplegable, igual que antes abría el select.
- **`<option value="" disabled>Varios</option>`** (`luminaire-bulk-fields.tsx:35`): el trigger
  pinta la etiqueta desde `Select.Value` con hijos explícitos, así que se ve «Varios»
  aunque el ítem esté deshabilitado.
- **`RenderCostEstimate` no puede romper con `actionError`**: `callAction`
  (`src/lib/action-result.ts:33-36`) relanza el error, no devuelve el objeto, así que
  `state.value.estimatedUsd.toLocaleString()` nunca recibe `undefined`.
- **`renderPassCount`**: la aritmética coincide con `zoneCompositeActive` y con el texto de la
  UI («2 pasadas por vista»), con test en `tests/editor-v2/zone-mask.test.ts:566-574`.
- **Autorización de la estimación**: `requireOrgContext()` + `assertProjectInOrg()` antes de
  cualquier trabajo (`agent-actions.ts:611-613`). Correcto y coherente con el resto de acciones.
- **El commit 80e8272 es solo documentación de plan**, sin impacto en código.

---

## Acciones recomendadas antes de mergear

1. Arreglar la fila de «Aparatos» de cocina (IMPORTANTE 1) — es visible a simple vista.
2. Decidir de una vez cómo se integra `ModernSelect` con los CSS de módulo (IMPORTANTE 2):
   una clase estable o un selector `[data-radix-select-trigger]` en `.panel`/`.shell`, no un
   parche por sitio.
3. Propagar el mensaje real del error de estimación (MENOR 4) — barato y útil en producción.
4. Opcional antes de desplegar: reducir los roundtrips de estimación (IMPORTANTE 3) y validar
   con una generación real que el modelo decodifica `verticesM`/`pathM:[i,j]` (MENOR 7a).

## Preguntas abiertas

- ¿Se ha comprobado visualmente el panel de techo/luces tras el cambio, o solo la suite? Los
  puntos 1 y 2 no los detecta ningún test.
- ¿Se ha validado con una llamada real al proveedor que el prompt con `verticesM` produce la
  misma geometría que antes del indexado? El test solo prueba la transformación.

Status: DONE_WITH_CONCERNS
Summary: Sin bloqueantes; la lógica de costes, el tope de pasadas y el indexado de vértices son correctos y están bien acotados, pero el cambio a ModernSelect deja una fila rota en cocina y controles de 32 px con fondo distinto en los paneles que tenían CSS de módulo para `select`. Mergeable a develop tras corregir los dos puntos de maquetación.
