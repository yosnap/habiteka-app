# Fase 7 · Integración con el diseño IA y propuesta de luces

Esfuerzo: 5h · Depende de: fases 2, 3, 4 y 5 · Estado: pending

## Contexto

El contexto físico que ve el motor de diseño lo produce `ceilingDesignContext`
(`ceiling-design-context.ts:12`), con dos textos de política:
`CEILING_RENDER_POLICY` (~900 caracteres, `:6`) para el prompt completo y
`CEILING_RENDER_POLICY_COMPACT` (~480, `:9`) incrustado en
`COMPACT_RENDER_POLICY` (`compact-render-context.ts`, bloque final).

El prompt compacto tiene tope duro de 4800 (`interior-prompt-scope.ts:16`, con
200 de margen sobre el 5000 real de KIE) y **ya está a unos 200 caracteres del
tope con un plano real**. `fitCompactPrompt` (`:399`) degrada por pasos:
redondeo a 3 decimales, sin nombres, redondeo a 2, sin detalle de forjado, solo
la estancia de la cámara y, en vista exterior, contornos fuera y luminarias
resumidas por estancia (`summarizedLuminaires`, `:377`). El último recurso
simplifica contornos con tolerancia creciente.

La propuesta local determinista es `proposeLighting` /
`proposeLightingForPlan` (`lighting-proposal.ts:12,65`); usa `flush`/`recessed`
para la general y `pendant` sobre mesas/islas.

## Requisitos

1. `ceilingDesignContext` incluye:
   - en cada luminaria `spot`: `mount`, `tiltDeg`, `azimuthDeg` y `aimM`
     (punto al que apunta, en metros);
   - `lightStrips`: `id`, `roomId`, `kind`, `elevationM`, `lengthM`,
     `lumensPerMeter`, `temperatureK`, `enabled`, `direction`, y `pathM` solo
     cuando `derived === false` (las derivadas se deducen del contorno de la
     estancia o del tramo de cocina, geometría que el prompt ya lleva);
   - las **zonas de luces guardadas** NO se envían: son una herramienta de
     edición, no geometría del proyecto, y cada zona costaría ~90 caracteres
     del presupuesto del prompt;
   - `lightingScene` por estancia cuando hay una activa:
     `{ roomId, name, temperatureK, intensityPct }`.
   - Los valores de luminarias y tiras son los **efectivos** (fase 5).
2. Ambas políticas se amplían con una frase por concepto, **sin que
   `CEILING_RENDER_POLICY_COMPACT` crezca más de 180 caracteres**.
3. `fitCompactPrompt` gana pasos de degradación para lo nuevo, antes de tocar
   lo que ya se degrada hoy:
   - redondear `tiltDeg`/`azimuthDeg` a grado entero (siempre, no es
     degradación real);
   - sustituir `pathM` de las tiras con recorrido propio (libres o ajustadas a
     mano) por sus extremos;
   - resumir tiras por estancia (`{roomId, count, kind}`);
   - eliminar `lightingScene` (su efecto ya va en los valores efectivos de cada
     luz).
4. `proposeLighting` acepta opciones: zona (polígono de la fase 6), uso de
   focos orientables (p. ej. acento sobre pared con cuadro/TV) y foseado cuando
   la estancia tiene falso techo.
5. El test de longitud del prompt con plano real sigue en verde con todo
   activado.

## Ficheros

Modificar:
- `src/lib/editor-document/ceiling-design-context.ts` — nuevos bloques y
  políticas.
- `src/server/agent/editor-v2/interior-prompt-scope.ts` — tipos `ScopeLevel`
  (`:70`) con `lightStrips` y `lightingScenes`, y los pasos nuevos en
  `fitCompactPrompt` (`:399`).
- `src/server/agent/editor-v2/selected-view-prompt.ts` — incluir tiras y
  escena donde hoy pasa `ceilings`/`luminaires` (`:153`, `:181`).
- `src/lib/editor-document/lighting-proposal.ts` — opciones de propuesta.
- `src/components/editor-v2/ceiling-lighting-panel.tsx` y
  `ceiling-plan-section.tsx` — activar las opciones de propuesta.

Tests a ampliar: `tests/agent/ceiling-render-prompt.test.ts`,
`tests/agent/interior-prompt-length.test.ts`,
`tests/agent/compact-prompt-lossless.test.ts`,
`tests/agent/selected-view-prompt.test.ts`,
`tests/editor-document/lighting-proposal.test.ts`.

## Pasos

1. Ampliar `ceilingDesignContext` y su test de contrato.
2. Redactar las dos políticas; medir la longitud del compacto con un test que
   fije el máximo (`expect(CEILING_RENDER_POLICY_COMPACT.length).toBeLessThan(660)`).
3. Añadir las colecciones al scope y los pasos de degradación.
4. Test de longitud con el plano real de la fixture, con focos, foseado en
   todas las estancias, tira de cocina y escena activa: el prompt debe caber en
   4800 y conservar geometría (el test «lossless» ya comprueba que no se corta
   JSON).
5. Opciones de `proposeLighting` y su UI.

## Presupuesto de caracteres (estimación)

| Concepto | Coste bruto | Tras degradación |
|---|---|---|
| Política compacta ampliada | +180 | +180 (nunca se degrada) |
| `mount/tilt/azimuth` por foco | ~22 c/foco | ~22 (ya mínimos) |
| Tira derivada (`cove`/cocina) | ~70 c/tira | ~24 al resumir por estancia |
| Tira con recorrido propio (`free` o ajustada a mano) | ~110 c/tira | ~40 con solo extremos |
| Escena activa | ~55 c/estancia | 0 al eliminarse |

Con 8 estancias, 8 foseados y 2 tiras libres el peor caso bruto ronda +900
caracteres; los tres pasos nuevos recuperan ~600, y el paso ya existente
«solo la estancia de la cámara» (`onlyCameraRoom`) deja en vista interior una
sola estancia con sus tiras. El riesgo real está en la **vista exterior**, donde
no hay estancia de cámara: por eso el resumen de tiras por estancia se coloca
junto a `summarizedLuminaires`.

## Validación

```bash
DATABASE_URL=… bun run scripts/test-isolated.ts run \
  tests/agent/ceiling-render-prompt.test.ts \
  tests/agent/interior-prompt-length.test.ts \
  tests/agent/compact-prompt-lossless.test.ts \
  tests/agent/selected-view-prompt.test.ts \
  tests/editor-document/lighting-proposal.test.ts
```

Casos: prompt interior y exterior del plano real con iluminación completa ≤ 4800;
degradación aplicada en el orden previsto (comprobando qué claves sobreviven);
`spot` llega con `aimM` coherente con `spotAimPoint`; en modo `strict` la
política prohíbe añadir tiras; propuesta acotada a zona no coloca luces fuera
del polígono; propuesta con foseado solo lo propone en estancias con falso
techo.

## Riesgos

- **Tope del prompt** (prob. alta, impacto alto): es el riesgo dominante de la
  fase. Mitigación: pasos de degradación nuevos + test con plano real + tope
  fijado por test para el texto de política.
- **Política más larga = menos sitio para geometría** (prob. alta, impacto
  medio): cada carácter de política es fijo. Mitigación: redacción telegráfica
  al estilo de la actual y límite verificado por test.
- **La IA reinterpreta la escena** (prob. media, impacto medio): al enviar
  valores efectivos, la escena es descriptiva; mandar además `intensityPct`
  podría inducir doble aplicación. Mitigación: la política dice explícitamente
  que los valores ya incluyen la escena.
- **Propuesta con focos que apuntan a nada** (prob. media, impacto bajo):
  limitar el acento a paredes con hueco/objeto detectado; si no hay, no
  proponer focos.

## Rollback

Revertir esta fase deja las funcionalidades en el editor pero invisibles para
la IA (comportamiento anterior, seguro). Es el punto de corte natural si el
prompt no cupiera.

## Propiedad de ficheros

Exclusiva sobre `interior-prompt-scope.ts`, `selected-view-prompt.ts`,
`ceiling-design-context.ts` y `lighting-proposal.ts`. La rama de costes por
zona se cierra y mergea a `develop` antes de empezar, así que estos ficheros
llegan limpios y no hay merge conjunto que planificar. Sí conviene medir la
longitud real del prompt compacto **después** de ese merge: el margen de 200
caracteres puede haber cambiado.
