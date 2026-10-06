# Televisión existente y cubierta de vacíos interiores

Amueblar añade piezas al documento. Antes, un mueble de TV propuesto generaba
siempre su televisor acompañante, aunque la estancia ya tuviera una pantalla.
`hasRoomTelevision` reconoce las fichas de televisión y localiza su centro en
la estancia. El parser omite las pantallas repetidas; los acompañantes consultan
también las ya presentes en el candidato. La aplicación vuelve a comprobarlo
para proteger propuestas antiguas. No elimina televisores existentes ni limita
la colocación manual del usuario; permite una pantalla propuesta en otra estancia.

El tejado unía las huellas de habitaciones elegibles y conservaba siempre los
anillos interiores. Un patio o paso con un delimitador lógico exterior podía
formar una abertura aunque el usuario quisiera una cubierta continua.

`exteriorRoof.voidCover` es opcional para documentos anteriores:

- `solid`: rellena los vacíos completamente rodeados por la cubierta.
- `open`: conserva las aberturas.
- `glass`: conserva la parte opaca y genera piezas de vidrio sobre esos vacíos.

Los tejados nuevos usan `solid`. La ausencia del campo sigue significando
`open`; editar pendiente, material o alero de un tejado antiguo no cambia sus
aberturas. La elección se realiza en el panel Tejado; no forma parte de la
propuesta de muebles. No extiende el contorno ni cubre terrazas exteriores.

Las piezas acristaladas comparten la proyección y facetas de la cubierta
principal, con 20 mm de espesor y material físico de vidrio en la escena.
No generan cierres de muro duplicados. El contexto IA incluye `voidCover` y
`glazing` en esas huellas; los prompts conservan esa elección explícita.
La transparencia de edición sigue siendo únicamente una ayuda visual.

La política compacta conserva estas reglas dentro de sus 660 caracteres y del
presupuesto total de 4800 del prompt. El panel aplica el vidrio a todos los
vacíos encerrados: editar una zona individual o el tejado sobre el lienzo 2D
sigue pendiente. La selección de paredes externas cuenta adyacencias a las
estancias interiores elegibles, por lo que incluye las paredes a patios.

Pruebas: televisión existente y acompañante, propuesta antigua al aplicar,
otra estancia, límite de pantallas por propuesta, cerrado nuevo y abierto
histórico, persistencia y vidrio alineado con cubiertas planas y de una,
dos y cuatro aguas giradas.

El plano y su 3D siguen siendo guías de preparación. Estas pruebas no certifican
fidelidad de imágenes finales ni aceptan diseños por el usuario.
