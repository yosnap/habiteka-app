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

## Fase 4 (19:43–19:55) — pilares, ventanas y aparatos desde el catálogo

- `kitchen-run-obstacles.ts`: recortes que vienen del entorno, calculados solo para dibujo/3D (`furnitureVolumes(item, doc)`); colisiones y navegación siguen con el cuerpo entero. Pilar sobre el tramo: zócalo y bajos vaciados en su huella; altos vaciados si el pilar entra en su fondo; encimera con muesca (continúa por delante) si el pilar no ocupa todo el fondo, interrumpida si lo ocupa. Ventana en el muro de apoyo (trasera del tramo a ≤ 6 cm de una cara, paralelo): altos omitidos en el ancho de la ventana si hay solape vertical.
- `kitchenRunVolumes` acepta `extra` cuts y muescas de encimera (`worktopNotches`); `kitchenRunDisplayVolumes(run, doc)`.
- Aparatos: `putKitchenSlot` rechaza un aparato sobre el hueco de un pilar; `addKitchenSlot` sin posición evita esos huecos. `kitchen-slot-drop.ts`: un aparato del catálogo Amueblar (fregadero, vitro/fogones, lavavajillas, lavadora, horno, frigorífico/nevera, también modelos 3D) soltado sobre un tramo se encaja como hueco en vez de quedar suelto (`canvas-view.tsx`).
- `worldToLocal` compartido en `spatial-properties.ts`.
- Tests: `tests/editor-document/kitchen-run-obstacles.test.ts` (5). Suites editor-document/canvas/editor-v2 en verde. Sin prueba en navegador.

## Fase 6 + bloque de catálogo (2026-09-20 02:07–02:30) — sin commit, pendiente de prueba

- Sofás: `chaise-longue` (2,6 × 1,6), `rinconera` (2,8 × 2,2), `sofa-modular` (tres módulos con juntas), `sofa-cama` (+ variante «Abierto · cama 200 × 190»). Perfiles `sofa-chaise`, `sofa-corner`, `sofa-modular`, `sofa-bed` en `furniture-profiles.ts`; en las L las patas van bajo cada tramo, no en las esquinas de la huella (lo detectó el test).
- Exterior: `pergola-aluminio`, `pergola-metal` junto a la de madera (misma geometría, material y color propios; el color se cambia con Pintar); `carpa` con cuatro postes, cubierta a niveles y tres paneles de lona transparente (fondo y laterales), frente abierto.
- Transparencia: `opacity` en `FurnitureVolume` y `SceneBox`; `scene-meshes.tsx` la renderiza (sin sombra, sin depthWrite) y `FurnitureSymbol` la aplica en planta.
- Cortinas y persianas: `cortina-abierta` (dos paños recogidos), `estor-enrollable` (a 0,90 m), `persiana-veneciana` (a 0,90 m), `persiana-vertical`, `persiana-exterior` (cajón + lamas, a 0,90 m). Variantes de color: cortinas gris/azul/blanco, estor gris/screen negro, veneciana madera/negra. Miniaturas nuevas en `catalog-panel.tsx`.
- Tests: `tests/editor-document/catalog-additions.test.ts` (2). Suites editor-document/canvas/editor-v2: 871 ✓. Sin prueba en navegador.

## Estores sobre la ventana y avisos de colisión con nombre (02:19–02:40) — sin commit

- Síntoma (Paulo): el estor no se coloca sobre la ventana; en la habitación contigua «atraviesa una pared» sin decir qué.
- `dockToWindow` (`wall-back-alignment.ts`, dentro de `snapObject`): estores, persianas y cortinas soltados junto al muro se centran en la ventana más cercana de ese muro; estores y persianas nacen 10 cm bajo el alféizar, con ancho ≥ ventana + 10 cm y alto ≥ ventana + 20 cm; las cortinas quedan en el suelo con ancho ≥ ventana + 40 cm y llegan 10 cm por encima del dintel. Lejos de una ventana no cambian.
- Aviso de colisión específico: «“Estor enrollable” atraviesa “Armario de dos puertas” (12 cm). Ajusta posición, tamaño o elevación.» Nombra ambos sólidos (mueble por su nombre; la pared, columna, escalera, rampa o descansillo por su tipo o su nombre) y la profundidad en cm (`collisionLabel` en `spatial-placement.ts`). Mantiene la palabra «atraviesa».
- Tests: `tests/editor-document/window-dock.test.ts` (3). Suites del editor en verde.

## Cobertura de ventana (02:29–02:45) — sin commit

- Campo `coverage` (0–1) en el mobiliario; en Propiedades «Cobertura de la ventana (%)» para cortinas, estores y persianas. Por defecto 100 % (tapada), salvo la cortina abierta que nace al 40 %.
- Geometría según cobertura: el estor baja desde el tubo la fracción indicada; veneciana y persiana exterior despliegan lamas desde arriba; lamas verticales cubren desde la izquierda; las cortinas corren pliegues desde ambos extremos hacia el centro. Al 100 % con el enganche a la ventana, la tapan entera.
- Altura de estos objetos: crece hacia abajo con el tubo o la barra fijos (el inspector recalcula la elevación).
- Test añadido en `window-dock.test.ts`. Suites del editor en verde (875).

## Orientación al muro sin excepción (02:40) — sin commit

- Paulo: el sofá que llega perpendicular a un muro debe adoptar la dirección del muro, como mesas, televisores, etc. Quitada la excepción que respetaba la orientación perpendicular: `alignBackToWall` gira siempre el mueble paralelo al muro cercano con la trasera contra la cara y el frente hacia la estancia. Test actualizado en `object-host-rest.test.ts`. Suites en verde (875).

## Cortina que asomaba sobre el muro (02:55) — sin commit

- Causa: `dockToWindow` calculaba la altura de la cortina desde cota 0 y el saneamiento la subía después al suelo de la estancia (1 m), con lo que el paño quedaba 1 m por encima de lo debido y sobresalía del muro.
- Arreglo: el enganche trabaja en cotas absolutas y conoce el suelo de la estancia del muro (`wallFloorElevation`): la cortina arranca del suelo y sube hasta 10 cm sobre el dintel; estores y persianas nunca superan la coronación del muro. Test con suelo a 1 m en `window-dock.test.ts`. Suites en verde (875).

## PR #43 y revisión (2026-09-20 03:00–13:40)

- PR #43 `feat/planos-ia` → `develop` (arrastra los 35 commits de `main` que `develop` no tenía). Revisión `ak:review-pr` en modo lectura: Request changes por CI roja en lint.
- Lint: 29 errores de reglas del compilador de React; 21 ya en `main`, 8 nuevos en `ceiling-layer.tsx`. Arreglados todos (`76b91ed`): mutaciones imperativas de cursor, captura de puntero y controles de cámara movidas a `src/components/canvas/3d/pointer-interaction.ts`; cámara isométrica configurada en función de módulo; `useMemo` incondicional en la tira LED; `setState` en efectos sustituido por estado derivado o ajuste durante el render (catálogo 3D, panel de propiedades, `useCatalogItems` con clave de petición, paso de estilo del asistente).
- Tests rojos: `model-config-loader` vaciaba solo `modelConfig` pero las rutas `aiModelRoute` tienen prioridad (ahora vacía ambas); `gateway-fallback` probaba una conmutación por variable de entorno que ya no existe (ahora prueba la normalización a `gateway_down`); `config-ops` anula `server-only` en Vitest.
- Hallazgo de seguridad al pasar los tests (`912cda8`): `resolveBaseURL` dejaba pasar cualquier `baseURL` para el proveedor `openrouter`, saltándose la allowlist; ahora OpenRouter usa siempre su gateway por defecto.
- Suite completa contra la base de pruebas real: 1426 tests en verde, 0 fallos. Lint 0 errores. Pendiente: CI de la PR en verde.
