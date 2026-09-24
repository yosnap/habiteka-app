# Fase 4 · Tira LED bajo módulos altos de cocina

Esfuerzo: 5h · Depende de: fase 3 · Estado: pending

## Contexto

`KitchenRun extends Furniture` se traza por su línea trasera: el origen es el
extremo inicial, `x` recorre el tramo, el cuerpo ocupa el fondo hacia `+y` y
`heightMm` es la cota de la cara superior de la encimera
(`kitchen-run-types.ts`, comentario del tipo). Los módulos altos son
`composition.uppers` (`KitchenUppers`: `bottomMm` medido desde el suelo del
tramo, `heightMm`, `depthMm`); son opcionales.

La conversión local→mundo ya existe: `localToWorld` y `projectAlong`
(`spatial-properties.ts`, usadas en `kitchen-run-commands.ts:5,29`).

## Requisitos

1. Botón «Tira bajo módulos altos» en la ficha del tramo de cocina y también en
   la sección «Tiras LED» del panel de iluminación (un solo comando detrás:
   `addUnderCabinetStrip(doc, kitchenRunId)`).
2. Solo disponible si el tramo tiene `composition.uppers`; si no, botón
   deshabilitado con el motivo.
3. Recorrido **derivado** del tramo (`derived: true`): línea paralela a la
   trasera, a `uppers.depthMm − 30 mm` del fondo, recorriendo todo el largo
   menos 50 mm por extremo, a la cota `elevationMm + uppers.bottomMm − 10 mm`.
   Mientras siga derivada, mover, girar o alargar el tramo la arrastra.
4. **Editable a mano**: arrastrar sus puntos en 2D (o editar la cota) llama a
   `setLightStripPath` y la deja en `derived: false`; desde ahí deja de seguir
   al mueble. Botón «Reajustar al mueble» (`refitLightStrip`) para volver.
5. Dirección de emisión `down`: ilumina la encimera.
6. Borrar el tramo borra su tira, esté derivada o editada (borrado en cascada
   como `removeCeiling` con sus luces). Mover el tramo con la tira ya editada
   NO la mueve: queda donde estaba y, si se descuelga del mueble, sale aviso
   «La tira ajustada a mano ya no queda bajo el mueble; reajústala».
7. Una sola tira `under-cabinet` por tramo (validado en fase 1).

## Ficheros

Modificar:
- `src/lib/editor-document/light-strip-geometry.ts` — rama `under-cabinet` de
  `resolvedStrips` y de `lightStripIssue` («El tramo de cocina no tiene módulos
  altos», «El tramo de cocina ya no existe»).
- `src/lib/editor-document/light-strip-commands.ts` — `addUnderCabinetStrip`.
- `src/lib/editor-document/kitchen-run-commands.ts` — el borrado del tramo
  elimina su tira; quitar `uppers` del tramo deja la tira en incidencia (aviso,
  no borrado silencioso); `updateKitchenRun` refresca la instantánea `pathMm`
  de la tira derivada y no toca la editada a mano.
- El panel de cocina donde se editan los `uppers` (localizar el consumidor de
  `KitchenUppers` en `src/components/editor-v2/`) — botón de alta.
- `src/components/editor-v2/ceiling-lighting-panel.tsx` (o la sección de tiras)
  — alta desde iluminación.

Tests: `tests/editor-document/light-strip-kitchen.test.ts` (nuevo).

## Pasos

1. Resolver el recorrido con `localToWorld` sobre el sistema local del tramo;
   test de rotación (tramo a 0°, 90° y 37°) comparando con puntos calculados a
   mano.
2. Comando de alta con la comprobación de `uppers`.
3. Cascada de borrado y aviso al retirar los módulos altos.
4. Botones en las dos entradas de UI.
5. Comprobar en 3D que la tira queda bajo el módulo y sobre la encimera, sin
   z-fighting con el frente del mueble (separación de 10 mm).

## Validación

```bash
DATABASE_URL=… bun run scripts/test-isolated.ts run \
  tests/editor-document/light-strip-kitchen.test.ts \
  tests/editor-document/kitchen-run.test.ts \
  tests/editor-document/light-strip-geometry.test.ts
```

Casos: tramo sin `uppers` → error al dar de alta; tramo con `uppers` → tira con
longitud = `widthMm − 100` y `derived: true`; girar el tramo 90° mueve el
recorrido de forma coherente; alargar el tramo alarga la tira sin editarla;
tras `setLightStripPath`, mover el tramo **no** mueve la tira y aparece el
aviso de descolgada; `refitLightStrip` la devuelve bajo el mueble; borrar el
tramo borra la tira en ambos estados; quitar `uppers` deja incidencia en
`ceilingWarnings`; dos altas seguidas sobre el mismo tramo → error.

## Riesgos

- **Sistema local del tramo mal interpretado** (prob. media, impacto medio): el
  cuerpo va hacia `+y` local y el trazado es por la línea trasera; equivocar el
  signo pone la tira dentro del muro. Mitigación: tests con coordenadas
  esperadas explícitas en tres rotaciones.
- **Cota relativa** (prob. baja): `uppers.bottomMm` se mide desde el suelo del
  tramo, no desde el nivel del plano; hay que sumar `run.elevationMm`
  (`kitchen-run-commands.ts:29` lo fija con `floorElevationAt`).
- **Tramos en L** (varios `KitchenRun` encadenados): cada tramo lleva su propia
  tira; no se fusionan. Documentarlo en la UI.

## Rollback

Revertir los cambios; las tiras `under-cabinet` existentes quedan como datos
ignorados y validando. Borrarlas con `removeLightStrips` si se desea limpiar.

## Propiedad de ficheros

Exclusiva sobre los `light-strip-*` (tras la fase 3) y los dos puntos de UI.
No coincide con las fases 2, 5 ni 6.
