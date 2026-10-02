import type { ApprovedLightingPreset } from './approved-design';
import type { DesignVideoReference, DesignVideoSettings } from './design-video';
import { constructionTiming } from './construction-timing';
import type { RenderView } from './render-view';
import type { EditorDocument } from './schema';
import { renderRoomContext } from './render-room-context';
import { buildingDocuments } from './building-levels';

/** La identidad de estancia se verifica con la cámara, no solo con la etiqueta del render. */
export function designVisitContext(document: EditorDocument, view: RenderView) {
  if (view.preset !== 'custom' || view.allLevels) return { visitIssue: 'Necesita una vista interior a altura de ojos; las vistas aéreas y laterales no sirven para primera persona.' };
  if (view.cutaway !== false || view.cutawayWallIds?.length || view.cutawayObjectIds?.length || view.ceilingView !== 'solid')
    return { visitIssue: 'Necesita paredes, objetos y techo completos, sin recortes ni transparencias.' };
  const level = buildingDocuments(document).find(item => item.id === (view.levelId ?? document.activeLevelId ?? 'ground'));
  const room = level ? renderRoomContext(level.document, view) : null;
  if (!room) return { visitIssue: 'No se puede verificar la cámara interior y su estancia. Genera una vista Interior por estancia.' };
  return { interiorRoomId: `${level!.id}:${room.roomId}`, interiorRoomName: room.roomName };
}

/** Un piloto permanece en una estancia: no inventa el trayecto entre habitaciones inconexas. */
export function designVisitSelectionIssue(references: readonly DesignVideoReference[]): string | null {
  if (!references.length || references.length > 9) return 'Elige de 1 a 9 referencias interiores de una estancia.';
  const invalid = references.find(reference => reference.issue || reference.visitIssue || !reference.interiorRoomId);
  if (invalid) return `${invalid.view}: ${invalid.issue || invalid.visitIssue || 'Falta la estancia interior verificada.'}`;
  if (new Set(references.map(reference => reference.interiorRoomId)).size !== 1)
    return 'Prepara una toma por estancia. No mezcles habitaciones: todavía no hay un trayecto verificado entre ellas.';
  const batches = new Set(references.map(reference => reference.batchId));
  if (batches.size !== 1 || batches.has(null)) return 'Elige vistas interiores de la misma tanda para conservar el diseño.';
  return null;
}

export function defaultDesignVisitReferenceIds(references: readonly DesignVideoReference[]) {
  const first = references.find(reference => !reference.issue && !reference.visitIssue && reference.interiorRoomId && reference.batchId);
  return first ? [first.id] : [];
}

export function designVisitPrompt(lighting: ApprovedLightingPreset, settings: DesignVideoSettings, references: readonly DesignVideoReference[]) {
  const seconds = constructionTiming(settings.presentation).durationMs / 1000;
  return [
    `Vídeo hiperrealista de interiorismo en primera persona, como una filmación real, una toma continua de ${seconds} segundos dentro de ${references[0]?.interiorRoomName ?? 'la estancia seleccionada'}. La casa ya está terminada; no mostrar construcción ni fases de obra.`,
    'Las imágenes generadas son la fuente de apariencia y mobiliario. La referencia 1 fija la posición, cantidad, orientación, materiales y colores de camas, sofá, TV, cortinas y decoración. Las demás muestran el mismo interior; no fusionar diseños distintos ni recuperar muebles del plano editable.',
    ...references.map((reference, index) => `Referencia ${index + 1}: ${reference.interiorRoomName}; ${reference.view}.`),
    `Mantener la luz de las referencias (${lighting}) durante todo el clip. Cámara a altura de ojos, movimiento lento y corto desde el encuadre de la referencia principal, sin cortes, giros completos, vuelo aéreo, secciones, transparencias ni atravesar muros o muebles. Permanecer en la estancia; no inventar accesos, escaleras ni habitaciones fuera del encuadre.`,
    'Conservar paredes interiores, ventanas, puertas y techo durante todo el vídeo. No mover ni transformar muebles; no añadir ni eliminar elementos. Evitar revelar superficies ocultas que las referencias no permiten identificar. No generar textos, logos ni cotas.',
    settings.presentation.soundEffects ? 'Pedir ambiente interior suave sin voces ni música; sin sonidos de obra.' : 'Pedir una toma silenciosa, sin voces, música ni efectos.',
    ...(settings.presentation.prompt ? [`Indicaciones adicionales, siempre respetando las referencias y la estancia: ${settings.presentation.prompt}`] : []),
  ].join('\n\n');
}
