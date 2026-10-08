# Catálogo maestro de decoración y equipamiento de vivienda (España)

Fecha: 2026-10-05. Investigación previa a las oleadas 2–4 de la fábrica de la fase 5 del [plan](plan.md). La especificación
estructurada equivalente está en [catalogo-maestro.json](catalogo-maestro.json): mismas familias, variantes y medidas, y es la
entrada de la fábrica. Este documento no cambia código.

## Resultado

- **236 piezas nuevas en tres oleadas**: oleada 2 (P1), 91 piezas; oleada 3 (P2), 82; oleada 4 (P3), 63. Se suman a la
  oleada 1 en marcha, que aquí no se repite. Por método: Blender 173, código 40 y CC0 de Poly Haven 23.
- **Los huecos más graves para una vivienda típica** son, por este orden:
  1. Electrodomésticos realistas: los actuales son low-poly de Kenney o Quaternius, o cajas.
  2. Almacenaje: armarios, armarios empotrados, mueble de TV, librerías y cómodas.
  3. Lámparas de techo con modelo: hoy son luminarias sin forma de producto.
  4. Habitación infantil.
  5. Radiadores y aire acondicionado.
  6. Grifería y espejos de baño.
- **Orden recomendado dentro de la oleada 2**:
  1. Cuerpos de cajón y puerta, compartidos por mueble de TV, cómodas, mesillas, armarios y aparadores (fabricar uno sirve a
     cinco familias).
  2. Electrodomésticos.
  3. Iluminación.
  4. El resto.
- **Cuatro cambios de modelo de datos** son necesarios antes de terminar la oleada 2 (ver «Encaje en la arquitectura»):
  1. Estancias nuevas.
  2. Elementos colgados de la pared.
  3. Enlace de luminaria a modelo.
  4. GLB en los huecos de la cocina.
- **Poly Haven tiene poco que aportar**: de 521 modelos, 39 ya están importados y solo 23 merecen la pena. El resto es mobiliario
  victoriano o envejecido, árboles de millones de polígonos o atrezo industrial.

## Convenciones

- Medidas en mm de la caja exterior: **ancho × fondo × alto**. «Cota» (`elevationMm`) es la altura de apoyo sobre el suelo
  acabado, por ejemplo un espejo a 1150 o un split a 2050.
- Prioridad:
  - **P1**: imprescindible para amueblar una vivienda típica.
  - **P2**: habitual.
  - **P3**: complementario.
- Método:
  - **Blender**: mueble u objeto (`scripts/blender`).
  - **Código**: carpintería, cocina modular o construcción paramétrica.
  - **CC0**: importar de Poly Haven con `scripts/import-polyhaven-models.mjs`.
- Estado respecto al catálogo actual:
  - **existe**: hay modelo válido.
  - **parcial**: hay algo low-poly, procedural o de otro estilo.
  - **falta**: no hay nada.
- Estilos con las etiquetas que ya usa el código: Nórdico, Contemporáneo (moderno), Industrial, Clásico, Mediterráneo y Rústico.
- Materiales: claves de `scripts/furniture-factory/finishes.mjs`. Faltan 16 acabados nuevos, todos con textura CC0 (ambientCG
  o Poly Haven) o PBR liso: `acero-inox`, `acero-galvanizado`, `acrilico-blanco`, `ceramica-blanca`, `espejo`, `estuco-blanco`,
  `granito-negro`, `gresite-azul`, `lacado-gris`, `lacado-negro`, `ladrillo-refractario`, `lona-acrilica`, `piedra-natural`,
  `pino`, `plastico-blanco` y `vidrio-opal`.

## Inventario actual frente a un catálogo completo

| Área | Qué hay hoy | Calidad | Hueco principal |
|---|---|---|---|
| Salón y comedor | 65 piezas procedurales (`furniture-catalog.ts`); 39 modelos de Poly Haven (sillones, mesas de centro, 4 aparadores, 2 estanterías) | Variable: CC0 realista pero a menudo clásico o envejecido | Mueble de TV, librerías modernas, aparadores actuales |
| Dormitorio | 2 camas CC0, 2 mesillas CC0, cómoda clásica, armario low-poly | Armario no realista | Armarios libres y empotrados, vestidor, cómodas actuales |
| Cocina | Tramo lineal por código con huecos (fregadero, vitro, lavavajillas, lavadora, horno y frigorífico) y altos; cocina en L desde Amueblar; electrodomésticos low-poly; 3 taburetes CC0 | Huecos dibujados como cajas | Electrodomésticos realistas, columnas, isla con barra, campanas, fregaderos |
| Baño y aseo | Low-poly y procedurales | Bajo | Oleada 1 en marcha; faltan grifería, espejos y accesorios |
| Iluminación | Luminarias de techo funcionales (colgante, plafón, empotrado y foco), tiras LED, 2 lámparas CC0 y procedurales | Sin forma de producto | Colgantes, plafones, apliques y lámparas de pie actuales |
| Exterior | 31 elementos por código (3 pérgolas, toldo, sombrilla, vallas, piscina elevada, barbacoa y vegetación); coche | Correcto como guía | Piscina enterrada, cancelas, pérgola bioclimática, iluminación exterior |
| Carpintería | 31 tipos de puerta y ventana | Bueno | Oleada 1 en marcha |
| Construcción | Escaleras recta, en L y en U con pasamanos; rampas; columnas rectangulares | Bueno | Caracol, barandillas independientes, chimenea de obra |
| Decoración | 26 alfombras, jarrón y 2 plantas CC0; cortinas, estores y persianas por código | Bueno en textiles | Cuadros, espejos, cojines, cestas; plantas de interior realistas |
| Materiales | 117 CC0 en 12 categorías | Bueno | Los 16 acabados de fábrica citados arriba |

## Oleada 1: en marcha (no se repite aquí)

| Familia | Estancia |
|---|---|
| Sofás de 2, 3 y 4 plazas, chaise longue, rinconera, sofá cama, modular, butacas y puf | Salón |
| Camas con cabecero | Dormitorio |
| Mesas de comedor, sillas, taburetes y bancos | Comedor y cocina |
| Sofás, sillas, tumbonas, mesas y chill-out de exterior | Terraza y jardín |
| Más puertas, puertas de garaje (seccional, enrollable y basculante) y ventanas | Toda la vivienda |
| Lavabos, inodoros, bidés, duchas con mampara, bañeras y muebles de baño | Baño y aseo |
| Alfombras | Toda la vivienda |

Hay que comprobar si la oleada 1 de carpintería incluye la ventana de tejado y la puerta de trastero o de registro. No están
en la lista pedida y un catálogo completo las necesita.

## Cobertura por estancia

| Estancia | Oleada 2 (P1) | Oleada 3 (P2) | Oleada 4 (P3) |
|---|---|---|---|
| Salón | Mueble de TV, librerías, mesas de centro y auxiliares, radiador, split | Chimenea de obra, estufas, espejos, apliques y lámparas de pie | Mueble bar, piano, carrito, bioetanol, chimenea de esquina |
| Comedor | Colgante lineal sobre la mesa | Aparadores y vitrinas, lámpara de araña | Decoración clásica CC0 |
| Cocina | Electrodomésticos libres e integrables, fregaderos, grifo, columnas, isla, península, frentes | Placa de gas, inducción de 80, campana de isla, vinoteca, rinconero, altos a techo | Pequeño electrodoméstico, enchufes sobre encimera |
| Dormitorio | Armarios libres y empotrados, mesillas, cómodas | Vestidores, espejo de pie, aplique de cabecero | Tocador, galán, baúl |
| Infantil y juvenil | Cunas, cama nido, litera, cambiador | Escritorio, organizador y silla juveniles | Cama casita, mesa infantil, baúl |
| Baño | Grifería, espejos | Toalleros, portarrollos, radiador toallero | Mecanismos |
| Aseo | Grifería, espejos (mismas piezas que el baño) | Accesorios | No aplica |
| Despacho | Escritorios y silla ergonómica; librerías compartidas con el salón | Apliques y lámparas compartidos | Toma de TV y datos |
| Recibidor | Armario empotrado | Consolas, zapateros, percheros, espejo redondo | Biombo, cestas |
| Lavadero | Lavadora y secadora | Columna apilada, armario para lavadora, tendedero, termo, caldera | Tabla de planchar, carga superior |
| Terraza y jardín | No aplica | Piscina enterrada, barbacoas, pérgola bioclimática, toldos, cancelas, vallas, iluminación, conjunto de balcón | Spa, ducha, columpio, hamaca, leñero, kamado, caseta, hoguera |
| Garaje | No aplica | Estanterías metálicas (CC0) | Bicicleta, scooter, banco de trabajo, cargador, armario |

## Oleada 2 · P1 · 91 piezas

Imprescindible que falta para amueblar una vivienda típica. Métodos: Blender 79, Código 10, CC0 2.

### Salón

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Mueble de TV y composición de salón (6) | Bajo de roble con patas · 160 cm; Bajo de nogal con frentes ranurados · 200 cm; Suspendido lacado · 180 cm; Industrial de madera y acero · 180 cm; Con puertas de rejilla de ratán · 150 cm; Composición con bajo, altos y estantes · 300 cm — Hueco para TV de 55–75″. Patas o zócalo por parámetro. Comparte el cuerpo de puertas y cajones con cómodas y aparadores. | 1200–2400 × 350–450 × 400–600; suspendido 250–350 de alto a 300–450 del suelo; composición 2400–3200 × 350–450 × 1800–2200 | roble, lacado-blanco, nogal, metal-negro, ratan-natural · Nórdico, Contemporáneo, Industrial, Mediterráneo | P1 | Blender | parcial: aparador_bajo_moderno (CC0) y mueble-tv procedural |
| Librerías y estanterías (8) · también despacho, dormitorio, infantil | Librería alta lacada · 80 cm; Librería alta de roble · 80 cm; Estantería de cubos 2 × 4; Estantería de cubos 4 × 4; Estantería escalera; Librería baja · 120 cm; Estante de pared flotante · 80 cm; Estante de pared con escuadras · 120 cm — Relleno opcional de libros y objetos (parámetro) reutilizando decorative_book_set_01 (CC0). | 400–1200 × 250–400 × 800–2020; cubos 770/1470 × 390 × 770/1470; estante de pared 600–1200 × 200–250 × 30–50 | lacado-blanco, roble, nogal, metal-negro · Nórdico, Contemporáneo, Industrial | P1 | Blender | parcial: estanteria_cubos y estanteria_acero_madera (CC0), estantería low-poly y librería procedural |
| Mesas de centro (5) | Rectangular de roble · 120 × 60; Redonda de mármol con pie de latón · Ø 90; Mesas nido redondas · Ø 80 + Ø 50; Con tapa elevable · 110 × 55; Redonda de ratán · Ø 80 | 900–1300 × 500–700 × 350–450; redonda Ø 700–1000 | roble, marmol-blanco, laton, metal-negro, lacado-blanco, ratan-natural · Nórdico, Contemporáneo, Industrial, Mediterráneo | P1 | Blender | parcial: 3 CC0 (moderna, redonda, cuadrada) y procedural |
| Mesas auxiliares (3) · también dormitorio | Redonda de mármol y metal · Ø 45; De roble con pie central · Ø 40; En C para el sofá | Ø 350–500 × 450–600; en C 450 × 300 × 600 | marmol-negro, metal-negro, roble · Contemporáneo, Nórdico, Industrial | P1 | Blender | parcial: velador_alto (CC0) y mesa-auxiliar procedural |

### Cocina

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Electrodomésticos de libre instalación (7) · también lavadero | Frigorífico combi inox · 186 cm; Frigorífico combi blanco · 203 cm; Frigorífico americano de dos puertas; Lavavajillas de libre instalación · 60 cm; Microondas de sobremesa; Lavadora de carga frontal; Secadora de bomba de calor — Sustituyen a nevera, nevera_americana, nevera_mini, microondas, lavadora y secadora actuales. Lavadora y secadora sirven también al lavadero. | Combi 595–600 × 650–680 × 1850–2030; americano 900–920 × 700–750 × 1780–1800; lavavajillas 450/600 × 600 × 850; lavadora y secadora 595–600 × 550–650 × 845–850; microondas 450–520 × 350–420 × 260–310 | acero-inox, lacado-blanco, cristal · Contemporáneo | P1 | Blender | parcial: low-poly (Kenney/Quaternius) y procedurales; sustituir por realistas |
| Aparatos integrables, fregaderos y grifo de cocina (8) | Horno integrable · 60 cm; Microondas integrable · 60 cm; Placa de inducción · 60 cm; Campana decorativa de pared · 90 cm; Campana integrada bajo mueble alto · 60 cm; Fregadero de un seno con escurridor · inox; Fregadero de dos senos · granito; Grifo de cocina monomando de caño alto — Un único GLB por aparato: lo usan el catálogo suelto y el hueco del tramo de cocina (KitchenSlot), sin duplicar geometría. | Horno 595 × 550–570 × 595; microondas 595 × 350–400 × 380–460; placa 590–800 × 510–520 × 45–60; campana de pared 600/900 × 450–500 × 640–1000; fregadero 780–1160 × 435–500; grifo con caño de 200–250 y 300–450 de alto | cristal, acero-inox, granito-negro, cromo · Contemporáneo | P1 | Blender | parcial: los huecos del tramo de cocina se dibujan como cajas por código; vitrocerámica low-poly |
| Cocina modular: columnas, isla, península y frentes (6) | Columna de horno y microondas; Columna despensa; Isla con voladizo de barra; Península con barra; Frentes sin tirador con gola; Frentes enmarcados (shaker) con pomo — Amplía KitchenComposition (tipo de columna, isla/península con voladizo, estilo de frente y tirador); no genera GLB. | Bajos 600 × 900 (zócalo 100, encimera 30); altos 300–370 de fondo × 600–900 a 1450–1500; columnas 600 × 600 × 2000–2200; isla 1800–2400 × 900–1200 × 900 con voladizo de barra 250–350 | lacado-blanco, marmol-blanco, roble, lacado-gris, lacado-verde, laton · Contemporáneo, Nórdico, Clásico | P1 | Código | parcial: tramo lineal con huecos y módulos altos; cocina en L desde Amueblar |

### Dormitorio

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Armarios de libre instalación (5) | Dos puertas lacado · 100 cm; Tres puertas de roble · 150 cm; Dos puertas correderas · 180 cm; Correderas con espejo · 200 cm; Dos puertas de rejilla de ratán · 100 cm | 1000–2000 × 550–650 × 2000–2360 (módulos de 500/750/1000) | lacado-blanco, roble, espejo, ratan-natural · Nórdico, Contemporáneo, Mediterráneo | P1 | Blender | parcial: armario low-poly (Quaternius) y procedural |
| Armarios empotrados (4) · también recibidor, infantil | Frente de puertas batientes; Frente corredero de dos hojas; Frente corredero de tres hojas con espejo; Puertas batientes con altillo — Se traza entre muros como el tramo de cocina (mismo patrón que KitchenRun): ancho = hueco, alto = techo. Frente liso, enmarcado o con espejo y tirador elegible; interior con barra, baldas y cajonera. | Hueco de 800–3600 entre muros, módulos de 400–1000; fondo 600–650; a techo 2400–2700 o 2200 + altillo 400–600 | lacado-blanco, roble, espejo · Contemporáneo, Nórdico, Clásico | P1 | Código | falta |
| Mesillas de noche (4) | Dos cajones de roble; Suspendida de un cajón; Nogal con patas de latón; De ratán con balda | 400–550 × 350–450 × 450–600; suspendida de 150–200 de alto a 400–450 | roble, lacado-blanco, nogal, laton, ratan-natural · Nórdico, Contemporáneo, Mediterráneo | P1 | Blender | parcial: 2 CC0 (con cajón, con estantes), mesilla low-poly y procedural |
| Cómodas y sinfonieres (4) | Seis cajones de roble · 160 cm; Tres cajones lacada · 80 cm; Sinfonier de seis cajones; Nogal con patas altas · 120 cm | Cómoda 800–1600 × 450–500 × 750–950; sinfonier 450–600 × 400–480 × 1100–1300 | roble, lacado-blanco, nogal, laton · Nórdico, Contemporáneo, Clásico | P1 | Blender | parcial: comoda_clasica y cajonera_baja (CC0) y procedural |

### Infantil y juvenil

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Cunas, camas nido, literas y cambiador (5) | Cuna de barrotes · 60 × 120; Cuna convertible · 70 × 140; Cama nido · 90 × 190; Litera con escalera · 90 × 190; Cómoda con cambiador — Cunas según UNE-EN 716: separación de barrotes 45–65 mm. Ropa de cama con el paño de fam_beds (drape). | Cuna 60 × 120 → 640–670 × 1240–1260 × 850–950; 70 × 140 → 760 × 1460 × 900; nido 90 × 190 → 970–1000 × 1960–2000 × 550–800; litera 980–1010 × 1960–2050 × 1500–1700; cambiador 800–900 × 500–800 × 900–1000 | lacado-blanco, roble, pino · Nórdico, Contemporáneo | P1 | Blender | falta |

### Baño y aseo

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Grifería visible (4) · también aseo, cocina | Grifo de lavabo monomando; Grifo de lavabo de caño alto · negro; Columna de ducha termostática; Grifo mural de baño-ducha — Si la fábrica de baño (oleada 1) ya trae grifo en lavabos y duchas, usar estas piezas como subpiezas en vez de duplicarlas. | Lavabo 50 × 130–180 × 150–200 (caño alto 280–320); columna termostática 300–350 × 450 × 1000–1200 con rociador Ø 200–300 a 2000–2100; mural de baño-ducha 300 × 150 × 150 a 700–800 | cromo, metal-negro · Contemporáneo, Industrial, Clásico | P1 | Blender | falta |
| Espejos de baño (3) · también aseo | Rectangular · 80 × 70; Redondo con marco negro · Ø 60; Retroiluminado LED · 100 × 70 | 600–1200 × 20–50 × 600–900; borde inferior a 1100–1200 | espejo, metal-negro · Contemporáneo, Industrial | P1 | Blender | falta |

### Despacho

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Escritorios y sillas de trabajo (5) | Escritorio de roble · 120 × 60; Escritorio con cajonera · 140 × 70; Escritorio elevable · 140 × 70; Escritorio en L · 150 × 150; Silla de oficina ergonómica de malla | Escritorio 1000–1600 × 500–800 × 740–760 (elevable 650–1250); en L 1400–1600 × 1400–1600; silla 600–700 × 600–700 × 950–1250 | roble, metal-negro, lacado-blanco, tejido-antracita · Nórdico, Contemporáneo | P1 | Blender | parcial: escritorio y silla procedurales, escritorio_metalico (CC0) |

### Toda la vivienda: iluminación, climatización, construcción y decoración

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Lámparas de techo: colgantes y plafones (6) | Colgante de campana metálica · Ø 35; Colgante de ratán · Ø 45; Colgante de tambor de lino · Ø 50; Lineal LED para mesa de comedor · 120 cm; Plafón LED redondo · Ø 40; Plafón de madera y opal · Ø 45 — Luminaire solo guarda kind: hace falta un catalogId opcional para enlazar el modelo. El kind sigue gobernando la luz. | Colgante Ø 250–600 × 150–450 (bajo a 650–750 sobre la mesa); lineal 1000–1500 × 50–80; plafón Ø 300–500 × 60–120 | metal-negro, ratan-natural, lino-blanco, vidrio-opal, lacado-blanco, roble · Industrial, Mediterráneo, Nórdico, Contemporáneo | P1 | Blender | parcial: luminarias funcionales (colgante, plafón, empotrado, foco) sin modelo de producto |
| Colgante y ventilador de techo (Poly Haven) (2) | Colgante de globo opal (modern_ceiling_lamp_01); Ventilador de techo negro con luz (ceiling_fan) — Estado clean en Poly Haven. Importar con scripts/import-polyhaven-models.mjs (GLB con texturas de 1k). | Medidas de la caja del modelo | vidrio esmerilado, metal cepillado, metal negro mate · Contemporáneo | P1 | CC0 | falta: CC0 no importado |
| Radiadores (4) | Aluminio de 6 elementos; Aluminio de 10 elementos; Aluminio de 14 elementos; Panel de acero · 100 × 60 — Parámetros: número de elementos (ancho = n × 80) y alto 600/700/800; válvula y detentor visibles. | Aluminio: elemento de 80 de ancho × 80–100 × 600–800 (4–14 elementos); panel de acero 400–2000 × 60–100 × 300–900; a 100–150 del suelo | lacado-blanco · Contemporáneo | P1 | Blender | falta |
| Aire acondicionado split (2) | Split de pared · 2.500 frigorías; Split de pared · 4.500 frigorías — La unidad exterior va en la oleada 3. | Interior 700–1000 × 190–250 × 250–320, a 2000–2200 del suelo; exterior 650–900 × 250–350 × 450–700 | plastico-blanco · Contemporáneo | P1 | Blender | falta |

## Oleada 3 · P2 · 82 piezas

Habitual: completa estancias, instalaciones y exterior. Métodos: Blender 52, Código 21, CC0 9.

### Salón

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Chimenea de obra (1) | Chimenea de obra frontal con campana a techo — Construcción adosada al muro: alto de la campana = altura libre de la estancia. | Frente 1000–1600 × 400–600 × 1000–1200 con hogar de 700–1000 y campana hasta el techo | estuco-blanco, piedra-natural · Mediterráneo | P2 | Código | parcial: chimenea low-poly (Quaternius) |
| Estufas de leña y de pellet (2) | Estufa de leña con tubo; Estufa de pellet | Leña 450–700 × 400–600 × 700–1200 con tubo Ø 150; pellet 450–600 × 450–600 × 900–1250 | metal-negro, ceramica-blanca · Nórdico, Contemporáneo | P2 | Blender | falta |

### Comedor

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Aparadores y vitrinas (4) · también salón | Aparador de roble de tres puertas · 180; Aparador con rejilla de ratán · 150; Aparador lacado sin tiradores · 200; Vitrina de metal y vidrio | Aparador 1500–2200 × 400–500 × 700–850; vitrina 800–1000 × 350–450 × 1600–2000 | roble, ratan-natural, lacado-gris, metal-negro, cristal · Nórdico, Mediterráneo, Contemporáneo, Industrial | P2 | Blender | parcial: 4 CC0 (bajo moderno, vitrina clásica, industrial, cajonera alta) y procedurales |

### Cocina

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Más aparatos y grifo de cocina (5) | Placa de gas de cuatro fuegos · 60; Placa de inducción · 80; Campana de isla · 90; Grifo de cocina con ducha extraíble; Vinoteca bajo encimera · 60 | Placa de gas 580–600 × 500–520 × 90–110; inducción 800 × 520 × 50; campana de isla 900 × 600 × 700–1000; vinoteca 595 × 570 × 820 | cristal, metal-negro, acero-inox · Contemporáneo | P2 | Blender | falta |
| Cocina modular: rinconero y altos a techo (2) | Módulo rinconero con carrusel; Altos hasta el techo con altillo | Rinconero 900 × 900 × 900; altos a techo 300–370 de fondo hasta 2400–2700 | lacado-blanco · Contemporáneo | P2 | Código | falta |

### Dormitorio

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Vestidores (3) | Vestidor lineal abierto; Vestidor en L; Vestidor en U — Mismo trazado por tramos que el armario empotrado; añade barras, cajoneras, zapateros y baldas a la vista. | Fondo 350–600; pasillo ≥ 700 (cómodo 900–1000); módulos 500–1000; alto 2000–2400 | roble, metal-negro, lacado-blanco · Contemporáneo, Clásico | P2 | Código | falta |
| Espejos decorativos (3) · también salón, recibidor | Espejo de pie con marco de roble; Espejo redondo con marco de latón · Ø 70; Espejo de arco de pared | Pared Ø 500–900 o 500–900 × 800–1800; de pie 400–800 × 30–400 × 1500–1800 | espejo, roble, laton, metal-negro · Nórdico, Contemporáneo | P2 | Blender | falta |

### Infantil y juvenil

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Estudio y juego infantil (3) | Escritorio juvenil con estante · 110; Organizador de juguetes con cajas; Silla de escritorio giratoria juvenil | Escritorio 1000–1200 × 500–600 × 730–760; organizador 600–1000 × 300–450 × 600–950; silla 500–550 × 500–550 × 800–950 | lacado-blanco, roble, pino, polipropileno-blanco, polipropileno-salvia, metal-negro · Nórdico, Contemporáneo | P2 | Blender | falta |

### Baño y aseo

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Toalleros y accesorios de baño (4) · también aseo | Toallero de barra · 60 cm; Toallero de aro; Portarrollos; Radiador toallero · 50 × 120 | Toallero de barra 400–800 × 70–100 × 30 a 1000–1200; radiador toallero 450–600 × 80–120 × 700–1800 a 150; portarrollos 150 × 80 × 120 a 700 | cromo, metal-negro · Contemporáneo, Industrial | P2 | Blender | falta |

### Recibidor

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Consolas, zapateros y percheros (7) | Consola de roble · 100 cm; Consola de metal y mármol · 120 cm; Consola estrecha · 80 × 25; Zapatero de dos compartimentos abatibles; Banco zapatero con cojín; Perchero de pie; Perchero de pared con estante | Consola 800–1200 × 250–400 × 750–850; zapatero 600–1000 × 170–350 × 800–1500; perchero de pie Ø 400–500 × 1700–1900; banco 800–1200 × 300–400 × 450–500 | roble, metal-negro, marmol-blanco, nogal, lacado-blanco, lino-gris · Nórdico, Contemporáneo, Clásico, Industrial | P2 | Blender | parcial: zapatero procedural |

### Lavadero

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Lavadero e instalaciones de agua (5) · también cocina, baño | Lavadora y secadora apiladas; Armario para lavadora con altillo; Tendedero plegable de alas; Termo eléctrico · 80 L; Caldera mural de condensación | Columna lavadora-secadora 600 × 600 × 1700–1750; armario para lavadora 650–700 × 600–670 × 1800–2100; tendedero de alas 1600–1800 × 550–600 × 900–1050; termo Ø 360–460 × 500–1200 (50–100 L) a 1200–1800; caldera mural 400–450 × 250–350 × 600–750 a 1300–1500 | lacado-blanco, cristal, aluminio-blanco · Contemporáneo | P2 | Blender | parcial: pila de lavadero y cesto procedurales |

### Terraza y jardín

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Piscina enterrada (1) | Enterrada rectangular · 8 × 4 m — Vaso hundido en la superficie exterior con coronación y lámina de agua. | 6 × 3 a 10 × 5 m (la más común, 8 × 4); profundidad 1200–1500 y fosa de hasta 2000; coronación de 300–400 | gresite-azul, piedra-natural · Mediterráneo | P2 | Código | parcial: piscina elevada |
| Barbacoa de obra (1) | Barbacoa de obra con chimenea | 1500–2500 × 600–800 × 1800–2400 con chimenea | ladrillo-refractario, piedra-natural · Rústico | P2 | Código | parcial: barbacoa con parrilla |
| Barbacoa de gas (1) | Barbacoa de gas de tres quemadores | 1200–1500 × 550–650 × 1100–1200 | acero-inox, metal-negro · Contemporáneo | P2 | Blender | falta |
| Pérgola bioclimática y toldos (3) | Pérgola bioclimática de lamas orientables; Toldo de brazo extensible con cofre; Toldo vela triangular | Bioclimática 3000–6000 × 3000–4500 × 2500–2800; toldo de brazo: línea 2500–6000 × salida 1500–3500, cofre 150–200; toldo vela de 3600–5000 de lado | aluminio-antracita, lona-acrilica, aluminio-blanco · Contemporáneo, Mediterráneo | P2 | Código | existe: pérgolas de madera, aluminio y acero, toldo, sombrilla y carpa |
| Cancelas y vallas (3) | Cancela peatonal batiente; Cancela corredera de vehículos; Valla de lamas de aluminio — Las cancelas son aberturas en la valla (barren como una puerta abatible o recorren como una corredera). | Cancela peatonal 900–1200 × 50 × 1800–2000; corredera de vehículos 3000–5000 × 60 × 2000; valla de lamas en módulos de 1800–2000 × 1000–2000 | metal-negro, aluminio-antracita · Contemporáneo | P2 | Código | existe: valla de madera, cerca metálica y seto |
| Iluminación exterior (3) | Aplique de fachada; Baliza de jardín; Farola de jardín | Aplique 100–200 × 100–200 × 200–350 a 1800–2200; baliza Ø 150 × 400–800; farola Ø 200–400 × 1800–2400 | aluminio-antracita, cristal, metal-negro, vidrio-opal · Contemporáneo, Clásico | P2 | Blender | falta |
| Conjunto de balcón (Poly Haven) (1) | Mesa y dos sillas plegables de balcón (outdoor_table_chair_set_01) — Estado clean. | Medidas de la caja del modelo (mesa y dos sillas juntas) | madera, metal · Contemporáneo | P2 | CC0 | falta: CC0 no importado |

### Garaje

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Estanterías metálicas (Poly Haven) (2) | Estantería de acero y madera · 110 (steel_frame_shelves_01); Estantería de acero y madera · 60 (steel_frame_shelves_02) — Estado clean. Sirven también para trastero y despensa. | Medidas de la caja del modelo | acero, madera · Industrial | P2 | CC0 | falta: CC0 no importado |

### Toda la vivienda: iluminación, climatización, construcción y decoración

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Unidad exterior y rejilla de conductos (2) · también exterior | Unidad exterior de split; Rejilla lineal de conductos — La unidad exterior se coloca en terraza, fachada o cubierta. | Unidad exterior 650–900 × 250–350 × 450–700; rejilla lineal 600–1500 × 100–150 × 30 | lacado-blanco, aluminio-blanco · Contemporáneo | P2 | Blender | falta |
| Apliques, lámparas de pie y de mesa (8) | Aplique de brazo articulado; Aplique de cúpula opal; Aplique de lectura para cabecero; Lámpara de pie de arco; Lámpara de pie trípode; Lámpara de mesa de cerámica; Lámpara de mesa seta; Carril de techo con tres focos — El carril se cuelga del techo como luminaria (mismo enlace por catalogId que los colgantes). | Aplique 120–300 × 100–450 × 150–400 a 1600–1800 (cabecero 1100–1200); pie 1500–1900 (arco con vuelo de 1000–1800); mesa Ø 200–400 × 300–600; carril 1000–2000 | laton, vidrio-opal, metal-negro, acero-inox, marmol-blanco, roble, lino-blanco, ceramica-blanca · Clásico, Contemporáneo, Industrial, Nórdico, Mediterráneo | P2 | Blender | parcial: lámparas de pie y de mesa procedurales, low-poly y 2 CC0 |
| Lámpara de araña (Poly Haven) (1) | Lámpara de araña de latón y cristal (Chandelier_03) — Estado clean. | Medidas de la caja del modelo | latón, cristal · Clásico | P2 | CC0 | falta: CC0 no importado |
| Cortinas y estores (nuevos tipos) (2) | Estor plegable (paqueto); Cortina doble: visillo y opaca — Nuevas variantes de los perfiles por código ya existentes. | Ancho del hueco + 150–300 por lado; estor plegable 600–2000 × 60–100 × 1000–2500 | lino-arena, lino-blanco, lino-gris · Mediterráneo, Clásico | P2 | Código | existe: cortina, cortina abierta, estor enrollable, veneciana, vertical y persiana exterior |
| Escalera de caracol (1) | De caracol · Ø 140 — Nuevo kind de Stair ('spiral') con su recorrido y su enlace entre plantas. | Ø 1200–1800; contrahuella 130–185 y 540 ≤ 2C + H ≤ 700 (CTE DB-SUA 1); 12–16 peldaños por planta | metal-negro, roble · Industrial | P2 | Código | existe: recta, en L y en U; falta caracol |
| Barandillas de balcón, terraza y hueco (4) · también exterior | De vidrio laminado con pinzas; De barrotes verticales de acero; De forja clásica; De madera y cables de acero — Se traza por tramos como un muro bajo. El mismo diseño sirve de pasamanos de escalera y rampa. | Altura ≥ 900 (desnivel ≤ 6 m) o ≥ 1100; huecos que no dejen pasar una esfera de 100 (CTE DB-SUA 1); tramos de hasta 3000 | cristal, acero-inox, metal-negro, forja-negra, roble · Contemporáneo, Clásico, Nórdico | P2 | Código | parcial: solo pasamanos de escalera y rampa |
| Cuadros y láminas (3) | Lámina con marco negro · 50 × 70; Lámina con marco de roble · 70 × 100; Lienzo sin marco · 100 × 70 — Imagen intercambiable por parámetro: solo láminas CC0 o propias autorizadas, nunca obra con derechos. | 300 × 400 a 1000 × 1400; fondo 20–40; centro a 1500–1600 | metal-negro, roble, algodon-blanco · Contemporáneo, Nórdico | P2 | Blender | falta |
| Cojines (2) | Pareja de cojines cuadrados; Cojín rectangular — Reutiliza las telas CC0 de la fábrica de sofás. | Cuadrado 450 × 450 × 150; rectangular 500 × 300 × 120 | lino-arena, terciopelo-verde, punto-mostaza · Nórdico, Mediterráneo | P2 | Blender | falta |
| Jarrones, libros y planta (Poly Haven) (5) | Jarrón blanco de boca estriada (ceramic_vase_01); Jarrón alto rectangular de barro (ceramic_vase_03); Jarra de cerámica con asa (ceramic_vase_04); Hilera de libros decorativos (decorative_book_set_01); Planta mediana en maceta de terracota (potted_plant_01) — Estado clean, salvo potted_plant_01 (sin dato). Los libros vienen en hilera: separar en grupos al importar. | Medidas de la caja del modelo | cerámica esmaltada, barro pintado, papel, cartón, vegetación, terracota · Contemporáneo, Mediterráneo | P2 | CC0 | falta: CC0 no importado |

## Oleada 4 · P3 · 63 piezas

Complementario: estilos, detalle y nichos. Métodos: Blender 42, Código 9, CC0 12.

### Salón

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Mueble bar, piano y carrito (3) | Mueble bar con botellero; Piano vertical; Carrito camarero | Mueble bar 800–1000 × 400–500 × 1100–1800; piano vertical 1450–1550 × 580–650 × 1150–1300; carrito 700–800 × 400–500 × 800–900 | nogal, laton, lacado-negro, metal-negro, cristal · Clásico, Industrial | P3 | Blender | falta |
| Chimeneas de bioetanol y eléctricas (2) | Chimenea de bioetanol de pared; Chimenea eléctrica empotrable | Bioetanol de pared 600–1200 × 120–200 × 300–500; insert eléctrico 800–1200 × 250–350 × 500–700 | metal-negro, cristal · Contemporáneo | P3 | Blender | falta |
| Chimenea de obra en esquina (1) | Chimenea de obra en esquina | 900–1200 por lado × 1000–1200 con campana a techo | estuco-blanco, piedra-natural · Rústico | P3 | Código | falta |

### Cocina

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Pequeño electrodoméstico (3) | Cafetera espresso; Tostadora de dos ranuras; Hervidor eléctrico | Cafetera 250–350 × 300–400 × 300–400; tostadora 300 × 180 × 200; hervidor 220 × 160 × 250 (sobre encimera) | acero-inox, lacado-blanco · Contemporáneo, Nórdico | P3 | Blender | falta |

### Dormitorio

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Tocador, galán y baúl (3) | Tocador con espejo; Galán de noche; Baúl de pie de cama | Tocador 900–1200 × 400–500 × 750 (con espejo 1300–1500); galán 450 × 350 × 1050–1150; baúl 900–1200 × 400–500 × 400–500 | lacado-blanco, espejo, roble, lino-gris · Clásico, Nórdico, Rústico | P3 | Blender | falta |

### Infantil y juvenil

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Cama casita, mesa infantil y baúl (3) | Cama casita Montessori · 90 × 190; Mesa infantil con dos sillas; Baúl de juguetes | Cama casita 90 × 190 → 980 × 2000 × 1500–1800; mesa 600–800 × 500–600 × 450–520; baúl 700–1000 × 400–500 × 400–500 | pino, lacado-blanco · Nórdico | P3 | Blender | falta |

### Lavadero

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Plancha y lavadora de carga superior (2) | Tabla de planchar; Lavadora de carga superior | Tabla 1100–1300 × 330–450 × 700–950; lavadora de carga superior 400 × 600 × 850–900 | aluminio-blanco, algodon-gris, lacado-blanco · Contemporáneo | P3 | Blender | falta |

### Terraza y jardín

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Spa, ducha, columpio, hamaca, leñero y kamado (6) | Spa de exterior; Ducha de exterior; Columpio doble; Hamaca con soporte; Leñero; Barbacoa kamado con mesa | Spa 1800–2300 × 1800–2300 × 800–950; ducha 150–250 × 150–400 × 2100–2300; columpio 2400–3000 × 1500–1800 × 2000–2200; hamaca 2800–3200 × 900–1200 × 1000–1200; leñero 1000–2000 × 500–700 × 1200–1800; kamado 600–1300 × 600–750 × 1100–1200 | teca, acrilico-blanco, acero-inox, pino, cuerda-beige, metal-negro, roble, ceramica-blanca · Contemporáneo, Rústico, Mediterráneo | P3 | Blender | falta |
| Caseta de jardín y piscina con escalera romana (2) | Caseta de jardín de madera; Piscina con escalera romana · 8 × 4 m | Caseta 1500–3000 × 1500–2500 × 2000–2400; piscina como la enterrada con escalera romana de 1500–2000 de cuerda | pino, gresite-azul, piedra-natural · Rústico, Mediterráneo | P3 | Código | falta |
| Hoguera de piedra (Poly Haven) (1) | Hoguera de piedra (stone_fire_pit) — Estado weathered. | Medidas de la caja del modelo | piedra · Rústico | P3 | CC0 | falta: CC0 no importado |

### Garaje

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Vehículos ligeros y equipamiento de garaje (5) | Bicicleta urbana; Moto scooter; Banco de trabajo con panel de herramientas; Cargador de vehículo eléctrico; Armario metálico de garaje | Bicicleta 1700–1800 × 600 × 1000–1100; scooter 1800–2000 × 700 × 1100–1200; banco de trabajo 1200–2000 × 600–750 × 900; cargador 200–300 × 100–150 × 300–400 a 1000–1200; armario 900–1000 × 450–500 × 1800–1950 | aluminio-antracita, lacado-blanco, metal-negro, pino, plastico-blanco, acero-galvanizado · Contemporáneo, Industrial | P3 | Blender | parcial: coche (3dassets, generado con IA) |

### Toda la vivienda: iluminación, climatización, construcción y decoración

| Familia | Tipologías y variantes | Medidas mm (an × fo × al) | Materiales · estilos | P | Método | Estado |
|---|---|---|---|---|---|---|
| Cassette y ventilador de pie (2) | Cassette de techo (panel visto); Ventilador de pie | Cassette: panel visto de 570–620 × 570–620 × 30; ventilador de pie Ø 400–450 × 1100–1350 | plastico-blanco, metal-negro · Contemporáneo | P3 | Blender | falta |
| Enchufes, interruptores y mandos (6) | Enchufe; Enchufe doble sobre encimera; Interruptor; Toma de TV y datos; Termostato de pared; Videoportero — Útiles solo para planos de detalle y renders de cocina; variante negra y latón por acabado. | Placa 80–90 × 80–90 × 10–40; enchufe a 300 (1100 sobre encimera); interruptor a 1100; termostato y videoportero a 1500 | plastico-blanco, metal-negro · Contemporáneo | P3 | Blender | falta |
| Escaleras compensada, volada y escamoteable (3) | Escalera escamoteable de altillo; Escalera compensada; Peldaños volados empotrados en muro | Escamoteable: hueco 600–700 × 1000–1400, altura 2500–2900; compensada y volada con ancho de 800–1000 | pino, roble · Nórdico, Clásico, Contemporáneo | P3 | Código | falta |
| Panel japonés, mosquitera y persiana alicantina (3) | Panel japonés de cuatro paneles; Mosquitera enrollable; Persiana alicantina | Panel japonés 450–600 × 20 × 2500 por panel; mosquitera enrollable del ancho del hueco × 50; alicantina 600–2000 × 30 × 1000–2500 | lino-blanco, aluminio-blanco, ratan-natural · Nórdico, Contemporáneo, Mediterráneo | P3 | Código | falta |
| Espejo sol, cestas, jarrón de suelo, velas, escultura y biombo (7) | Espejo sol de ratán · Ø 60; Cesta de fibra natural · Ø 35; Cesta de fibra natural · Ø 45; Jarrón de suelo con ramas secas; Juego de portavelas; Escultura abstracta; Biombo de ratán de tres hojas | Espejo sol Ø 600–900; cesta Ø 300–450; jarrón de suelo Ø 250–400 × 500–1000; biombo 1200–1800 × 30–50 × 1700–1800 | ratan-natural, espejo, ratan-trenzado, ceramica-blanca, laton, roble · Mediterráneo, Nórdico, Clásico, Contemporáneo | P3 | Blender | falta |
| Decoración clásica y rústica (Poly Haven) (11) | Reloj de pared (wall_clock); Lámpara de araña de latón con pantallas (Chandelier_01); Lámpara de araña de seis brazos (Chandelier_02); Espejo victoriano dorado (ornate_mirror_01); Lámina con marco negro fino (hanging_picture_frame_01); Cesta de mimbre con tapa (wicker_basket_02); Maceta de barro (planter_pot_clay); Jarrón antiguo de loza azul (antique_ceramic_vase_01); Mecedora de madera (Rockingchair_01); Pareja de cojines estampados (throw_pillows_01); Farol de madera y vidrio (wooden_lantern_01) — Estado worn o weathered (salvo el marco, clean): válidos para estilos Clásico y Rústico, no como opción por defecto. | Medidas de la caja del modelo | metal, vidrio, latón, tela, tela plisada, madera dorada, espejo, metal negro, lámina, mimbre, terracota, loza, madera envejecida, tejido, madera · Contemporáneo, Clásico, Rústico, Mediterráneo | P3 | CC0 | falta: CC0 no importado |

## Modelos CC0 de Poly Haven

Consulté `https://api.polyhaven.com/assets?type=models` y `/categories/models` el 2026-10-05: hay 521 modelos y el manifiesto
tiene 39 importados. Filtré por las categorías furniture, seating, table, lighting, appliances, shelves, office, vases, wall
decoration, potted plants, plants, flowers, bed, books, dishes, decorative y electronics (243 sin importar). Después revisé el estado de conservación
(`attributes.condition`) y las medidas de la API.

- **Recomendados (23, ya repartidos en las oleadas)**:
  - Estado clean, que encajan en una vivienda actual: `modern_ceiling_lamp_01`, `ceiling_fan`, `Chandelier_03`,
    `ceramic_vase_01/03/04`, `decorative_book_set_01`, `potted_plant_01`, `outdoor_table_chair_set_01`,
    `steel_frame_shelves_01/02` y `hanging_picture_frame_01`.
  - Estado worn o weathered, válidos solo para los estilos Clásico y Rústico: `wall_clock`, `Chandelier_01/02`,
    `ornate_mirror_01`, `wicker_basket_02`, `planter_pot_clay`, `antique_ceramic_vase_01`, `Rockingchair_01`,
    `throw_pillows_01`, `wooden_lantern_01` y `stone_fire_pit`.
- **Descartados, con su motivo**:
  - Mobiliario victoriano, gótico o filipino envejecido: `ClassicConsole_01`, `ClassicNightstand_01`, `GreenChair_01`,
    `Sofa_01`, `WoodenChair_01`, `gallinera_*`, `GothicCabinet_01`, `painted_wooden_*`, `vintage_day_bed`. El listón es
    una vivienda actual española.
  - Estilo oriental de nicho: `chinese_*`.
  - Televisores de tubo: `Television_01`, `television_02`.
  - Microondas antiguo: `vintage_microwave`.
  - Unidad de aire industrial con dos aparatos y 1800 de ancho: `exterior_aircon_unit`. Un split doméstico mide 650–900.
  - Árboles de 1,7–4,7 millones de polígonos y matas de suelo como `island_tree_*`, `tree_small_02` y `shrub_*`: ya hay
    árbol y arbusto por código.
  - Atrezo de taller y de oficina, y estatuas.
- **Medidas**: son las de la caja que da la API, en mm. El script de importación vuelve a medir el GLB. Dos piezas vienen
  agrupadas: `decorative_book_set_01` (2,5 m de libros en hilera) y `outdoor_table_chair_set_01` (mesa y dos sillas). Hay que
  separarlas o reescalarlas al importarlas.

## Comparación de métodos

| Criterio | Blender (fábrica) | Código (paramétrico en el editor) | CC0 Poly Haven | IA imagen → 3D (sin decidir) |
|---|---|---|---|---|
| Realismo | Alto si hay buenas texturas CC0 | Medio: guía geométrica | Alto, pero de estilo fijo | Variable y difícil de controlar |
| Coste por variante | Bajo una vez hecho el constructor | Casi nulo (parámetro) | Nulo, pero no hay variantes | Gasto por pieza |
| Control de medidas | Exacto | Exacto, y se adapta al hueco | Fijo: se escala | Aproximado |
| Licencia | Propia con texturas CC0 | Propia | CC0 | Depende del proveedor |
| Mantenimiento | Un constructor por familia en Python | Comandos, validación y tests | Ninguno | Ninguno, pero sin reproducibilidad |
| Riesgo | Tiempo de constructor por familia | Cambios de esquema y migraciones | Catálogo pobre en vivienda actual | Fidelidad y coste sin aprobar |

Recomendación: Blender para todo objeto, código solo para lo que se adapta a muros o huecos (empotrados, vestidores,
cocina, barandillas, escaleras, piscinas, cancelas) y CC0 únicamente para las 23 piezas citadas. La vía IA queda fuera
hasta que el usuario la autorice, como dice el plan.

## Encaje en la arquitectura

1. **Estancias.** `FurnitureRoom` y `ROOMS` de `catalog-specs.mjs` no tienen infantil, recibidor, lavadero ni garaje.
   - Propuesta: añadir esas cuatro.
   - Aseo usa baño, despacho usa oficina y terraza y jardín usa exterior.
   - Mientras no se amplíe el enum, el JSON trae `catalogRoom` con la estancia admitida hoy.
2. **Elementos de pared.** Espejos, cuadros, radiadores, split, apliques, toalleros, mecanismos, termo y caldera necesitan
   cota y apoyo en el muro, no en el suelo.
   - Ya existen `elevationMm` y `object-host-rest.ts`.
   - Falta un símbolo 2D de «elemento de pared». Es mejor una sola noción común que un perfil por familia.
3. **Luminarias con modelo.** `Luminaire` solo guarda `kind` (`pendant`, `flush`, `recessed`, `spot`). Hace falta un
   `catalogId` opcional para que las lámparas de techo de la fábrica sean luminarias reales, no muebles.
4. **Huecos de cocina con GLB.** `KitchenSlot` dibuja cajas. Los integrables de la oleada 2 deben servir a la vez en el
   catálogo suelto y en el hueco del tramo, sin duplicar geometría.
5. **Tramos de carpintería.** El armario empotrado y el vestidor repiten el patrón de `KitchenRun` (trazado sobre el muro,
   ancho del hueco, módulos).
   - Conviene extraer un tramo común antes de copiar la lógica de la cocina.
   - Barandillas y vallas siguen el patrón de muro bajo por tramos.
6. **Escaleras.** `Stair.kind` admite `straight`, `L` y `U`. Caracol, compensada, volada y escamoteable son kinds nuevos con su
   recorrido y su enlace entre plantas.
7. **Perfiles de la fábrica.** Todas las variantes de Blender y CC0 usan perfiles que `PROFILES` ya admite. `stair`,
   `railing`, `outdoor`, `curtain`, `roller` y `shutter` solo aparecen en familias de código.

## Fuentes y credibilidad

| Fuente | Uso | Credibilidad |
|---|---|---|
| [API de Poly Haven](https://api.polyhaven.com/assets?type=models) | Inventario CC0, medidas y estado | Alta (primaria) |
| Repositorio: `furniture-catalog.ts`, `furniture-assets.ts`, `outdoor-catalog.ts`, `opening-types.ts`, `schema.ts`, `kitchen-run-types.ts`, manifiestos CC0 y `scripts/furniture-factory` | Inventario actual y encaje | Alta (primaria) |
| [IKEA España, PAX](https://www.islas.ikea.es/tenerife/es/pd/pax-combinacion-armario-spr-09503134) y [METOD](https://www.islas.ikea.es/grancanaria/es/pd/metod-armario-alto-con-baldas-blanco-gris-claro-spr-09605236) | Módulos de armario (50/75/100 × 58 × 201/236) y altos de cocina (fondo 37, alto 200) | Alta (fabricante) |
| [Normatia, CTE DB-SUA](https://normatia.com/es/blog/altura-minima-barandillas-antepechos-cte/) y [ficha DB-SUA del COA Málaga](https://coamalaga.es/wp-content/uploads/2026/03/Ficha-DB-SUA2019_Revisado.docx) | Barandillas de 900/1100, huella y contrahuella | Alta (normativa y su resumen) |
| [Obramat](https://www.obramat.es/productos/aire-acondicionado-split-2150-frigorias-toshiba-seiya2-10-25100896.html), [Autosolar](https://cdn.autosolar.es/pdf/fichas-tecnicas/Ficha-tecnica-Aire-Acondicionado-Split-2.4kW-R32-Svan-SAAS2400W-Wifi.pdf), [Obramat radiadores](https://www.obramat.es/productos/radiador-de-aluminio-ferroli-xian-600-10-elementos-10538556.html) | Splits (700–1010 × 190–250 × 255–315) y radiadores (elemento de 80, alto 586–800) | Media-alta (fichas de distribuidor) |
| [Leroy Merlin, toldo Zefir](https://www.leroymerlin.es/productos/toldo-brazo-extensible-2-95x2-5m-para-terraza-zefir-ii-cofre-gris-motorizado-con-mando-tela-poliester-gris-naterial-95497714.html) y [prensa de consumo](https://www.compradiccion.com/decoracion-y-muebles/estos-mejores-toldos-leroy-merlin-para-proteger-dar-intimidad-a-tu-terraza-que-puedes-comprar-rebajados-antes-verano) | Toldos (295–395 de línea × 200–300 de salida) | Media |
| [Cemevisa, termo Teka](https://www.cemevisa.com/es/termo-teka-ewh31080cwh/pdf-00052737/) y [Autosolar, caldera](https://autosolar.es/calderas-de-gas/caldera-de-gas-titan-hr-2428-nat) | Termo de 80 L (Ø 410–460 × 790–880) y caldera (626–750 × 400–450 × 270–385) | Media-alta |
| [Fichas de estufas de pellet y de leña](https://autosolar.es/estufas-de-pellets/estufa-de-pellets-72-kw-lydia-natural-7) | Pellet 470–710 × 450–600 × 900–1350 | Media-alta |
| [El Corte Inglés, cuna de 70 × 140](https://www.elcorteingles.es/bebes/A18152298-cuna-convertible-70x140-cm-con-cajones-sero-bubble) y [Colchón Exprés](https://www.colchonexpres.com/blog/cuanto-mide-un-colchon-de-cuna) | Cunas de 60 × 120 y 70 × 140; UNE-EN 716 | Media |
| [Kave Home, consolas](https://kavehome.com/en/en/p/yoana-console-table-with-a-walnut-veneer-and-painted-black-metal-structure-120-x-80-cm) | Consolas de 110–120 × 75–80 | Alta (fabricante) |
| [Habitissimo](https://www.habitissimo.es/presupuestos/instalar-piscina-prefabricada-pvc) y [Generador de precios](https://generadordeprecios.info/rehabilitacion/Urbanizacion_interior_de_la_parcela/Piscinas/Piscinas_prefabricadas/Piscina_prefabricada_2.html) | Piscinas de 6 × 3 a 10 × 5 con profundidad de 1,2–1,5 | Media-alta |
| [Planner 5D](https://support.planner5d.com/en/articles/5832615-about-planner-5d) | Solo las familias de su catálogo (más de 6.800 objetos): muebles, construcción, iluminación, accesorios y electrodomésticos, decoración, cocina y baño, exterior | Media (fuente secundaria; solo categorías, ningún modelo) |

## Limitaciones

- No consulté fichas de Roca, Porcelanosa ni Maisons du Monde.
  - Baño y sanitarios están en la oleada 1.
  - Las medidas de espejos, grifería y accesorios son rangos de mercado habituales sin ficha por producto.
  - Al modelar productos reales de tienda se sustituyen por sus fichas.
- Planner 5D sirvió solo como lista de categorías tomada de su página de soporte y de las tiendas de aplicaciones. No
  recorrí su catálogo dentro de la aplicación, porque es propietario.
- **Plantas de interior realistas** (monstera, ficus, olivo, kentia, sansevieria): no hay fuente CC0 de calidad. Poly Haven solo
  ofrece `potted_plant_01`, y el follaje paramétrico en Blender es caro y arriesgado. Por eso quedan como hueco sin método.
- No estimé horas de desarrollo por constructor. El número de piezas por oleada mide el catálogo, no el esfuerzo. Las
  familias de código tienen además el coste del esquema, la validación, los tests y la documentación de usuario.
- No sé si la fábrica de baño en curso ya incluye grifo y espejo. Si los incluye, `griferia` y `espejos_bano` se reducen.

## Preguntas abiertas

1. ¿Se amplía `FurnitureRoom` con infantil, recibidor, lavadero y garaje, o el catálogo sigue con la asignación de
   `catalogRoom`?
2. ¿La fábrica de baño de la oleada 1 trae grifería y espejos? Si es así, se quitan de la oleada 2.
3. Plantas de interior: ¿se autoriza la vía IA imagen → 3D, se compra un paquete con licencia comercial o se aceptan
   solo las CC0 disponibles?
4. Láminas de los cuadros: ¿imágenes CC0 (dominio público de museos), generadas con IA y aceptadas, o propias?
5. ¿Se aprueba el cambio de esquema de `Luminaire` (`catalogId` opcional) y el tramo de carpintería común para empotrados y
   vestidores antes de la oleada 2?
6. ¿Los modelos CC0 envejecidos de estilo Clásico y Rústico entran en el catálogo general o solo como filtro de estilo?
