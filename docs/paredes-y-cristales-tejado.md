# Clasificación manual y huecos de tejado

`Wall.classification` es opcional: `interior` o `exterior` manda sobre el
criterio automático de `wallSelectionGroups`. No modifica la derivación de
estancias ni la elegibilidad de techos. El inspector explica el criterio y
`setWallClassification` aplica la selección en una revisión. Cambia el menú
de selección, las caras de acabados y el corte 3D. La pared fijada como interior
presenta ambas caras como interiores, también al editarla individualmente;
la normal de una fachada manual coincide con la cara exterior de sus acabados.
Los documentos anteriores
conservan la clasificación automática y la validación rechaza otros valores.

`exteriorRoof.openings` almacena piezas con id, tipo, posición, medidas
proyectadas y giro. `outline` normalizado conserva contornos de patios al
convertir su vidrio general. Los comandos conservan el documento de entrada,
validan tamaño, contención y solapes y usan el historial del editor.
El tipo `chimney` admite `heightMm` (200–5000 mm, valor implícito 1200).
Su cuerpo vertical tiene pared de 60 mm, conducto hueco y base por debajo de
la cubierta; su altura se mide desde el máximo de las facetas bajo su huella.
Un sombrerete metálico añade 280 mm y deja abiertos los cuatro lados.
Las facetas no dividen su cuerpo vertical, para evitar tabiques dentro del conducto.
El cuerpo usa UV por cara en metros; las juntas de ladrillo no se estiran desde
la proyección horizontal del tejado.

`exteriorRoofFootprints` recorta las piezas de la parte opaca. Vidrio y marco
comparten el contorno exterior usado para calcular la pendiente, incluso si
un hueco separa el tejado en varias partes. Ventanas cerradas tienen marco
de 50 mm y vidrio de 20 mm; no pueden cruzar una arista entre pendientes.
El vidrio sin marco puede seguir varias facetas. Reducir el vidrio convertido
de un patio rellena el resto con cubierta, sin abrir huecos nuevos.

El recorte de facetas y hastiales reintenta sobre coordenadas enteras con una
rejilla de 0,001 mm y después 0,1 mm cuando los extremos casi coincidentes
hacen fallar la librería. Redondear fracciones en metros no bastaba porque
seguían representadas en binario. No omite el recorte ni entrega la pieza
sin cortar como alternativa.

El plano técnico usa una capa de cubierta independiente y desactiva los clics
en muebles y paredes mientras se edita. La preferencia de visibilidad se guarda
en el navegador; la geometría se guarda en el documento y por planta.
Los techos interiores reciben los mismos huecos, unidos a los de escaleras.
Los contextos y contratos IA conservan piezas y clasificación manual; los
datos del vidrio se convierten a metros. El prompt compacto mantiene su límite.

`useRoofWorkflow` comparte los accesos de Construir y Herramientas sin duplicar
la configuración. Las solicitudes de colocación se consumen una vez: volver
del 3D al plano no empieza otra pieza. `placedRoofOpening` distingue clic
(tamaño inicial centrado) de arrastre. La vista previa ejecuta la misma
validación que la operación final. `roofSlopeCells` comparte las facetas del
3D y sus aristas visibles en 2D; así puede entenderse el rechazo de ventanas
que cruzan pendientes. Las fotos se regeneran con
`node scripts/build-construction-photos.mjs --only=tejado,cristal-tejado,ventana-tejado,chimenea-tejado`;
sus escenas están separadas en `scripts/blender/roof_construction_photos.py`.

Pruebas: persistencia, historia y plantas, rayos sobre huecos/vidrio/marco,
recorte de techo interior, reducción de patio, salida de cubierta, solapes,
cumbreras, selección y acabados manuales. El flujo final sigue exigiendo
diseños IA aceptados; ninguna prueba acepta ni certifica sus imágenes finales.
