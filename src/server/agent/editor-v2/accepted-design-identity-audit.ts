import sharp from 'sharp';
import { z } from 'zod';
import type { ChatVisionAdapter, JsonSchema } from '@/lib/contracts';
import type { RenderFidelityReport } from '@/lib/editor-document/render-fidelity';
import type { RenderView } from '@/lib/editor-document/render-view';
import { RenderRejectedError } from '@/server/errors/render-rejected-error';
import { IncompleteRenderReviewError } from './render-fidelity-verdict';
import { renderIdentityDetails } from './render-audit-details';
import { candidateIdentityInventory } from './candidate-identity-inventory';
import type { RenderSpatialContext } from './render-spatial-context';
import { cameraOpeningLocations } from './accepted-interior-prompt';
import { interiorFurnitureBrief } from './interior-furniture-brief';
import { auditIsolatedReference } from './isolated-reference-audit';

type Image = { base64: string; mimeType: string };
const comparison = z.object({
  element: z.string().trim().min(1),
  reference: z.string().trim().min(1),
  candidate: z.string().trim().min(1),
  status: z.enum(['preserved', 'changed', 'occluded', 'uncertain']),
  evidence: z.string().trim().min(1),
});
const identitySchema = z.object({
  occlusions: z.array(z.object({
    element: z.string().trim().min(1),
    hiddenIn: z.enum(['reference', 'candidate']),
    obstacle: z.string().trim().min(1),
    location: z.string().trim().min(1),
  })).describe('Partes no comparables por perspectiva u obstáculo, identificadas ANTES de comparar. No se certifica su conservación ni se afirma su desaparición.'),
  comparisons: z.array(comparison).min(1).describe('Solo rasgos y subconjuntos observables en ambas imágenes. Separar filas visibles y ocultas: no comparar el total cenital con el subtotal visible interior.'),
});

/** Revisión separada: la maqueta y el aprobado global no pueden sesgar la identidad observada. */
export async function auditAcceptedDesignIdentity(chat: ChatVisionAdapter, accepted: Image, candidate: Image,
  view: RenderView, orientation: 'interior' | 'lateral' | 'exterior', rooms: string[] = [],
  constraints?: { spatial?: RenderSpatialContext; architecture?: Image; acceptedBrief?: string[]; openingDepths?: { id: string; beyondOpeningMm: number | null }[] }) {
  const sourceFacts = orientation === 'interior' && constraints?.spatial
    ? constraints.acceptedBrief ?? (await interiorFurnitureBrief(chat, accepted, view, constraints.spatial)).brief : undefined;
  const isolated = sourceFacts ? await auditIsolatedReference(chat, candidate, sourceFacts,
    JSON.stringify({ openings: cameraOpeningLocations(view, constraints!.spatial!), depths: constraints?.openingDepths })) : [];
  const resize = async (image: Image) => ({ type: 'image_url' as const, mimeType: 'image/jpeg',
    base64: (await sharp(Buffer.from(image.base64, 'base64')).resize({ width: 2800, height: 2800,
      fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer()).toString('base64') });
  const [referenceDetails, candidateDetails] = await Promise.all([
    renderIdentityDetails(accepted), renderIdentityDetails(candidate),
  ]);
  const candidateInventory = await candidateIdentityInventory(chat, candidate, candidateDetails);
  const auditSchema = constraints?.architecture ? identitySchema.extend({
    architectureCheck: comparison.describe('Comprobación obligatoria separada de cubierta, vidrio y estructura del exterior aceptado; explicar si queda oculta.'),
  }) : identitySchema;
  const result = await chat.chat({ model: '', temperature: 0, maxTokens: 4000, reasoning: { effort: 'medium' },
    responseSchema: z.toJSONSchema(auditSchema) as JsonSchema,
    messages: [{ role: 'user', content: [
      { type: 'text', text: [
        'Compara exclusivamente la identidad visual de DOS imágenes del mismo inmueble. Imagen 1: diseño aceptado. Imagen 2: candidata desde otra cámara.',
        `Lectura aislada de la CANDIDATA, realizada sin ver la referencia: ${JSON.stringify(candidateInventory)}. Contrasta estas piezas con la imagen. Si tu recuento difiere, localiza la pieza discrepante: no sustituyas esta lectura por una cantidad supuesta. Una discrepancia sin resolver es uncertain.`,
        `Cámara candidata: ${view.preset}. Estancias que debe mostrar: ${rooms.join(', ') || view.roomName || 'las visibles desde esta cámara'}.`,
        ...(constraints?.spatial ? [
          `Huecos proyectados en la cámara candidata: ${JSON.stringify(cameraOpeningLocations(view, constraints.spatial))}. Su posición horizontal no garantiza visibilidad si hay obstáculos.`,
          `Correspondencia geométrica, NO apariencia: ${JSON.stringify({ roofGlazing: constraints.spatial.roofGlazing,
            levels: constraints.spatial.levels.map(level => ({ name: level.name, rooms: level.rooms,
              openings: level.openings.map(opening => ({ id: opening.id, center: opening.center, connectsRooms: opening.connectsRooms })) })) })}`,
          'Comprueba por separado cada interior visible tras una ventana o puerta: connectsRooms y las coordenadas fijan a qué estancia pertenece. La derecha de esta cámara no es la derecha de la cenital. Una cama visible en el hueco de un estudio es changed aunque exista esa cama en otro dormitorio. No marques preserved por encontrar un objeto parecido en otra habitación.',
        ] : []),
        ...(constraints?.openingDepths ? [`Incluye en comparisons los accesos y fondos visibles: ${JSON.stringify(constraints.openingDepths)} mide profundidad en mm tras el hueco hasta estructura opaca. Una puerta corredera convertida en abatible, un pasillo ampliado tras una pared cercana o una salida exterior inventada son changed aunque el patio y su mobiliario sean correctos. Comprueba esos rasgos por separado del lucernario.`] : []),
        ...(constraints?.architecture ? [
          'Al final se adjunta una referencia EXTERIOR ACEPTADA adicional que fija cubierta, lucernarios, fachadas y pérgolas. La imagen 1 fija el mobiliario. La ausencia de tejado en una cenital de interiores no significa ausencia física de cubierta.',
          'OBLIGATORIO: añade una comparación de cubierta/lucernarios. Localiza el vidrio con roofGlazing y el exterior aceptado. Si donde debe verse cristal y estructura aparece cielo completamente abierto, marca changed. Si realmente queda fuera de cámara o detrás de superficies opacas, explica esa oclusión sin certificarlo. No confundas vidrio transparente con ausencia de cubierta ni inventes su desaparición por no ver una parte oculta.',
        ] : []),
        orientation === 'interior' ? 'La imagen 1 es una cenital completa SIN GIRAR. Localiza la estancia por su posición, forma y huecos. No compares habitaciones distintas.'
          : orientation === 'lateral' ? 'La cenital aceptada está girada: el borde inferior es la fachada retirada y su izquierda coincide con la candidata. Las estancias ocultas no tienen que aparecer.'
            : 'La referencia aceptada puede tener otro ángulo. Compara solo las superficies y objetos identificables en ambas vistas; no inventes lo oculto.',
        ...(orientation === 'interior' && view.position && view.focus ? [`En el plano, la cámara está en x=${view.position[0]}, z=${view.position[2]} m y mira hacia x=${view.focus[0]}, z=${view.focus[2]} m; arriba de la cenital es -z y derecha es +x. No asignes norte/sur de la cenital a izquierda/derecha de la candidata sin transformar esta cámara.`] : []),
        'Primero completa occlusions: determina qué partes quedan detrás de superficies opacas, fuera del encuadre o invisibles en la cenital. Identifica el obstáculo y dónde está en la imagen. Si no hay partes ocultas, usa []. No presupongas que un espacio que no ves está vacío.',
        'Después recorre uno a uno TODOS los grupos visibles en ambas: sillas, taburetes, mesa, sofás, camas, mesillas, textiles, cocina, pavimento y, si aparecen, cubierta, pérgola, vehículos y vegetación.',
        'OBLIGATORIO: separa cojines, mantas y colchas del mueble principal. Compara sus colores y posiciones en entradas propias; no los escondas bajo la descripción sofá beige o cojines auxiliares. Compara también brazos y laterales: un brazo marrón/ cuero frente a tapizado claro es changed si es visible en ambas. Un sofá puede conservar volumen y color principal y aun así fallar por sus textiles o brazos. Si las caras no se ven en la referencia, identifica esa oclusión sin inventar su acabado.',
        'Por cada grupo escribe primero reference (lo que ves SOLO en imagen 1), después candidate (SOLO imagen 2): cantidad visible, material, color dominante, forma del asiento/respaldo/patas, disposición y orientación. Después decide status y explica evidencia concreta.',
        'Tras las dos imágenes completas, cada grupo de ampliaciones lleva una etiqueta de REFERENCIA o CANDIDATA. Orden dentro de cada grupo: arriba izquierda, arriba derecha, abajo izquierda, abajo derecha. Se solapan: no sumes objetos repetidos. Úsalas para contar asientos y reconocer sus respaldos en cada imagen por separado.',
        'Cuenta sillas y taburetes uno a uno POR LADO, no por total del inmueble. Cada comparison compara el mismo subconjunto visible: fila exterior con fila exterior, cabecera con cabecera. Si otra fila está oculta, va únicamente en occlusions. No deduzcas una pérdida restando el subtotal interior al total de la cenital. No declares preservada la cantidad oculta.',
        'Si alegas un cambio de cantidad, enumera en evidence cada pieza visible de la candidata con el centro aproximado de su asiento (x%, y% de la imagen completa). No cuentes una silla de comedor como taburete ni el respaldo y el asiento de una misma pieza como dos objetos. Si no puedes localizar las piezas que sostienen tu recuento, marca uncertain y explica la duda.',
        'Una silla tapizada con respaldo continuo no es una silla de listones; un taburete gris con respaldo no es uno negro sin respaldo; una mesilla redonda no es rectangular. Conservar función o estilo no conserva el objeto. No copies la descripción de una imagen en la otra.',
        'changed si cambia una característica comprobable. No excuses cambios de forma, tapizado, orientación o familia de color como iluminación. Sí permite la variación normal de luz y perspectiva.',
        'Una oclusión explicada pertenece a occlusions y no es una incertidumbre sobre lo visible. uncertain si no puedes localizar la estancia, el obstáculo o distinguir un rasgo que sí debería verse. Nunca ocultes un objeto sustituto visible en occlusions. No inventes fachadas de muebles que la cenital no muestra.',
        'Distingue ausencia de falta de visibilidad: una encimera, un frente opaco o muebles delante pueden ocultar otra fila de asientos. No afirmes que ese lado está vacío sin ver el espacio que deberían ocupar. Separa los objetos visibles y los ocultos en comparaciones distintas; conserva el recuento observado sin exigir que todos sean visibles desde cada cámara.',
        'Una campana o el frente vertical de un frigorífico no visibles en la cenital no demuestran un objeto nuevo. Compara solo los rasgos observables; no rechaces por inventar cómo debía ser una cara oculta. La izquierda de la candidata no es automáticamente el oeste del plano.',
        'No emitas un aprobado global. No hay permisos para rediseñar. Si no hay mobiliario compara suelos, paredes o cubierta; la lista nunca queda vacía. La aceptación corresponde al usuario.',
      ].join('\n') },
      ...await Promise.all([resize(accepted), resize(candidate)]),
      ...(referenceDetails.length ? [{ type: 'text' as const, text: 'Ampliaciones de REFERENCIA aceptada (imagen 1).' },
        ...referenceDetails.map(image => ({ type: 'image_url' as const, ...image }))] : []),
      ...(candidateDetails.length ? [{ type: 'text' as const, text: 'Ampliaciones de CANDIDATA (imagen 2).' },
        ...candidateDetails.map(image => ({ type: 'image_url' as const, ...image }))] : []),
      ...(constraints?.architecture ? [{ type: 'text' as const, text: 'REFERENCIA EXTERIOR ACEPTADA: cubierta, vidrio y fachadas; no fija mobiliario interior.' },
        await resize(constraints.architecture)] : []),
    ] }],
  });
  const parsed = auditSchema.parse(result.structured);
  parsed.comparisons.push(...isolated);
  if ('architectureCheck' in parsed) parsed.comparisons.push(comparison.parse(parsed.architectureCheck));
  return parsed;
}

/** Conserva evidencias incluso cuando la revisión general había marcado identidad correcta. */
export function applyAcceptedIdentityReview(report: RenderFidelityReport, value: unknown): RenderFidelityReport {
  const parsed = identitySchema.safeParse(value);
  if (!parsed.success || parsed.data.comparisons.every(item => item.status === 'occluded'))
    throw new IncompleteRenderReviewError('No se pudo contrastar la identidad del diseño aceptado con esta cámara.');
  const checks = parsed.data.comparisons;
  const evidence = (items: typeof checks) => items.map(item => `${item.element}: referencia: ${item.reference}; candidata: ${item.candidate}. ${item.evidence}`).join('\n');
  const failures = checks.filter(item => item.status === 'changed' || item.status === 'uncertain');
  const criterion = report.criteria?.find(item => item.id === 'objectIdentityPreserved');
  const occlusions = parsed.data.occlusions.map(item => `${item.element}: no comprobable en ${item.hiddenIn === 'candidate' ? 'la candidata' : 'la referencia'} por ${item.obstacle}; ubicación: ${item.location}. No se certifica su conservación.`);
  if (criterion) { criterion.observation = `Comparación independiente:\n${evidence(checks)}${occlusions.length ? `\nPartes ocultas:\n${occlusions.join('\n')}` : ''}`; if (failures.length) criterion.status = 'fail'; }
  if (!failures.length) return report;
  report.status = 'rejected';
  report.violations = [...(report.violations ?? []), evidence(failures)];
  throw new RenderRejectedError(`Se descartó el diseño: la identidad no coincide con la referencia aceptada. ${evidence(failures).slice(0, 450)}`, report);
}
