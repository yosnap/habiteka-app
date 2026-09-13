/**
 * Prompt del render cenital construido DESDE LOS DATOS del plano (nombres,
 * superficies y aberturas por estancia), nunca pidiendo al modelo que "adivine"
 * la disposición: la geometría exacta viaja aparte como imagen de referencia.
 * Pieza pura y testeable sin red.
 */
import type { Estilo, PlanZone, Plano2dPayload } from '@/lib/contracts';
import { ESTILOS } from '@/lib/design-options';

/** Describe una estancia a partir de sus datos (sin inventar). */
function describeZone(zone: PlanZone): string {
  const areaM2 = outlineAreaM2(zone);
  const doors = zone.apertures.filter((a) => a.kind === 'puerta').length;
  const windows = zone.apertures.filter((a) => a.kind === 'ventana').length;
  const parts = [`- ${zone.name}`];
  if (areaM2 > 0) parts.push(`(${areaM2.toFixed(1)} m²)`);
  const openings: string[] = [];
  if (doors) openings.push(`${doors} puerta${doors > 1 ? 's' : ''}`);
  if (windows) openings.push(`${windows} ventana${windows > 1 ? 's' : ''}`);
  if (openings.length) parts.push(`con ${openings.join(' y ')}`);
  return parts.join(' ');
}

function outlineAreaM2(zone: PlanZone): number {
  const pts = zone.outline;
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2 / 1_000_000;
}

/**
 * Prompt del render cenital fotorrealista. La imagen adjunta es la autoridad
 * sobre la disposición; el texto solo aporta el uso de cada estancia y el estilo.
 */
/**
 * Prompt del cenital cuando la referencia es la IMAGEN del plano (con las
 * estancias ya rotuladas en ella): el modelo lee las etiquetas del propio
 * plano; el texto solo fija el formato y el estilo.
 */
// Tope de las instrucciones del propietario (evita prompts desbocados).
const MAX_OWNER_NOTES_CHARS = 800;

export function buildCenitalImagePrompt(estilo: Estilo, ownerNotes = ''): string {
  const estiloLabel = ESTILOS.find((o) => o.value === estilo)?.label ?? estilo;
  const notes = ownerNotes.trim().slice(0, MAX_OWNER_NOTES_CHARS);
  return [
    'La imagen adjunta es un PLANO EN PLANTA de una vivienda con sus estancias rotuladas.',
    'Genera un render cenital fotorrealista (vista "dollhouse" desde arriba, muros con altura',
    'cortados en sección) que respete EXACTAMENTE esa disposición: mismas estancias, mismos',
    'muros en la misma posición y proporción, mismas puertas y ventanas.',
    '',
    'LOS MUROS SON SAGRADOS: dibuja exactamente los muros del plano, ni uno más. PROHIBIDO',
    'añadir tabiques, cerrar espacios abiertos o dividir una estancia en dos. Un pasillo o zona',
    'de paso abierta en el plano permanece ABIERTA en el render.',
    '',
    'Amuebla cada estancia SEGÚN SU RÓTULO, sin excepciones:',
    '- Dormitorio → cama, armario, mesillas.',
    '- Cocina → bancada, fogones, fregadero.',
    '- Baño → sanitarios. SOLO puede haber sanitarios (bañera, ducha, inodoro, lavabo) dentro',
    '  de la estancia rotulada "Baño"; en ninguna otra parte.',
    '- Salón → sofá, mesa de centro.',
    '- Entrada → recibidor: perchero, consola, felpudo. JAMÁS sanitarios ni electrodomésticos.',
    'Una estancia sin rótulo se amuebla de forma neutra (o se deja vacía). No inventes',
    'habitaciones que el plano no rotula. Sin textos, sin cotas, sin marcas de agua.',
    ...(notes
      ? [
          '',
          'INSTRUCCIONES DEL PROPIETARIO (prevalecen sobre las reglas genéricas de mobiliario,',
          'nunca sobre la geometría de los muros):',
          notes,
        ]
      : []),
    '',
    `Estilo de interiorismo: ${estiloLabel}. Iluminación natural cálida, suelos y materiales`,
    'realistas, mobiliario proporcionado al tamaño de cada estancia.',
  ].join('\n');
}

export function buildCenitalPrompt(plano: Plano2dPayload, estilo: Estilo): string {
  const zonas = plano.zones.map(describeZone).join('\n');
  const estiloLabel = ESTILOS.find((o) => o.value === estilo)?.label ?? estilo;
  return [
    'La imagen adjunta es el PLANO EN PLANTA exacto de una vivienda (muros en negro,',
    'huecos de puertas y ventanas abiertos en los muros). Genera un render cenital',
    'fotorrealista (vista "dollhouse" desde arriba, muros con altura cortados en sección)',
    'que respete EXACTAMENTE esa disposición: mismas estancias, mismos muros, mismas',
    'puertas y ventanas en su posición, mismas proporciones. No añadas ni muevas',
    'habitaciones ni tabiques.',
    '',
    'Estancias (amuebla cada una según su uso):',
    zonas || '- Estancia única',
    '',
    `Estilo de interiorismo: ${estiloLabel}. Iluminación natural cálida, suelos y`,
    'materiales realistas, mobiliario proporcionado al tamaño de cada estancia.',
    'Sin textos, sin cotas, sin marcas de agua.',
  ].join('\n');
}
