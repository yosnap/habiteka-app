---
title: "Iluminación a fondo en el editor v2"
description: "Foco orientable, tiras LED (foseado, bajo módulos altos, tramo libre) y escenas de iluminación por estancia, con 2D, 3D e integración con el diseño IA."
status: pending
priority: P2
effort: 43h
branch: feat/iluminacion-y-costes-zonas
tags: [editor-v2, iluminacion, schema, 3d, ia]
created: 2026-09-24
---

# Iluminación a fondo

## Resultado buscado

El editor v2 pasa de «tres luminarias que apuntan hacia abajo» a un sistema de
iluminación completo y escalable:

1. **Foco orientable** (`spot`), empotrado o en superficie, con inclinación
   0–60° y giro 0–360°. Plafón, colgante y foco empotrado siguen apuntando hacia
   abajo, sin cambios de comportamiento.
2. **Tiras LED** en sus tres usos: foseado perimetral de falso techo (un clic
   por estancia), bajo módulos altos de un tramo de cocina, y tramo libre
   dibujado como línea con cota, color/temperatura y potencia.
3. **Iluminación por zona**: escenas por estancia (temperatura, intensidad, qué
   luces encendidas) aplicadas de golpe y respetadas por el diseño IA; y zonas
   de luces **guardadas en el proyecto** (con nombre, reutilizables) que acotan
   qué luces se seleccionan, editan o proponen.

Todo esto visible en 2D (símbolos/líneas), en 3D (dentro del presupuesto de
luces reales de WebGL) y descrito al motor de diseño IA sin pasarse del tope del
prompt compacto.

## Restricciones

- **Un solo bump de `schemaVersion`**: 11 → 12 cubre foco orientable, tiras LED,
  escenas y zonas de luces. `src/lib/editor-document/schema.ts:181`.
- **Rama**: este trabajo arranca en una rama nueva desde `develop`, después de
  cerrar y mergear la rama de costes por zona. No se planifica merge conjunto
  de `interior-prompt-scope.ts`.
- **Compatibilidad**: leer un documento antiguo no lo cambia nunca. La migración
  solo ocurre al editar, con el patrón `upgradeCeilingDocument`
  (`ceiling-commands.ts:9`) / `upgradeKitchenDocument`
  (`kitchen-run-commands.ts:11`). Los documentos < 12 siguen validándose sin los
  campos nuevos (`validation.ts:58`).
- **Tope duro del prompt compacto**: `COMPACT_PROMPT_LIMIT = 4800`
  (`interior-prompt-scope.ts:16`), hoy a ~200 caracteres del tope con un plano
  real. Cada dato nuevo entra con su paso de degradación en `fitCompactPrompt`
  (`interior-prompt-scope.ts:399`).
- **Presupuesto WebGL**: `MAX_LUMINAIRE_LIGHTS = 12`
  (`ceiling-scene-utils.ts:5`). Las tiras NO añaden una luz real por metro:
  material emisivo siempre + un máximo de 4 luces reales de tira, descontadas
  del mismo presupuesto de 12.
- Reglas del repo: ficheros ≤ 1000 líneas, sin `useEffect` directo en
  componentes, textos de UI en castellano, catálogo e interacción en un solo
  sitio (un `LIGHT_KINDS`/`STRIP_KINDS` compartido por panel, capa 2D y 3D).
- Tests con Vitest:
  `DATABASE_URL=postgres://…/habiteka_test_editor_v2 bun run scripts/test-isolated.ts run <ficheros>`.
- Sin commits en esta rama por parte del agente; Paulo decide cuándo commitear.

## Fuera de alcance

- Cálculo fotométrico real (lux sobre plano de trabajo, curvas IES, UGR).
- Domótica: escenas programadas por hora, integración con Hue/KNX, circuitos y
  conmutación real (interruptores, grupos eléctricos).
- Luminarias exteriores/fachada, balizas de suelo y luz de patios/terrazas
  (`eligibleCeilingRooms` sigue excluyendo espacios no interiores,
  `ceiling-geometry.ts:13`).
- Tiras LED curvas o con radio; el tramo libre es una polilínea de segmentos
  rectos.
- Costes/presupuesto de iluminación (vive en el trabajo paralelo de costes por
  zona de esta misma rama).
- Inclinación de plafón/colgante/empotrado: descartada, la orientación entra
  solo con el foco orientable.

## Fases

| # | Fase | Esfuerzo | Estado | Depende de |
|---|------|----------|--------|-----------|
| 1 | [Modelo v12 + migración compartida](phase-01-modelo-v12.md) | 7h | pending | — |
| 2 | [Foco orientable: 2D, 3D y panel](phase-02-foco-orientable.md) | 6h | pending | 1 |
| 3 | [Tiras LED: geometría, foseado y tramo libre](phase-03-tiras-led-base.md) | 10h | pending | 1 |
| 4 | [Tira bajo módulos altos de cocina](phase-04-tira-cocina.md) | 5h | pending | 3 |
| 5 | [Escenas de iluminación por estancia](phase-05-escenas.md) | 5h | pending | 1 |
| 6 | [Zonas de luces guardadas](phase-06-zona-luces.md) | 5h | pending | 2, 3, 5 |
| 7 | [Integración con diseño IA y propuesta de luces](phase-07-ia-y-propuesta.md) | 5h | pending | 2, 3, 4, 5 |

Las fases 2, 3 y 5 son paralelizables entre sí tras la 1 (ficheros disjuntos,
ver «Propiedad de ficheros» en cada fase). La 4 espera a la 3; la 6 y la 7
cierran.

## Modelo de datos (resumen; detalle en fase 1)

```ts
// Luminaire (ampliado)
kind: 'pendant' | 'flush' | 'recessed' | 'spot';
mount?: 'recessed' | 'surface';   // solo spot; obligatorio en spot
tiltDeg?: number;                 // solo spot; 0–60, 0 = hacia abajo
azimuthDeg?: number;              // solo spot; 0–360, 0 = +X del plano, horario

// LightStrip (colección nueva doc.lightStrips)
id: string;
kind: 'cove' | 'under-cabinet' | 'free';
ceilingId?: string;      // cove: obligatorio, uno por techo (falso techo ≥80 mm)
kitchenRunId?: string;   // under-cabinet: obligatorio, uno por tramo con uppers
pathMm: Point[];         // SIEMPRE guardado: 2–24 puntos, longitud total ≤ 60 m
derived: boolean;        // true = sigue al muro/mueble; false = recorrido retocado a mano
elevationMm: number;     // 0–4000 desde el suelo acabado de su estancia
color: string;           // #rrggbb
temperatureK: number;    // 1800–6500
lumensPerMeter: number;  // 50–2000
enabled: boolean;

// LightingScene (colección nueva doc.lightingScenes)
id: string;
roomId: string;          // room:[...] como Ceiling.roomId
name: string;            // 1–40 caracteres
temperatureK: number;    // 1800–6500
intensityPct: number;    // 10–150, factor sobre lumens/lumensPerMeter
offLightIds: string[];   // luces de la estancia apagadas en la escena
offStripIds: string[];   // tiras de la estancia apagadas en la escena
active: boolean;         // máximo una activa por estancia

// LightZone (colección nueva doc.lightZones)
id: string;
name: string;            // 1–40 caracteres
polygonMm: Point[];      // 3–20 vértices, mismo contrato que renderDesignOptionsSchema
```

**Tiras derivadas vs. editadas**: foseado y tira de cocina nacen con
`derived: true` y su recorrido se recalcula a partir del contorno de la
estancia o del tramo de cocina (sigue al muro/mueble). En cuanto el usuario
mueve un punto, la tira pasa a `derived: false` y su `pathMm` manda; el botón
«Reajustar al muro» / «Reajustar al mueble» vuelve a `derived: true` y
recalcula. El tramo libre nace siempre con `derived: false`.

**Zonas de luces**: se guardan en el proyecto con nombre y son reutilizables
(seleccionar, editar en bloque y proponer luces dentro). El dibujo reutiliza
`render-region-draw.ts`; la validación es la misma forma de polígono que las
zonas de render.

## Criterios de aceptación

- [ ] Un documento v11 guardado hoy se lee, se renderiza en 2D/3D y se envía a
      IA sin cambiar su `schemaVersion` ni su contenido (test de regresión).
- [ ] Al editar iluminación, el documento sube a v12 una sola vez y valida con
      `parseEditorDocument`; volver a editar no vuelve a migrar.
- [ ] Se puede crear un foco orientable empotrado o en superficie, fijar
      inclinación 0–60° y giro 0–360°, verlo apuntar en 3D a la pared/objeto y
      ver su cono de dirección en 2D.
- [ ] Un clic en una estancia con falso techo ≥ 80 mm crea el foseado
      perimetral; se ve como línea discontinua interior en 2D y como halo
      emisivo perimetral en 3D.
- [ ] Un tramo de cocina con módulos altos acepta tira bajo mueble en un clic y
      la encimera se ve iluminada en 3D.
- [ ] Se puede dibujar un tramo libre de tira con cota, color, temperatura y
      lm/m, y editarlo/moverlo después.
- [ ] Una escena por estancia aplica temperatura, intensidad y encendido a todas
      las luces y tiras de esa estancia en un solo paso deshacible.
- [ ] Una zona de luces guardada con nombre sobrevive a recargar el proyecto;
      «seleccionar luces de la zona» selecciona exactamente las que caen dentro
      y la propuesta se limita a esa zona.
- [ ] Mover un punto del foseado lo desliga del contorno (deja de recalcularse)
      y «Reajustar al muro» lo devuelve al contorno derivado; lo mismo con la
      tira de cocina y su tramo.
- [ ] En 3D nunca se superan 12 luces reales simultáneas con cualquier
      combinación de luminarias y tiras (test sobre el selector de presupuesto).
- [ ] El prompt compacto de una vista interior de un plano real con focos,
      tiras y escena activa mide ≤ 4800 caracteres (test).
- [ ] `ceilingDesignContext` describe focos (tilt/azimut), tiras (tipo, cota,
      lm/m, recorrido) y escena activa, y la política de render lo prohíbe
      alterar en modo estricto.
- [ ] Toda la suite de iluminación en verde:
      `tests/editor-document/ceiling-commands.test.ts`,
      `ceiling-bulk-commands.test.ts`, `lighting-proposal.test.ts`,
      `validation.test.ts`, `tests/editor-v2/ceiling-scene-utils.test.ts`,
      `tests/agent/ceiling-render-prompt.test.ts`,
      `interior-prompt-length.test.ts`, `compact-prompt-lossless.test.ts`.

## Riesgos transversales

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| El prompt compacto se pasa de 4800 al añadir focos/tiras/escenas | Alta | Alto | Fase 7: pasos de degradación nuevos (tiras → nº por estancia, escena → cadena corta, tilt/azimut redondeados a grado) + test con plano real |
| Rendimiento WebGL al sumar tiras | Media | Alto | Emisivo siempre, luces reales solo 4 como máximo y dentro del presupuesto único de 12; orden estable por prioridad |
| Validación de colocación demasiado estricta bloquea tiras legítimas | Media | Medio | El foseado y la tira de cocina derivan su recorrido de geometría ya validada; solo el tramo libre valida (dentro de estancia, sin cruzar muros, cota libre) |
| Un solo bump de versión hecho a trozos deja documentos a medias | Media | Alto | Fase 1 entrega la migración completa y cerrada; las fases 2–5 no tocan `schemaVersion` |
| Ficheros de iluminación pasando de 1000 líneas | Media | Bajo | `light-strip-*.ts`/`lighting-scene-*.ts` como módulos nuevos; el panel se parte en secciones |

## Preguntas abiertas

Ver el cierre del informe al orquestador.
