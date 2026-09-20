# Cerramientos compuestos y puertas exteriores

Estado: propuesta técnica; el dibujo encadenado está implementado, los elementos compuestos y las puertas en vallas todavía no.

## Necesidad

Un cerramiento puede combinar muro inferior y valla superior, con lamas verticales u horizontales y postes circulares o rectangulares. Debe admitir puertas que corten realmente el cerramiento, sin superponer una puerta sobre un sólido cerrado.

## Interacción acordada

- Primer clic inicia; cada clic siguiente confirma un tramo y continúa desde su extremo.
- Cerrar un contorno termina el modo de dibujo automáticamente.
- Esc termina un trazado abierto, conserva tramos confirmados y descarta únicamente la previsualización.
- Mantener cursor de lápiz, imanes, cotas y deshacer por tramo.

## Propuesta de modelo

Entidad de construcción propia para cerramientos, con extremos compartidos y composición por tramo. Evitar seguir ampliando la entidad de mobiliario para resolver huecos y encuentros.

- Base: altura, espesor, material y color; altura cero permite valla sin zócalo.
- Parte superior: altura independiente, lamas verticales/horizontales, separación y acabado.
- Postes: sección rectangular/circular, ancho o diámetro, altura y separación máxima. Poste único en un encuentro compartido.
- Puertas vinculadas al tramo: posición longitudinal, ancho, alto y apertura. Primer alcance: peatonal abatible; ampliar a doble hoja y corredera como variantes explícitas.
- Propiedades a la izquierda. Presets para valla, muro con valla y seto; dimensiones editables mediante los controles numéricos existentes.

Ejemplo: altura total 2 m = muro 1 m + valla horizontal 1 m, postes circulares de diámetro 15 cm cada 2 m, puerta peatonal de 1 m.

## Implementación pendiente

1. Contrato versionado y migración conservadora de las tres clases actuales de cerramiento. Conservar IDs, coordenadas, dimensiones, acabados y comentarios; los demás objetos exteriores no cambian.
2. Geometría compartida entre 2D, 3D, selección, imanes y colisiones. Incorporar cilindros reales para postes; no mostrar columnas cuadradas con etiqueta circular.
3. Encuentros entre tramos con poste compartido y remates del zócalo; cambios de altura por tramo.
4. Puertas que recorten base y parte superior, ajusten postes, rechacen huecos solapados o fuera del tramo y sobrevivan a mover, girar, dividir y redimensionar el cerramiento.
5. Exportación y contexto de generación: transmitir composición, alturas, lamas, postes y huecos. Navegación debe respetar pasos y puertas cerradas.
6. Validar tramos de 40 m, esquinas y cierre, puertas en esquinas inválidas, migración, persistencia, selección, deshacer/rehacer y representación 2D/3D.

## Límites actuales

Las vallas y setos actuales siguen almacenados como objetos espaciales por compatibilidad. Sus uniones permiten contacto en extremos, pero no consolidan postes de esquina. Las puertas del editor se vinculan a paredes; todavía no pueden insertarse como huecos en una valla o seto. No presentar esta propuesta como implementada.
