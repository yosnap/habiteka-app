import type { ChatVisionAdapter } from '@/lib/contracts';
import type { RenderView } from '@/lib/editor-document/render-view';
import { assertRenderFraming } from './render-framing-check';
import sharp from 'sharp';
import { renderViewVisibilityRule } from '@/lib/editor-document/render-view-visibility';
import { FURNITURE_USE_RULE } from '@/lib/editor-document/render-review';
import { renderSpatialRule, type RenderSpatialContext } from './render-spatial-context';
import { RENDER_FIDELITY_SCHEMA, validateRenderFidelity, IncompleteRenderReviewError } from './render-fidelity-verdict';
import { RENDER_FIDELITY_CRITERIA } from '@/lib/editor-document/render-fidelity';
import { renderAuditDetails } from './render-audit-details';
import { HARD_MAX_OUTPUT_TOKENS } from '@/server/ai/call-limits';
import { auditAcceptedDesignIdentity, applyAcceptedIdentityReview } from './accepted-design-identity-audit';
import { cameraOpeningLocations } from './accepted-interior-prompt';

type Image = { base64: string; mimeType: string };

/** El lateral debe enseñar el mismo interiorismo que la cenital aceptada, no otro diseño con la misma distribución. */
const LATERAL_DESIGN_RULE = 'La referencia adicional es la CENITAL ACEPTADA del MISMO diseño, vista desde arriba; la cámara correcta es la de la imagen 1. Está girada para coincidir con esta cámara y puede mostrar solo la parte del inmueble que ve: su borde inferior es la fachada cortada más cercana y su izquierda y derecha son las de la imagen 1, así que el orden de las estancias debe coincidir sin invertirlo. Identifica cada estancia por su posición y su mobiliario, no por el orden de la cenital sin girar. Compara cada estancia visible con la misma estancia de esa cenital: tipo, número, forma, color, posición relativa y orientación de los muebles, y acabados de suelo, paredes, cocina y baños. Un interiorismo distinto es objectIdentityPreserved=fail, por ejemplo dos camas donde la cenital muestra una, una cocina de otro color o una cama vista de frente cuando en la cenital su cabecero toca el borde inferior: desde esta cámara debe verse por detrás. Los muebles de la maqueta 3D solo orientan su posición: si difieren, manda la cenital aceptada. No penalices lo que la cenital no permite ver, como frentes verticales o cuadros.';

/**
 * El mapa de estancias se dibuja como la planta, con su borde superior arriba. Desde la trasera o un lateral el orden
 * se ve girado: sin esta correspondencia el auditor descartaba alzados correctos por «usos invertidos».
 */
const MAP_ORIENTATION: Record<string, string> = {
  front: 'la cámara mira desde el borde inferior del mapa: la izquierda y la derecha de la imagen coinciden con las del mapa.',
  back: 'la cámara mira desde el borde superior del mapa: la izquierda de la imagen corresponde a la derecha del mapa y la derecha, a su izquierda.',
  left: 'la cámara mira desde el borde izquierdo del mapa: la parte superior del mapa aparece a la izquierda de la imagen y la inferior, a la derecha.',
  right: 'la cámara mira desde el borde derecho del mapa: la parte inferior del mapa aparece a la izquierda de la imagen y la superior, a la derecha.',
};

/** Vista de conjunto; los detalles de las plantas cenitales se revisan además en recortes. */
async function auditImage(image: Image, mask = false): Promise<Image> {
  const resized = sharp(Buffer.from(image.base64, 'base64'))
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
  const bytes = mask ? await resized.png().toBuffer() : await resized.jpeg({ quality: 82 }).toBuffer();
  return { base64: bytes.toString('base64'), mimeType: mask ? 'image/png' : 'image/jpeg' };
}

/** Contrasta una imagen candidata con la captura real antes de publicarla como diseño. */
export async function assertRenderFidelity(
  chat: ChatVisionAdapter,
  capture: Image,
  candidate: Image,
  view: RenderView,
  mask?: Image,
  vehicleCount = 0,
  strictExterior = false,
  /** Vista auditada del mismo diseño; en los laterales (`lateral`) es la cenital aceptada que fija el interiorismo. */
  drone?: { identity: Image; environment?: Image; architecture?: Image; lateral?: boolean; interior?: boolean },
  redesignFixed = false,
  redesignRequested = redesignFixed,
  spatial?: { context: RenderSpatialContext; image: Image },
  /**
   * Referencia dibujada en 2D (plano o sección) en lugar de la captura del 3D, personas pedidas por el usuario y, en la
   * sección, las estancias que quedan abiertas de izquierda a derecha: todas deben verse.
   */
  extra: { reference?: 'capture' | 'plan' | 'section'; people?: boolean; sectionRooms?: { id: string; name: string; visibilityHint?: string }[];
    /** Camas y sofás dibujados en la sección porque su orientación coincide en la cenital aceptada y en el plano. */
    sectionFurniture?: string[];
    acceptedBrief?: string[];
    openingDepths?: { id: string; beyondOpeningMm: number | null }[] } = {},
) {
  await assertRenderFraming(capture, candidate);
  const [source, output, area] = await Promise.all([
    auditImage(capture), auditImage(candidate), mask ? auditImage(mask, true) : Promise.resolve(undefined),
  ]);
  const droneImages = drone ? await Promise.all([auditImage(drone.identity), ...(drone.environment ? [auditImage(drone.environment)] : [])]) : [];
  const guide = spatial ? await auditImage(spatial.image, true) : undefined;
  const details = await renderAuditDetails(candidate, view.preset);
  const exterior = spatial?.context.levels.flatMap(level => level.exterior ?? []) ?? [];
  const fixtureGroups = spatial?.context.levels.flatMap(level => level.fixtureGroups ?? []) ?? [];
  // Cada estancia y hueco del plano lleva su comprobación: con 30 huecos la respuesta se cortaba antes de terminar.
  const checkedSpaces = spatial?.context.levels.reduce((total, level) => total + level.rooms.length + level.openings.length + (level.openAreas?.length ?? 0), 0) ?? 0;
  const requiredExteriorIds = extra.reference === 'plan' && !mask
    ? exterior.filter(item => ['vehicle', 'boundary'].includes(item.category)
      || (item.category === 'surface' && item.visibleInPlan)).map(item => item.id) : [];
  const result = await chat.chat({
    model: '', responseSchema: RENDER_FIDELITY_SCHEMA, temperature: 0, maxTokens: Math.min(HARD_MAX_OUTPUT_TOKENS, 6000 + exterior.length * 90 + fixtureGroups.length * 180 + checkedSpaces * 110), reasoning: { effort: 'low' },
    messages: [{ role: 'user', content: [
      { type: 'text', text: [
        `Audita la fidelidad de un diseño arquitectónico. Ángulo solicitado: ${view.preset}.`,
        extra.reference === 'plan'
          ? 'Imagen 1: plano 2D del proyecto en vista cenital; cada hoja dibujada indica el lado y el giro de su puerta. Imagen 2: diseño candidato, que debe ser una vista cenital fotorrealista de ese plano.'
          : extra.reference === 'section'
            ? 'Imagen 1: sección 2D del proyecto vista de frente a la altura de los ojos, con la fachada del lado de cámara retirada, sin techo ni tejado; las bandas oscuras verticales son tabiques cortados. Imagen 2: diseño candidato, que debe ser esa maqueta abierta por arriba en versión fotorrealista. Rechaza una losa, viga continua, bloque o banda añadida que cierre su parte superior; no confundir la coronación de un muro real con una cubierta nueva.'
            : 'Imagen 1: captura original del 3D del proyecto. Imagen 2: diseño candidato.',
        ...(extra.sectionRooms?.length ? [`Estancias abiertas en la sección, de izquierda a derecha: ${extra.sectionRooms.map((room) => `${room.id} ${room.name}`).join(', ')}. Cada una debe verse en su hueco y en ese orden, con su uso y su mobiliario de la cenital. Si falta o en su hueco aparece otra estancia, márcala fail en roomChecks y roomUsesPreserved=false; nunca not-visible. roomChecks sigue incluyendo todas las estancias del plano: las que no están en esta lista quedan fuera del corte y son not-visible.`] : []),
        ...(extra.sectionRooms ?? []).flatMap(room => room.visibilityHint
          ? [`Visibilidad de ${room.id} ${room.name}: ${room.visibilityHint} No exijas muebles que están ocultos ni apruebes su traslado a la franja visible. Describe los objetos que realmente ves, sus cantidades y su relación con el diseño aceptado; repetir el nombre o la intención del prompt no es evidencia.`] : []),
        // La revisión aprobaba camas giradas y descartaba otras bien orientadas por leer mal la cenital girada.
        ...(extra.sectionFurniture?.length ? [`Las camas y sofás dibujados en la imagen 1 tienen su orientación confirmada por la cenital aceptada y por el plano: ${extra.sectionFurniture.join('; ')}. Comprueba cada uno en la candidata: si está girado (por ejemplo, una cama vista desde los pies donde debe verse por detrás), objectIdentityPreserved=fail. Si coincide, no rechaces su orientación por tu lectura de la cenital.`] : []),
        ...(extra.people ? ['El usuario pidió personas en las estancias: no las cuentes como objetos ni construcciones añadidas; rechaza solo si tapan puertas o pasos o su escala es irreal.'] : []),
        ...(details.length ? ['Antes del mapa auxiliar final hay cuatro ampliaciones de la candidata, en orden: arriba izquierda, arriba derecha, abajo izquierda, abajo derecha. Son detalles de la misma imagen para examinar hojas de puertas, sanitarios, sillas y texturas; no son referencias nuevas. Compara arquitectura en las vistas completas, sin confundir el recorte con una pérdida de muros.'] : []),
        ...(mask ? ['Imagen 3: máscara de la única zona diseñada (blanco = zona visible; negro = fondo gris claro vacío).'] : []),
        'Acepta mejoras de materiales, iluminación y realismo. La maqueta original puede tener muros cortados para ver el interior.',
        ...(view.architectureOnly ? ['La imagen 1 omite intencionadamente el mobiliario de la maqueta: compara muebles, plantas y fuentes con el diseño aceptado, no con su ausencia en esa guía. El azul opaco en la cubierta representa vidrio; exige cubierta acristalada realista en la candidata, nunca cielo abierto.'] : []),
        ...(spatial && view.preset === 'custom' ? [`Proyección horizontal de huecos en ESTA cámara: ${JSON.stringify(cameraOpeningLocations(view, spatial.context))}. No traslades el uso de un hueco fuera de cámara a otra ventana visible. El centro proyectado no acredita visibilidad si hay obstáculos.`] : []),
        ...(extra.openingDepths ? [`Profundidad geométrica desde cada hueco hasta la primera estructura opaca, siguiendo la mirada: ${JSON.stringify(extra.openingDepths)}. Rechaza pasillos largos, ventanas o salidas exteriores inventados donde la guía muestra una pared próxima. Comprueba en openingChecks el tipo exacto indicado: una corredera transformada en abatible es fail, aunque ambas sean puerta y su hueco conserve posición.`] : []),
        'Antes de declarar un bloque, plataforma u ocultación NUEVOS, comprueba si ya aparecen en la imagen 1 en la misma posición relativa y proporción. Un descansillo blanco o una superficie lisa ya modelados no son construcciones añadidas. Compara el inmueble tras alinear su encuadre: acercarlo dentro del lienzo no añade geometría. Solo atribuye al candidato las pérdidas u ocultaciones que introduce respecto de la captura; si cambia un descansillo, sus límites, peldaños o barandillas visibles, recházalo.',
        'Rechaza si cambia el punto de vista, orientación, silueta, número o posición de plantas, muros, huecos, escaleras, rampas, piscina o accesos visibles.',
        'Exige identidad completa: rechaza si desaparecen o se simplifican pérgolas, carpas, cubiertas, terrazas o cualquier elemento arquitectónico visible, aunque el volumen principal se parezca.',
        renderViewVisibilityRule(view),
        ...(drone?.interior ? ['La referencia adicional es la CENITAL ACEPTADA SIN GIRAR del mismo diseño. Localiza la estancia interior por el mapa y sus huecos; la imagen 1 fija la cámara y la arquitectura. Compara muebles y acabados con esa estancia en la cenital, nunca con los de la maqueta. Conserva tipo, número, forma, color, posición y orientación: una mesa, silla, sofá o cama diferentes son objectIdentityPreserved=fail. No apruebes otra decoración solo porque conserva el uso de la habitación. No atribuyas a la cenital un giro que no tiene. Comprueba también lo visible por puertas y ventanas; no apruebes un paisaje inventado.']
          : drone?.lateral ? [LATERAL_DESIGN_RULE] : drone ? ['La referencia adicional del inmueble es una vista cercana auditada del MISMO diseño. Compara la identidad y el volumen de la casa con esa vista, usando la cámara de la imagen 1. Rechaza pérdidas de elementos visibles en esa cámara y cualquier casa añadida.',
          ...(drone.environment ? [`La imagen ${mask ? 5 : 4} es la ortofoto real de la parcela. El entorno solo puede proceder de ella: conserva sus límites, caminos y vegetación sin inventar urbanización. La ortofoto no define el diseño de la casa.`] : ['La casa está aislada: conserva el fondo neutro sin paisaje.'])] : []),
        'Rechaza si sustituye el inmueble por otra casa, extiende la maqueta fuera de sus bordes, inserta una imagen del 3D dentro de otra escena, o produce un collage, superposición o doble arquitectura.',
        drone
          ? 'Los muebles no pueden sustituirse: deben ser los de la cenital aceptada. Rechaza también si bloquean accesos, cambian el uso del espacio o se añaden construcciones.'
          : 'Los muebles móviles pueden sustituirse: sofás, mesas, sillas, lámparas, alfombras y cortinas. Rechaza si bloquean accesos, cambian el uso del espacio o se añaden construcciones.',
        `Rechaza cambios de función del mobiliario${spatial ? ', salvo la corrección autorizada de muebles incompatibles con el uso nombrado de una estancia' : ''}. ${FURNITURE_USE_RULE}`,
        redesignRequested
          ? 'El usuario pidió REDISEÑO REAL: redesignApplied solo es true si los elementos modificables visibles muestran cambios reconocibles de formas, mobiliario, estilo o acabados. Una copia de los mismos elementos con mejor luz o textura NO es un rediseño: recházala. Si esta cámara no muestra ningún elemento modificable, no penalices esa ausencia. Los tabiques y la distribución nunca se rediseñan en este modo.'
          : 'No se exige rediseño en esta solicitud; indica redesignApplied=true.',
        drone
          ? 'FIJOS DEL DISEÑO ACEPTADO: compara forma, ubicación, cantidad y acabados con la referencia aceptada, aunque difiera de la maqueta. El permiso original de rediseño no permite volver a diseñarlos al cambiar de cámara. Muros, huecos, usos y accesos siguen fijados por el plano.'
          : redesignFixed
          ? 'El usuario autorizó REDISEÑO DE FIJOS: admite sustituciones y acabados nuevos de cocina, isla, sanitarios y armarios empotrados dentro del ámbito permitido. No los marques como pérdida de identidad de objetos; muros, huecos, instalaciones, usos y accesos siguen protegidos.'
          : 'FIJOS PROTEGIDOS: rechaza sustituciones o cambios de forma, ubicación o acabados de cocina, isla, sanitarios y armarios empotrados. Si hay cocina en L, rechaza huecos nuevos entre tramos; conserva el color dominante de cada encimera y los frentes; un tramo beige convertido en blanco puro o marrón oscuro no es una mejora de textura.',
        'Compara también la IDENTIDAD de cada objeto exterior visible, no solo su posición. Una fila de vehículos transformada en sofás es un fallo grave aunque conserve el número y la ubicación.',
        'En exteriorChecks devuelve observedVehicleType desde la CANDIDATA: compact=coche compacto, sedan=berlina, suv=SUV alto con carrocería y habitáculo propios, van=furgoneta con zona de carga, unspecified solo si el inventario no fija tipo; not-applicable para otros elementos. No copies el tipo del inventario sin reconocerlo visualmente; uncertain si no se distingue. Un SUV o una furgoneta convertidos en un turismo fallan aunque sigan siendo vehículos.',
        'Devuelve fixtureChecks por cada id de levels[].fixtureGroups, exactamente una vez, vacío si no hay grupos. Cuenta por separado inodoros, lavabos, bidés, bañeras, duchas, fregaderos y placas. referenceCounts son las piezas visibles en la referencia de esa cámara; observedCounts son las que VES en la candidata, incluidos duplicados. El inventario solo dice qué estancias revisar y dónde (searchAreaMm), no cuántas piezas tienen: cuenta tú cada pieza, una a una, en la referencia y en la candidata. Dos piezas iguales pegadas son dos, nunca una. En plano cenital completo escribe 0 para lo que no veas. En una cámara parcial no cuentes piezas ocultas; null solo si no se puede verificar, no como cero. Una placa con cuatro fogones es UNA placa. Inodoro+lavabo+ducha no son tres inodoros. La placa integrada en kitchenRuns cuenta igual que una independiente: ausencia, encimera vacía u objetos encima => fail. identityAndPlacement evalúa función y ubicación por estancia. not-visible solo para grupos fuera de cámara/máscara, con observedCounts null; nunca para piezas visibles en la referencia que desaparecen. Si hay cenital aceptada adjunta, referenceCounts se toma de ese diseño aceptado, aunque difiera del plano; no impongas sus cantidades antiguas. Con rediseño de fijos puedes admitir bañera por ducha o viceversa, sin multiplicar su total ni inodoros, lavabos o placas.',
        'Devuelve exteriorChecks con cada id de levels[].exterior exactamente una vez, sin omisiones ni duplicados; vacío si no hay inventario. observedCategory describe lo que realmente ves en la candidata: un bloque de madera donde había un coche es other, nunca vehicle. identityAndGeometry=preserved solo si mantiene tipo/modelo/especie, cantidad, posición, orientación, huella y geometría (incluidas puertas y huecos del cerco). finish compara material/especie del terreno y cerramiento con la referencia: césped convertido en arena o tierra es changed, nunca una mejora de textura. Si hay una referencia de diseño aceptado adjunta, compara sus acabados, no los de la maqueta. Describe la evidencia y su ubicación; uncertain o una pérdida visible son fail aunque los booleanos globales indiquen true. not-visible exige que la referencia o máscara demuestre ocultación/fuera de cámara; un objeto visible en la referencia pero omitido en la candidata es fail, no not-visible.',
        ...(requiredExteriorIds.length ? [`En el plano cenital completo deben verse estas superficies, vehículos y tramos de cerco: ${requiredExteriorIds.join(', ')}. No aceptes not-visible para ellos. Las superficies con visibleInPlan=false están cubiertas por otras capas o elementos y pueden ser not-visible.`] : []),
        ...(vehicleCount ? [`El plano contiene ${vehicleCount} coches. Si son visibles en la imagen 1, en la imagen 2 deben seguir siendo coches reconocibles; nunca sofás u otros muebles.`] : []),
        ...(strictExterior ? ['El usuario pidió fidelidad estricta. Si el fondo exterior de la captura es liso o neutro, NO es terreno modelado: rechaza si el candidato lo sustituye por suelo, desierto, césped, árboles, arbustos, horizonte, cielo, aparcamiento o caminos nuevos. Mejorar texturas sobre objetos ya visibles sí está permitido.'] : []),
        ...(mask ? ['Fuera del blanco debe quedar fondo gris claro vacío. Rechaza si aparecen otras zonas del inmueble, mobiliario, terreno o construcciones.'] : []),
        'Rechaza decoración absurda aunque esté permitida: objetos sobre placas de cocina, fregaderos o inodoros; plantas sobre sillas, camas o electrodomésticos; muebles flotando, atravesando muros o tapando puertas o ventanas.',
        ...(spatial ? [renderSpatialRule(spatial.context, true, true),
          'Para cada openingCheck, referenceVisible indica si el hueco se ve en la imagen 1, independientemente de si aparece en la candidata. Si se ve en la referencia y desaparece en la candidata, es fail: nunca not-visible. No borres un fallo observado porque otro campo diga oculto. La estancia de una cámara interior y las estancias de una cenital completa deben aparecer en roomChecks como pass o fail, nunca not-visible.',
          ...(MAP_ORIENTATION[view.preset] ? [`ORIENTACIÓN DEL MAPA EN ESTA CÁMARA: ${MAP_ORIENTATION[view.preset]} Localiza cada estancia con esta correspondencia; no compares el orden izquierda-derecha del mapa sin girarlo.`] : []),
          'Evalúa cada id de estancia en roomChecks y cada id de hueco en openingChecks, exactamente una vez y sin omitir ninguno. Describe lo que ves en la candidata, no repitas la intención del prompt. Marca fail si su uso, dimensiones relativas o funcionamiento no coinciden. Usa not-visible solo cuando la captura/máscara demuestra que queda fuera de cámara u oculto, explicando el motivo; si es visible pero dudoso o borroso, fail.',
          'En openingChecks, observedKind describe lo observado en la IMAGEN CANDIDATA, sin copiar kind del plano. Una hoja marrón abierta cruzando un paso sigue siendo puerta: un hueco no tiene hoja ni bisagras. La hoja es una tabla rígida y recta: una hoja curva, doblada o un tablón que sigue el arco de giro es fail, porque el arco del plano es solo un símbolo. Una abatible partida en dos o más tramos, en V o en abanico, también es fail: es un único panel recto, salvo que type sea plegable. swingClear=clear solo cuando todo el barrido desde cerrada hasta su apertura queda libre de muebles (en una puerta de dos hojas, el de ambas; en una corredera o plegable según type, su slideClearance, sin exigir arco de giro). Una corredera o plegable puede verse cerrada, entreabierta o abierta aunque el plano la dibuje en otra posición: eso no es un defecto ni la convierte en abatible; solo falla si aparece con arco de giro o bisagras, o si un mueble ocupa su slideClearance. blocked si golpea un escritorio, armario o cama aunque el hueco frontal esté libre; uncertain si no puedes comprobarlo; not-applicable para ventanas y huecos, not-visible solo fuera de vista. Evalúa cada openAreas en openAreaChecks: rechaza puertas o tabiques interpuestos entre sus usos aunque no exista un opening en ese punto. Devuelve todos los ids exactamente una vez.',
          'Un Comedor amueblado como dormitorio y un Aseo convertido en otra estancia fallan aunque el resto de la casa se parezca. Un espacio con usos múltiples conserva las zonas nombradas sin desplazarlas. No aceptes una etiqueta copiada del mapa como prueba del uso real.',
        ] : ['No hay mapa adicional de estancias: devuelve roomChecks, openingChecks y openAreaChecks vacíos.']),
        'constructionCheck compara construcciones añadidas con las referencias: piscina nueva, pérgola, tabique o acceso no autorizado => fail, aunque esté dentro del perímetro de una terraza. Un patio vacío no es una piscina. La libertad decorativa y el rediseño de fijos NO autorizan construirla. Explica qué hay en la referencia y qué aparece en la candidata; uncertain si no puedes distinguirlo. Una piscina de una referencia de diseño aceptado adjunta sí pertenece al diseño. No trates esta revisión como permiso para añadirla.',
        'Comprueba por separado roomUsesPreserved, doorsPhysicallyCoherent, circulationPreserved y photorealistic. Una hoja rígida abierta tiene el mismo ancho que cuando cierra: rechaza hojas sobredimensionadas, marcos sin paso, puertas atravesando muros y pasillos estrechados o bloqueados. No certifiques centímetros a partir de píxeles; compara con las medidas y proporciones del plano.',
        'Exige acabado fotográfico nítido: rechaza puertas deformadas, muebles fundidos, sanitarios irreconocibles, materiales de maqueta, contornos confusos, bruma y cualquier rótulo, cota o línea técnica copiados de la guía. Una textura bonita no compensa un fallo de arquitectura o circulación.',
        `Devuelve criteria con exactamente estos ids, una vez cada uno: ${Object.keys(RENDER_FIDELITY_CRITERIA).join(', ')}. En cada observation cita evidencia visual concreta y su ubicación. No escribas solo que cumple, es coherente o respeta el prompt. Examina especialmente hojas partidas/duplicadas, bisagras separadas del marco, muebles translúcidos o fundidos y bordes borrosos. status=uncertain si no puedes comprobarlo; nunca conviertas una duda en pass. Para redesignApplied sin petición de rediseño usa pass y explica que no se solicitó. Los booleanos deben coincidir con los criterios.`,
        'No penalices diferencias normales de textura o decoración permitida. Ante duda sobre geometría o cámara, rechaza.',
        'accepted solo puede ser true si todos los controles son true, ningún elemento tiene status=fail y no hay violaciones. La aceptación final pertenece al usuario.',
      ].join('\n') },
      { type: 'image_url', base64: source.base64, mimeType: source.mimeType },
      { type: 'image_url', base64: output.base64, mimeType: output.mimeType },
      ...(area ? [{ type: 'image_url' as const, base64: area.base64, mimeType: area.mimeType }] : []),
      ...droneImages.map((image) => ({ type: 'image_url' as const, base64: image.base64, mimeType: image.mimeType })),
      ...details.map(image => ({ type: 'image_url' as const, base64: image.base64, mimeType: image.mimeType })),
      ...(guide ? [{ type: 'image_url' as const, base64: guide.base64, mimeType: guide.mimeType }] : []),
    ] }],
  });
  const report = validateRenderFidelity(result.structured, redesignRequested, spatial?.context, result.execution?.model,
    Boolean(view.cutaway) && ['front', 'back', 'left', 'right'].includes(view.preset),
    extra.sectionRooms?.map((room) => room.id) ?? (extra.reference === 'plan' && !mask || view.roomId
      ? spatial?.context.levels.flatMap(level => level.rooms.map(room => room.id)) : []), requiredExteriorIds,
    { fullPlan: extra.reference === 'plan' && !mask && !drone, acceptedDesign: Boolean(drone), redesignFixed: redesignFixed && !drone });
  if (!drone) return report;
  let identity;
  try {
    identity = await auditAcceptedDesignIdentity(chat, drone.identity, candidate, view,
      drone.interior ? 'interior' : drone.lateral ? 'lateral' : 'exterior',
      extra.sectionRooms?.map(room => room.name) ?? (view.roomId ? spatial?.context.levels.flatMap(level => level.rooms.map(room => room.name)) : []),
      { spatial: spatial?.context, architecture: drone.architecture, openingDepths: extra.openingDepths, acceptedBrief: extra.acceptedBrief });
  } catch (error) {
    // Los errores del proveedor conservan su clasificación y tratamiento de coste.
    if (error instanceof SyntaxError || error instanceof Error && error.name === 'ZodError')
      throw new IncompleteRenderReviewError('La comparación independiente del diseño aceptado no devolvió un informe completo.');
    throw error;
  }
  return applyAcceptedIdentityReview(report, identity);
}
