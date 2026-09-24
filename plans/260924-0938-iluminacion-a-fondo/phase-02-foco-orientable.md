# Fase 2 · Foco orientable: geometría, 2D, 3D y panel

Esfuerzo: 6h · Depende de: fase 1 · Estado: pending

## Contexto

`createLuminaireEmitter` (`ceiling-scene-utils.ts:49`) crea un `SpotLight` con
`target.position.set(0, -1, 0)`: todas las luces apuntan hacia abajo. El ángulo
del cono depende del tipo (`recessed` 50°, `flush` 80°, colgante 65°).

Radio y canto de cada tipo están en `luminaireRadiusMm` /`luminaireDepthMm`
(`ceiling-geometry.ts:34-35`) y la colocación se valida en
`luminairePlacementIssue` (`ceiling-geometry.ts:38`), que exige falso techo
≥ 80 mm para `recessed` (`:42`).

El símbolo 2D se dibuja en `ceiling-lighting-layer.tsx:44-49`; el panel expone
tipos vía `LUMINAIRE_KINDS` (`luminaire-bulk-fields.tsx:6`), reutilizado por
`ceiling-lighting-panel.tsx:14`.

## Requisitos

1. Tipo `spot` seleccionable en el panel (alta individual y edición en bloque),
   con `mount` empotrado o en superficie.
2. `mount: 'recessed'` exige falso techo ≥ 80 mm (misma regla que el foco
   empotrado actual); `mount: 'surface'` no lo exige y admite `dropMm` 0–300.
3. Inclinación 0–60° y giro 0–360° editables con campos numéricos y reflejados
   en 2D y 3D.
4. Los otros tres tipos siguen exactamente igual (sin `tiltDeg` ni `azimuthDeg`).
5. La validación de colocación tiene en cuenta el alcance inclinado: con
   `tiltDeg > 0` el punto al que apunta el foco debe caer dentro de la estancia
   o sobre uno de sus muros; si no, aviso (no bloqueo silencioso) por el canal
   de `ceilingIssues` (`ceiling-geometry.ts:78`).

## Modelo derivado (geometría)

En `ceiling-geometry.ts`:

```ts
luminaireRadiusMm: spot → 60 (recessed) | 90 (surface)
luminaireDepthMm:  spot → 12 (recessed) | 110 (surface)
spotAimPoint(resolved): Point  // x + h·tan(tilt)·cos(az), y + h·tan(tilt)·sin(az)
```
donde `h` = altura libre bajo el foco (`heightMm - elevación del suelo`). El
ángulo del cono del `spot` es 30° (haz de acento), constante.

`ResolvedLuminaire` gana `aim?: { x: number; y: number }` para que 2D, 3D e IA
usen el mismo cálculo (DRY).

## Ficheros

Modificar:
- `src/lib/editor-document/ceiling-geometry.ts` — radio/canto de `spot`,
  `spotAimPoint`, aviso de apuntado fuera de estancia, `LIGHT_KIND_LABEL`
  (`:76`) con «Foco orientable».
- `src/lib/editor-document/ceiling-commands.ts` — `addLuminaire` con defaults
  de `spot` (`mount: 'surface'`, `tiltDeg: 30`, `azimuthDeg: 0`, 550 lm);
  `updateLuminaire` (`:50`) limpia `tiltDeg`/`azimuthDeg`/`mount` al cambiar a
  un tipo no orientable, igual que ya hace con `dropMm` (`:55`).
- `src/components/editor-v2/luminaire-bulk-fields.tsx` — entrada `spot` en
  `LUMINAIRE_KINDS`, campos de montaje/inclinación/giro visibles solo cuando el
  tipo común es `spot`.
- `src/components/editor-v2/ceiling-lighting-panel.tsx` — `LightFields` con los
  mismos campos condicionales; botón «Foco orientable» en «Añadir luminaria».
- `src/components/editor-v2/ceiling-lighting-layer.tsx` — símbolo: círculo con
  una cuña/flecha hacia el azimut, longitud proporcional a la inclinación.
- `src/components/editor-v2/scene/ceiling-scene-utils.ts` —
  `createLuminaireEmitter` orienta el `target` por tilt/azimut y usa 30° de
  cono para `spot`.
- `src/components/editor-v2/scene/ceiling-lighting-meshes.tsx` — cuerpo del
  foco (cilindro corto inclinado) y difusor girado.

Tests: `tests/editor-document/spot-luminaire.test.ts` (nuevo),
`tests/editor-v2/ceiling-scene-utils.test.ts` (ampliar).

## Pasos

1. Geometría: radios, cantos y `spotAimPoint` con test de trigonometría
   (tilt 0 → aim = posición; tilt 45° a 2,5 m → 2,5 m de desplazamiento; azimut
   90° desplaza en +Y).
2. Comandos: defaults, limpieza de campos al cambiar de tipo y regla de
   `mount: 'recessed'` en `luminairePlacementIssue`.
3. Panel + edición en bloque: campos «Montaje», «Inclinación (°)» y «Giro (°)»;
   en bloque, con el aviso «· varios» ya implementado (`luminaire-bulk-fields.tsx:31`).
4. 2D: símbolo direccional; verificar que el arrastre existente sigue funcionando.
5. 3D: `target.position` = vector unitario `(sin(tilt)cos(az), -cos(tilt), sin(tilt)sin(az))`
   en coordenadas de Three (ojo: el plano usa X/Y, Three usa X/Z con Z = y del
   plano); cono 30°, `penumbra` 0,35.
6. Comprobar en el editor que el haz cae donde marca el símbolo 2D.

## Validación

```bash
DATABASE_URL=… bun run scripts/test-isolated.ts run \
  tests/editor-document/spot-luminaire.test.ts \
  tests/editor-document/ceiling-commands.test.ts \
  tests/editor-v2/ceiling-scene-utils.test.ts
```

Casos: alta de `spot` en techo plano con `mount: 'surface'` (permitido) y con
`recessed` (error «necesita un falso techo»); cambio `spot` → `flush` deja el
documento sin `tiltDeg`; `spotAimPoint` en los cuatro cuadrantes; aviso cuando
el punto apuntado cae fuera de la estancia; el vector de `target` coincide con
`spotAimPoint` proyectado (test compartido 2D/3D para evitar el desfase
histórico de pivotes 2D↔3D).

## Riesgos

- **Convención de ejes 2D↔3D** (prob. alta, impacto alto): el repo ya arrastra
  un desfase entre el pivote de Konva y el de la escena. Mitigación: una sola
  función `spotAimPoint` en el dominio, y el test que compara símbolo 2D y
  `target` 3D contra el mismo punto.
- **Sombras**: cada `SpotLight` con `castShadow` cuesta; los focos entran en el
  mismo presupuesto de 12 (`MAX_LUMINAIRE_LIGHTS`). Mitigación: `spot` con
  `shadow.mapSize` 512 como el resto; no se amplía el presupuesto.
- **Foco inclinado que ilumina otra estancia** (prob. media, impacto bajo): se
  resuelve con aviso, no con bloqueo, para no frenar diseños válidos (haz sobre
  un muro medianero).

## Rollback

Fase aditiva: revertir estos ficheros deja los focos existentes como
luminarias con campos no leídos. Para revertir limpio hay que borrar de los
documentos los `kind: 'spot'` (comando puntual) o dejarlos: la validación de
la fase 1 los sigue aceptando.

## Propiedad de ficheros

Exclusiva sobre `ceiling-lighting-layer.tsx`, `ceiling-scene-utils.ts`,
`ceiling-lighting-meshes.tsx`, `luminaire-bulk-fields.tsx`. Comparte
`ceiling-geometry.ts` y `ceiling-commands.ts` con la fase 3: si se ejecutan en
paralelo, la fase 3 añade ficheros nuevos y solo toca estos dos al final.
