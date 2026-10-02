import type { EditorDocument } from './schema';
import type { RenderView } from './render-view';
import type { RenderDesignOptions } from './render-design-options';
import { buildingDocuments } from './building-levels';
import { designZoneStructures } from './design-zone-geometry';
import { renderScopeRegions } from './render-scope-regions';

interface Source { view?: Partial<RenderView>; options: RenderDesignOptions }

/** Solo estructura de las zonas referenciadas. Nunca añade muebles del plano. */
export function designVideoStructure(document: EditorDocument, sources: readonly Source[]): string {
  const descriptions: string[] = [];
  for (const level of buildingDocuments(document)) {
    const relevant = sources.filter(source => source.view?.allLevels ||
      (source.view?.levelId ?? document.activeLevelId ?? 'ground') === level.id);
    if (!relevant.length) continue;
    const included = new Set<string>();
    const elements = [...(level.document.stairs ?? []), ...(level.document.ramps ?? [])];
    for (const source of relevant) {
      const options = source.options;
      if (options.designScope === 'all' && options.placement === 'all') elements.forEach(item => included.add(item.id));
      else {
        options.designStructureIds.forEach(id => included.add(id));
        for (const polygon of renderScopeRegions(level.document, options))
          designZoneStructures({ polygon }, level.document).forEach(id => included.add(id));
      }
    }
    const stairs = (level.document.stairs ?? []).filter(item => included.has(item.id));
    const ramps = (level.document.ramps ?? []).filter(item => included.has(item.id));
    const landings = ramps.filter(item => item.riseMm === 0 && !item.route?.secondRiseMm);
    const slopes = ramps.filter(item => !landings.includes(item));
    const label = document.levels?.find(item => item.id === level.id)?.name ?? 'Planta baja';
    descriptions.push(`${label}: exactamente ${stairs.length} escaleras, ${slopes.length} rampas inclinadas y ${landings.length} descansillos planos en el ámbito elegido.`);
    stairs.forEach((item, index) => descriptions.push(`Escalera ${index + 1}: ${item.kind === 'straight' ? 'recta, sin giro' : `forma ${item.kind}`}, ${item.stepCount} peldaños. ${placement(item)}`));
    slopes.forEach((item, index) => descriptions.push(`Rampa ${index + 1}: superficie inclinada continua, sin peldaños${item.route ? `, segundo tramo con giro ${item.route.turn}` : ', sin segundo tramo'}. ${placement(item)}`));
    landings.forEach((item, index) => descriptions.push(`Descansillo ${index + 1}: plataforma horizontal, sin convertirla en escalera. ${placement(item)}`));
  }
  return ['Control estructural de la aprobación, limitado al ámbito de las referencias. Las posiciones siguientes son coordenadas locales del plano, no geográficas ni cotas para dibujar en pantalla.',
    ...descriptions, 'No añadir, duplicar, desplazar ni convertir accesos al girar la cámara. Si un acceso está tapado en una foto, no reconstruirlo en otra posición. Mantener la misma distribución y todos los tabiques interiores: un recorte de visualización de fachada no es una demolición.'].join('\n');
}

function placement(item: { x: number; y: number; widthMm: number; depthMm: number; rotation: number }): string {
  const metres = (value: number) => (value / 1000).toFixed(2);
  return `Origen local X=${metres(item.x)} m, Y=${metres(item.y)} m; huella ${metres(item.widthMm)} × ${metres(item.depthMm)} m; orientación ${item.rotation}°. Conservar su lugar relativo en las fotos.`;
}
