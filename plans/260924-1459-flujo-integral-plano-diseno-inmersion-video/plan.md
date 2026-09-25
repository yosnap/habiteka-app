---
title: "Flujo integral: plano, diseño, visita y vídeo"
description: "Unificar Estudio, catálogo, diseño aprobado, visita y vídeo para tres sectores, con piloto comercial de mueblería en paralelo."
status: pending
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

## Diagnóstico del producto actual

| Parte | Ya existe | Brecha real |
|---|---|---|
| Estudio | Original, redibujado opcional, extracción, vista cenital/maqueta | Estados y destinos poco claros; pestaña editable limitada al boceto dibujado; panel «resultados» sin galería. |
| Editor | Documento por plantas, escena Three/R3F, materiales, muebles, luces | Hay que aprobar una versión global coherente del diseño. |
| Recorrido | Ruta 2D, auto-tour, cámara animada, MP4 1080p | No hay movimiento libre en primera persona; rutas actuales por planta. |
| Vídeo IA | Vistas asociadas al storyboard; F4 del plan anterior pendiente | Falta construir la casa en vídeo y ensamblar una presentación fiel al modelo. |
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
3. **Explorar:** entrar con teclado/flechas y ratón; ofrecer navegación táctil y ruta guiada, atravesando solo puertas y conexiones válidas entre plantas.
4. **Presentar:** configurar un vídeo de construcción visual por etapas y un recorrido rápido de cámara; previsualizar, exportar y guardar versiones. La inmobiliaria usa visita/vídeo para comercializar; el interiorista, propuesta para revisión; la tienda piloto, productos y consulta/presupuesto, con fichas/enlaces solo para catálogo autorizado.

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

| # | Phase | Status |
|---|-------|--------|
| 1 | [Estudio y resultados](./phase-01-estudio-y-resultados.md) | En validación local |
| 2 | [Importación y plano editable](./phase-02-importacion-y-edicion.md) | En curso |
| 3 | [Diseño 3D aprobado](./phase-03-diseno-aprobado.md) | Maqueta exploratoria; aprobación en espera de fidelidad de fase 2 |
| 4 | [Visita inmersiva](./phase-04-visita-inmersiva.md) | Pendiente |
| 5 | [Vídeo de construcción y recorrido](./phase-05-video-construccion-y-recorrido.md) | Pendiente |
| 6 | [Entrega y validación integral](./phase-06-entrega-y-validacion.md) | Pendiente |
| 7 | [Catálogos de comercios y negocio](./phase-07-catalogos-de-comercios-y-negocio.md) | Preparación del socio en paralelo; integración tras fase 3 |

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
- **Vídeo:** abrir con exterior y vista cenital, revelar la maqueta por capas y terminar con un vuelo/paseo interior. Todos los planos salen de la misma versión aprobada; un clip IA más vistoso se etiqueta si cambia distribución, acabados o productos.
- **Calidad visual:** suelos y paredes con materiales coherentes, modelos de muebles a escala, luz natural y artificial, sombras, huecos correctos y vegetación solo donde exista en el proyecto. Diferenciar previsualización interactiva optimizada de render/exportación de alta calidad; no prometer que WebGL en móvil iguale una imagen generativa fotorrealista.

Antes de pulir iluminación, fijar un inmueble patrón con plano y fotos de referencia, interiores de día/noche y exterior. Comparar las mismas cámaras en Editor, visita y vídeo; registrar discrepancias de geometría/SKU y rendimiento por dispositivo. La dirección artística de estas referencias favorece materiales cálidos y luz habitable, pero el estilo final debe poder cambiarse por proyecto sin cambiar la estructura.

## Criterios globales

- [ ] Desde cualquiera de las entradas del Estudio se llega al documento editable y se entiende el estado de cada resultado.
- [ ] Diseño, visita y vídeos identifican la misma versión aprobada; los cambios posteriores se señalan.
- [ ] Se puede caminar por todas las zonas conectadas previstas sin atravesar elementos físicos.
- [ ] Se obtiene un vídeo de montaje visual y paseo breve en formatos publicitarios, reproducible y descargable.
- [ ] Una prueba con inmueble representativo valida fidelidad visual, carga y fluidez en escritorio y móvil.
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
