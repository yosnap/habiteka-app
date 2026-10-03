# Imágenes de navegación del catálogo

Actualizado: 3 de octubre de 2026.

## Alcance

Amueblar utiliza imágenes realistas propias para nueve habitaciones y doce categorías. Construir las incorpora en doce categorías y en las acciones Añadir terreno/Añadir pavimento. Son ilustraciones genéricas de navegación, sin datos de inmuebles, personas, marcas ni modelos comerciales concretos. Las fichas mantienen sus símbolos, dimensiones, variantes y créditos. Estas imágenes no son referencias aceptadas para diseños o vídeos de un proyecto.

## Assets y carga

- `public/images/catalog/rooms-v1.webp`: 1536 × 1024 px, 296402 bytes; atlas de 3 columnas y 3 filas.
- `public/images/catalog/categories-v1.webp`: 1086 × 1448 px, 243362 bytes; atlas de 3 columnas y 4 filas.
- `public/images/catalog/construction-v1.webp`: 948 × 1660 px, 230062 bytes; atlas de 2 columnas y 7 filas.
- `catalog-navigation-image.tsx` y `construction-navigation-image.tsx` relacionan cada identificador con su celda. Comparten `navigation-atlas-image.tsx`, que recorta visualmente el atlas mediante CSS. El atlas de Construir emplea regiones ajustadas a sus filas para excluir los separadores de 1–2 px; no se modifica el contenido de la imagen.
- Las imágenes se generaron con la herramienta integrada `image_gen`, sin referencias de usuarios. Los PNG originales se convirtieron a WebP (calidad 82, mismas dimensiones) con Sharp, sin edición de su contenido.
- Se sirven como assets estáticos precodificados con Next Image `unoptimized` y carga diferida. Cada atlas se descarga una vez y se reutiliza entre tarjetas; se evita depender de la transformación de imágenes en tiempo de petición. Si falla la carga se utiliza la ilustración SVG existente.
- El texto visible de la tarjeta sigue siendo su nombre accesible. La imagen es decorativa, sin texto alternativo duplicado.

Orden de habitaciones, por filas: salón, dormitorio, cocina / baño, comedor, oficina / exterior, iluminación, decoración.

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
