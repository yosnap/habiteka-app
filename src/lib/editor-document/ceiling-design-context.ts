import type { EditorDocument } from './schema';
import { ceilingSurfaces, resolvedLuminaires, luminaireDepthMm } from './ceiling-geometry';

const meters = (value: number) => Number((value / 1000).toFixed(3));

export const CEILING_RENDER_POLICY = 'Los techos y luminarias indicados ya están aceptados y persistidos: conserva sus tipos, posiciones, alturas, acabados, caída, temperatura K, flujo lm y encendido. La transparencia del techo es solo una ayuda de edición, nunca un material de cristal. En cenital/isométrica omite visualmente el techo para ver el interior sin borrar luminarias; en vista interior representa el acabado real. No inventes techos ni cubras patios o terrazas abiertos. En modo estricto representa las luminarias existentes sin añadir otras; en modo controlado solo propón luces si additions incluye lights y dentro de las zonas autorizadas. positionM.elevation indica la cota inferior de la luminaria y bodyHeightM su altura; dropM es la caída desde el techo al cuerpo. El estilo no autoriza cambios geométricos.';

/** Las mismas reglas, condensadas para el prompt compacto (tope de longitud de los modelos de respaldo). */
export const CEILING_RENDER_POLICY_COMPACT = 'Techos y luminarias ya aceptados: conserva tipo, posición, altura, acabado, caída, K, lm y encendido. Techo transparente = ayuda de edición, nunca cristal. Cenital/isométrica: omite el techo sin borrar luminarias; interior: acabado real. No inventes techos ni cubras patios/terrazas. strict: sin luces nuevas; controlled: solo si additions incluye lights y en zonas autorizadas. positionM.elevation=cota inferior; dropM=caída desde techo. Estilo sin cambios geométricos.';

/** Mismo contrato físico para diseño, render completo y render compacto. */
export function ceilingDesignContext(doc: EditorDocument) {
  return {
    ceilings: ceilingSurfaces(doc).map(({ ceiling, room, heightMm }) => ({
      id: ceiling.id, roomId: room.id, kind: ceiling.kind,
      heightM: meters(heightMm), dropM: meters(ceiling.dropMm), color: ceiling.color,
      boundaryM: room.boundary.map((point) => ({ x: meters(point.x), y: meters(point.y) })),
    })),
    luminaires: resolvedLuminaires(doc).map(({ luminaire, ceiling, heightMm, ceilingHeightMm }) => ({
      id: luminaire.id, ceilingId: ceiling.id, roomId: ceiling.roomId, kind: luminaire.kind,
      positionM: { x: meters(luminaire.x), y: meters(luminaire.y), elevation: meters(heightMm) },
      bodyHeightM: meters(luminaireDepthMm(luminaire.kind)),
      ceilingHeightM: meters(ceilingHeightMm), dropM: meters(luminaire.dropMm), color: luminaire.color,
      temperatureK: luminaire.temperatureK, lumens: luminaire.lumens, enabled: luminaire.enabled,
    })),
  };
}
