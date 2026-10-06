import type { EditorDocument } from '@/lib/editor-document/schema';
import type { JsonSchema } from '@/lib/contracts';
import type { RenderFidelityReport } from '@/lib/editor-document/render-fidelity';
import { IncompleteRenderReviewError } from './render-fidelity-verdict';
import { ROOF_KIND_LABELS } from '@/lib/editor-document/exterior-roof';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';

export const ROOF_CLOSURE_PROMPT_VERSION = 'habiteka-roof-closure-v2';

/** Acabados interiores que el selector admite pero que no describen una cubierta: se usa solo el color dibujado. */
const INTERIOR_CATEGORIES = new Set(['Moqueta', 'Tela', 'Parqué y tarima', 'Azulejo de pared', 'Pintura y estuco', 'Madera (paredes y muebles)']);

/** Tipo, pendiente, alero, acabado y piezas de la cubierta del modelo, en una frase. */
function roofDescription(document: EditorDocument): string {
  const roof = document.exteriorRoof!;
  const material = surfaceMaterial(roof.materialId);
  const finish = material && !INTERIOR_CATEGORIES.has(material.category) ? `, acabado ${material.label.toLowerCase()}` : ', en el color de la maqueta';
  const shape = roof.kind === 'flat' ? 'cubierta plana' : `cubierta a ${ROOF_KIND_LABELS[roof.kind].toLowerCase()} de ${Math.round(roof.pitchDeg)}° de pendiente`;
  const openings = roof.openings ?? [];
  const glass = openings.filter(item => item.kind === 'glass' || item.kind === 'roof-window').length;
  const chimneys = openings.filter(item => item.kind === 'chimney').length;
  return [`${shape} con alero de ${Math.round(roof.eavesMm / 10)} cm${finish}`,
    ...(glass ? [`${glass} ${glass > 1 ? 'lucernarios' : 'lucernario'} de vidrio con carpintería oscura que deja ver el espacio de debajo`] : []),
    ...(chimneys ? [`${chimneys} ${chimneys > 1 ? 'chimeneas' : 'chimenea'} de obra con sombrerete metálico`] : [])].join('; ');
}

/**
 * La cubierta sale del modelo: la imagen 2 fija su forma y el texto, sus datos. La IA la añade a la imagen aceptada y la
 * alinea con sus muros, porque esa imagen puede no conservar el encuadre exacto de la cámara con la que se generó.
 */
export function roofClosurePrompt(document: EditorDocument): string {
  return [
    'EDICIÓN DE LA IMAGEN 1: añade a este mismo inmueble su cubierta real y no cambies nada más.',
    'La imagen 1 es el diseño aceptado visto sin cubierta. La imagen 2 es una maqueta del mismo inmueble desde la misma dirección: muros en claro, huecos en gris oscuro y la cubierta del proyecto en su color.',
    'Copia exactamente la forma de la cubierta de la imagen 2 (faldones, cumbreras, limatesas, aleros, lucernarios y chimeneas, en su posición) y colócala sobre los muros de la imagen 1, alineada con ellos aunque el encuadre de la maqueta sea distinto.',
    `Cubierta: ${roofDescription(document)}.`,
    'Conserva el encuadre, la cámara, la perspectiva, la luz, las fachadas, las ventanas, la parcela, la vegetación, los vehículos y el mobiliario exterior de la imagen 1. El interior queda tapado por la cubierta.',
    'No añadas placas solares, antenas, buhardillas ni otros elementos. Resultado fotorrealista, con la misma nitidez que la imagen 1, sin textos, rótulos ni marcos.',
  ].join('\n');
}

export const ROOF_REVIEW_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['roof', 'framing', 'identity', 'photorealistic'],
  properties: Object.fromEntries(['roof', 'framing', 'identity', 'photorealistic'].map(key => [key, {
    type: 'object', additionalProperties: false, required: ['status', 'observation'],
    properties: { status: { type: 'string', enum: ['pass', 'fail', 'uncertain'] }, observation: { type: 'string' } },
  }])),
};

export function roofClosureReviewPrompt(document: EditorDocument): string {
  return [
    'Revisa una imagen arquitectónica. Imagen 1: diseño aceptado sin cubierta. Imagen 2: maqueta con la cubierta del proyecto. Imagen 3: resultado que debe ser la imagen 1 con esa cubierta añadida.',
    `Cubierta del proyecto: ${roofDescription(document)}.`,
    'roof: la imagen 3 tiene la misma forma de cubierta que la imagen 2 (tipo, faldones, cumbreras, aleros, lucernarios y chimeneas en su sitio) y cubre todo el edificio que la maqueta cubre, sin piezas añadidas.',
    'framing: la imagen 3 conserva la cámara, el encuadre, la perspectiva y la escala de la imagen 1.',
    'identity: fuera de la cubierta, la imagen 3 conserva lo que se ve en la imagen 1 (fachadas, ventanas, terrazas, parcela, vegetación, vehículos y mobiliario exterior), sin quitar, añadir ni mover nada.',
    'photorealistic: la imagen 3 es fotorrealista y nítida, sin textos, rótulos, marcos ni collage.',
    'Para cada criterio devuelve pass, fail o uncertain y una observación concreta en español. Si no puedes comprobar algo, usa uncertain.',
  ].join('\n');
}

type Check = { status: 'pass' | 'fail' | 'uncertain'; observation: string };

/** Informe en el formato de la galería; un criterio fallido o dudoso descarta la imagen. */
export function roofClosureReport(structured: unknown, model?: string): RenderFidelityReport {
  const value = structured as Partial<Record<'roof' | 'framing' | 'identity' | 'photorealistic', Check>> | undefined;
  const valid = (check?: Check) => check && ['pass', 'fail', 'uncertain'].includes(check.status) && typeof check.observation === 'string' && check.observation.trim();
  if (!value || !valid(value.roof) || !valid(value.framing) || !valid(value.identity) || !valid(value.photorealistic))
    throw new IncompleteRenderReviewError('No se pudo verificar la imagen con tejado: el informe de la revisión no es válido.');
  const worst = (...checks: Check[]): Check['status'] => checks.some(item => item.status === 'fail') ? 'fail' : checks.some(item => item.status === 'uncertain') ? 'uncertain' : 'pass';
  const criteria = [
    { id: 'cameraAndGeometryPreserved' as const, status: worst(value.roof!, value.framing!), observation: `Cubierta: ${value.roof!.observation.trim()} Encuadre: ${value.framing!.observation.trim()}` },
    { id: 'objectIdentityPreserved' as const, status: value.identity!.status, observation: value.identity!.observation.trim() },
    { id: 'photorealistic' as const, status: value.photorealistic!.status, observation: value.photorealistic!.observation.trim() },
  ];
  const violations = criteria.filter(item => item.status !== 'pass').map(item => item.observation);
  return { version: ROOF_CLOSURE_PROMPT_VERSION, status: violations.length ? 'rejected' : 'passed', checkedAt: new Date().toISOString(),
    ...(model ? { model } : {}), criteria, ...(violations.length ? { violations } : {}), roomChecks: [], openingChecks: [] };
}
