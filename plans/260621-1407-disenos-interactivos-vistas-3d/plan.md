# Diseños interactivos: vistas, decoración, prompt libre y 3D navegable

**Visión (del usuario):** la fuerza del producto es la INTERACTIVIDAD profesional. El usuario
no solo genera un render: elige el tipo de vista, pide decoración, corrige lo que la IA detecta,
escribe un prompt libre, y la IA le PROPONE mejoras explicándolas ("te puse el sofá bajo la
ventana para que entre la luz"). Sin esto, no hay negocio. El realismo es transversal y crítico.

## Estado verificado (qué hay hoy)

- **Generación desde lienzo (CRL-4, hecho):** doc → texto semántico + PNG referencia →
  `image.generate` (Gemini, respeta `referenceImage`). Render cenital, fidelidad alta.
- **Chat/asistente recoge:** `objetivo`, `estilo`, `entregables` (`phases/cualificacion.ts`,
  herramientas `set_objetivo`/`set_estilo`/`set_entregables`/`finalizar`).
- **Formulario del lienzo recoge:** solo `estilo` (`generate-from-canvas-dialog.tsx`). ← desajuste.
- **Ingesta de foto:** solo CUENTA `{walls,doors,windows,pillars}` (`phases/ingesta.ts`), no
  posiciones, no editable por el usuario.
- **Feedback por zona con inpainting YA EXISTE:** `feedback/feedback-orchestrator.ts` +
  `directed-inpaint.ts` regeneran una región respetando el resto. ← base para "mejora respetando
  lo que ya está".
- **Entregables:** `DeliverablePayload = plano2d | render3d | memoria`. `render3d` solo lleva
  `assetUrl` — no distingue tipo de vista ni guarda el prompt/propuesta.
- **3D:** NO hay Three.js/R3F en el proyecto.

## Decisiones tomadas con el usuario

1. **Solo planificar ahora** (no implementar en este pase).
2. **Distinguir 2 conceptos que el usuario llamó "3D":**
   - **Vistas por imagen** (barato, reusa pipeline): cenital, desde la puerta, panorámica
     interior, ojo de pájaro. Son llamadas a `image.generate` con prompt/ángulo distinto.
   - **3D navegable real** (otra liga): Three.js/R3F, cámara libre, requiere modelos 3D de cada
     mueble del catálogo. Fase de investigación propia, no se mezcla con lo anterior.
3. **La interactividad es el núcleo**, no un extra (IA que sugiere y explica, corrección de
   detección, decoración recomendada).
4. **Escala arquitectónica real (1:50, 1:100, 1:1000…):** el lienzo deja de ser píxeles abstractos
   y pasa a tener medidas REALES. El usuario fija una escala (p. ej. 1:50) y, opcionalmente, una
   referencia (px por metro). Así una puerta de 90 px a 1:50 = 90 cm reales; el techo, los muros y
   cada mueble llevan dimensiones reales. La IA recibe medidas reales (ancho de puerta, altura de
   techo) → diseño/decoración mucho más precisos. Es el modo de trabajo de la arquitectura.
5. **Producto estructurado en 3 ETAPAS secuenciales** (marco general; las fases técnicas cuelgan
   de estas etapas):
   - **A · Mapeo / planos** — definir el espacio con medidas reales (dibujar o detectar de foto).
   - **B · Borrador de decoración / materiales** — qué se decora, con qué materiales/acabados.
   - **C · Vistas** — generar las vistas del resultado (cenital, desde puerta, panorámica, 3D).
6. **Nomenclatura: "PLANO", no "lienzo".** De cara al usuario (y preferiblemente en el código) la
   superficie de edición se llama "plano" (profesional, arquitectónico). Incluye renombrar el
   botón/diálogo actuales ("Generar diseño desde el lienzo" → "...desde el plano", etc.).

## Principios transversales (aplican a TODAS las fases)

- **Interacción escalable (un solo sitio de verdad):** el formulario/flujo de interacción —al
  subir foto, al generar diseños, en el chat— debe centralizarse, de modo que añadir o cambiar una
  opción se propague a todos los puntos sin duplicar. Caso concreto a resolver ya: la lista de
  estilos está duplicada (`generate-from-canvas-dialog.tsx` y `agent-actions.ts`) → unificar.
- **Catálogo extensible declarativo:** añadir un elemento nuevo del plano (alfombra, chimenea,
  foco, puerta enrollable…) debe ser declarativo —una entrada en el catálogo + su forma de
  dibujo— sin tocar store/serialize/UI. Hoy `CATALOG_BY_KIND` + `objectShape` ya lo permiten en
  parte; mantener y reforzar esa propiedad.
- Ver memoria del principio: `principio-escalabilidad-interaccion-catalogo`.

## Fases propuestas (agrupadas por las 3 etapas; cada fase es un PR independiente)

> Las fases se mapean a las etapas A (mapeo/planos), B (decoración/materiales), C (vistas).
> F0 y F1 son fundacionales y habilitan el resto.

### F1b · Renombrar "lienzo"→"plano" + centralizar la interacción  (pequeña-media — fundacional)
**Diseño resuelto con /ck:predict (veredicto GO):**
- **Fuente de verdad:** nuevo módulo de DATOS `src/lib/design-options.ts` con
  `ESTILOS: ReadonlyArray<{ value: Estilo; label: string }>` y `ENTREGABLES` análogo. El *tipo*
  `Estilo`/`DeliverableType` SIGUE en `contracts/` (que es solo tipos, no datos); el módulo de
  datos lo importa. Los 5 sitios duplicados pasan a importar de aquí
  (agent-actions, qualification-tools, style-quick-picks, generate-from-canvas-dialog).
- **Escalabilidad por tipos:** estructurar para que el COMPILADOR obligue a dar label a cada
  `Estilo` nuevo (p. ej. `Record<Estilo, string>` y derivar el array). Añadir una opción se
  propaga sin olvidos. Mismo patrón servirá para futuras familias (`vista`, `materiales`).
- **Renombrado lienzo→plano: SOLO los ~6 strings de UI** (pestaña 'Lienzo', botón/diálogo
  'Generar diseño desde el lienzo', 'Usar como fondo del lienzo', tooltips). NO rutas (el href
  sigue), NO comentarios internos (oportunista al tocar cada archivo). Diff pequeño.
- **TDD (acordado):** test que afirme que el array de valores derivado == los 7 valores del tipo
  `Estilo`, y que los enums de `qualification-tools` salen del módulo único.
- Riesgo: bajo. Refactor + nomenclatura; sin cambiar comportamiento ni valores.

### F-CAT · Catálogo extensible: nuevos elementos del plano  (media — habilita decoración)
- Añadir elementos que hoy faltan: alfombra, chimenea, foco/luz, puerta enrollable, planta, etc.
- Hacerlo declarativo: cada elemento = entrada en `catalog.ts` + su `objectShape`. Verificar que
  no requiere tocar store/serialize (si lo requiere, refactor para que NO haga falta).
- Las luces tienen propiedades extra (color, intensidad) → ver F-LUZ.
- Riesgo: medio. El grueso es asegurar que el catálogo escala sin reescritura (principio rector).

### F-LUZ · Luces de primera clase + render con iluminación (+ vídeo)  (grande — diferenciador)
- Las luces/focos no son un mueble: llevan color, intensidad y dirección. Modelarlas como tipo
  propio en el catálogo (extiende F-CAT) con esos atributos.
- La IA RECOMIENDA iluminación según objetivo/estilo ("foco cálido en la esquina para ambiente",
  "luz fría sobre la encimera"). El prompt del render incorpora las luces colocadas → el render
  fotorrealista las refleja (reflejos, sombras, color de ambiente).
- **Vídeo (futuro dentro de la fase):** generar un vídeo corto con las luces "funcionando"
  (encendido/ambiente) — requiere modelo de vídeo (Veo/Hailuo, ya hay skills de media). Validar
  coste y calidad con prototipo; puede partirse en sub-fase.
- Riesgo: alto. La parte de imagen es asumible; el vídeo es una pieza nueva (modelo + coste +
  storage). Acotar: primero render con luces, vídeo después.

### F0 · Escala arquitectónica en el plano  (fundacional — ETAPA A)
- Añadir al `CanvasDoc` una `scale`: ratio (1:50, 1:100, 1:1000) y px-por-unidad real, para
  convertir px de stage ↔ medidas reales (cm/m). Campo opcional v2 del doc (no romper v1).
- UI: selector de escala + (opcional) regla/calibración ("esta línea son 1 m").
- Mostrar dimensiones reales en la toolbar al seleccionar un objeto (ancho/alto en cm).
- `serialize-doc-to-prompt` pasa a describir MEDIDAS REALES ("puerta de 90 cm", "techo 2,5 m")
  en vez de píxeles → mejora directa de fidelidad y base para decoración/materiales.
- Riesgo: medio. Toca el modelo del doc (migración de schema v2, serialize defensivo).
- Habilita: mejor F2 (vistas a escala), F4 (decoración con medidas), F5 (detección métrica).

### F1 · Paridad de opciones plano ↔ chat  ✅ HECHO (ETAPA A)
- El formulario del plano (`generate-from-canvas-dialog.tsx`) ofrece objetivo + estilo +
  entregable (paridad de datos con el chat). `objetivo` se propaga: diálogo → Server Action
  (acotado a 200) → AgentInput → handler → ReadyForDelivery.
- Lista de estilos/entregables unificada en la fuente única (ver F1b). Verificado: typecheck OK,
  eslint OK, 61 tests (4 nuevos de design-options). Code-review: sin críticos.

### F1b nota pendiente (futuro): renombrado producto-amplio
- Hecho en F1b: strings de UI del plano (pestaña, botón, diálogo, tooltips) lienzo→plano +
  fuente única `src/lib/design-options.ts`.
- PENDIENTE (fuera de scope de F1b, anotado): el mensaje de error en
  `src/server/agent/feedback/zone-resolver.ts` aún dice "lienzo". Decidir en un pase de
  renombrado producto-amplio si se cambia (es del flujo de feedback por zona, no del plano).

### F5b · Borrador de decoración y materiales  (media — ETAPA B)
- Etapa intermedia entre el plano y las vistas: definir QUÉ se decora y CON QUÉ materiales/acabados
  (suelo, paredes, tapizados…). Reusa/expande la "memoria de materiales" (`memoria` ya existe como
  entregable). La escala (F0) permite cantidades reales (m² de suelo, ml de rodapié).
- La IA propone una paleta/materiales según objetivo+estilo; el usuario ajusta. Genera el borrador
  ANTES de las vistas finales, para que las vistas reflejen esos materiales.
- Riesgo: medio. Diseño del modelo de "borrador de decoración" y cómo alimenta las vistas.

### F2 · Tipos de vista por imagen  (media, alto valor — ETAPA C)
- Nuevo eje `ViewType = 'cenital' | 'desde-puerta' | 'panoramica' | 'ojo-de-pajaro'`.
- El usuario elige la vista en el formulario/chat. El prompt del render se adapta al ángulo
  (`renderPrompt`/`serialize-doc-to-prompt` reciben el `viewType`).
- Para "desde la puerta" y "panorámica" el render YA NO es cenital → el `referenceImage` cenital
  sigue dando la disposición, pero el prompt pide la cámara desde ese punto. Validar fidelidad
  con prototipo (como en CRL-4): ¿respeta posiciones desde otro ángulo?
- `render3d` payload debe guardar el `viewType` (extender el contrato, sin romper los existentes).
- Permitir generar VARIAS vistas del mismo diseño (galería de un proyecto).
- Riesgo: medio. La incógnita es la fidelidad desde ángulos no cenitales → PROTOTIPO antes.

### F3 · Prompt libre + IA que explica sus propuestas  (media, núcleo de interactividad — ETAPA B/C)
- Campo de texto libre: "haz la sala más cálida", "añade plantas". El prompt del usuario se
  combina con la descripción estructurada del lienzo, REFORZANDO que respete posiciones (ventana,
  sofá, etc.). Reusa el patrón de fidelidad de CRL-4.
- **Salida conversacional:** además del render, la IA devuelve un TEXTO con lo que propuso y por
  qué ("centré el sofá para dejar paso a la puerta"). Requiere una llamada de chat que explique
  los cambios, o pedir al modelo de imagen+texto que devuelva ambos. Extender el outcome del
  agente para llevar ese mensaje a la UI.
- Riesgo: medio. Coste extra (2 llamadas: imagen + explicación) salvo que el modelo devuelva texto.

### F4 · Decoración interactiva con recomendaciones de IA  (media-grande — ETAPA B)
- Catálogo de decoración añadible (alfombra, chimenea, plantas, cuadros…). Puede ser objetos del
  catálogo del lienzo o "extras" que solo viven en el prompt del render.
- La IA RECOMIENDA según el objetivo ("para una sala acogedora, te sugiero una alfombra bajo la
  mesa y una chimenea en la pared este"). Recomendación interactiva: el usuario acepta/rechaza.
- Riesgo: medio-alto. Diseño de UX de sugerencias + cómo se materializan (objeto en lienzo vs.
  solo prompt).

### F5 · Foto → plano editable (puente IA→plano)  (grande — ETAPA A) · **BETA en testing**
Idea central del usuario: cuando alguien sube una foto, la IA reconoce sus elementos y CONSTRUYE
un plano con esos elementos como objetos EDITABLES; el usuario confirma lo detectado y luego
"juega" con el plano (añade/quita/mueve) antes de generar el diseño. Generar a partir de un plano
que el usuario validó da MUCHO mejor resultado a la IA que partir de la foto cruda (datos
estructurados validados por un humano, no píxeles que adivinar). Se guía al usuario a este flujo,
sin abandonar el camino "foto directa → diseño" (que también debe quedar bueno).

**El cableado ya existe por piezas; F5 es el PUENTE que las conecta:**
- Detección de elementos de la foto → `phases/ingesta.ts` (hoy solo CUENTA; ampliar a POSICIONES).
- Plano editable con objetos → ya existe (el plano con `StructObj`: mover/añadir/quitar).
- Generar diseño desde el plano → ya existe (CRL-4).

**Flujo F5:** subir foto → IA detecta elementos + bbox → se PINTAN sobre la foto y se proponen
como objetos del plano → el usuario ACEPTA/CORRIGE (mover/añadir/borrar) → el plano queda poblado
→ a partir de ahí, generar (reusa CRL-4). Tras una detección buena, la IA además SUGIERE
("según lo que pides, yo haría X").

**Marcada como BETA (decisión del usuario):** se lanza con etiqueta beta y se mantiene EN TESTING
hasta que la calidad de detección sea fiable. Razón: la detección de bbox sobre foto en
perspectiva es imprecisa (muebles descolocados; ya anotado en CRL-2). Acotar primero a planos en
planta / cenitales; la foto en perspectiva entra como experimento. Métrica de salida de beta:
% de detecciones que el usuario acepta sin grandes correcciones.
- Con escala (F0): si la foto trae referencia métrica (o el usuario calibra), estimar medidas.
- Conecta con CRL-2 del plan `260621-0746-ciclo-render-lienzo` (detección → objetos editables).
- Riesgo: alto (precisión de la detección). Por eso beta + testing iterativo. El puente en sí
  (poblar el plano y editarlo) es de bajo riesgo; lo arriesgado es la calidad de la detección.

### F6 · 3D navegable real (Three.js / R3F)  (XL — ETAPA C, fase de investigación propia)
- Vista 3D donde el usuario se mueve por la habitación con cámara libre.
- Requiere: Three.js + React Three Fiber, modelos 3D (glTF) de cada mueble del catálogo, mapear
  el doc del lienzo a una escena 3D, controles de cámara (OrbitControls/PointerLock), iluminación.
- NO usa el modelo de imagen: es render en tiempo real en el navegador.
- Riesgo: muy alto. Semanas. Necesita su propio `/ck:plan` + `/ck:research` (qué modelos 3D, de
  dónde, licencias; rendimiento; cómo casa con el catálogo actual). Se planifica aparte cuando el
  resto esté sólido.

## Realismo (transversal a F2–F4)
- Mejorar prompts de render hacia fotorrealismo (materiales, iluminación, lente, calidad).
- Posible cambio/ajuste de modelo de imagen si Gemini no da el realismo necesario (hay
  `model-routing`/`model-allowlist`; es conmutable por config).
- Medir calidad con prototipos antes de comprometer cada fase.

## Orden recomendado (siguiendo las 3 etapas)
**Fundacional:** F1 (paridad) → F1b (renombrar plano + centralizar interacción) → F0 (escala).
**ETAPA A (mapeo):** F0 + F5 (detección editable de foto).
**ETAPA B (decoración/materiales):** F-CAT (catálogo extensible) → F5b (borrador materiales) →
F4 (decoración interactiva) → F-LUZ (luces + render iluminado, vídeo después) →
F3 (prompt libre + IA explica).
**ETAPA C (vistas):** F2 (vistas por imagen, con prototipo) → F6 (3D navegable, plan aparte).

Pragmático para valor temprano:
F1 → F1b → F0 → F2 → F3 → F-CAT → F5b → F4 → F-LUZ → F5 → F6.

## Incógnitas a resolver con prototipo/investigación
- F0: ¿cómo calibra el usuario la escala con el mínimo roce? (selector de ratio fijo vs. regla
  interactiva "esto es 1 m"). ¿migración del doc a v2 sin romper proyectos v1?
- F2: ¿el modelo respeta posiciones desde ángulos NO cenitales (desde la puerta)?
- F3: ¿el modelo de imagen puede devolver imagen + explicación, o hace falta 2ª llamada de chat?
- F4: ¿la decoración recomendada se materializa como objeto del lienzo o solo en el prompt?
- F6: stack 3D (R3F), fuente de modelos glTF de muebles, licencias, rendimiento.

## Red de seguridad por fase (predict / red-team / TDD)
No se aplican al roadmap global (sería análisis en abstracto); se aplican POR FASE, antes de
implementar cada una, donde aportan:
- **/ck:predict (debate de personas, antes de implementar):** F0 (migración schema v2 + escala),
  F5 (detección beta), F6 (3D/Three.js), F-LUZ (vídeo). Caza problemas de diseño concretos
  (probado útil en CRL-4).
- **Red-team / /ck:security:** solo donde hay superficie de ataque NUEVA. Candidata principal:
  F5 (subida y procesamiento de fotos de usuarios). El resto reusa auth/créditos ya cubiertos →
  basta el `code-reviewer` obligatorio del flujo cook.
- **TDD (tests primero):** para piezas de LÓGICA PURA testeable — F0 (conversión px↔medidas),
  serializadores, validadores, centralización de opciones (F1b). NO para piezas de IA/render,
  cuya validación es visual vía PROTOTIPO (como en CRL-4).
- **Prototipo de medición:** obligatorio en toda fase con incógnita de calidad de IA antes de
  comprometer la fase completa (F2 fidelidad por ángulo, F5 precisión de detección, F-LUZ vídeo).

## Fuera de alcance de este plan
- Implementación: este documento solo planifica. Cada fase se cocina por separado tras aprobar.
