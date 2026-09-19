import { BOUNDARY_RENDER_POLICY } from '@/lib/editor-document/boundary-context';
import { CEILING_RENDER_POLICY } from '@/lib/editor-document/ceiling-design-context';

/** Compactación estructurada: conserva todos los valores numéricos y relaciones.
 * Los identificadores opacos se renombran coherentemente, nunca se corta el JSON.
 */
export function compactRenderContext(data: unknown) {
  const ids = new Map<string, string>();
  const schemas: string[][] = [];
  const schemaIds = new Map<string, number>();
  function encode(value: unknown): unknown {
    if (typeof value === 'string' && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value)) {
      if (!ids.has(value)) ids.set(value, `e${ids.size}`);
      return ids.get(value);
    }
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === 'object') {
      const entries = Object.entries(value);
      const keys = entries.map(([key]) => key);
      const signature = JSON.stringify(keys);
      if (signature === '["x","y"]' || signature === '["x","y","elevation"]'
        || signature === '["width","depth","height"]') return entries.map(([, item]) => encode(item));
      let index = schemaIds.get(signature);
      if (index === undefined) { index = schemas.length; schemas.push(keys); schemaIds.set(signature, index); }
      return [`@${index}`, ...entries.map(([, item]) => encode(item))];
    }
    return value;
  }
  const values = encode(data);
  return JSON.stringify({ schemas, values });
}

export const COMPACT_RENDER_POLICY = `Render fotorrealista: MISMO proyecto y cámara que referencia. Metros/grados; WebGL X=x,Y=elevación,Z=y. ["@N",...valores] usa schemas[N]. Puntos=[x,y], positionM=[x,y,elevación], dimensionsM=[ancho,fondo,alto]. IDs eN coherentes. floors usa boundary de rooms por roomId.
Conserva toda geometría, cantidades, posiciones, alturas, cotas, huecos, plataformas y objetos existentes. No añadas ni cambies construcción; exterior sigue exterior. Rampas continuas hasta suelo elevado; footprint sube 2-3→0-1, descansillo horizontal. cutawayWallIds se omiten visualmente, no se demuelen; no recoloques lo oculto.
Mejora acabados/luz. designOptions prevalece: strict=no objetos nuevos; controlled=solo additions; free=decoración sin construcción; selected=solo regionsM. Accesos/rampas/escaleras/descansillos libres. lighting: daylight=día,warm=atardecer,evening=noche. Sin nuevas luces en strict. Una imagen fiel, sin collage/texto/cotas.
${CEILING_RENDER_POLICY}
${BOUNDARY_RENDER_POLICY}`;
