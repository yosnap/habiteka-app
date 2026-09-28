---
title: "Flujo integral: plano, diseño, visita y vídeo"
description: "Unificar Estudio, catálogo, diseño aprobado, visita y vídeo para tres sectores, con piloto comercial de mueblería en paralelo."
status: in_progress
priority: P1
effort: "Por estimar por fase tras validar inmueble de referencia y formatos de vídeo"
tags: [feature, frontend, video, 3d]
created: 2026-09-24
---

# Flujo integral: plano, diseño, visita y vídeo

## Contrato de producto

El [PRD de inmueble verificable](../../docs/prd-inmueble-verificable-inmersion-video-catalogo.md) fija los tres sectores simultáneos —inmobiliarias, interioristas y mueblerías—, promesa, límites y criterios de piloto. Si la validación comercial exige secuencia, se empieza con una mueblería; aún no hay socio. La [investigación competitiva](../reports/competencia-producto-260924-1745-habiteka-valor-diferencial-report.md) muestra que plano→3D, paseo y catálogo comercial no diferencian por sí solos. Estas fases deben demostrar fidelidad entre salidas, claridad del flujo y valor de pago por sector; no medir solo completitud técnica.

## Resultado buscado

Un usuario parte de una imagen, PDF, boceto o plano existente; entiende qué se ha guardado; corrige el plano editable; diseña con elementos del catálogo propio y, bajo acuerdo de piloto, con productos reales de una tienda; aprueba un diseño coherente; entra en él y camina en primera persona; crea un vídeo en el que el inmueble se construye visualmente y termina con un recorrido cinematográfico. Inmobiliaria, interiorista y tienda obtienen salidas distintas del mismo inmueble aprobado. La visita interactiva y el vídeo son entregables separados que comparten la misma versión del modelo y de sus productos.

### Precisión del resultado final (27-09-2026)

Paulo aportó tres imágenes adicionales de viviendas contemporáneas terminadas, con fachadas, grandes paños de vidrio, iluminación, jardines, terrazas y piscinas. Fijan una aspiración de **calidad arquitectónica exterior e interior**; no representan necesariamente el mismo edificio ni autorizan a inventar piscinas, plantas o muebles en un proyecto que no los tenga. La imagen que combina fachada y dos plantas esquemáticas tampoco proporciona por sí sola una reconstrucción métrica del edificio fotografiado.

El diseño que se aprueba debe existir como **escena 3D editable y navegable** con ese nivel de acabado, no solo como imagen bonita. Desde la misma revisión aprobada salen dos experiencias distintas: una **visita libre** en la que la persona camina y decide dónde mirar, y un **vídeo automático** con montaje visual de la construcción, tomas aéreas exteriores tipo dron del inmueble terminado y transición a una entrada y paseo interior dirigidos por cámara. El MP4 de recorrido ya exportado y el montaje breve actual son bases técnicas; no cumplen aún esta presentación cinematográfica ni certifican el realismo buscado.

El diseño puede trabajarse por ámbitos: interior, exterior o estancias concretas. Cada propuesta editable se aplica sobre el mismo `EditorDocument` y conserva las demás zonas; la versión que se aprueba es la composición completa. Las imágenes generadas desde ángulos o zonas son referencias para revisar esa composición: no forman por sí solas un espacio navegable. La visita libre, el recorrido dirigido y la película deben utilizar el modelo editable terminado y aprobado. La película comienza con el terreno vacío de esa misma escena, revela la construcción y los acabados por etapas, vuela como dron alrededor del inmueble acabado y entra por un acceso real para recorrerlo.

### Estado verificado del 28-09-2026

El código ya permite elegir el ámbito de una propuesta editable y aplicarla sin sustituir las otras zonas (`design-scope-picker.tsx`, `native-design-proposal.ts`). La visita abre una copia de solo lectura de una aprobación concreta y el MP4 nativo registra su ID, revisión y huella (`approved-design-view.tsx`, `walkthrough/actions.ts`). El grabador actual exporta 1080p horizontal y usa una introducción breve por capas seguida de la ruta (`offline-recorder.ts`). **Estas conexiones técnicas no significan que el diseño final esté aprobado ni que la película solicitada exista**: faltan validar la composición y su calidad visual, fijar los activos de la aprobación y producir la secuencia cinematográfica completa. En «FInca», la revisión actual es la 115 (geometría y acabados de la 113; las 114–115 solo cambiaron y restauraron el tipo de espacio durante una prueba) y la aprobación más reciente es la 107; la 94 permanece en el historial y demuestra la exportación de una ruta. Ninguna de ellas certifica todavía el diseño final para la experiencia solicitada ni cierra las fases 3–5.

## Diagnóstico del producto actual

| Parte | Ya existe | Brecha real |
|---|---|---|
| Estudio | Original, redibujado opcional, extracción, vista cenital/maqueta | Estados y destinos poco claros; pestaña editable limitada al boceto dibujado; panel «resultados» sin galería. |
| Editor | Documento por plantas, plano visual cenital y 3D sobre la misma escena, aprobación e historial recuperable del plano | Faltan mejor calidad de modelos/acabados y validar un inmueble importado con medidas fieles. |
| Recorrido | Paseo libre y guiado por la misma escena, incluso entre plantas válidas | Falta probar la visita libre **dentro del diseño final visualmente aprobado**, con rendimiento móvil, puntos de interés y un inmueble importado fiel. |
| Vídeo | Montaje MP4 nativo de construcción y paseo, vinculado a la aprobación | Falta la película objetivo: construcción visual por etapas, vuelo exterior tipo dron, casa terminada y entrada/paseo cinematográfico; además, editor de tomas, 9:16 y prueba con inmueble fiel. Vídeo IA sigue pendiente. |
| Catálogo | `CatalogItem` admite cargas propias y productos de tienda con modelo GLB opcional; existe una base de marketplace | Editor v2, colocación 3D y propuesta IA siguen usando un catálogo estático separado. El marketplace actual es semilla, no un feed comercial vivo. |
| Modelos IA | Kie está integrado para imagen y hay enrutamiento de modelos de texto/imagen | No existe aún acción `video` ni adaptador de vídeo de Kie; Astra y Claude Opus 5.5 no están configurados como motores de vídeo de la aplicación. |
| Asistencia | Orquestador por fases, comandos del editor, historial/deshacer y puertas de Jev con caché | Falta un chat operativo único que dirija propuestas tipadas al Editor v2, acote el contexto de entrada y preserve revisión/aprobación. |

Evidencia en `plano-studio.tsx`, `plan-import-panel.tsx`, `studio-state.ts`, `editor-scene-view.tsx` y en el [plan anterior de recorridos](../260916-0135-plano-importado-y-recorridos-visuales/plan.md). El [plan específico de inmersión](../260924-1208-inmersion-diseno-aprobado/plan.md) queda incorporado en las fases 3 a 5 de este plan integral; este documento es la referencia de ejecución de extremo a extremo.

## Arquitectura común

`Original / redibujados` → `extracción revisada` → `EditorDocument + referencias de catálogo versionados` → `diseño 3D aprobado` → `visita libre` y `vídeos` → `ficha de cada producto identificable`.

Las imágenes generativas son referencias visuales y resultados comerciales. No se unen píxel a píxel para construir un espacio transitable: el 3D aprobado contiene la geometría, los acabados, los objetos y la iluminación. La misma revisión del documento y sus activos debe identificarse en la visita y en cada vídeo.

Three.js/R3F continúa como motor web. Su escena y ruta ya están implementadas; añadir otro runtime o streaming GPU solo se justifica tras medir que este enfoque no alcanza la calidad/rendimiento requeridos. [Controles de primera persona de Three.js](https://threejs.org/docs/pages/PointerLockControls.html), [optimización de R3F](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [infraestructura de Pixel Streaming](https://dev.epicgames.com/documentation/unreal-engine/pixel-streaming-in-unreal-engine).

## Catálogo único y veracidad del diseño

El **material propio** (muebles, electrodomésticos, acabados y elementos de ejemplo) permite probar desde ya; el primer comercio se integra en cuanto haya acuerdo y el contrato de catálogo esté listo. No deben crearse experiencias separadas por sector: un servicio de catálogo normaliza elementos incorporados en código, `CatalogItem` persistentes y productos autorizados de tienda. El editor y la IA seleccionan del mismo conjunto elegible para el proyecto. El marketplace de afiliación existente debe enlazarse a esa identidad canónica, no duplicar fichas independientes.

Cada elemento tiene origen, propietario/licencia, categoría, medidas, variantes, imágenes y, cuando exista, GLB validado con escala y orientación. El diseño aprobado fija ID de producto/SKU/variante, versión de activo 3D y posición; precio, disponibilidad y enlace de compra se consultan en vivo y pueden cambiar. Si solo hay foto o ficha comercial, se permite una **representación 3D aproximada**, señalizada como tal: no se promete que la visita o el vídeo muestren exactamente ese SKU. Para afirmarlo se exige activo 3D autorizado y comparación visual aprobada. La IA puede proponer combinaciones y colocar objetos dentro de límites espaciales, pero no inventar que un producto del catálogo existe ni cambiar su marca/variante.

## Responsabilidades de modelos y vídeo

| Componente | Papel previsto | Límite |
|---|---|---|
| Three/R3F y exportador | Visita interactiva, montaje visual y MP4 determinista del modelo aprobado | Calidad/rendimiento se miden antes de cambiar de motor. |
| Kie, proveedor de vídeo a ensayar primero | Animar o estilizar tomas cortas con fotogramas de referencia; ensamblarlas solo si pasan control de fidelidad | No sustituye la geometría ni garantiza continuidad de plano, producto o estancia. |
| GPT-6 Astra / Claude Opus 5.5 | Guion, selección de cámaras, prompts, análisis comparativo y orquestación, sujeto a coste y evaluación | Sus APIs documentadas ofrecen salida de texto, no vídeo final. No asumir integración ya desplegada. |

La aplicación usa Kie para imágenes, pero aún no integra vídeo. La fase 5 añadirá una acción `video` con adaptador seleccionable, tareas asíncronas, seguimiento de estado, límites de coste, cancelación/reintento y copia inmediata del resultado a almacenamiento propio. Kie retiene los archivos generados durante un plazo limitado, así que su URL no puede ser la fuente permanente del entregable. Comparar sobre tres escenas del mismo inmueble: montaje exterior, entrada/paseo interior y plano con producto identificable. Medir continuidad física/SKU, calidad, tiempo y coste; elegir modelo por evidencia, no por nombre del proveedor. [Kie: Kling 3.0](https://docs.kie.ai/market/kling/kling-3-0), [retención de Kie](https://docs.kie.ai/), [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [Claude Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview).

## Arquitectura conversacional aprobada

Un chat visible por proyecto; capacidades especializadas detrás, **sin conversaciones autónomas entre agentes**. Los módulos «revisor de plano», «editor/constructor», «decorador/acabados», «catálogo» y «director de vídeo» proponen operaciones de su dominio. Un enrutador usa reglas para órdenes explícitas y Jev solo para clasificación o calidad cuando haya ambigüedad. El modelo generativo produce una propuesta tipada, nunca escribe el documento directamente. El servidor valida permisos, geometría, SKU y revisión; enseña una diferencia previsualizable; el usuario acepta; el editor guarda una nueva revisión con posibilidad de deshacer. Sobre una versión aprobada, la operación abre un borrador nuevo.

`Chat → intención → operación tipada → validación → vista previa → aceptación → revisión nueva`.

Reutilizar `src/lib/editor-document/commands.ts`, los comandos de dominio, `src/canvas/editor-v2/store.ts` y `save-queue.ts`, el orquestador persistente y las puertas de `src/server/quality/`. No crear un segundo motor de edición ni un historial completo por rol. Jev ya comprueba estructura e instrucciones y cachea por evidencia; ampliar checkpoints medibles, no convertir su score en autorización de cambios físicos. Para imagen/vídeo, evaluar primero con evidencia visual/geométrica; Jev solo puntúa esa evidencia. [TypeSafe: Jev como decisiones tipadas](https://typesafe.ai/blog/introducing-system-one-models-and-jev).

La ruta de chat actual limita tokens de **salida**, pero el nuevo flujo necesita presupuesto de **entrada** y un constructor de contexto por tarea: revisión, selección, estancia, medidas, preferencias, productos elegibles, resumen y pocos turnos recientes. No reenviar todo el edificio, catálogo o historial a cada llamada. Registrar tokens, coste y latencia por operación; fallos de modelo/Jev no aplican cambios. Solo estudiar varios agentes autónomos tras una evaluación comparativa de calidad, latencia, coste y conflictos sobre tareas reales.

## Recorrido de usuario propuesto

1. **Preparar plano:** escoger fuente, comparar original/redibujados, extraer y revisar medidas; el paso siguiente siempre está visible.
2. **Editar y diseñar:** corregir el plano en Editor v2, también mediante propuestas revisables del chat; generar propuestas editables e imágenes desde vistas, elegir acabados/muebles del catálogo común y aprobar una versión 3D con sus referencias de producto.
3. **Explorar:** entrar en el diseño terminado aprobado con teclado/flechas y ratón; ofrecer navegación táctil y ruta guiada, atravesando solo puertas y conexiones válidas entre plantas. La persona puede elegir libremente dirección y mirada.
4. **Presentar:** configurar el vídeo automático de construcción visual por etapas, vuelo exterior del inmueble terminado y entrada/paseo interior dirigidos; previsualizar, exportar y guardar versiones. La inmobiliaria usa visita/vídeo para comercializar; el interiorista, propuesta para revisión; la tienda piloto, productos y consulta/presupuesto, con fichas/enlaces solo para catálogo autorizado.

## Pantalla del Estudio propuesta

```text
Original  →  Plano editable  →  Diseño  →  Visita  →  Vídeo
                    ↓ estado y siguiente acción en cada etapa
┌──────────────────────────────────────┬─────────────────────────────┐
│ Vista principal                       │ Siguiente paso              │
│ Original / redibujado / vectores      │ Revisar medidas → Editor    │
│ Comparar con original                 ├─────────────────────────────┤
│                                      │ Resultados del proyecto     │
│                                      │ miniatura · origen · versión│
└──────────────────────────────────────┴─────────────────────────────┘
```

«Vista vectorizada» muestra la extracción; «Editar plano» lleva al Editor v2. «Render» muestra cenital o maqueta y solo aparece como resultado cuando exista una imagen. El botón de generación sigue visible con su coste/condición antes de producirla.

## Fases

| # | Fase | Estado de ejecución | Base existente y condición de cierre |
|---|---|---|---|
| 1 | [Estudio y resultados](./phase-01-estudio-y-resultados.md) | En validación | Flujo y galería implementados; faltan cotización por modelo y generación real controlada. |
| 2 | [Importación y plano editable](./phase-02-importacion-y-edicion.md) | En curso | Importación y revisión disponibles; faltan fidelidad métrica y arcos de la Original v11. |
| 3 | [Diseño 3D aprobado](./phase-03-diseno-aprobado.md) | En curso | Las cuatro zonas están guardadas en «FInca» y una imagen IA real del Salón se generó con su contorno; faltan aplicar y componer propuestas editables por zona, contrastar las demás zonas, validar diez cámaras y aprobar el 3D final. |
| 4 | [Visita inmersiva](./phase-04-visita-inmersiva.md) | En espera del diseño final | Paseo libre/guiado de una aprobación disponible; falta validarlo en la escena terminada y en móvil. |
| 5 | [Vídeo de construcción y recorrido](./phase-05-video-construccion-y-recorrido.md) | En espera del diseño final | MP4 de recorrido y muestra con introducción breve disponibles; falta el vídeo resumen autónomo: terreno vacío, construcción, vuelo exterior y recorrido aéreo interior rápido por todas las zonas del diseño aprobado. |
| 6 | [Entrega y validación integral](./phase-06-entrega-y-validacion.md) | En espera de fases 2–5 | Diseños e Historial muestran resultados versionados; falta prueba integral y recuperación del proyecto completo. |
| 7 | [Catálogos de comercios y negocio](./phase-07-catalogos-de-comercios-y-negocio.md) | Pendiente | Existe una base de catálogo; integración y piloto requieren socio autorizado. |

El estado indica **qué se está ejecutando ahora**, no si existe código previo. «En espera» conserva los avances técnicos de visita, vídeo y entrega, pero evita presentarlos como fases activas mientras dependen del diseño final y de la importación fiel. Ninguna fase se marca completada hasta cumplir sus criterios de aceptación.

### Puertas de aceptación: diseño → visita y vídeo

1. **Cerrar fase 3:** sobre un inmueble con geometría y medidas revisadas, aplicar y combinar propuestas por zonas independientes aunque compartan estancia o exterior: Entrada, Patio, Salón y Cocina en «FInca». Comprobar que acabados, muebles y luz de una zona persisten al diseñar las siguientes, sin modificar las otras. Comparar al menos diez cámaras exteriores, cenitales e interiores, con materiales, muebles, luz, accesos y escalas coherentes. Resolver diferencias entre renders de referencia y 3D; archivar los activos usados y aprobar la **composición completa**. Una aprobación anterior o una imagen IA aislada no pasan esta puerta.
2. **Validar fase 4:** abrir esa aprobación exacta en la visita libre y verificar que el usuario camina y mira dentro del acabado final, también por conexiones entre plantas y exterior, con colisiones, controles y rendimiento medidos. Cualquier cambio de diseño crea un borrador y exige una nueva aprobación para actualizar la visita.
3. **Validar fase 5:** generar desde la misma aprobación un vídeo resumen automático: terreno vacío → construcción y acabados por etapas → inmueble terminado → vuelo exterior tipo dron → entrada real y vuelo interior breve por todas las zonas. Revisar fotogramas y cámaras frente a fase 3, previsualizar las tomas y exportar en los formatos aceptados. El MP4 de ruta de la revisión 94 y la introducción actual de ocho segundos solo prueban la infraestructura; el resumen es distinto del recorrido grabado y de la visita libre.

Las fases 4 y 5 pueden aprovechar el código actual mientras esperan la fase 3, pero no se presentan como entregables finales hasta pasar estas pruebas sobre el diseño terminado.

La [auditoría de casillas y roadmap del 27-09-2026](../260927-0135-auditoria-checks-y-roadmap-habiteka/plan.md) distingue capacidades implementadas, criterios parciales y pasos de aceptación todavía abiertos. Evita contar las casillas de planes históricos absorbidos como backlog duplicado.

### Antecedente de importación y prioridad actual (28-09-2026)

La fase 2 sigue abierta para la **fidelidad métrica y topológica**. Sus avisos impiden aprobar un diseño o generar visita/vídeo final sobre geometría dudosa, pero no detienen el desarrollo visual del Editor v2 en un documento de prueba aislado. La maqueta amueblada ya existe como base. La prioridad actual de la fase 3 es elevar su calidad arquitectónica en la misma escena, comprobar que las propuestas parciales forman un diseño homogéneo y compararlo desde cámaras exteriores, cenitales e interiores. Las imágenes aportadas por el usuario fijan el objetivo de presentación; la visita y la película solo se validarán después de aprobar esa escena conjunta.

En paralelo, mantener un conjunto pequeño de planos autorizados y variados (CAD limpio, escaneo, plano amueblado y dibujo manual) con muros, huecos, exteriores y cotas revisados como referencia. Medir por caso qué detecta el flujo, qué exige corrección y qué no puede afirmar. La pantalla de carga debe explicar cómo obtener una imagen legible y una cota de referencia, sin exigir al usuario que prepare un único estilo de plano ni ocultar fallos de extracción. Usar este conjunto primero para evaluar cambios de lectura y geometría; plantear ajuste de modelo solo si los errores repetidos, los ejemplos etiquetados y una comparación controlada justifican ese coste.

Las fases 1–6 construyen el núcleo común para los tres sectores: experiencia visual, documento aprobado, visita y vídeos. La fase 3 incorpora el catálogo propio y contrato extensible. La captación/definición del piloto de mueblería de fase 7 empieza en paralelo a fase 1; su importación técnica requiere fase 3 y acuerdo de uso. No esperar a terminar vídeos para preparar el socio, ni bloquear el núcleo común por falta de socio. Validar una tarea completa por sector antes de afirmar encaje comercial.

| Vía de trabajo | Inicio | Dependencia para validar |
|---|---|---|
| Núcleo espacial y audiovisual | Fase 1 | Fases 1→6, una revisión aprobada reproducible |
| Uso inmobiliario e interiorista | Al definir casos de prueba | Núcleo suficiente para tarea completa, sin esperar catálogo externo |
| Socio mueblería y datos | Preparación desde fase 1 | Acuerdo de uso y catálogo común de fase 3; piloto comercial en fase 7 |

## Reglas de fidelidad

- La imagen cenital/maqueta y las vistas por estancia ayudan a decidir el diseño, pero no habilitan por sí solas el paseo libre.
- La construcción del vídeo es una animación de aparición de partes del mismo modelo aprobado, no la simulación de una obra real ni una reconstrucción improvisada desde imágenes.
- Las mejoras IA de vídeo se aplican a clips concretos solo tras validar continuidad de distribución, materiales y objetos; el vídeo nativo es el resultado fiel de referencia.
- Un producto exacto solo se anuncia como tal en 3D/vídeo si dispone de activo autorizado y validado; si no, se distingue entre referencia comercial y aproximación visual.

## Dirección visual aportada por el usuario (25-09-2026)

Las imágenes 1 y 2 muestran prácticamente la misma composición: fachada exterior cálida sobre un plano cenital amueblado. Se interpretan como **nivel de presentación**, no como dos inmuebles distintos ni como prueba de navegación. Las imágenes 3–7 son ejemplos de maquetas abiertas con materiales, mobiliario, vegetación y distintas luces; sus distribuciones no coinciden entre sí. Sirven para evaluar acabado y encuadre, **no** para reconstruir una única geometría mezclando píxeles.

- **Editor:** el plano editable conserva herramientas precisas de muros, huecos, medidas y selección. Un modo visual conectado al mismo documento muestra la vivienda desde arriba, amueblada y con cubierta ocultable; alternar 2D/3D o compararlos no crea dos diseños. La fachada puede aparecer como vista de presentación asociada, pero no sustituye el lienzo editable.
- **Visita:** desde esa maqueta se puede entrar a la altura de los ojos y moverse en primera persona. El recorrido debe demostrar también interiores, puertas y continuidad de estancias: ninguna de las referencias adjuntas muestra por sí sola esa cámara.
- **Vídeo:** abrir con el terreno vacío, revelar construcción y acabados del modelo por capas, mostrar el inmueble terminado con un vuelo exterior tipo dron y entrar por un acceso real para el paseo interior dirigido. Todos los planos salen de la misma versión aprobada; un clip IA más vistoso se etiqueta si cambia distribución, acabados o productos.
- **Calidad visual:** suelos y paredes con materiales coherentes, modelos de muebles a escala, luz natural y artificial, sombras, huecos correctos y vegetación solo donde exista en el proyecto. Diferenciar previsualización interactiva optimizada de render/exportación de alta calidad; no prometer que WebGL en móvil iguale una imagen generativa fotorrealista.

Antes de pulir iluminación, fijar un inmueble patrón con plano y fotos de referencia, interiores de día/noche y exterior. Comparar las mismas cámaras en Editor, visita y vídeo; registrar discrepancias de geometría/SKU y rendimiento por dispositivo. La dirección artística de estas referencias favorece materiales cálidos y luz habitable, pero el estilo final debe poder cambiarse por proyecto sin cambiar la estructura.

## Criterios globales

- [x] Desde cualquiera de las entradas del Estudio se llega al documento editable y se entiende el estado de cada resultado. Verificación local de etapas, galería e importación de imagen/PDF/boceto en fases 1–2; la fidelidad del plano real sigue abierta.
- [ ] Las propuestas de zonas independientes dentro de una estancia o exterior (Entrada, Patio, Salón y Cocina), además de interior, exterior y estancias completas, componen un diseño final coherente; diseño, visita y vídeos identifican esa misma versión aprobada y los cambios posteriores se señalan.
- [ ] Se puede caminar por todas las zonas conectadas previstas sin atravesar elementos físicos.
- [ ] Se obtiene un vídeo automático del diseño aprobado con construcción visual, vuelo exterior tipo dron, revelación de la casa terminada y entrada/paseo interior cinematográfico, en formatos publicitarios reproducibles y descargables.
- [ ] Una prueba con inmueble representativo valida fidelidad visual compartida entre plano visual, 3D, visita libre y vídeo, además de carga y fluidez en escritorio y móvil.
- [ ] Catálogo propio y Editor v2 comparten identidad de objeto; la propuesta IA solo coloca productos seleccionables y físicamente compatibles.
- [ ] Un producto de comercio puede actualizar precio/disponibilidad sin alterar el diseño aprobado; se conservan SKU, variante y activo visual de la versión aprobada.
- [ ] El mismo inmueble aprobado permite: anuncio/visita inmobiliaria, propuesta revisable de interiorismo y lista de productos para consulta o presupuesto de mueblería; cada camino tiene una métrica propia.
- [ ] El chat dirige órdenes al módulo adecuado sin cambiar directamente el modelo; toda operación aprobada queda vinculada a una revisión, puede deshacerse y respeta un presupuesto de contexto/coste.

## Decisiones abiertas

1. Definir si la aprobación deja la visita solo para revisión interna o si además crea un enlace para clientes; no cambia la fuente 3D.
2. Elegir duración y ritmo objetivo del vídeo publicitario (propuesta inicial: una pieza corta, editable por escenas). La pista de voz/música es opcional por vídeo.
3. Seleccionar un inmueble real de referencia con varias estancias, muebles, exterior y dos plantas para medir el resultado; sin él no conviene fijar límites técnicos ficticios.
4. Escoger el primer comercio piloto y sus condiciones de catálogo/uso de imágenes y modelos 3D antes de importar o publicar sus productos. La preparación de fase 7 comienza de inmediato; no se contactará al comercio sin mandato ni se usará su catálogo sin acuerdo adecuados.

## Referencia visual

Higgsfield se toma como referencia de ritmo y encadenado de planos, no como proveedor decidido. Su flujo de vídeo usa cuadros de inicio/fin y timelapse de espacios; el movimiento y la fidelidad de Habiteka deben seguir ligados al modelo aprobado. [Higgsfield Canvas](https://higgsfield.ai/canvas-intro).

<!-- slug: flujo-integral-plano-diseno-inmersion-video -->
