# Fase 5 · Escenas de iluminación por estancia

Esfuerzo: 5h · Depende de: fase 1 · Estado: pending

## Contexto

Hoy la edición en bloque existe (`updateLuminaires`, `ceiling-commands.ts:91`,
y `LuminaireBulkFields`), pero es un cambio destructivo: no se puede volver al
ambiente anterior ni comparar dos ambientes. Una escena guarda el ambiente y lo
aplica cuando se activa.

Las luminarias pertenecen a un techo (`Luminaire.ceilingId`) y el techo a una
estancia (`Ceiling.roomId`), así que «las luces de una estancia» se resuelve por
`ceilingSurfaces` (`ceiling-geometry.ts:19`). Las tiras dan su estancia en
`ResolvedStrip.roomId` (fase 3).

## Requisitos

1. Escenas guardadas por estancia (máximo 4), con nombre, temperatura,
   intensidad (% sobre los lúmenes nominales) y la lista de luces/tiras
   apagadas.
2. «Guardar el ambiente actual como escena» captura el estado de la estancia;
   «Aplicar» lo devuelve en un solo paso deshacible.
3. Como máximo una escena activa por estancia; activar otra desactiva la
   anterior (validado en fase 1).
4. **La escena no destruye los valores nominales**: `temperatureK`/`lumens` de
   cada luminaria se conservan; la escena es una capa que se aplica al
   resolver. `resolvedLuminaires` y `resolvedStrips` devuelven los valores
   efectivos; el panel sigue editando los nominales.
5. El 3D y la IA usan los valores efectivos (ya lo harán por venir de
   `resolved*`).
6. Renombrar, borrar y desactivar escenas.

## Modelo efectivo

`src/lib/editor-document/lighting-scene.ts` (nuevo):

```ts
activeSceneForRoom(doc, roomId): LightingScene | null
effectiveLuminaire(light, scene): { temperatureK, lumens, enabled }
effectiveStrip(strip, scene): { temperatureK, lumensPerMeter, enabled }
captureScene(doc, roomId, name): Omit<LightingScene, 'id'>
```

Regla de aplicación:
- `enabled` efectivo = `light.enabled && !scene.offLightIds.includes(light.id)`.
- `lumens` efectivo = `round(light.lumens * scene.intensityPct / 100)`, acotado
  al rango de validación (50–10000) solo para el cálculo, sin escribirlo.
- `temperatureK` efectivo = `scene.temperatureK`.
- Sin escena activa, los valores efectivos son los nominales (identidad).

`resolvedLuminaires` (`ceiling-geometry.ts:65`) y `resolvedStrips` incorporan
los valores efectivos en su salida (campos `effective*`), sin cambiar los
existentes, para no romper a sus consumidores actuales
(`ceiling-lighting-meshes.tsx:70`, `ceiling-design-context.ts:19`).

## Ficheros

Crear:
- `src/lib/editor-document/lighting-scene.ts`
- `src/lib/editor-document/lighting-scene-commands.ts` — `saveLightingScene`,
  `applyLightingScene`, `deactivateLightingScene`, `renameLightingScene`,
  `removeLightingScene`.
- `src/components/editor-v2/lighting-scene-section.tsx` — UI de la sección.

Modificar:
- `src/lib/editor-document/ceiling-geometry.ts` — valores efectivos en
  `resolvedLuminaires`.
- `src/lib/editor-document/light-strip-geometry.ts` — ídem en `resolvedStrips`.
- `src/components/editor-v2/ceiling-lighting-panel.tsx` — montar la sección en
  el ámbito «Una estancia».
- `src/components/editor-v2/scene/ceiling-lighting-meshes.tsx` y
  `light-strip-meshes.tsx` — consumir los valores efectivos.

Tests: `tests/editor-document/lighting-scene.test.ts` (nuevo).

## Pasos

1. `lighting-scene.ts` puro, con tests de identidad (sin escena → nominal) y de
   aplicación.
2. Comandos sobre `upgradeLightingDocument`, todos cerrando con
   `parseEditorDocument`.
3. Valores efectivos en las dos funciones `resolved*`.
4. Sección de UI: lista de escenas de la estancia, botón «Guardar ambiente
   actual», activar/desactivar, renombrar, borrar; sin `useEffect` (estado
   derivado del documento y reseteo por `key` al cambiar de estancia).
5. 3D consumiendo lo efectivo; comprobar que activar una escena cambia el
   ambiente al instante.

## Validación

```bash
DATABASE_URL=… bun run scripts/test-isolated.ts run \
  tests/editor-document/lighting-scene.test.ts \
  tests/editor-document/ceiling-commands.test.ts \
  tests/editor-document/ceiling-bulk-commands.test.ts
```

Casos: capturar el ambiente de una estancia con 3 luces (una apagada) produce
una escena con esa luz en `offLightIds`; aplicar una segunda escena desactiva
la primera; `intensityPct: 50` deja los `lumens` nominales intactos en el
documento y devuelve la mitad en `resolvedLuminaires`; borrar una luminaria
limpia su id de las escenas; escena de una estancia no afecta a otra; deshacer
la aplicación restaura el estado anterior (el comando es un solo `apply`).

## Riesgos

- **Duplicidad nominal/efectivo** (prob. media, impacto medio): si algún
  consumidor lee `luminaire.lumens` en vez del efectivo, el 3D y la IA se
  contradicen. Mitigación: enumerar y revisar los consumidores actuales de
  `resolvedLuminaires` — `ceiling-lighting-meshes.tsx:70`,
  `ceiling-design-context.ts:19` — y de `luminaire.lumens` directo —
  `ceiling-scene-utils.ts:52` (`light.power`), `luminaire-bulk-fields.tsx:44`,
  `ceiling-lighting-panel.tsx` (`LightFields`), `lighting-proposal.ts:32`. Los
  dos últimos editan valores nominales y deben seguir haciéndolo.
- **Ids huérfanos en escenas** al borrar luces/tiras (prob. alta, impacto bajo):
  limpiar en `removeLuminaire(s)` y `removeLightStrip(s)`.
- **Escena aplicada como edición destructiva por confusión de UI** (prob.
  media): dejar claro en el texto que la escena no cambia los valores de cada
  luminaria.

## Rollback

Revertir los ficheros; las escenas guardadas quedan como datos inertes que
siguen validando. Sin escena activa el comportamiento es idéntico al actual.

## Propiedad de ficheros

Exclusiva sobre `lighting-scene*`. Comparte `ceiling-geometry.ts` y
`ceiling-lighting-panel.tsx` con las fases 2 y 3.
