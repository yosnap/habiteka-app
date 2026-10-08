import { PerspectiveCamera, Vector3 } from 'three';
import type { RenderView } from '@/lib/editor-document/render-view';
import type { RenderSpatialContext } from './render-spatial-context';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { renderRoomVisibility } from './render-room-visibility';

/** Distancia hasta la primera estructura detrás de cada hueco, en la línea de visión de esta cámara. */
export function openingSightlineDepths(document: EditorDocument, view: RenderView, context: RenderSpatialContext) {
  const visibility = renderRoomVisibility(document, view), origin = new Vector3(...view.position);
  return context.levels.flatMap(level => level.openings).map(opening => {
    const target = new Vector3(opening.center.x / 1000, view.position[1], opening.center.y / 1000);
    const distance = origin.distanceTo(target), hit = visibility.depthBeyond(target, distance + .1);
    return { id: opening.id, beyondOpeningMm: Number.isFinite(hit) ? Math.round((hit - distance) * 1000) : null };
  });
}

/** Coordenada horizontal de los huecos en ESTA cámara; no confundir este/oeste con izquierda/derecha. */
export function cameraOpeningLocations(view: RenderView, context: RenderSpatialContext) {
  const camera = new PerspectiveCamera(view.fov, view.aspect, .01, 10000);
  camera.position.fromArray(view.position); camera.quaternion.fromArray(view.quaternion); camera.updateMatrixWorld(true);
  return context.levels.flatMap(level => level.openings).map(opening => {
    const projected = new Vector3(opening.center.x / 1000, view.position[1], opening.center.y / 1000).project(camera);
    const inFrame = projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1;
    return { id: opening.id, kind: opening.kind, type: opening.type, openAngleDeg: opening.openAngleDeg,
      position: inFrame ? `${Math.round((projected.x + 1) * 50)}% desde el borde izquierdo` : 'fuera del campo horizontal',
      connects: opening.connectsRooms?.map(room => room.name) ?? [],
    };
  });
}

/** Contrato específico: amueblar arquitectura vacía desde un diseño aceptado, sin reglas de rediseño. */
export function acceptedInteriorPrompt(view: RenderView, context: RenderSpatialContext, brief: string[], detail: boolean, light: string,
  document?: EditorDocument) {
  return [
    `Produce UNA fotografía hiperrealista a altura de ojos de ${JSON.stringify(view.roomName)}, con ${light}, desde los diseños aceptados del inmueble.`,
    'Imagen 1: guía de ARQUITECTURA SIN MOBILIARIO. Fija exclusivamente cámara, perspectiva, dimensiones, muros, huecos, puertas y cubierta. Suelo vacío NO significa diseño vacío: tienes que incorporar todos los elementos del diseño aceptado que sean visibles desde esta cámara.',
    'Imagen 2: CENITAL ACEPTADA SIN GIRAR. Fija mobiliario, fuentes, vegetación, suelos y acabados interiores. Copia forma, cantidad, posición relativa, materiales y colores. Nunca copies su perspectiva desde arriba.',
    ...(detail ? ['Imagen 3: recorte de la misma cenital aceptada con la estancia solicitada. Es el detalle principal de los elementos que deben aparecer dentro de la arquitectura de la imagen 1, no otra cámara.'] : []),
    'La última imagen fija fachadas y cubierta del diseño exterior aceptado. Conserva lucernarios y su estructura. El azul opaco de la guía marca CRISTAL REAL: represéntalo como vidrio transparente, nunca cielo abierto ni un panel azul opaco.',
    `ELEMENTOS OBLIGATORIOS DEL DISEÑO ACEPTADO: ${brief.join('; ')}. No entregues una habitación vacía cuando la referencia tiene mobiliario, fuente o plantas. No sustituyas cubetas cuadradas por fuentes circulares ni cambies textiles.`,
    `HUECOS EN ESTA CÁMARA: ${JSON.stringify(cameraOpeningLocations(view, context))}. Las posiciones indican el centro horizontal proyectado, no garantizan visibilidad si hay un muro delante. Cada hueco conserva SU conexión, también los recintos sin etiqueta. No traslades el estudio a la puerta de un pasillo ni coloques una cama en su ventana. Sigue la lectura AL OTRO LADO de cada id por separado.`,
    'Conserva el TIPO exacto de cada puerta: una corredera abierta no tiene hoja abatible ni bisagras añadidas. No añadas hojas donde la guía solo deja ver el hueco y los carriles.',
    ...(document ? [`PROFUNDIDAD DEL FONDO TRAS CADA HUECO: ${JSON.stringify(openingSightlineDepths(document, view, context))}. beyondOpeningMm mide desde el centro del hueco hacia el fondo siguiendo la mirada, hasta la primera estructura opaca; null significa sin pared encontrada, NO autorización para añadir un acceso. Mantén el fondo de la guía: no inventes una galería larga, otra ventana, una salida al jardín ni un horizonte detrás de una pared cercana.`] : []),
    `Mapa de la estancia en milímetros: ${JSON.stringify(context.levels.map(level => ({ rooms: level.rooms, openings: level.openings.map(opening => ({ id: opening.id, center: opening.center, widthMm: opening.widthMm, heightMm: opening.heightMm })) })))}`,
    `Cámara en metros: ${JSON.stringify({ position: view.position, focus: view.focus, fov: view.fov })}. Arriba de la cenital es -z y derecha +x.`,
    'Mantén exactamente la cámara y las aperturas de puerta de la imagen 1. No retires paredes ni cubierta. Los acabados de la maqueta no fijan los del diseño. Para caras ocultas prolonga el material visible del mismo objeto sin inventar otro modelo. Conserva pasos libres sin desplazar muebles arbitrariamente.',
    'Sin personas, texto, cotas, collage, paneles ni elementos duplicados. Resultado fotográfico nítido, proporciones reales, luz y reflejos naturales; una sola vista del inmueble.',
  ].join('\n');
}
