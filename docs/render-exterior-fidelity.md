# Exterior en referencias y revisión de diseños

Corrección del 5 de octubre de 2026. La referencia cenital de toda la planta omitía
`terrainSurfaces` y `boundaries`; `planParts` dibujaba vehículos como rectángulos
marrones. El prompt corto enumeraba solo muebles dentro de estancias. Esto dejaba
sin referencia visual o semántica el césped y el cerco y confundía coches con madera.

## Datos y referencia técnica

`exterior-design-context.ts` reúne superficies de terreno por capas, suelos de
zonas exteriores, cerramientos nativos e históricos y objetos exteriores,
incluidos los vehículos de garaje. Conserva catálogo/tipo/especie, huella,
material, color, dimensiones, giro y las puertas del cerco. Las coordenadas están
en mm; la rotación de un terreno afecta a su textura, no a su rectángulo.
`renderSpatialContext` usa prefijos por planta para evitar IDs repetidos.

`rasterize-editor-exterior.ts` carga albedos exclusivamente del catálogo local
en `public/materials`, los reduce a 256 px y aplica el tinte multiplicativo.
Su ausencia detiene la preparación antes de consultar al generador. Las capas
grandes quedan debajo de las pequeñas; los suelos interiores tapan el terreno
y los suelos exteriores explícitos mantienen su textura. Los límites incluyen
terrenos y volúmenes del cerco, también puertas abiertas. Los cerramientos
reutilizan `boundaryVolumes`; los coches tienen símbolos técnicos con ruedas,
cristales, carrocería y ópticas, conservando huella y giro. Otros elementos
exteriores usan sus volúmenes paramétricos cuando existen.

Es una referencia técnica interna para generación, nunca un diseño final ni
un sustituto de los renders IA aceptados. El catálogo, el plano interactivo y
sus modelos reales mantienen sus propias fotografías y geometría.

`simplePlanPrompt` pasa a `habiteka-plan-simple-v4`: recibe el inventario exterior
además del mobiliario de estancias. El tamaño depende del inventario, por lo que
ya no se describe como un prompt fijo de unos 800 caracteres. El prompt de
captura v25 y el contexto espacial también conservan exterior visible, sin
destapar elementos fuera de cámara/máscara. Una referencia aceptada adjunta
sigue siendo la fuente de apariencia y acabados.

## Auditoría y compatibilidad

`spatial-fidelity-v5` exige `exteriorChecks` por todos los IDs del contexto, una
vez cada uno. El esquema enviado al proveedor exige ese campo, incluso vacío,
para ser compatible con salida estructurada `strict:true`; el lector mantiene
compatibilidad histórica cuando no hay inventario. Comprueba categoría
observada, identidad/geometría y acabado.
Un resumen aprobado no anula una categoría sustituida, un objeto perdido o
movido ni un material de superficie/cerramiento cambiado o no verificable.
Los fallos se propagan a identidad de objetos y, en terreno/cercos, arquitectura.
El informe conserva evidencias y el visor las muestra en un apartado exterior.

En referencias `plan` completas, vehículos, cercos y superficies visibles son
obligatorios. `exterior-plan-visibility.ts` resta capas superiores, suelos y
huellas de objetos mediante polígonos: una superficie totalmente cubierta puede
ser no visible. En cámaras parciales se admite no visible solo cuando la
referencia/máscara lo justifica. El presupuesto máximo de salida de revisión
crece de 6000 a 16000 tokens según el número de elementos y grupos; no inicia generación
ni aceptación por sí mismo.

Los informes antiguos sin inventario conservan compatibilidad y no reciben
controles retrospectivos. Las imágenes previas no se regeneran ni reparan.
Estas comprobaciones automáticas no certifican fidelidad visual: el usuario
debe revisar y aceptar cada imagen final. Esta corrección se verifica con
fixtures y dobles de visión; no se ha lanzado una generación IA pagada.

## Sanitarios, cocina y tipo de vehículo

`vehicle-type.ts` identifica compacto, berlina, SUV y furgoneta por catálogo o
tipo canónico, sin adivinar por nombre libre o dimensiones. El raster técnico
separa furgoneta y SUV; `exteriorChecks.observedVehicleType` es obligatorio para
el proveedor y rechaza un tipo sustituido aunque el resumen sea favorable.

`critical-fixtures.ts` agrupa inodoro, lavabo, bidé, bañera, ducha, placa y
fregadero por estancia cerrada. Incluye aparatos de `kitchenRuns`; no limita el
inventario a seis tipos. Los elementos fuera de un recinto se registran aparte.
`rasterize-fixture-symbols.ts` ofrece símbolos reconocibles en la guía interna.
`fixtureChecks` exige cada grupo exactamente una vez y cantidades por función:
`null` significa no verificable, nunca cero. En una cenital completa se comparan
con el plano; en cámaras derivadas se comparan con el diseño aceptado visible.
El permiso de rediseño admite sustitución bañera/ducha conservando el total,
sin autorizar duplicar inodoros o perder placas. El visor presenta las evidencias.

## Biblioteca de referencias

`render-reference-actions.ts` consulta por organización, proyecto, zona y preset,
con paginación de 40 imágenes y URLs renovadas. Comprueba contenido visual entre
revisiones y el borrador contra su revisión guardada. No llama a IA ni modifica
aceptaciones. `render-reference-compatibility.ts` comparte condiciones y mensajes
con la generación. `RenderReferenceLibrary` reutiliza `RenderAcceptance`; solo
un clic explícito del usuario registra aceptación. No acepta al seleccionar.

`designReferenceId` viaja hasta `drone-references.ts`; se busca por ID dentro del
ámbito autorizado y se revalida aceptación, parámetros y contenido antes de leer
la imagen. Una selección inválida nunca cae a otra referencia. La búsqueda
automática conserva prioridad reciente y exige aceptación también para vistas
lejanas. Frontal/laterales/isométrica/exterior usan cenital; dron usa isométrica.
La ortofoto confirmada y el aislamiento de Solo la casa mantienen sus reglas.

`optionsFromReference` recupera solo luz, libertad, ámbito, colocación y permiso
de rediseño de fijos, manteniendo los ángulos solicitados. La recuperación
invalida capturas y exige preparación local nueva, conservando el ID elegido.
No arregla revisiones distintas ni cambia la planta activa. Se ofrece cuando
esas condiciones pueden hacer compatible una imagen aceptada.
