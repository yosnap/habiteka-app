# Referencia Planner5D → Habiteka: patrones y gaps priorizados

**Tipo:** documento de referencia (no plan de ejecución). Surge de una investigación en vivo del
producto Planner5D (jun-2026, sesión autenticada del usuario) para extraer patrones aplicables a
Habiteka. NO se tocó código. El usuario lo señaló como el producto de referencia que busca.

**Método:** navegación del editor de Planner5D (v7.19.0) + inspección de red (catálogo, assets,
feature flags del remote_config) + capturas del usuario (wizard de creación de sala).

## Hallazgos técnicos clave (de la red)

- **El motor 3D es WebAssembly**, no Three.js en JS plano: el editor carga
  `static.planner5d.com/.../<hash>.module.wasm`. Renderan con un módulo WASM propio (probable C++).
  → Implicación para Habiteka: NO intentar igualar su motor. Three.js/R3F es la opción realista y
  suficiente para nuestra escala (F6). Su WASM es años de inversión; no es el listón a copiar.
- **Catálogo servido como JSON desde CDN:** `storage.planner5d.com/catalogs/700.json` +
  `planner5d.com/api/v2/catalog`. El catálogo es dato, no código. Coincide con nuestro principio de
  catálogo declarativo ([[principio-escalabilidad-interaccion-catalogo]]).
- **2D y 3D son la MISMA escena:** el toggle 2D/3D muestra la misma sala; el 3D se construye de la
  geometría del plano (paredes, suelo, muebles por coordenadas), NO lo "imagina" un modelo de imagen.
  → Valida la tesis de F6: la vista fiel del diseño es 3D por geometría, no render generativo.

## Mapa de features de Planner5D (de su remote_config — su producto completo)

Categorizado. Marca: ✅ Habiteka ya lo tiene · ⚠️ parcial · ❌ no existe.

### Creación de planos
- Import floor plan, 18 formatos (`web_upload_plan_new`, `web_csi`, export CAD `pro_project_export_cad`) — ❌
- Draw Walls / Rooms / **Forms** (formas de sala: L, U, T…) — ⚠️ (solo rectangular)
- **Smart Wizard** (forma → dimensiones → tipo/estilo, 3 pasos) — ⚠️ (diálogo parcial)
- **Home Scanner** (escaneo de la casa con el móvil → plano) — ❌
- Multi-planta (`web_editor_many_floors`, "First floor") — ❌
- Curved walls (`web_editor_curved_wall`) — ❌

### Construcción (catálogo estructural)
- Doors, Windows, Stairs, Archs, **Partitions, Roofs, Fireplaces, Columns, Terraces, Fences/gates** — ⚠️
  (Habiteka tiene muros/puertas/ventanas + decoración F-CAT; faltan escaleras, columnas, terrazas…)

### Zonas / salas
- `room_multiselect`, `room_rotation`, `web_intersection_room_closing` (cierre por intersección) — ✅ zonas (P3) / ⚠️ rotación
- Navegación entre salas dentro del proyecto — ✅ (P3, zone-switcher)

### 3D
- 3D navegable (cámara libre, WASM) — ❌ (= F6, el gap grande)
- `web_three_axis_rotation`, `web_ruler_3d` (regla en 3D), `web_environment_lighting`,
  `web_ao_normal` (ambient occlusion), `import_3d`, `import_3d_from_image` — ❌
- 360° Panorama + 360° Walkthrough (`walkthrough_360`) — ❌

### IA (su apuesta fuerte)
- **Bernard chat** (`web_bernard_chat`): asistente conversacional dentro del editor — ⚠️ (tenemos chat de cualificación, no in-editor)
- `web_bernard_chat_smart_materials`: la IA sugiere materiales — ✅ (F5b materiales)
- **Design Generator** (`web_design_generator`) + **Smart Wizard** auto-amueblado ("Creando magia") — ⚠️ (F4 sugerir decoración; no auto-amueblado completo)
- **AI Studio** (`web_ai_studio`, `ai_money`) — ⚠️ (tenemos render IA CRL-4)
- **Catálogo por imagen** (`web_catalog_image_search`): subir foto → encuentra el mueble — ❌

### Colaboración / negocio
- `web_multiplayer` (edición simultánea), `web_comments` + `web_comments_3d` — ❌
- `budget_widget`, `calculate_furniture_set`, `pro_budgeting_and_documents` (presupuesto del diseño) — ❌
- Moodboards (`pro_moodboards`) — ❌ (tenemos "memoria" de materiales, no moodboard visual)

### UX del editor
- Búsqueda semántica de objetos ("Cozy puffy sofa") — ❌
- Onboarding por checklist ("0 of 5": ventanas/puertas → muebles → material) — ❌
- `object_snapping`, `web_draw_dimensions` (cotas dibujables), `web_editor_texture_picker` — ⚠️

## Gaps priorizados para Habiteka

Criterio: valor para el usuario × (1/esfuerzo) × encaje con lo que ya hay. No copiar features por
copiar; cada una debe servir a la visión (interacción profesional + fidelidad real).

### P0 — El gap transformador (ya en roadmap)
1. **3D navegable (F6).** Es LO que distingue a Planner5D y la solución real a la fidelidad del
   render. Stack: Three.js/R3F (no WASM propio). La escena se construye del plano (F0 escala + objetos
   con medidas + luces F-LUZ ya dan los datos). Research hecho (R3F + Kenney CC0). Falta /ck:plan +
   spike. **XL, plan aparte.** Ver [[roadmap-disenos-interactivos-estado]].

### P1 — Alto valor, esfuerzo medio, encaja con lo hecho
2. **Smart Wizard completo** (forma → dimensiones → tipo/estilo en 3 pasos guiados). Hoy es un diálogo
   parcial. Planner5D lo usa como ON-RAMP principal. Reusa F0 (escala) + design-options (estilos).
3. **Búsqueda semántica del catálogo** ("sofá acogedor"). El catálogo ya es declarativo (F-CAT);
   añadir búsqueda por nombre/tipo/estilo es acotado y mejora mucho el uso con catálogo grande.
4. **Formas de sala no rectangulares** (L, U, T). Hoy solo rectángulo. Necesario para plantas reales;
   encaja con el editor de polígonos del canvas.

### P2 — Valor claro, más esfuerzo o menos urgente
5. **Catálogo estructural ampliado** (escaleras, columnas, terrazas, chimeneas ya está). Declarativo
   por diseño; ir añadiendo kinds según demanda.
6. **Presupuesto del diseño** (`calculate_furniture_set` + budget). La escala (F0) ya da cantidades
   (m² suelo, ml rodapié); sumar precios del catálogo → presupuesto. Diferenciador B2B.
7. **Onboarding por checklist** en el editor ("añade ventanas → muebles → genera"). Barato, sube
   activación.

### P3 — Estratégico pero lejano / requiere infra nueva
8. **Bernard-style chat in-editor** (asistente conversacional dentro del plano, no en página aparte).
   Tenemos las piezas (chat + acciones del agente); es reubicar UX + contexto del plano.
9. **Multi-planta** (varias plantas por inmueble). Extiende el modelo multi-zona (P3) a un eje más.
10. **Import de planos externos** (PDF/imagen/CAD → plano editable). Conecta con F5 (foto→plano).
11. **Colaboración** (multiplayer, comentarios). Infra nueva (websockets/CRDT); solo si el negocio lo pide.
12. **Home Scanner** (móvil → plano). Muy lejano; depende de capacidades nativas.

## Qué NO copiar (decisiones conscientes)
- **El motor WASM 3D.** Años de inversión; Three.js/R3F es suficiente para nuestra escala.
- **Densidad de features de su editor.** Planner5D es un editor maduro generalista; Habiteka apuesta
  por interacción guiada + IA que explica. No perseguir paridad de features: perseguir la visión.

## Siguiente paso recomendado
F6 (3D navegable) es el único gap P0 y ya tiene research. El resto (Smart Wizard, búsqueda de
catálogo, formas de sala) son P1 incrementales sobre lo existente. Decidir con el usuario si tras
multi-zona (P1/P2/P3 ya hechos) se ataca F6 o se hacen primero los P1 de menor riesgo.

## Incógnitas abiertas
- ¿F6 antes que los P1, o al revés? F6 es el "wow" pero XL; los P1 dan valor antes con menos riesgo.
- ¿Presupuesto del diseño (gap 6) entra en la visión B2B o es scope creep? Decisión de producto.
- Formato de modelos 3D para F6: confirmar en el spike (Kenney glTF CC0 ya identificado en research).

---

# Segunda pasada — exploración profunda (jun-2026)

Recorrido a fondo de Smart Wizard y modelo de datos del catálogo (inspección directa del JSON).

## Smart Wizard (a fondo) — el on-ramp principal

Se abre en un **iframe aislado** (`/editor?key=wizard&mode=wizard`) → lo tratan como módulo
independiente del editor. Flujo de 3 pasos con **preview en vivo** en cada paso:

1. **Choose room shape** — 6 formas (cuadrado, L, esquina cortada, T, U, pentágono) + Rotate /
   Flip Horizontal / Flip Vertical. Preview 2D actualizado al instante.
2. **Add room dimensions** — 2 sliders (ancho / largo) con **rango acotado** (ancho 200–600 cm,
   largo 250–600 cm) + inputs numéricos + toggle Cm/Inch. Detalle UX: cada slider tiene color
   (azul/naranja) y **resalta del mismo color la pared que edita** en el preview. Mapeo visual
   slider↔pared.
3. **Select room type and style** — auto-amueblado:
   - **8 tipos de sala:** Living Room, Kitchen, Bedroom, Office, Bathroom, Child Room, Open space, Studio.
   - **29 estilos:** Modern 1/2, Classic, Industrial, Scandinavian 1/2/3/4, Bright Boho, Japanese,
     Minimalism 1/2/3, Country, Eclectic 1/2, Farmhouse 1/2, Japandi, Mid-century, Modern Urban,
     Coastal. (Habiteka tiene 7 → margen claro para ampliar.)
   - **Preview 3D en vivo:** al elegir tipo+estilo, amuebla la sala en 3D al momento.
   - **Botón "Shuffle":** genera otra variación del amueblado. CLAVE: el auto-amueblado NO es IA
     generativa cara por llamada — es **colocación procedural de sets de muebles predefinidos** con
     variaciones aleatorias. Barato, determinista, instantáneo.

→ **Implicación para Habiteka:** el "auto-amueblado" tipo Planner5D se puede hacer SIN coste de IA
por generación: plantillas de muebles por (tipo, estilo) + reglas de colocación a escala (F0 ya da
las medidas). La IA (F4) queda para sugerencias *contextuales*, no para el amueblado base. Esto
abarata muchísimo la feature frente a asumir "IA por cada sala".

## Catálogo — modelo de datos real (del JSON `catalogs/700.json`)

Un solo JSON desde CDN con `hash`/`version` para cacheo. Tamaño del catálogo:
- **`items: 17.073`** objetos.
- **`categories: 243`** categorías.
- **`rooms: 35`** + **`rtypes: 41`** (tipos/subtipos de sala).

Estructuras (minimalistas a propósito):
- **item:** `{ id, cid, size }` — p.ej. `{id:"562", cid:74, size:"500x286x172"}`. Solo id, id de
  categoría y dimensiones (mm, ancho×alto×fondo). **El modelo 3D y la miniatura NO van en el JSON**:
  se derivan del `id` por convención de URL → el catálogo pesa poco aunque tenga 17k items.
- **category:** `{ id, pid, hidden, name_en…name_zh (17 idiomas), ico, custom_icon }` — jerárquica
  (`pid` = parent), raíces Build / Furnish / Exterior. i18n masivo en la propia categoría.
- **rtype:** título en ~28 idiomas.

→ **Implicación para Habiteka:** el patrón a imitar para escalar el catálogo —
  (a) item ligero (id + categoría + tamaño), (b) categorías jerárquicas con i18n, (c) datos servidos
  no hardcodeados, (d) modelo 3D/thumbnail por convención de id (no embebido). Esto encaja con el
  catálogo declarativo actual (F-CAT) y es el camino cuando el surtido crezca. Para F6, la referencia
  al modelo 3D por convención de id es justo lo que se necesita (cada kind → su glTF).

## Otros patrones observados
- **Onboarding por checklist en el editor:** "1 of 5" (añadir ventanas/puertas → muebles →
  seleccionar objeto → cambiar material). Guía de activación de bajo coste.
- **Asistente "Ask me!"** flotante en el editor (Bernard) — IA conversacional in-editor (no en
  página aparte como el chat de Habiteka).
- **Búsqueda semántica del catálogo:** placeholder "Search objects by name, type or style (e.g.
  Cozy puffy sofa)" — búsqueda en lenguaje natural sobre el catálogo.

## Refuerzo de gaps tras la 2ª pasada
- **Smart Wizard (P1):** confirmado como on-ramp central; el auto-amueblado procedural (no IA) lo
  hace barato. Sube prioridad como quick-win de activación.
- **Ampliar estilos (nuevo, P1 barato):** pasar de 7 a ~15-20 estilos (Japandi, Mid-century, Coastal,
  Boho…) es casi gratis (datos en design-options) y acerca la paridad percibida.
- **Modelo de catálogo escalable (P2):** cuando el surtido crezca, adoptar el patrón item-ligero +
  categorías jerárquicas + assets por convención de id.

---

# Tercera pasada — interacción 3D/2D, medidas y menú contextual (foco del usuario)

El usuario subrayó que lo que más le importa es **cómo se construyen las habitaciones en 3D con
medidas reales (altura, espacio, paredes que toman forma), y la selección de elemento/zona con su
menú contextual**. Investigado en vivo.

## Medidas como ciudadano de primera clase (confirmado)

Al seleccionar una SALA, aparece una **barra de propiedades inferior** con:
- **Type of Room** (desplegable: Room, Bedroom, Living Room…).
- **Height: 270.00 cm** — altura de las paredes. ES un parámetro editable de la sala → las paredes
  3D toman esa altura. (Habiteka ya tiene `CanvasDoc.ceilingHeightM` + `StructObj.heightM` por F0
  ampliada → ya estamos alineados en el dato; falta exponerlo igual de a mano.)
- **Thickness: 10 cm** — grosor de pared.
- **Flooring Height: 0 cm** — altura del suelo (desniveles).
- Checkboxes **Hide ceil** / **Hide Floor** — ocultar techo/suelo para ver el interior en 3D.

Las **cotas** se muestran en TODO el perímetro del plano y entre zonas (5 m, 5 m, total 10.3 m…),
siempre visibles, no solo al seleccionar. La escala es el lenguaje base del editor.

## Menú contextual flotante sobre el elemento (lo que pidió el usuario)

Al hacer clic en un elemento (sala o mueble) aparece un **menú contextual flotante anclado al
objeto** (iconos circulares sobre él), además de la barra inferior. Para una SALA:
- ✨ acción IA / mágica
- 🎨 cambiar material/textura
- ⧉ duplicar
- 🗑️ eliminar
- 🔄 rotar (handle circular separado, debajo)

Para un MUEBLE el patrón es el mismo + resize (el plan PRO ofrece "item resizing"). La barra inferior
para un objeto muestra Width / Depth / Height / Levitation (altura de flotación) / Angle (visto en
captura del usuario).

→ **Diferencia con Habiteka:** hoy Habiteka tiene la barra inferior de propiedades (Width/Depth/
  Height) pero NO el menú contextual flotante anclado al objeto. Planner5D pone las acciones
  frecuentes (material, duplicar, borrar, rotar) **encima del objeto**, no solo en barra/clic
  derecho. Es UX más directa. **Gap nuevo (P1, UX): menú radial/flotante sobre el objeto seleccionado.**

## Cómo se construye el 3D (modelo mental confirmado)

- **2D y 3D son la MISMA escena y los mismos datos.** El 2D es **SVG** (elementos `<path>` con id,
  DOM-manipulables — como nuestro Konva); el 3D es **WebGL/WASM**. Ambos leen la misma geometría.
- Las **paredes 3D se extruyen de los segmentos 2D** a la altura `Height` de la sala. Cambiar la
  altura en la barra → las paredes cambian en 3D. El suelo/techo se generan del polígono de la sala.
- Los **muebles** son modelos 3D (glTF por convención de id del catálogo) posicionados por las
  coordenadas + ángulo + levitation del objeto 2D. NADA se "imagina": todo es geometría.
- **Hide ceil / Hide Floor** permiten mirar el interior (cámara cenital o en ángulo sin que el techo
  tape). Es la solución a "ver dentro" sin quitar paredes.

→ **Esto es EXACTAMENTE el modelo de F6 para Habiteka:** el `CanvasDoc` (con escala F0, alturas,
  objetos con medidas) ya tiene todos los datos para extruir paredes a `ceilingHeightM`, generar
  suelo del polígono, y colocar modelos glTF por kind en (x, y, rotación, heightM). R3F construye la
  escena de la misma fuente que el 2D. La altura y las medidas que el usuario valora YA están en el
  modelo de datos de Habiteka; F6 las consume para la geometría 3D.

## Gaps nuevos / reforzados (3ª pasada)
- **Menú contextual flotante sobre el objeto (P1, UX):** acciones (material, duplicar, borrar, rotar,
  resize) ancladas al objeto seleccionado, no solo barra inferior. Mejora la fluidez de edición.
- **Hide ceil / Hide floor en 3D (parte de F6):** imprescindible para navegar el interior. Barato
  una vez exista la escena 3D.
- **Cotas siempre visibles + editables (refuerzo de F0):** Planner5D muestra TODAS las medidas del
  perímetro siempre. Habiteka las muestra al seleccionar; valorar mostrarlas de forma permanente.
- **Altura de sala editable inline (refuerzo):** el dato existe (ceilingHeightM); exponerlo en la
  barra de propiedades de la sala como Planner5D (Height 270cm) si no está ya tan a mano.

## Conclusión de la investigación
El modelo de Planner5D **valida punto por punto la arquitectura de Habiteka**: datos de plano con
escala/altura → 2D (SVG/Konva) y 3D (WebGL/WASM ↔ nuestro R3F) leyendo la MISMA geometría. Habiteka
ya tiene el modelo de datos correcto (F0 escala + alturas + objetos con medidas). Lo que falta es la
**capa de render 3D (F6)** y pulir la **UX de interacción** (menú contextual flotante, cotas
permanentes). No hay que rehacer el modelo: hay que añadir la vista 3D que lo consume.

> **Nota sobre el 3D:** se inspeccionó la escena 3D renderizada (paredes con altura, zonas, muebles),
> pero NO se pudo ejercitar la interacción dentro del 3D (cámara, picking de muebles) desde el
> navegador automatizado: el 3D es WebGL/WASM (canvas) y no responde a clics sintéticos ni a los
> tools de drag/hover (que requieren uid del DOM). El menú contextual y las medidas se capturaron en
> 2D (SVG, sí manipulable). La interacción 3D real queda pendiente de verificación manual del usuario.

## Cuarta pasada — /spaces (gestión) y on-ramp "Create"

**`/spaces`** es el panel de gestión de proyectos (= lista de proyectos de Habiteka). Cada proyecto
("Space") se ve desde varias vistas/herramientas del sidebar:
- **Herramientas (8):** Floor Plans · Renders · Moodboards · AI Studio · Design Generator ·
  360° Panorama · 360° Walkthrough · Documents.
- **Explorar (5):** Templates · Get Ideas · Design Battles · Design School · Blog.
- **Mis activos:** Textures.

**Flujo "Create" (on-ramp):** arranca pidiendo **la DIRECCIÓN del inmueble** ("Let's start with your
location") para personalizar ideas/recursos según ubicación, ANTES de crear el plano. Ofrece **casas
reales como plantilla** (Charming City Escape, Modern Suburban Home, Rustic Cedar Cabin, con
direcciones reales). On-ramp orientado a "tu casa real".

→ **Implicación para Habiteka:** el `Project` ya tiene campos de dirección ("Complete la dirección"
  visto en la UI). El patrón dirección → ideas personalizadas → plantillas es un on-ramp de
  activación (P2/P3). "Design Battles" y "Design School" son gamificación/educación (comunidad) —
  fuera del core, anotado.

## Quinta pasada — las 8 herramientas del Space (cada vista del proyecto)

Cada "Space" (proyecto) se ve desde 8 herramientas. Abiertas una a una (estado vacío en cuenta Free):

| Herramienta | Qué es | Estado en Habiteka |
|---|---|---|
| **Floor Plans** | El editor 2D/3D (núcleo). | ✅ canvas 2D · ❌ 3D (F6) |
| **Renders** | Renders fotorrealistas **4K** del proyecto (desde la geometría 3D, no IA generativa). | ✅ render CRL-4 (IA, no desde 3D) |
| **Moodboards** | Tablero visual de ideas de diseño + plantillas. | ❌ (tenemos "memoria" textual, no moodboard visual) |
| **AI Studio** | "AI-driven visual board": tablero visual COLABORATIVO con IA (ideación). | ⚠️ (render IA suelto, no board) |
| **Design Generator** | "for PROs": **sube una imagen → genera variaciones/sketches** de diseño. | ⚠️ (parecido a foto→diseño F5; ellos lo orientan a inspiración rápida) |
| **360° Panorama** | Vista panorámica 360° del diseño (orientado B2B "grow your business"). | ❌ |
| **360° Walkthrough** | Recorrido virtual navegable (derivado de la escena 3D). | ❌ (lo daría F6) |
| **Documents** | Presupuesto + documentación del proyecto (PRO/B2B; flags `pro_budgeting_and_documents`). | ❌ |

**Explore (comunidad/contenido, fuera del core):** Templates · Get Ideas · Design Battles
(competiciones) · Design School (cursos) · Blog. Gamificación + educación + SEO. No aportan patrón
técnico; son retención/adquisición.

**Mis activos:** Textures (biblioteca de texturas propias del usuario).

→ **Lectura estratégica:** Planner5D monetiza una MISMA escena 3D explotándola en muchas salidas
  (render 4K, 360°, walkthrough, panorama, documentos/presupuesto). Todas dependen de tener la
  geometría 3D. Para Habiteka esto refuerza que **F6 (la escena 3D) es el habilitador transversal**:
  una vez existe, desbloquea 360°, walkthrough y renders-desde-3D casi gratis. Hoy el render de
  Habiteka es IA generativa (no desde 3D); con F6 podría además renderizar desde geometría (fiel).
  Documents/presupuesto es la apuesta B2B (encaja con que la escala F0 ya da cantidades).

## Sexta pasada — Draw Walls: dibujo a mano con MEDIDAS REALES en vivo → sala → 3D

El usuario subrayó esto como el núcleo diferenciador. Investigado a fondo (modo activado + trazo real
capturado en vivo).

### Mecánica exacta (del tutorial + prueba en vivo)
1. **Clic izquierdo** → fija el nodo de inicio de la pared (punto verde de anclaje).
2. **Mover el cursor** → la pared se "estira" (línea verde semitransparente) y muestra su **longitud
   REAL en vivo** — capturado: una pared marcaba **"4 m"** mientras se arrastraba, NO píxeles.
3. **Clic de nuevo** → fija ese segmento. Se encadenan segmentos (polilínea).
4. **Doble clic o Esc** → termina. Al cerrar el polígono, **se convierte en una SALA real**: suelo +
   paredes + área en m² + tipo de sala.
5. **Toggle 3D** → las paredes se **extruyen a la altura** de la sala (Height 270 cm por defecto) →
   plano 3D navegable de verdad.

### El punto clave (observación del usuario): medidas REALES desde el inicio
La rejilla del editor **está calibrada a escala física desde el primer trazo**. No se dibuja en
píxeles y luego se convierte: cada celda de rejilla = medida real, así que la cota que acompaña a la
pared en construcción ya está en metros/cm reales. El usuario NUNCA ve píxeles. La escala es el
sistema de coordenadas base, no un metadato añadido después.

→ **Esto es exactamente la apuesta de Habiteka con F0 (escala arquitectónica).** Habiteka YA tiene
  `pxPerMeter` como única fuente de verdad y medidas reales. La diferencia con Planner5D es de UX de
  DIBUJO, no de modelo: falta la herramienta de **dibujar paredes a mano libre con cota en vivo por
  segmento** (hoy Habiteka coloca formas/objetos, pero el trazado libre de muros con feedback métrico
  en tiempo real durante el arrastre es el gap). El dato (escala real) ya existe; falta la
  interacción de trazado.

### El editor 2D es SVG vectorial (dato arquitectónico)
Confirmado: el lienzo de dibujo es un **SVG de 8000×8000** (el "mundo", con offset para paneo). Las
paredes y cotas son elementos SVG/texto vectoriales — no bitmap. Equivale a Konva de Habiteka (DOM
vectorial), así que el patrón de dibujo con cota en vivo es replicable con la misma tecnología.

### Tipos de sala: ~40 (mucho más granular que Habiteka)
El desplegable "Type of Room" incluye, además de los obvios: Toilet, Hall, Storage, Balcony,
Wardrobe, Guest Room, Lobby, Entryway, **Passenger/Freight elevator**, Loggia, Aeration, Boiler room,
Garage, Laundry, Gym, Attic, Basement, Workshop, Play room, Media room, Utility, Ventilation shaft.
Incluye espacios técnicos → orientado a planos profesionales/edificios reales, no solo vivienda.

### Gaps nuevos (6ª pasada)
- **Dibujo de paredes a mano libre con cota real en vivo (P1, ALTO valor diferenciador):** clic-mover-
  clic con longitud en metros mientras arrastras; cierre del polígono = sala. Es la interacción
  central del usuario. El modelo (escala F0) ya lo soporta; falta la herramienta de trazado + el
  feedback métrico en tiempo real. **Este es el gap que el usuario más valora.**
- **Cota en vivo durante CUALQUIER manipulación (mover/redimensionar):** no solo al dibujar paredes,
  también al mover/escalar objetos mostrar la medida real en tiempo real.
- **Catálogo de tipos de sala ampliado (P2, barato):** pasar de los tipos actuales a ~30-40
  incluyendo técnicos, si el target B2B lo pide.

## RESUMEN EJECUTIVO — dónde está la diferenciación de Habiteka
Tras 6 pasadas, la conclusión: Planner5D y Habiteka comparten el MISMO fundamento correcto (plano
con escala real → 2D vectorial + 3D por geometría). Habiteka NO debe competir en amplitud de features
(catálogo de 17k, 8 herramientas, comunidad) — eso es años. La diferenciación de Habiteka está en:
1. **IA que EXPLICA y guía** (no solo genera): el chat de cualificación + explicación de decisiones
   es algo que Planner5D NO tiene tan integrado (su Bernard es asistente, no consejero que razona).
2. **Fidelidad por geometría (F6)** como Planner5D, pero combinada con la capa de IA conversacional.
3. **Interacción de dibujo con medidas reales en vivo** (Draw Walls) — paridad necesaria, alto valor.
4. **Flujo guiado foto→plano→diseño** (F5) con IA que corrige — su Design Generator es "sube foto y
   reimagino", el de Habiteka construye un plano EDITABLE validado por el humano (más fiel).
El resto (render 4K, 360°, walkthrough, presupuesto) son SALIDAS que F6 desbloquea casi gratis una
vez exista la escena 3D. Prioridad: F6 (habilitador) + Draw Walls (interacción que el usuario valora)
+ mantener la capa de IA-consejera como sello propio.

---

# ROADMAP COMPETITIVO — cola de trabajo día a día (post-MVP)

**Decisión del usuario (jun-2026):** competir con Planner5D es una carrera de FONDO (meses, no un
mes); se avanza día a día con mejoras incrementales. **Para el MVP, lo actual ya sirve.** Esta
sección es la cola ejecutable: ir tomando tareas de arriba hacia abajo.

## MVP — ya cubierto (NO bloquea lanzar)
- Canvas 2D con escala arquitectónica real (F0) · zonas multi-habitación (P1/P2/P3) · catálogo
  declarativo (F-CAT) · render IA desde plano (CRL-4) · foto→plano editable BETA (F5) · decoración
  por IA (F4) · materiales (F5b) · luces (F-LUZ) · prompt libre + IA explica (F3) · historial
  origen↔diseño (P2).
- **Conclusión:** el MVP es viable con esto. Lo de abajo es para crecer hacia paridad con Planner5D.

## Cola priorizada (cada ítem = una o varias tandas día a día)

### Tier 1 — núcleo diferenciador (lo que el usuario más valora)
1. **Draw Walls con cota real en vivo** — trazar muros a mano (clic-mover-clic), longitud en metros
   durante el arrastre, cierre del polígono = sala. El modelo (F0) ya lo soporta; falta la
   herramienta de trazado + feedback métrico. *Alto valor, esfuerzo medio. SVG/Konva ya disponible.*
2. **F6 · 3D navegable (Three.js/R3F)** — el habilitador transversal. Escena desde la geometría del
   plano (paredes extruidas a altura, suelo del polígono, muebles glTF por kind). Research hecho
   (R3F + Kenney CC0). *XL — su propio /ck:plan + spike.*
3. **Cota en vivo al mover/redimensionar cualquier objeto** — feedback métrico en tiempo real en toda
   manipulación, no solo al dibujar. *Bajo-medio, alto valor percibido.*
4. **Menú contextual flotante sobre el objeto** — acciones (material, duplicar, borrar, rotar, resize)
   ancladas al objeto seleccionado, además de la barra inferior. *Bajo, UX directa.*

### Tier 2 — paridad de creación / activación
5. **Smart Wizard completo** (forma → dimensiones con sliders → tipo/estilo + auto-amueblado). El
   auto-amueblado por COLOCACIÓN PROCEDURAL de sets (no IA cara). *Medio, on-ramp de activación.*
6. **Búsqueda semántica del catálogo** ("sofá acogedor"). *Bajo-medio sobre F-CAT.*
7. **Formas de sala no rectangulares** (L, U, T, pentágono). *Medio, editor de polígonos.*
8. **Ampliar estilos** (de 7 a ~20: Japandi, Mid-century, Coastal, Boho…). *Trivial, solo datos.*
9. **Ampliar tipos de sala** (incluir técnicos si target B2B). *Trivial, solo datos.*
10. **Cotas del perímetro siempre visibles** (no solo al seleccionar). *Bajo.*

### Tier 3 — salidas que F6 desbloquea (tras tener escena 3D)
11. **360° Panorama / Walkthrough** — recorrido navegable desde la escena 3D. *Medio una vez F6.*
12. **Render desde geometría 3D** (además del render IA) — vista fiel sin alucinación. *Medio post-F6.*
13. **Hide ceil / Hide floor** en 3D — ver el interior. *Bajo, parte de F6.*

### Tier 4 — negocio / B2B / comunidad (estratégico, lejano)
14. **Presupuesto del diseño** (`calculate_furniture_set` + precios catálogo; F0 ya da cantidades).
15. **Moodboards visuales** (hoy solo "memoria" textual).
16. **Multi-planta** (extiende multi-zona a un eje más).
17. **Import de planos externos** (PDF/imagen/CAD → editable; conecta con F5).
18. **Bernard-style chat in-editor** (reubicar el chat + acciones dentro del plano).
19. **AI Studio / board colaborativo**, **Design Battles**, **Design School** (comunidad/retención).
20. **Colaboración** (multiplayer + comentarios). *Infra nueva; solo si el negocio lo pide.*
21. **On-ramp por dirección** (dirección → ideas personalizadas → plantillas de casas reales).

## Cómo avanzar (operativa día a día)
- Tomar el ítem más alto sin hacer; abrir su fase (`/ck:plan` si es grande como F6/Draw Walls, o
  cocinar directo si es pequeño como estilos/cotas).
- Mantener la disciplina actual: scout → plan → code → code-review → verificar (incl. dev server).
- **Sello propio en cada paso:** la IA que EXPLICA y guía es el diferenciador; no perderlo al
  perseguir paridad de features con Planner5D.

## Incógnitas para el usuario (priorización)
- ¿El primer ítem post-MVP es **Draw Walls** (interacción que más valoras) o **F6** (habilitador de
  más cosas)? Draw Walls da valor antes y con menos riesgo; F6 desbloquea más a largo plazo.
- ¿Target a medio plazo es B2C (vivienda) o B2B (profesionales/edificios)? Cambia la prioridad de
  tipos técnicos, presupuesto y documentos.
