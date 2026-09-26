import { planObjects } from './boundary-types';
import { elementName } from './element-classification';
import type { EditorDocument } from './schema';
import type { WalkBlock } from './walkthrough-navigation';

export function walkthroughBlockReport(doc: EditorDocument, block: WalkBlock, limitedZones = false) {
  const objects = planObjects(doc);
  const furniture = objects.find((item) => item.id === block.entityId);
  const wall = doc.walls.find((item) => item.id === block.entityId);
  const opening = doc.openings.find((item) => item.id === block.entityId);
  const column = doc.columns?.find((item) => item.id === block.entityId);
  const stair = doc.stairs?.find((item) => item.id === block.entityId);
  const ramp = doc.ramps?.find((item) => item.id === block.entityId);
  const wallName = wall?.name ?? `Muro ${wall ? doc.walls.indexOf(wall) + 1 : ''}`;
  const openingName = opening?.name ?? `${opening?.kind === 'ventana' ? 'Ventana' : 'Puerta'} ${opening ? doc.openings.indexOf(opening) + 1 : ''}`;
  const repeated = furniture ? objects.filter((item) => elementName(item) === elementName(furniture)) : [];
  const itemName = furniture ? `${elementName(furniture)}${repeated.length > 1 ? ` ${repeated.indexOf(furniture) + 1}` : ''}` : 'Elemento exterior';
  switch (block.kind) {
    case 'floor-void': return { cause: 'El punto cae en un hueco sin suelo.', action: 'Desvía el recorrido hacia una superficie transitable.' };
    case 'outside': return { cause: limitedZones ? 'El tramo sale de las estancias incluidas en este recorrido.' :
      'El tramo pisa exterior sin suelo transitable definido en el plano; aunque se vea despejado, la visita no puede caminar allí.', action: limitedZones ?
      'Incluye la estancia intermedia en el recorrido o desplaza los puntos dentro de las zonas elegidas.' :
      'Amplía o dibuja un patio con suelo en ese paso, o mueve los puntos dentro de un contorno transitable.' };
    case 'ramp-edge': return { cause: `El tramo pasa a menos de 15 cm de un borde de ${ramp?.catalogId === 'builtin:ramp-landing' ? 'descansillo' : 'rampa'} sin suelo contiguo a la misma altura.`,
      action: 'Lleva el tramo hacia el centro o conecta ese borde con un suelo a la misma cota.' };
    case 'stair-edge': return { cause: `El tramo pisa el borde sin peldaño de ${stair?.name ?? 'la escalera'}.`, action: 'Lleva los puntos por el centro de los peldaños.' };
    case 'ceiling': return { cause: `El techo deja ${Math.round((block.deltaMm ?? 0) / 10)} cm menos de altura libre de la necesaria.`,
      action: 'Reduce la altura de cámara o eleva el techo.' };
    case 'wall': return { cause: `El tramo cruza ${wallName} fuera de una abertura transitable.`, action: 'Pasa por una puerta o rodea el muro.' };
    case 'closed-door': return { cause: `${openingName} está cerrada o abierta menos de 75°.`, action: 'Abre la puerta al menos 75° o desvía el tramo.' };
    case 'window': return { cause: `El tramo cruza ${openingName}; una ventana no permite pasar.`, action: 'Usa una puerta o cambia la ruta.' };
    case 'door-clearance': return { cause: `${openingName} no deja ancho o altura libre suficiente para la cámara.`,
      action: 'Revisa ancho, cota y altura de la abertura o desplaza la ruta al centro del paso.' };
    case 'outdoor': return { cause: `El paso toca ${block.part ? `${block.part} de ` : ''}${itemName}.`,
      action: furniture?.kind === 'carpa' ? block.part?.includes('lona izquierda') || block.part?.includes('lona derecha') ?
        'Recoge ese lateral o desvía los puntos hacia el frente abierto.' :
        'Entra por el frente abierto o por un lateral recogido, evitando postes y fondo.' :
        'Separa el tramo del elemento exterior al menos 15 cm.' };
    case 'furniture': return { cause: `El paso invade ${itemName} (incluido el margen de 15 cm de la cámara).`,
      action: 'Mueve el mueble o desplaza los puntos para rodearlo.' };
    case 'column': return { cause: `El paso toca ${column?.name ?? (column ? `columna ${doc.columns!.indexOf(column) + 1}` : 'una columna')} (con 15 cm de margen).`,
      action: 'Rodea la columna con puntos adicionales.' };
    case 'height-step': return { cause: `La cota del suelo cambia ${Math.round((block.deltaMm ?? 0) / 10)} cm de golpe.`,
      action: 'Usa la rampa o la escalera real para conectar las cotas.' };
    case 'stair-link': return { cause: 'Los puntos no coinciden con una conexión de escalera válida entre plantas.',
      action: 'Coloca ambos puntos en las salidas de la misma escalera, con altura continua.' };
    case 'too-long': return { cause: 'El tramo es demasiado largo para comprobarlo con seguridad.',
      action: 'Añade puntos intermedios.' };
  }
}
