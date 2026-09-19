# Cocina modular · fases 1 y 2 (contrato + geometría) — 2026-09-19

Plan: `plans/260919-1453-cocina-modular/plan.md`. Rama `feat/planos-ia`. SIN commit.

## Hecho

- Nueva entidad `KitchenRun` (colección `kitchenRuns`, esquema 11): `src/lib/editor-document/kitchen-run-{types,validation,commands,volumes}.ts`.
- Comandos: `addKitchenRun` (trazado por línea trasera, cota de suelo automática), `updateKitchenRun`, `addKitchenSlot`/`putKitchenSlot`/`removeKitchenSlot`, `splitKitchenRun`, `upgradeKitchenDocument`, `projectKitchenRun`.
- Geometría única para planta, 3D, colisiones y navegación: zócalo retranqueado, carcasa, un frente y tirador por módulo (ritmo `moduleWidthMm`), encimera con material, módulos altos opcionales, aparatos (fregadero, vitro, lavavajillas, horno, frigorífico columna) con recorte por capa. Esquinas en L con módulo compartido.
- Registro en `planObjects`, `furnitureVolumes`, `updateFurniture`/`paintElement` (partes `worktop`, `plinth`, `uppers`), borrado, portapapeles (ids de aparatos regenerados), colocación (junta en esquina, pilar embebido), recalibrado, flechas sobre aparatos, imanes a bordes de aparatos, buscador, edición en bloque (aparatos no se copian), menú «Seleccionar → Todas las cocinas», apoyo en suelo, etiqueta «Cocina lineal», símbolo procedural en planta y enlace de avisos 3D al aparato.
- `projectAlong` compartido en `spatial-properties.ts`; `projectBoundary` delega en él.

## Verificación

- `tsc --noEmit` limpio; `eslint` limpio en los ficheros tocados.
- `tests/editor-document/kitchen-run.test.ts`: 10 tests (trazado/undo, huella y despiece, recortes de aparatos, validación, colisiones con muro/tramo/pilar, esquina en L sin solape 3D, apoyo en suelo, copiar/pegar/borrar/flechas, buscador/selección/bloque/pintura, migraciones sin degradación).
- Suite completa contra `habiteka_test_editor_v2`: 1384 ✓ / 4 ✗ — los 4 fallos son los ya conocidos y ajenos (`model-config-loader` ×3, `gateway-fallback`, `config-ops` import server-only).

## Pendiente (fases 3–6)

3. Herramienta «Cocina» en Construir (clics por tramos, imán a caras de muro, Esc), inspector con composición/altos/encimera/lista de aparatos, aparatos arrastrables en planta (patrón `onGateMove` con `slotId`).
4. Catálogo de aparatos en UI; omitir altos sobre ventanas del muro de apoyo; recorte alrededor de columnas (ambos entran por `kitchenRunCuts`); prohibir aparato sobre el hueco de un pilar.
5. Apoyo de objetos sobre encimera (generalizar `object-floor-rest`); contexto IA de la composición (`kitchenDesignContext`, política de render).
6. Sofás: chaise longue, rinconera, modular, sofá cama.

No verificado en navegador (no se lanza el dev server desde aquí).

## Fase 3 (misma sesión, 17:30) — herramienta, dibujo e inspector

- Construir → **Cocina** (`construction-menu.tsx`, `construction-catalog.tsx`, herramienta `kitchen` en `store.ts`). Trazado por clics como los cerramientos (`canvas-view.tsx`): el puntero se pega a la cara de muro visible más cercana (`kitchen-run-placement.ts` · `snapToWallFace`, tolerancia 24 px ≥ 15 cm) y el tramo se orienta solo para que el cuerpo caiga hacia la estancia (`orientKitchenRun`, normal de la cara más cercana al centro del tramo). Lejos de muros se respeta el orden dibujado.
- Planta: los aparatos son piezas seleccionables y arrastrables a lo largo del tramo, con el mismo mecanismo que las puertas de valla. `FurnitureSymbol` pasa de props `gate*` a `part*` (`gateId ?? slotId`) y `document-layer.tsx` resuelve el dueño con `linear-part-owner.ts` (puerta o aparato).
- Inspector: `kitchen-fields.tsx` con bajos (zócalo, grosor y color/material de encimera, ancho de módulo, color/material de frentes), altos (activar, cota inferior, altura, fondo, color, material), dividir tramo, lista de aparatos (tipo, centro, ancho, color, eliminar) y desplegable para añadir. Seleccionar un aparato en planta abre la cocina con ese aparato resaltado. Campos base renombrados: Longitud, Fondo, Altura de encimera.
- Desviación respecto al plan: los aparatos se añaden desde el inspector (desplegable + botón), no arrastrando desde el catálogo. Cubre el caso de uso con menos superficie de UI; si Paulo lo quiere por arrastre, entra en la fase 4 con el catálogo.
- Verificación: `tsc` y `eslint` limpios; `tests/editor-document/kitchen-run-placement.test.ts` (imán y orientación en los dos sentidos y en muro oeste); suites editor-document/canvas/editor-v2: 850 ✓. Sin prueba en navegador todavía.

## Cómo probarlo en el navegador

1. Editor v2 → Construir → Cocina → «Mueble lineal de cocina». Clic junto a la cara interior de un muro (se pega), segundo clic más adelante: aparece el mueble con encimera. Esc para salir.
2. Seleccionarlo → Propiedades: activar módulos altos, añadir «Horno», «Fregadero», «Frigorífico columna». Arrastrar el aparato en planta.
3. Vista 3D: bajos con frentes y tiradores, encimera, altos, aparatos recortando. Trazar un segundo tramo en L desde la misma esquina: sin error de colisión y sin encimeras solapadas.
4. Pilar sobre el tramo: se admite (recorte visual pendiente, fase 4).

## Feedback de Paulo tras probar (18:00–18:30) y arreglos, verificados en su navegador con «Finca»

- **Lavadora**: nuevo aparato `lavadora` (vacía la base como el lavavajillas, ojo de buey en el frente). No hace falta cortar el tramo: se añade desde Propiedades → Aparatos.
- **«No me deja agregarla»**: `addKitchenSlot` colocaba siempre en el centro y el segundo aparato chocaba con el primero. Ahora busca el primer hueco libre desde el centro hacia los extremos (`freeSlotPosition`) y avisa «No queda hueco libre» si el tramo está lleno. Probado: dos lavadoras seguidas sin error.
- **Pintar / materiales «no me hace caso»**: el panel «Pintar» del elemento solo ofrecía «Color del elemento». Ahora para una cocina ofrece Frentes, Encimera, Zócalo y Módulos altos (si los hay), con selector de material fotografiado en frentes, encimera y altos. Probado: Encimera → Marble 01 aplicado.
- **Selección múltiple con Mayús**: Mayús+clic funcionaba (verificado: «2 elementos seleccionados»), pero un clic con un leve arrastre de trackpad disparaba `dragStart`, que vaciaba la selección y dejaba solo el último. Ahora con Mayús/⌘/Ctrl el arrastre suma el objeto a la selección, y un arrastre < 4 px se trata como clic sin mover nada (`document-layer.tsx`).
- Los tiradores de mover/girar/redimensionar no aplicaban a cocinas (`object-transform-controls.tsx` no mapeaba `kitchenRuns`). Corregido.
- En planta los aparatos bajo encimera quedaban tapados por la encimera: el símbolo 2D los dibuja ahora encima (`furniture-symbol.tsx`), así se ven y se arrastran.
- Nota: en el proyecto «Finca» queda un borrador local mío de prueba («Recuperar · 4 cambios», ~18:00) además del de Paulo (207 cambios); se puede ignorar o abrir la revisión del servidor.

## Bloque «apoyo sobre mueble y alineación» (18:35–18:50) · ampliación de la fase 5

- `hostId` en el mobiliario: el objeto se apoya en el mueble cuya huella contiene su centro (`object-host-rest.ts`): al ganar anfitrión toma la cota de su cara superior y su orientación; si sigue sobre él sube con su altura pero respeta una cota puesta a mano más alta; si lo pierde vuelve al suelo (y `restObjectsOnFloors` lo deja en el suelo de la estancia). Solo se apoyan objetos de sobremesa: pantallas, plantas, lámparas y electrodomésticos ≤ 60 cm; un aparato de pie o un mueble nunca se sube a una encimera. Anfitriones: muebles con cara plana (cabinet, table, shelf, kitchen, bench, appliance) y tramos de cocina (encimera).
- Colisiones: apoyado y anfitrión no chocan entre sí (`spatial-placement.ts`).
- Giro contra el muro (`wall-back-alignment.ts`): al acercar un mueble a un muro recto se gira paralelo con la trasera contra la cara, como una puerta; solo si ya está más o menos paralelo (frente o trasera hacia el muro), uno perpendicular a propósito se respeta.
- Soltar un objeto no seleccionado aplica ya la colocación completa (giro, cota, anfitrión), no solo el desplazamiento (`document-layer.tsx`).
- Verificado con el plano real «Finca» exportado de la BD local: la «Pantalla de televisión» que Paulo había subido a mano queda apoyada sola en el mueble (1,50 m) y un televisor nuevo se coloca a esa cota girado 90° como el mueble; el error «atraviesa» que vi en el navegador era que ya había una pantalla en ese mueble. La «Cocina con fogones» (90 cm) ya no se sube a la encimera.
- Tests: `tests/editor-document/object-host-rest.test.ts` (5). Suites editor-document/canvas/editor-v2 en verde.

## Descansillo contra la esquina del patio (18:51–19:00)

- Síntoma (Paulo): el descansillo a cota 1 m no se deja pegar a la línea de columnas del patio; «El elemento atraviesa una pared u otro objeto».
- Causa, reproducida con el plano «Finca» guardado (rev. 51): el descansillo ya se empotra en las dos columnas (permitido), pero al avanzar toca las **esquinas** de dos muros que se juntan en ese vértice: el muro vertical del patio termina 41 mm por debajo del borde superior del descansillo y el muro horizontal arranca en el mismo punto. Ese solape de esquina se contaba como colisión.
- Regla nueva (`landing-wall-corner.ts`, usada en `assertSpatialPlacement`): un descansillo puede abrazar el extremo de un muro recto (hasta dos grosores desde el vértice hacia dentro), igual que se empotra en una columna; invadir el tramo intermedio sigue prohibido. Con el plano real, desplazamientos de 20 a 300 mm hacia el patio pasan de bloqueados a permitidos.
- Test: `tests/editor-document/landing-wall-corner.test.ts` (2).

## Baño exterior sobre el descansillo: cota a 1 m (19:05–19:12)

- Síntoma (Paulo): al poner la cota del baño nuevo a 1 m, «El elemento atraviesa una pared u otro objeto».
- Causa, reproducida con «Finca» (rev. 53): el muro sur del baño está trazado sobre el borde del descansillo y nace con base 1000. Al subir la cota, `normalizeRoomWallBases` borraba la base de todos los muros de la estancia (base 0, altura 3700) y ese muro pasaba a atravesar el podio del descansillo 76 mm.
- Arreglo: un muro cuyo eje apoya en un descansillo conserva la cota del descansillo como base (`floor-finishes.ts`), y el ajuste de altura al cambiar la cota se mide desde la base del muro, no desde el terreno (`floor-elevation-sync.ts`): ese muro no crece, los que arrancan del terreno crecen la cota del suelo y todos coronan a la misma altura.
- Test: `tests/editor-document/landing-wall-floor.test.ts` (2). Con el plano real, la subida de cota pasa a permitida sin colisiones nuevas.

## Puerta en el baño elevado (19:12–19:22)

- Síntoma (Paulo): al colocar una puerta en el baño a 1 m, «La abertura supera la altura del muro».
- Causa, con «Finca» rev. 55: `resolveOpeningPlacement` comparaba la coronación de la puerta (1,00 + 2,10 = 3,10 m) con la altura del muro sin sumar su base. El muro del baño apoyado en el descansillo (base 1,00 m, alto 2,70 m) corona a 3,70 m, pero la herramienta lo trataba como 2,70 m. Las puertas ya arrancan a ras del suelo elevado (`wallFloorElevation`); el resto de muros del baño aceptaban la puerta.
- Arreglo: la coronación se mide desde la base del muro (`opening-placement.ts`). Test añadido en `landing-wall-floor.test.ts`.
