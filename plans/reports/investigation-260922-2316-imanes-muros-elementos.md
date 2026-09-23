# Investigación: por qué los muros y elementos no se pegan ni alinean

Fecha: 2026-09-22 · Rama: develop · Editor: `editor-v2` (ruta `/projects/[id]/editor`)

## Resultado

La causa principal está en el imán por ejes de `src/canvas/editor-v2/magnetic-alignment.ts`. La nube de referencias
incluye, por cada muro, su eje **y sus dos caras** (±grosor/2) en tres puntos (inicio, medio, fin). El imán elige por
separado la referencia más cercana en X y la más cercana en Y, con una tolerancia de 10 px (125 mm al zoom inicial
0,08). Alrededor de cada esquina hay por tanto 9 puntos a 75 mm unos de otros, y el vértice arrastrado o el extremo
trazado acaba con frecuencia en una **esquina fantasma** formada por dos líneas de cara, a 75–106 mm de la esquina
real. Las operaciones que luego deberían unir geometría (fusión de vértices, unión en T, saneado de extremos sueltos)
usan umbrales mucho más estrictos (0,5 mm, 100 mm, 150 mm), así que la unión no ocurre y el muro queda "casi" pegado.

## Evidencia (funciones reales, escala 0,08, casa 8000×3000 con muros de 150 mm)

| Caso | Entrada | Resultado |
|---|---|---|
| Arrastrar vértice suelto hacia la esquina (8000,3000) | puntero a (8040,3050), 64 mm de la esquina | aterriza en (8075,3075), **no se fusiona** |
| Ídem | puntero a (8020,3020) | aterriza en (8000,3000), se fusiona |
| Ídem, desde el rincón interior | puntero a (7960,2950) | aterriza en (7925,2925) y falla con "Intersección de muros sin vértice compartido" |
| Trazar muro con el extremo cerca de la esquina | puntero a (8130,3130), 184 mm | kind `object`, punto (8075,3075); tras normalizar queda un vértice suelto y la esquina sigue con 2 muros |
| Ídem | puntero a (8100,3100), 141 mm | kind `vertex`, se une bien (dentro del radio de 12 px = 150 mm) |
| Mover un muro entero para alinearlo con el eje y=3000 | delta −360 | rejilla lo lleva a 2900 y el imán lo pega a la **cara** 2925, no al eje 3000 |
| Soltar un mueble 600×600 en el rincón interior | (7300,2300) | queda pegado a ambas caras (7925 / 2925) y girado 90°: aquí el imán funciona |
| Trazar una estancia contra la cara exterior, ratón a ~1 cm | 4 clics | 2 estancias, vértices sobre el eje: funciona |

Un plano de 4 muros genera ya 37 referencias magnéticas; en un plano real el imán por ejes dispara casi siempre.

## Causas concretas, por orden de impacto

1. **Referencias de cara en el imán por ejes** (`magneticReferences`, línea 71: `[-1, 0, 1]` lados). Sirven para pegar
   muebles a caras, pero para vértices y extremos de muro producen esquinas fantasma. `previewVertex`
   (`vertex-preview.ts:250-254`) y el caso libre de `snapWallPoint` (`snap-candidates.ts:51`) y `snapWallMove`
   (`wall-move-snap.ts:229`) consumen esta misma nube.
2. **Imán por ejes independientes** (`alignPoints`): X puede venir de una referencia e Y de otra distinta. No hay
   preferencia por el punto real más cercano (vértice) frente a una combinación de líneas.
3. **Umbrales de unión incoherentes con el imán**: fusión de vértice a 0,5 mm (`vertex-preview.ts:268`), esquina suelta a
   100 mm (`wall-join.ts:587`), apoyo en muro a grosor/2 + 50 mm y a más de 150 mm de los extremos (`wall-join.ts:573`).
   Un extremo a 100–150 mm de una esquina no se fusiona ni se apoya: banda muerta.
4. **Tolerancias en píxeles sin suelo**: al hacer zoom (escala 0,3–0,6) el radio de vértice baja a 40–20 mm y el de ejes a
   33–17 mm; el usuario tiene que acertar casi al milímetro. Solo el imán de cara tiene suelo (150 mm).
5. **Rejilla de 100 mm antes del imán** (`snapWallMove`, `snapObject`): el redondeo previo puede acercar el punto a
   una cara en vez de al eje, como muestra el caso de mover muro.

## Lo que sí funciona

Muebles, columnas y descansillos: `snapObject` acaba con `snapToWallFace`, que tiene prioridad sobre el imán por ejes y
un suelo de 150 mm. El trazado de muros a menos de 12 px del vértice o del cuerpo de otro muro también une bien.

## Dirección de arreglo recomendada

- Separar la nube de referencias: vértices y ejes para geometría estructural (vértices, extremos, mover muro); caras
  solo para objetos. O bien, en `previewVertex` y `snapWallPoint`, evaluar primero el vértice real más cercano en 2D
  (con radio con suelo en mm) antes del imán por ejes.
- Alinear los umbrales de unión con el radio del imán: fusión de vértice y esquina suelta al mismo radio que el snap, y
  permitir apoyo en T también cerca de los extremos cuando el vértice destino es la esquina.
- Poner un suelo en milímetros a las tolerancias en píxeles (por ejemplo 40–50 mm) para que el zoom no las anule.
- Aplicar la rejilla después del imán, no antes, o sólo cuando no haya referencia dentro del radio.

Cobertura de tests actual: `tests/editor-v2/wall-join.test.ts` usa escala 1 (tolerancia 10 mm) y punteros a 2–10 mm,
por lo que no ejercita el comportamiento a la escala real del editor.
