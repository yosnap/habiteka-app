import { CEILING_RENDER_POLICY_COMPACT } from '@/lib/editor-document/ceiling-design-context';

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

export const COMPACT_RENDER_POLICY = `Fotorrealismo: MISMO proyecto/cámara. Metros/grados; WebGL X=x,Y=elevación,Z=y. ["@N",...valores]=schemas[N]. Puntos=[x,y]; positionM=[x,y,elevación]; dimensionsM=[ancho,fondo,alto]. IDs eN coherentes. floors/ceilings: boundary de rooms por roomId. wallDefaults/ceilingDefaults/floorDefaults: valores omitidos. pathM=[i,j]: índices si hay verticesM.
Conserva geometría/cantidades/posiciones/alturas/cotas/huecos/plataformas. Rediseño: solo muebles móviles/acabados del ámbito; fijos con permiso. Sin rediseño: objetos intactos. Sin construcción nueva; exterior sigue exterior. Rampa: footprint sube 2-3→0-1; descansillo horizontal. cutawayWallIds: ocultos, no demolidos/recolocados.
designOptions manda: strict=sin objetos/luces nuevos; controlled=solo additions; free=decoración sin estructura; selected=solo regionsM. Accesos/rampas/escaleras/descansillos libres. lighting: daylight=día,afternoon=tarde sol bajo,warm=atardecer,evening=noche. Sin collage/texto/cotas.
${CEILING_RENDER_POLICY_COMPACT}
Cerramientos: conserva muro inferior/altura superior, lamas/orientación/separación, postes/sección/colores y puertas/huecos/apertura. Ni rellenar puertas ni cambiar postes circulares por rectangulares.`;
