# Imágenes de navegación del catálogo

Actualizado: 5 de octubre de 2026.

## Alcance

### Exterior y jardín (octubre de 2026)

La fábrica admite dimensiones de hasta 20 m para piezas exteriores (árboles, piscinas y vehículos); mantiene el límite de 4 m en interiores y los límites existentes de peso y polígonos. Las relaciones de modelos más pequeños para Amueblar excluyen los modelos ocultos del catálogo, como las jardineras de Exterior.

`garden-models.ts` resuelve las identidades históricas de Exterior a modelos de las familias Blender `jardin` y `equipamiento`. Los GLB y las miniaturas se generan localmente con `scripts/build-furniture-factory.mjs`; no hay coste de proveedor IA. Las especies no se duplican en Amueblar. Las variantes de carpa reflejan `rolledSides`; la pintura de equipamiento no tiñe cristales, goma ni agua.

Los cerramientos de seto conservan su `catalogId` al trazar y validar documentos. `hedge-model-pieces.ts` repite módulos de hasta un metro, recortando por puertas y zócalos en plano y 3D. Los caminos son piezas editables por tramo, con plantas independientes y materiales compartidos con las superficies exteriores. No hay generación de curvas ni resolución automática de encuentros.

Materiales nuevos: Poly Haven `asphalt_02`, `gravel_road`, `brown_mud_dry`, `wood_chips` y `sand_01`, importados mediante el flujo CC0 existente. El césped utiliza `outdoor:grass-lawn-pbr`. Las superficies siguen siendo rectangulares y no alteran navegación.

Las hojas de contacto en `plans/reports/fabrica-muebles-{jardin,equipamiento}-*.jpg` permiten revisar geometría y acabado. Se han corregido frutos sin soporte, tapa de barbacoa sin bisagras y aspersores indistinguibles. No se considera alcanzado el objetivo hiperrealista por superar pruebas o compilación.

Los cuatro vehículos se construyen con `fam_vehiculos_carroceria.py` (perfiles interpolados, pasos de rueda, cristales y juntas) y `fam_vehiculos_detalles.py` (ruedas, frenos, ópticas, retrovisores y accesorios), coordinados por `fam_equipamiento_vehiculos.py`. Cada clase tiene su silueta; la furgoneta incluye puertas de carga y guía lateral, el SUV barras de techo. Los cristales coinciden con la superficie de carrocería para evitar intersecciones. La revisión de producto incluye frente, trasera y vista cenital; se han ajustado faros y pilotos que sobresalían.

Conservan los identificadores históricos de Exterior. Los valores iniciales se ajustan a las especificaciones de cada clase, sin migrar las medidas de entidades guardadas. `habiteka-furniture.ts` restringe el tinte de vehículos al material `pintura`. Sus URLs de GLB y miniatura incorporan `?v=<sha256,12>`: la caché de GLTF y las fotos derivadas del modelo cambian al regenerar el asset bajo el mismo nombre. Las pruebas que resuelven archivos locales excluyen la query al comprobar su existencia. Los modelos cumplen el presupuesto de 40 000 triángulos y 1,5 MB por pieza; los vehículos ocupan aproximadamente 295–326 KB cada uno. Son modelos genéricos del editor, todavía simplificados; no son diseños aceptados ni resultados hiperrealistas finales de un inmueble.

Amueblar utiliza imágenes realistas propias para trece habitaciones y doce categorías. Construir las incorpora en doce categorías y en las acciones Añadir terreno/Añadir pavimento. Son ilustraciones genéricas de navegación, sin datos de inmuebles, personas, marcas ni modelos comerciales concretos. Las fichas mantienen sus símbolos, dimensiones, variantes y créditos. Estas imágenes no son referencias aceptadas para diseños o vídeos de un proyecto.

## Colisiones de mesas y asientos

`scripts/build-furniture-collision-proxies.ts` lee los GLB que resuelve `furnitureModel` para perfiles `table`, `chair` y `bench`, incluidos alias históricos. Aplica la misma rotación frontal del render, rasteriza los triángulos en celdas de hasta 20 mm, rellena interiores cerrados por flood fill exterior y fusiona cajas contiguas. Se conservan huecos entre patas, bajo el tablero y alrededor de pedestales y caballetes. Las caras sobre los límites de la rejilla se incluyen para impedir fugas dentro de piezas sólidas.

El registro `src/lib/editor-document/generated/furniture-collision-proxies.json` contiene SHA256, rotación, rejilla y sólidos normalizados. `furniture-collision-volumes.ts` los escala a ancho, fondo, alto y elevación del objeto sin sustituir la geometría visible. La aproximación es conservadora; su margen aumenta proporcionalmente al ampliar un mueble. Si el hash o la orientación no coinciden con el modelo vigente, se utiliza la colisión anterior como envolvente segura.

`spatial-placement.ts` comprueba primero envolventes por entidad y después sólidos. `seating-drag.ts` realiza SAT continuo entre mesa y silla/banco para detener el arrastre individual al primer contacto, incluso si el puntero salta una pata entre eventos. Los dos planos conservan la última posición válida de vista previa. Se puede retroceder y rodear el obstáculo; el imán no gira la pieza durante la entrada. La elevación diferente se valida al soltar. La selección múltiple, el giro explícito, las flechas y las propiedades mantienen la comprobación de posición final; no simulan un recorrido físico.

Tras importar o cambiar modelos de mesas/asientos, ejecutar `bun run scripts/build-furniture-collision-proxies.ts`. Para actualizar solo una pieza: `--only=silla_nordica_roble`. La fábrica `build-furniture-factory.mjs` actualiza automáticamente los proxies de los modelos de mesa/asiento que regenera y falla si esa actualización falla. Las pruebas contrastan hashes contra los GLB y cubren huecos, soportes, respaldo, giro, escala, elevación, barrido y deshacer/rehacer. Este mecanismo pertenece a la guía geométrica del editor; no cambia el flujo de resultados basados en diseños IA aceptados.

## Porche de entrada

`habiteka:outdoor:porche-entrada` resuelve el GLB oculto de fábrica `porche_entrada_exterior` (familia equipamiento, builder `porch`): cuatro columnas con zócalo/capitel, cubierta continua, membrana y albardilla. Se utiliza su render de producto; no lleva puerta ni muros. `porch-volumes.ts` comparte la geometría paramétrica de colisiones y genera base y peldaños con material local `polyhaven:stone_tiles_02`. Las proporciones de columnas y cubierta coinciden con el builder Blender.

La membrana y la losa de cubierta no comparten superficies; evita rayas en las sombras del render en tiempo real. El GLB y la miniatura incluyen la versión SHA256 en la URL. La pintura cambia solo el material `blanco`, conservando la membrana y el suelo de piedra.

`elevationMm` significa cota de la plataforma; `heightMm`, altura desde esa cota a la cubierta. La base ocupa desde el terreno hasta la cota; a ras, es una losa de 20 mm por debajo de cero. El único campo nuevo es `Furniture.porchSteps?: boolean`, validado exclusivamente para ese tipo y opcional para documentos anteriores. El número de subidas es `ceil(elevationMm / 170)`, con huellas de 300 mm y ancho `min(1200, widthMm * .6)`. La última subida llega a la propia plataforma; a ras no hay peldaños.

Los extras se renderizan con `BoxMesh` junto al GLB, y mediante `sceneBoxesObject` en la foto cenital. La caché y la extensión de esa foto incluyen cota, altura y acceso para no estirar ni recortar los escalones. La huella nominal corresponde a la cubierta; los sólidos y la foto incluyen el acceso fuera de esa huella. El recorrido de revisión usa el mismo suelo y alturas de peldaños; no permite saltar la base por un lateral. El contexto de diseño comunica el porche y el acceso, conservando la puerta como abertura independiente de la pared. No cambia la exigencia de diseños IA aceptados para resultados finales.

## Assets y carga

- `public/images/catalog/rooms-v1.webp`: 1536 × 1024 px, 296402 bytes; atlas de 3 columnas y 3 filas.
- `public/images/catalog/rooms-extra-v1.webp`: 1024 × 682 px, 53886 bytes; atlas de 2 columnas y 2 filas con las
  estancias añadidas después (infantil, recibidor, lavadero y garaje). No está generado con IA: son renders de Blender
  (Cycles) con muebles del propio catálogo, texturas CC0 y piezas de atrezo modeladas en la escena. Se regenera con
  `node scripts/build-catalog-room-photos.mjs` (escenas en `scripts/blender/catalog_room_photos.py`; `--only=garaje,…`,
  `--samples=N`). El lanzador descomprime los GLB fuera del repositorio y descarga con caché el HDRI
  `dry_orchard_meadow` de Poly Haven y las texturas de ambientCG y Poly Haven: `Plaster002`, `WoodFloor047`,
  `Wicker011A`, `Tiles143`, `Carpet014`, `Tiles139`, `Tiles136A`, `oak_veneer_01`, `Concrete036` y `Cardboard004`. La
  escena del lavadero necesita `lavadora_blanca` y `secadora_blanca` de la familia `electrodomesticos`; si faltan, se
  detiene con un error.
- `public/images/catalog/categories-v1.webp`: 1086 × 1448 px, 243362 bytes; atlas de 3 columnas y 4 filas.
- `public/images/catalog/construction-v1.webp`: 948 × 1660 px, 230062 bytes; atlas de 2 columnas y 7 filas.
- `catalog-navigation-image.tsx` y `construction-navigation-image.tsx` relacionan cada identificador con su celda. Comparten `navigation-atlas-image.tsx`, que recorta visualmente el atlas mediante CSS. El atlas de Construir emplea regiones ajustadas a sus filas para excluir los separadores de 1–2 px; no se modifica el contenido de la imagen.
- Las imágenes se generaron con la herramienta integrada `image_gen`, sin referencias de usuarios. Los PNG originales se convirtieron a WebP (calidad 82, mismas dimensiones) con Sharp, sin edición de su contenido.
- Se sirven como assets estáticos precodificados con Next Image `unoptimized` y carga diferida. Cada atlas se descarga una vez y se reutiliza entre tarjetas; se evita depender de la transformación de imágenes en tiempo de petición. Si falla la carga se utiliza la ilustración SVG existente.
- El texto visible de la tarjeta sigue siendo su nombre accesible. La imagen es decorativa, sin texto alternativo duplicado.

Orden de habitaciones, por filas: salón, dormitorio, cocina / baño, comedor, oficina / exterior, iluminación, decoración. En `rooms-extra-v1.webp`: infantil, recibidor / lavadero, garaje. Si un atlas no carga, cada estancia muestra su dibujo SVG (`catalog-room-art.tsx`), que también existe para las cuatro nuevas.

Orden de categorías, por filas: sofás, camas, mesas / sillas, almacenaje, cocina / baño, lámparas, decoración / cortinas, pantallas, exterior.

Orden de Construir, por filas: paredes, columnas / exterior, patio / habitaciones, cocina / formas, puertas / ventanas, huecos / rampas, escaleras / terreno, pavimento. Importar plano conserva su icono de acción. Las imágenes de Formas no habilitan sus opciones pendientes.

## Prompts de generación

Se utilizó un prompt por atlas; la herramienta integrada no expone opciones independientes de resolución o calidad.

### Habitaciones

```text
Use case: product-mockup. Asset type: a SINGLE photographic sprite sheet for the room navigation cards of an interior-design app. Create one landscape atlas, exactly 3 columns and 3 rows, nine equal-sized rectangular cells, edge-to-edge with NO gutters, NO borders, NO rounded corners. Every cell must be a separate polished photorealistic interior photograph, realistic architecture and materials, bright soft daylight, warm neutral Scandinavian/Mediterranean styling, light oak, off-white walls and understated sage accents. Clear dominant subject easily readable as a small thumbnail, wide-angle eye-level composition, no people, no text, no letters, no logos, no watermark. Exact order, left to right then top to bottom: row 1: inviting living room with sofa and coffee table; cozy double bedroom with linen bedding; contemporary fitted kitchen with island. Row 2: elegant bathroom with basin and bath; dining room with table and chairs; home office with desk and ergonomic chair. Row 3: outdoor terrace with garden lounge seating and planting; tasteful interior focused on pendant and floor lighting; styled interior decor corner with indoor plants, ceramics, rug and artwork. The grid must fill the entire image with nine equal cells and no margins. These are generic navigation illustrations, not a specific user property. Output a single coherent atlas with accurate regular grid geometry.
```

### Categorías

```text
Use case: product-mockup. Asset type: ONE photographic sprite atlas for category navigation in a home-design catalog. A SINGLE image containing exactly 3 columns and 4 rows of equal-sized edge-to-edge rectangular cells. NO margins, gaps, borders, text, lettering, logos, price tags, watermarks or people. Each cell is its own distinct realistic product vignette, beautifully photographed in the same bright warm minimalist home/showroom with soft daylight, off-white and pale oak backdrop. Subjects fully visible, large and clearly recognizable at thumbnail size. Photoreal materials and physically plausible construction. Exact row-major order: row 1 left: beige fabric sofa and matching armchair; center: double bed with cream linen; right: beautiful oak dining table and slim writing desk. Row 2 left: two elegant chairs and a bench; center: wood wardrobe and open bookshelf; right: modern kitchen cabinetry with cooktop and oven. Row 3 left: bathroom basin vanity and freestanding bath; center: pendant light and floor lamp switched on; right: plants in pots with ceramics and rug. Row 4 left: tall window dressed with linen curtains and a roller blind; center: television on low console with desktop monitor visible nearby; right: terrace accessories with garden bench, outdoor planter and parasol. Keep every object within its cell. Coherent photographic style, neutral natural colours, image must fill all 12 exact grid cells with NO separators. Generic illustrations of categories, not exact representations of sellable models or any user's property. Output the single atlas only.
```

### Construir, terreno y pavimento

```text
Use case: product-mockup.
Asset type: ONE photographic sprite atlas for the construction category cards of a home planning application.
Create a single portrait image, 1024 by 1792 pixels if possible, containing EXACTLY TWO COLUMNS and SEVEN ROWS of equal-size edge-to-edge rectangular photo cells. No gutters, no borders, no margins. Each cell is a distinct photoreal architectural photograph; it will be cropped as an individual thumbnail in a navigation card.
Shared style: polished warm contemporary Mediterranean/Scandinavian architecture, natural soft daylight, pale oak, warm white plaster, limestone, restrained garden greens, realistic materials. Clear dominant subject at small size, simple uncluttered composition. No text, letters, diagrams, icons, logos, watermarks or people.
EXACT order left to right then top to bottom:
ROW 1 LEFT: a clean freestanding white plaster partition wall with visible end and return corner, architectural detail showing solid wall construction. RIGHT: one simple square rectangular structural column in a bright open interior.
ROW 2 LEFT: landscaped home garden with a small timber pergola and planting. RIGHT: a paved outdoor patio terrace beside a modern house.
ROW 3 LEFT: a bright empty finished room with clearly visible enclosing walls, floor and window. RIGHT: a straight fitted kitchen run with pale wood cabinetry and worktop.
ROW 4 LEFT: three simple solid architectural model blocks made from white plaster on neutral surface, in L, U and T shapes, photographed as real physical miniatures, no lettering. RIGHT: a real oak interior hinged door in a white wall, partly open, full frame visible.
ROW 5 LEFT: a large glazed window with slim frame in a plaster wall, full window visible. RIGHT: a simple rectangular open doorway through a wall, with no door or frame.
ROW 6 LEFT: a gentle straight outdoor access ramp connecting two levels of a terrace, continuous slope without any stairs. RIGHT: a straight flight of real residential stairs with clearly visible treads and risers.
ROW 7 LEFT: an attractive clear rectangular area of lush garden lawn, lawn is the main subject, a small border of shrubs in background. RIGHT: a clear rectangular paved garden area of warm grey stone slabs, paving is the main subject, subtle grass border.
The atlas is generic navigation imagery, not a user's actual property and not exact photographs of specific catalog products. Keep grid boundaries perfectly regular and all subjects within their cell. Produce only the complete atlas.
```

## Verificación

Comprobar el recorte de todas las celdas y los nombres, la carga diferida al desplazar el panel y el filtrado al abrir una tarjeta. No presentar la estética de una miniatura como garantía del modelo disponible ni del resultado final de un inmueble.

## Modelos 3D realistas de Poly Haven

Además de los modelos sencillos de Quaternius y Kenney, el catálogo incluye 33 muebles realistas CC0 de [Poly Haven](https://polyhaven.com/license). Son taburetes de barra, mesillas, una lámpara de mesa y un flexo, cómodas, aparadores y cajoneras, sofás, sillones y un puf, mesas de centro, altas y de comedor, una silla, camas, estanterías, un escritorio, una cocina eléctrica y plantas. Todos son guías para el plano y el 3D; no sustituyen a los diseños IA aceptados.

- `scripts/import-polyhaven-models.mjs` contiene la selección curada (id de Poly Haven, clave del catálogo y giro). Para cada modelo descarga el glTF 1K y verifica el MD5 publicado. Después lo deja estático, sin esqueleto ni animaciones, y lo orienta con el frente hacia +Z y el lado largo en X. Por último lo apoya en el suelo y escribe un GLB autocontenido en `public/models/cc0/<id en minúsculas>.glb`, con texturas WebP de 1024 px como máximo y geometría meshopt. `useGLTF` del editor y la vista cenital cargan meshopt; Draco no se usa.
- El script añade o actualiza la entrada en `public/models/cc0/manifest.json`, con estos campos: `polyhavenId`, `title`, `author`, `license` (`CC0-1.0`), `sourceUrl`, `importedAt`, `sha256` y `dimensionsMm` (ancho × fondo × alto del GLB orientado). La orientación no se detecta sola: se revisa con vistas ortográficas antes de fijar `rotationDeg` en la selección.
- Alta manual en `src/lib/editor-document/furniture-assets.ts`: nombre en español, estancia, perfil y las medidas de `dimensionsMm`. El octavo valor opcional es la cota de apoyo, que solo usa el flexo (750 mm). `tests/editor-document/polyhaven-assets.test.ts` exige que cada GLB exista y coincida con su hash, que sea CC0 y pese menos de 2 MB, que las texturas no pasen de 1K, que las medidas coincidan con el manifiesto y que las piezas se encuentren por nombre.
- Dependencias de desarrollo: `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions` y `meshoptimizer`. Sharp ya era dependencia del proyecto.
- Reimportar: `node scripts/import-polyhaven-models.mjs` importa lo que falte; `--force <id>` rehace un modelo; `id:clave[:giro]` importa uno nuevo; `--list[=categoría]` lista candidatos y `--dry-run` optimiza sin escribir.
- Poly Haven no tiene lavadora, frigorífico, microondas actual (solo uno de los años 70 modelado con 1,07 m de ancho, descartado), alfombras, lámparas de pie ni armario ropero moderno. Para esas piezas se mantienen los modelos sencillos existentes, salvo las alfombras, que se generan (ver más abajo). Las lámparas de techo de Poly Haven no se importan, porque las luminarias de techo tienen su propio sistema.

## Biblioteca de materiales CC0

Los acabados de suelos, paredes, forjados, cubiertas, pilares, frentes de cocina y terreno salen de un registro único, `src/lib/editor-document/surface-materials.ts`, que junta tres fuentes y las ordena por categoría (`SURFACE_CATEGORY_ORDER` en `surface-material-names.ts`):

- `public/materials/polyhaven/manifest.json`: la primera selección (61 materiales, JPEG 1K originales con su MD5). Sus ids no cambian; `LEGACY_SURFACE_NAMES` les da nombre y categoría en español.
- `public/materials/cc0/manifest.json`: 122 materiales de [ambientCG](https://docs.ambientcg.com/license/) y Poly Haven, todos CC0. Hay 18 de parqué y tarima, 13 de baldosas y porcelánico, 6 de hidráulico y barro, 8 de mármol, 9 de piedra y terrazo, 8 de microcemento y hormigón, 6 de moqueta, 11 de azulejo de pared, 10 de pintura y estuco, 9 de ladrillo visto, 8 de madera para paredes, 11 de fachada y cinco superficies exteriores (asfalto, grava, tierra, corteza y arena). Ocupan unos 29 MB, por debajo del presupuesto de 60 MB.
- `outdoor-materials.ts`: texturas propias de exterior.

`scripts/import-cc0-materials.mjs` importa la selección curada de `scripts/cc0-material-selection.mjs`. Cada entrada indica fuente, id, nombre, categoría y, si el proveedor no publica medidas, el ancho real de una repetición en mm, calibrado contando baldosas, tablas o ladrillos. El script descarga los mapas 1K mediante `scripts/lib/cc0-sources.mjs`. Este módulo solo admite los dominios de ambientCG y Poly Haven, verifica el MD5 de Poly Haven y extrae del ZIP 1K-JPG de ambientCG los mapas `Color`, `NormalGL` y `Roughness`. Las descargas quedan en `$TMPDIR/habiteka-cc0-cache`.

Después convierte cada mapa a WebP: color y normal a 1024 px como máximo y rugosidad en gris a 512 px, que basta para el teselado. También genera una miniatura de 160 px. En el manifiesto escribe `id` (`ambientcg:<Id>` o `polyhaven:<id>`), `label`, `category`, `source` (ficha), `license` (`CC0-1.0`), `authors`, `sizeMm` y `maps`. En `provenance` guarda el proveedor, el id, el título original e `importedAt`. Las URL de descarga y el SHA-256 de cada archivo generado van en `public/materials/cc0/sources.json`: el registro sí entra en el paquete del navegador y así no engorda.

- Reimportar: `node scripts/import-cc0-materials.mjs` importa lo que falte. `--force [ids]` rehace materiales. Para añadir uno fuera de la selección, usa `"fuente:id:Nombre:Categoría[:anchoMm]"`. `--list=<texto>` busca candidatos en los dos catálogos y `--dry-run` procesa sin escribir. El script borra las carpetas que ya no estén en el manifiesto y avisa si se supera el presupuesto.
- El selector (`surface-material-picker.tsx`) busca por nombre y filtra por categoría. El 2D pinta el mapa de color como patrón a escala `sizeMm` (`floor-surface.tsx`) y el 3D usa color, normal y rugosidad (`scene/surface-material.tsx`).
- `tests/editor-document/cc0-surface-materials.test.ts` comprueba los 117 acabados y los cinco ids de superficies exteriores, que todos sean CC0 y con ids únicos, y que cada categoría tenga al menos 5. Comprueba también la procedencia y que cada archivo exista, coincida con su SHA-256 de `sources.json` y sea WebP dentro del límite de tamaño. Además, controla el presupuesto de 60 MB y que los ids históricos conserven su nombre en español.
- Limitaciones: algunas medidas reales son estimadas, y en el suelo se corrigen con **Tamaño de repetición**. Los mapas de ambientCG no incluyen desplazamiento ni oclusión. La lista completa de ids y nombres también entra en el prompt de **Diseñar el plano**, que es más largo.

## Alfombras CC0

Poly Haven no tiene alfombras. `scripts/build-cc0-rugs.mjs` las genera como GLB (`public/models/cc0/alfombra_*.glb`) a partir de texturas CC0 de moqueta, tela y fibra: Carpet016, Fabric031, Carpet014, Fabric019, Carpet008 y Wicker011A de ambientCG, y curly_teddy_natural de Poly Haven.

- Cada alfombra es una losa de 10 mm, sin cara inferior y con la cara superior hacia +Y, en metros, con el lado largo en X. El color, la normal y la rugosidad (canal verde, metal 0) se hornean a su tamaño real: la textura se repite a su escala física. Según el diseño, se añade un dibujo vectorial propio (retícula bereber, kilim, rayas o espiral trenzada en la redonda de yute), un ajuste de brillo y saturación, y un ribete. Las texturas van en WebP dentro del GLB, con 1024 px como máximo. El resultado es determinista.
- Hay ocho diseños (`lana_beige`, `gris`, `pelo_largo`, `bereber`, `kilim`, `geometrica`, `yute` y `rayas`) en 140 × 200, 160 × 230 y 200 × 300 cm, y dos redondas: `redonda_yute_160` y `redonda_pelo_200`. En total son 26 GLB, unos 8 MB.
- El manifiesto de modelos registra `cc0Texture` (material de origen), `sourceUrl`, `author`, `license`, `importedAt`, `sha256` y `dimensionsMm`. `scripts/lib/model-manifest.mjs` lo comparten este script y el importador de Poly Haven.
- El catálogo se da de alta en `furniture-assets.ts` (`RUG_DESIGNS` × `RUG_SIZES_CM`, perfil `rug` y estancia `decoracion`). `CATALOG_MODELS` asigna `alfombra_lana_beige_160x230` a `habiteka:furniture:alfombra` y `alfombra_yute_200x300` a su variante grande. `REALISTIC_ASSETS` sustituye la antigua alfombra redonda de Kenney por `alfombra_redonda_yute_160`.
- La vista cenital (`furniture-top-view.ts`) se revisó con el mismo render ortográfico e iluminación en Chromium sin interfaz. Los tonos claros (lana, pelo largo) se oscurecieron en la generación porque la luz cenital los quemaba.
- Regenerar: `node scripts/build-cc0-rugs.mjs` crea las que falten; `--force [claves]` las rehace y `--dry-run` no escribe. Si se ejecuta sin claves, retira las alfombras que ya no estén en la lista.
- `tests/editor-document/cc0-rugs.test.ts` comprueba los diseños y tamaños, que sean CC0 y estén íntegras, la losa de 10 mm, las texturas WebP, el alta en el catálogo, que un sofá encima no choque y los modelos por defecto.

## Fábrica de muebles (Blender)

Muebles propios de Habiteka generados por script con Blender 5.2 sin interfaz: geometría paramétrica propia (biseles,
cojines abombados con vivos, capitoné, patas torneadas o metálicas, ropa de cama con caída) y materiales PBR de texturas
CC0 (Poly Haven y ambientCG) con UV a la escala real de cada muestra. Es la base para modelar después el stock de las
tiendas.

**Estructura (una familia = dos archivos, sin listas a mano):**

- `scripts/furniture-factory/families/<familia>.mjs`: especificación de la familia (`FAMILY`, `PRODUCTS` y, si hace
  falta, `FINISHES`/`TEXTURES` propios). Es la fuente única de verdad: familia, tipo, variantes, medidas reales en mm,
  acabados por hueco de material, estancia, perfil, estilo y nombre en español. El formato completo está documentado en
  `scripts/furniture-factory/catalog-specs.mjs`, que descubre las familias y valida las piezas.
- `scripts/blender/fam_<familia>.py`: constructores (`BUILDERS`, tipo → función). Usan las primitivas comunes de
  `hk_geo.py` (cajas redondeadas, volúmenes tapizados, revolución, barridos, láminas), `hk_parts.py` (patas, capitoné,
  vivos, almohadas), `hk_materials.py`, `hk_build.py` (UV a escala real y sombreado) y `hk_render.py` (foto de producto).
- `scripts/furniture-factory/finishes.mjs`: texturas CC0 y acabados comunes (telas, bouclé, terciopelo, piel, maderas,
  mármoles, ratán, cuerda, metales, lacados y vidrio). Las telas teñibles se pasan a gris y se llevan al color del acabado.
- Convención de ejes en Blender: X ancho, Y fondo con el frente hacia -Y, Z alto y suelo en Z = 0. El GLB exportado
  queda con el frente hacia +Z y `frontRotation = 0`, como los modelos de Poly Haven.
- Piezas colgadas (mueble de lavabo suspendido, espejos, toalleros): se construyen a su altura real y `dims` es solo
  el tamaño visible. El lanzador mide la cota del punto más bajo en el GLB sin optimizar y la guarda como `elevationMm`
  en el manifiesto y en `catalog.json` (por debajo de 5 mm cuenta como suelo); el GLB optimizado queda apoyado en
  y = 0 y la app coloca la pieza a esa elevación.

**Añadir un mueble:** añade una variante (otra medida o tapicería) o un producto en el archivo de su familia. Cada
producto marca exactamente una variante con `proposal: true` (la que ve Amueblar). Si es un tipo de mueble nuevo,
escribe su función en `fam_<familia>.py` y regístrala en `BUILDERS`. Para una familia nueva crea los dos archivos.

**Familia baño** (`families/bano.mjs`, `fam_bano.py` y sus módulos `fam_bano_*.py`, declarados en `dependsOn` para que
cuenten en la huella del generador): lavabos sobre encimera, suspendidos, de pedestal y de semipedestal; muebles con
lavabo integrado suspendidos y de suelo (60–120 cm) y dobles (120 y 140 cm); inodoros, bidés, platos de resina con
relieve de pizarra (Rock058 de ambientCG, CC0) con mampara walk-in, corredera o angular, bañeras y complementos. La loza
se modela con lofts de anillos polares (bordes redondeados y senos sin booleanas). Las piezas colgadas se construyen a su
cota real y la fábrica registra esa cota como su elevación.

**Familia plantas** (`families/plantas.mjs`, `fam_plantas.py` y sus módulos `fam_plantas_*.py` en `dependsOn`): 21
plantas de interior en maceta. Son monstera, ficus lyrata, olivo, sansevieria, kentia, potus de sobremesa y colgante, cactus,
cuenco de suculentas, strelitzia, helecho y bambú, en varias alturas, con macetas de barro con plato, cerámica blanca,
cesta de fibra u hormigón, y en total pesan unos 9,3 MB.

- **Hojas:** son láminas curvadas con filotaxis, inclinación, giro y caída por peso. Usan texturas CC0 con alfa: los atlas
  `LeafSet004` y `LeafSet018` de ambientCG y las hojas de los modelos `anthurium_botany_01` y `fern_02` de Poly Haven.
- **Siluetas propias:** las que no existen en CC0 se dibujan por código sobre el tejido de una hoja CC0. Son la monstera
  con cortes y perforaciones, la hoja de violín del ficus, la strelitzia rasgada, los folíolos de la kentia, el bambú,
  el olivo y las bandas de la sansevieria. Cada planta compone su atlas en `fam_plantas_img.py`.
- **Tallos y tierra:** tallos y pecíolos nacen de la tierra, que queda 2,5 cm bajo el borde de la maceta.
- **Potus colgante:** cuelga de un aro a 2,2 m; su cota baja se registra como `elevationMm`.

**Transparencia de las hojas:** una textura con `alpha: true` en `TEXTURES` admite dos fuentes. Puede ser un atlas de
ambientCG (`dataType 'Atlas'`, con su mapa `_Opacity`) o las texturas de hoja de un modelo de Poly Haven, con su mapa
`Alpha` (`scripts/lib/cc0-sources.mjs`). `textures-prepare.mjs` la entrega como un único `color.png` RGBA. En Blender, el
material lleva la imagen RGBA en el color base y su alfa pasa por un nodo Math «Round» antes de la entrada Alpha. El
exportador glTF lo traduce a `alphaMode: MASK` con corte 0,5, a doble cara, y la optimización conserva el canal alfa en
el WebP. La app no necesita nada especial. GLTFLoader aplica `alphaTest`, `furniture-model-transform.ts` conserva
`alphaTest` y `side` al clonar, la vista cenital (`furniture-top-view.ts`) renderiza el mismo GLB con fondo transparente
y three.js recorta también las sombras. Las plantas carnosas (sansevieria, cactus, suculentas) son opacas.
`tests/editor-document/habiteka-plantas.test.ts` comprueba el recorte en los GLB finales.

**Pintar una planta:** las plantas de la fábrica solo tiñen el material `maceta` (`tintMaterialNames` en
`habiteka-furniture.ts`), así que las hojas y la tierra conservan su textura. La pieza por código «Planta de interior»
(`habiteka:furniture:planta`) se ve con `ficus_lyrata_120` (500 × 507 × 1200 mm), mediante `CATALOG_MODELS` en
`furniture-models.ts`. Antes se veía con `potted_plant_02` de Poly Haven.

**Familia camas** (`families/camas.mjs`, `fam_camas.py`): el edredón se drapea con pliegues que crecen hacia abajo
(`drape`). El plaid de los pies tiene su propia lámina (`throw`): dobla por el mismo canto que el edredón con un radio
algo mayor y cae recto 20 cm por cada lado, con dos pliegues anchos y el bajo recto y apenas recogido. Así queda siempre
por fuera del edredón; antes este lo atravesaba y el bajo salía en ondas o dientes. Los vértices se concentran en el
canto para no pasar del presupuesto de triángulos en las camas grandes de capitoné.

**Familia almacenaje** (`families/almacenaje.mjs`, `fam_almacenaje.py` y el cuerpo común `fam_almacenaje_cuerpo.py`,
declarado en `dependsOn`): armarios batientes, correderos y con espejo, cómodas, sinfonier, mesillas, muebles de TV,
composición de salón, aparadores, vitrina, librerías, estanterías, zapateros, consolas y percheros. El tipo `casework`
describe cada mueble con una rejilla de huecos (`grid`: cajón, puerta, pareja, abatible, vitrina o abierto), la base
(patas, zócalo, bastidor metálico o suspendido), el estilo de frente (liso, ranurado, enmarcado, lamas, rejilla de ratán
o espejo) y el tirador (barra, pomo, perfil uñero, gola o sin tirador); `relleno` pone libros en los huecos abiertos.

**Familia electrodomésticos** (`families/electrodomesticos.mjs`, `fam_electrodomesticos.py` y las piezas comunes de
`fam_electrodomesticos_partes.py`): lavadora, secadora y lavasecadora con ojo de buey, lavavajillas, frigorífico combi y
americano con dispensador, microondas, horno de sobremesa, cafetera espresso, campana decorativa y termo, sin marcas
(placa genérica). El acero cepillado es Metal009 de ambientCG (CC0) a 200 mm por muestra. Microondas, horno de
sobremesa y cafetera van apoyados (cota 0) y el editor los sube a la encimera o al mueble sobre el que se sueltan; la
campana se construye a 1550 mm y el termo con sus tomas a su cota, y la fábrica registra esa elevación.

**Regenerar:**

```bash
node scripts/build-furniture-factory.mjs                    # piezas nuevas o cambiadas
node scripts/build-furniture-factory.mjs --only=camas       # una familia, un producto o una pieza
node scripts/build-furniture-factory.mjs --only=sofa_moderno_3p --force --samples=48
node scripts/build-furniture-factory.mjs --dry-run          # valida y muestra qué se generaría
```

Una pieza está al día si coinciden su especificación, sus acabados, la fuente e id de cada textura y el código de su
familia (módulos `hk_*.py` comunes, su `fam_*.py` y los módulos que declare en `dependsOn`). Por cada pieza, Blender construye la geometría, exporta el GLB y renderiza con Cycles una foto de
producto (vista 3/4, luz de estudio, sombra de contacto). Después el lanzador optimiza el GLB con la misma cadena que el
importador de Poly Haven (`scripts/lib/glb-optimize.mjs`: meshopt y texturas WebP), comprueba los presupuestos
(≤ 40 000 triángulos y ≤ 1,5 MB por modelo y ≤ 200 MB en total, constante `MAX_TOTAL_MB` del lanzador; texturas de 768 px en telas y 1024 px en maderas y
mármoles, 512 px en piezas pequeñas) y guarda:

- `public/models/habiteka/<pieza>.glb` y `public/models/habiteka/thumbs/<pieza>.webp` (512 × 384, miniatura de la ficha).
- `public/models/habiteka/manifest/<familia>.json`: procedencia (autor «Habiteka (modelo propio)», versión del
  generador, parámetros, acabados, medidas reales del modelo, triángulos y, por textura, su fuente CC0 con URL y huellas).
- `public/models/habiteka/catalog.json`: registro de todas las familias que importa
  `src/lib/editor-document/habiteka-furniture.ts`; las piezas entran en el catálogo como `habiteka:model:<pieza>`,
  agrupadas por producto, con su foto como `thumbnailUrl`.
- `plans/reports/fabrica-muebles-<familia>-<n>.jpg`: hojas de contacto para revisar las fotos.

El límite total es propio, no técnico: cada modelo se descarga solo cuando se usa, pero todos viajan en el repositorio
y en la imagen de despliegue. Si el catálogo sigue creciendo, los modelos deberían pasar al almacenamiento de objetos
(MinIO/S3) en lugar de `public/`.

Dos familias distintas pueden generarse a la vez: cada ejecución usa su propio directorio de trabajo y escribe solo los
manifiestos de sus familias. Si quitas o renombras una variante, su GLB, su miniatura y su entrada del manifiesto se
borran la próxima vez que se genera esa familia. Las texturas descargadas se guardan en la caché `$TMPDIR/habiteka-cc0-cache`.

**Amueblar:** recibe una sola variante por producto (`listedForProposal`) y, si no cabe, prueba la medida menor del
mismo producto y acabado (`HABITEKA_SMALLER`, calculada por la fábrica). Varias piezas por código del catálogo (sofás,
butacas, camas, mesas y sillas de comedor, bancos, sofá cama, chaise longue y sofá de exterior) se ven con estos modelos
(`CATALOG_MODELS` en `furniture-models.ts`). Los modelos antiguos de Poly Pizza que se dibujan con su equivalente realista
ya no se listan en el catálogo, pero se siguen resolviendo para los documentos existentes.

**Estancias del catálogo:** `FurnitureRoom` (`src/lib/editor-document/furniture-catalog.ts`) y `ROOMS` de
`catalog-specs.mjs` admiten trece estancias: las nueve de siempre más `infantil`, `recibidor`, `lavadero` y `garaje`. La
estancia solo ordena el catálogo y orienta la lectura del boceto y Amueblar; no se guarda en los documentos, así que los
planos existentes no cambian.

- `src/lib/editor-document/furniture-rooms.ts`:
  - `withProductRoom` lleva a su estancia, por el nombre del producto, las piezas que una familia dejó en otra porque la
    estancia aún no existía. Las de lavadora, secadora, tendedero, termo o caldera van al lavadero; zapatero, perchero,
    consola o recibidor, al recibidor; cuna, litera, cama nido, infantil, juvenil o cambiador, a infantil; y garaje,
    banco de trabajo o estantería metálica, al garaje. Los sanitarios no se mueven. Se aplica en
    `HABITEKA_FURNITURE_CATALOG`, así que sirve también para las piezas que se fabriquen después.
  - `furnitureRooms` añade las estancias en que una pieza también sirve. Las camas individuales, el escritorio y su silla,
    los armarios y las estanterías salen también en infantil; la lavadora y la secadora, en baño y cocina; el mueble
    columna y los bancos, en recibidor; y las estanterías metálicas, en garaje. El filtro y la búsqueda del catálogo
    (`searchFurnitureCatalog`) y la lectura del boceto (`place-furniture.ts`) usan esa lista.
- `src/lib/editor-document/room-use.ts` deduce el uso de una estancia por su nombre rotulado (`roomFromZoneName`). Va de
  lo concreto a lo general («Dormitorio infantil» es infantil; «Cocina-lavadero», cocina; «Porche de entrada», exterior).
  Lo comparten la lectura del boceto y Amueblar. Amueblar recibe el campo `uso` de cada estancia y las reglas de las
  estancias nuevas (`ROOM_USE_RULES`). En el garaje, el código descarta todo lo que no sea una estantería metálica, salvo
  que el cliente nombre el garaje en sus instrucciones o haya boceto.
- Piezas movidas en el código: lavadora, secadora, pila de lavadero y cesto de ropa, al lavadero; zapatero y felpudo, al
  recibidor. Las de la familia `almacenaje` (zapateros, consolas, mueble de recibidor y percheros) pasan al recibidor por
  `withProductRoom`.
