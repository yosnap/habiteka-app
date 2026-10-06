import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, ChatVisionAdapter } from '@/lib/contracts';
import type { RenderView } from '@/lib/editor-document/render-view';
import { assertRenderFidelity } from '@/server/agent/editor-v2/render-fidelity-audit';
import sharp from 'sharp';
import type { RenderSpatialContext } from '@/server/agent/editor-v2/render-spatial-context';
import { RENDER_FIDELITY_CRITERIA } from '@/lib/editor-document/render-fidelity';
import { reviewRenderFidelity } from '@/server/agent/editor-v2/review-render-fidelity';

const image = { base64: (await sharp({ create: { width: 12, height: 8, channels: 3,
  background: '#888' } }).png().toBuffer()).toString('base64'), mimeType: 'image/png' };
const view = { preset: 'front' } as RenderView;
const adapter = (verdict: Record<string, unknown>) => {
  const structured = { redesignApplied: true, roomUsesPreserved: true, doorsPhysicallyCoherent: true,
    circulationPreserved: true, photorealistic: true, roomChecks: [], openingChecks: [],
    openAreaChecks: [], constructionCheck: { status: 'pass', observation: 'Sin construcciones nuevas respecto a la captura' },
    criteria: Object.keys(RENDER_FIDELITY_CRITERIA).map(id => ({ id, status: 'pass', observation: 'Detalle visible en la imagen de prueba' })), ...verdict };
  const chat = vi.fn(async (request: ChatRequest) => {
    void request;
    return { structured, content: '', usage: { inputTokens: 0, outputTokens: 0 } };
  });
  return { chat, chatStream: vi.fn() } as unknown as ChatVisionAdapter & { chat: typeof chat };
};

describe('auditoría de fidelidad del diseño', () => {
  it('no descarta una corredera por verse cerrada si el plano la dibuja abierta', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] });
    const context: RenderSpatialContext = { units: 'mm', levels: [{ id: 'ground', name: 'Planta', rooms: [], openings: [] }] };
    await assertRenderFidelity(vision, image, image, { ...view, preset: 'top' }, undefined, 0, false, undefined, false, false,
      { context, image }, { reference: 'plan' }).catch(() => undefined);
    const text = (vision.chat.mock.calls[0]![0].messages[0]!.content[0] as { text: string }).text;
    expect(text).toMatch(/corredera o plegable puede verse cerrada, entreabierta o abierta[^.]*no es un defecto/);
  });
  it('rechaza hojas curvas y deja respuesta para revisar cada estancia y hueco', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] });
    const openings = Array.from({ length: 30 }, (_, index) => ({ id: `L1-O${index + 1}`, kind: 'ventana', center: { x: index * 100, y: 0 }, widthMm: 900, heightMm: 1200 }));
    const rooms = Array.from({ length: 11 }, (_, index) => ({ id: `L1-R${index + 1}`, name: 'Estancia', anchor: { x: index * 100, y: 500 } }));
    const context = { units: 'mm', levels: [{ id: 'ground', name: 'Planta', rooms, openings }] } as unknown as RenderSpatialContext;
    await assertRenderFidelity(vision, image, image, { ...view, preset: 'top' }, undefined, 0, false, undefined, false, false,
      { context, image }, { reference: 'plan' }).catch(() => undefined);
    const request = vision.chat.mock.calls[0]![0];
    expect((request.messages[0]!.content[0] as { text: string }).text).toMatch(/hoja curva, doblada o un tablón que sigue el arco de giro es fail[^]*partida en dos o más tramos, en V/);
    // Con 41 comprobaciones la respuesta se cortaba con el presupuesto anterior (6000 + exterior + sanitarios).
    expect(request.maxTokens).toBeGreaterThanOrEqual(6000 + 41 * 110);
  });
  it('distingue elementos ocultos por cámara de pérdidas de identidad', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] });
    await assertRenderFidelity(vision, image, image, { ...view, cutaway: true, ceilingView: 'hidden',
      cutawayObjectIds: ['cortina-frontal'] });
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content[0]).toMatchObject({ text: expect.stringContaining('No los reconstruyas') });
    expect(content[0]).toMatchObject({ text: expect.stringContaining('CORTE DE FACHADA') });
    expect(content[0]).toMatchObject({ text: expect.stringContaining('cortina-frontal') });
  });
  it('compara los laterales con el interiorismo de la cenital aceptada', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] });
    await assertRenderFidelity(vision, image, image, view, undefined, 0, false, { identity: image, lateral: true });
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    const text = (content[0] as { text: string }).text;
    expect(text).toContain('CENITAL ACEPTADA');
    expect(text).toContain('objectIdentityPreserved=fail');
    expect(text).toContain('debe verse por detrás');
    expect(text).toContain('Los muebles no pueden sustituirse');
    expect(text).not.toContain('Los muebles móviles pueden sustituirse');
    expect(text).not.toContain('La casa está aislada');
    expect(content.filter(part => part.type === 'image_url')).toHaveLength(3);
  });
  it('identifica el plano 2D como referencia de la cenital', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] });
    await assertRenderFidelity(vision, image, image, { ...view, preset: 'top' }, undefined, 0, false, undefined, false, false,
      undefined, { reference: 'plan' });
    const text = (vision.chat.mock.calls[0]![0].messages[0]!.content[0] as { text: string }).text;
    expect(text).toContain('Imagen 1: plano 2D del proyecto en vista cenital');
    expect(text).not.toContain('captura original del 3D');
  });
  it('identifica la sección 2D y admite las personas pedidas', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] });
    await assertRenderFidelity(vision, image, image, view, undefined, 0, false, undefined, false, false, undefined,
      { reference: 'section', people: true, sectionRooms: [{ id: 'L1-R1', name: 'Comedor' }, { id: 'L1-R2', name: 'Salón' }] });
    const text = (vision.chat.mock.calls[0]![0].messages[0]!.content[0] as { text: string }).text;
    expect(text).toContain('Imagen 1: sección 2D del proyecto');
    expect(text).toContain('de izquierda a derecha: L1-R1 Comedor, L1-R2 Salón');
    expect(text).toContain('roomChecks sigue incluyendo todas las estancias del plano');
    expect(text).toContain('El usuario pidió personas');
  });
  it('indica cómo se ve girado el mapa de estancias desde la trasera', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] });
    const context: RenderSpatialContext = { units: 'mm', levels: [] };
    await assertRenderFidelity(vision, image, image, { ...view, preset: 'back' }, undefined, 0, false, undefined, false, false,
      { context, image });
    const text = (vision.chat.mock.calls[0]![0].messages[0]!.content[0] as { text: string }).text;
    expect(text).toContain('ORIENTACIÓN DEL MAPA EN ESTA CÁMARA');
    expect(text).toContain('la izquierda de la imagen corresponde a la derecha del mapa');
  });
  it('solo relaja fijos cuando existe permiso explícito, manteniendo geometría protegida', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, redesignApplied: true, violations: [] });
    await assertRenderFidelity(vision, image, image, view, undefined, 0, false, undefined, true);
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content[0]).toMatchObject({ text: expect.stringContaining('REDISEÑO DE FIJOS') });
    expect(content[0]).toMatchObject({ text: expect.stringContaining('muros, huecos, instalaciones, usos y accesos siguen protegidos') });
    expect(content[0]).not.toMatchObject({ text: expect.stringContaining('FIJOS PROTEGIDOS') });
  });
  it('rechaza una copia del mobiliario cuando se pidió un rediseño, aunque la cámara sea fiel', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, redesignApplied: false, violations: [] });
    await expect(assertRenderFidelity(vision, image, image, view, undefined, 0, false, undefined, false, true))
      .rejects.toThrow('no se aplicó el rediseño solicitado');
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content[0]).toMatchObject({ text: expect.stringContaining('REDISEÑO REAL') });
  });
  it('falla cerrado si no se pudo evaluar el rediseño solicitado', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, redesignApplied: undefined, violations: [] });
    await expect(assertRenderFidelity(vision, image, image, view, undefined, 0, false, undefined, true))
      .rejects.toThrow('No se pudo verificar la fidelidad');
  });
  it('acepta un resultado fiel y adjunta la máscara después de las dos imágenes', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true,
      objectIdentityPreserved: true, violations: [] });
    await expect(assertRenderFidelity(vision, image, image, view, image, 3)).resolves.toMatchObject({ status: 'passed' });
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content.filter((part) => part.type === 'image_url')).toHaveLength(3);
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('front') });
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('3 coches') });
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('rechaza huecos nuevos entre tramos') });
    expect(content[1]).toMatchObject({ type: 'image_url', mimeType: 'image/jpeg' });
  });

  it('rechaza una arquitectura duplicada y no la publica', async () => {
    const vision = adapter({ accepted: false, cameraAndGeometryPreserved: false,
      objectIdentityPreserved: true, violations: ['otra casa superpuesta'] });
    await expect(assertRenderFidelity(vision, image, image, view)).rejects.toThrow('otra casa superpuesta');
  });

  it('rechaza la sustitución de coches por sofás aunque el modelo marque accepted', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true,
      objectIdentityPreserved: false, violations: [] });
    await expect(assertRenderFidelity(vision, image, image, view, undefined, 3))
      .rejects.toThrow('objetos reconocibles sustituidos');
  });

  it('exige auditar el paisaje inventado cuando el exterior es estricto', async () => {
    const vision = adapter({ accepted: false, cameraAndGeometryPreserved: false,
      objectIdentityPreserved: true, violations: ['terreno y árboles inexistentes'] });
    await expect(assertRenderFidelity(vision, image, image, view, undefined, 0, true))
      .rejects.toThrow('terreno y árboles inexistentes');
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('El usuario pidió fidelidad estricta') });
  });

  it('falla cerrado si la respuesta no se puede validar', async () => {
    const vision = adapter({ accepted: true });
    await expect(assertRenderFidelity(vision, image, image, view)).rejects.toThrow('No se pudo verificar la fidelidad');
  });
  it('audita el volumen e identidad contra la vista cercana y el entorno contra la ortofoto', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] });
    await assertRenderFidelity(vision, image, image, view, undefined, 0, false, { identity: image, environment: image });
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content.filter((part) => part.type === 'image_url')).toHaveLength(4);
    expect(content[0]).toMatchObject({ text: expect.stringContaining('pérgolas') });
    expect(content[0]).toMatchObject({ text: expect.stringContaining('ortofoto real') });
  });

  it.each([
    ['roomUsesPreserved', 'uso de las estancias'], ['doorsPhysicallyCoherent', 'puertas o huecos'],
    ['circulationPreserved', 'pasos estrechados'], ['photorealistic', 'realismo suficiente'],
  ])('rechaza %s aunque la evaluación global sea favorable', async (field, reason) => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [], [field]: false });
    await expect(assertRenderFidelity(vision, image, image, view)).rejects.toThrow(reason);
  });

  const context: RenderSpatialContext = { units: 'mm', levels: [{ id: 'ground', name: 'Planta',
    rooms: [{ id: 'R1', name: 'Comedor', anchor: { x: 2000, y: 1000 } }],
    openings: [{ id: 'O1', kind: 'puerta', center: { x: 1000, y: 0 }, widthMm: 800, leafWidthMm: 710, heightMm: 2100 }] }] };
  const checks = { roomChecks: [{ id: 'R1', status: 'pass', observation: 'Mesa con sillas dentro del comedor' }],
    openingChecks: [{ id: 'O1', status: 'pass', observation: 'Hoja proporcionada al vano', observedKind: 'puerta', swingClear: 'clear' }] };
  const approved = { accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] };
  const audit = (vision: ChatVisionAdapter) => assertRenderFidelity(vision, image, image, view, undefined, 0, false, undefined, false, false, { context, image });

  it('envía la misma guía y medidas, y exige observaciones por estancia y hueco', async () => {
    const vision = adapter({ ...approved, ...checks });
    await expect(audit(vision)).resolves.toMatchObject({ status: 'passed', ...checks });
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content.filter(part => part.type === 'image_url')).toHaveLength(3);
    expect(content[0]).toMatchObject({ text: expect.stringContaining('Comedor') });
    expect(content[0]).toMatchObject({ text: expect.stringContaining('"leafWidthMm":710') });
  });
  it('rechaza una cama en Comedor aunque todos los indicadores globales digan sí', async () => {
    await expect(audit(adapter({ ...approved, ...checks,
      roomChecks: [{ id: 'R1', status: 'fail', observation: 'Cama donde el plano sitúa el Comedor' }] })))
      .rejects.toThrow('Cama donde el plano sitúa el Comedor');
  });
  it.each([
    { ...checks, roomChecks: [] }, { ...checks, openingChecks: [] },
    { ...checks, roomChecks: [checks.roomChecks[0], checks.roomChecks[0]] },
    { ...checks, openingChecks: [{ ...checks.openingChecks[0], id: 'otro' }] },
  ])('no guarda una revisión incompleta o con identificadores ajenos', async (incomplete) => {
    await expect(audit(adapter({ ...approved, ...incomplete }))).rejects.toThrow('no comprobó todas las estancias');
  });
  it('no admite un informe antiguo que no evalúa realismo', async () => {
    await expect(audit(adapter({ ...approved, ...checks, photorealistic: undefined })))
      .rejects.toThrow('No se pudo verificar la fidelidad');
  });
  it('conserva la evidencia de un descarte y no lo convierte en aceptación', async () => {
    const vision = adapter({ ...approved, photorealistic: false, violations: ['Hoja partida en el acceso al salón'] });
    const result = await reviewRenderFidelity(vision, image, image, view);
    expect(result).toMatchObject({ review: { status: 'rejected' }, fidelity: { status: 'rejected',
      criteria: expect.arrayContaining([{ id: 'photorealistic', status: 'fail', observation: expect.any(String) }]),
      violations: expect.arrayContaining(['Hoja partida en el acceso al salón']) } });
  });
  it.each(['uncertain', 'fail'])('una evidencia %s no se oculta con un aprobado global', async status => {
    const criteria = Object.keys(RENDER_FIDELITY_CRITERIA).map(id => ({ id, status: id === 'photorealistic' ? status : 'pass', observation: 'Sillas fundidas con la mesa del comedor' }));
    await expect(assertRenderFidelity(adapter({ ...approved, criteria }), image, image, view)).rejects.toThrow('Sillas fundidas');
  });
  it('exige criterios completos, sin repetidos', async () => {
    const criteria = Object.keys(RENDER_FIDELITY_CRITERIA).map(() => ({ id: 'photorealistic', status: 'pass', observation: 'Nítida' }));
    await expect(assertRenderFidelity(adapter({ ...approved, criteria }), image, image, view)).rejects.toThrow('todos los criterios');
  });
  it('no oculta una auditoría incompleta al guardar descartes', async () => {
    await expect(reviewRenderFidelity(adapter({ ...approved, criteria: undefined }), image, image, view)).rejects.toThrow('No se pudo verificar');
  });

  it('rechaza la hoja inventada en un paso sin puerta aunque el auditor marque pass', async () => {
    const withoutDoor = structuredClone(context);
    withoutDoor.levels[0]!.openings[0]!.kind = 'hueco';
    const result = await reviewRenderFidelity(adapter({ ...approved, ...checks }), image, image, view,
      undefined, 0, false, undefined, false, false, { context: withoutDoor, image });
    expect(result.fidelity).toMatchObject({ status: 'rejected', openingChecks: [{ status: 'fail' }],
      criteria: expect.arrayContaining([expect.objectContaining({ id: 'doorsPhysicallyCoherent', status: 'fail' })]) });
    expect(result.fidelity.openingChecks[0]!.observation).toContain('un paso sin puerta');
  });
  it.each(['blocked', 'uncertain', 'not-applicable'])('rechaza el giro %s aunque el paso frontal esté libre', async swingClear => {
    const vision = adapter({ ...approved, ...checks,
      openingChecks: [{ ...checks.openingChecks[0], swingClear, observation: 'Escritorio detrás de la hoja' }] });
    await expect(audit(vision)).rejects.toThrow('barrido');
  });
  it('admite un paso sin hoja y sin giro de puerta', async () => {
    const withoutDoor = structuredClone(context);
    withoutDoor.levels[0]!.openings[0]!.kind = 'hueco';
    const vision = adapter({ ...approved, ...checks, openingChecks: [{ ...checks.openingChecks[0],
      observedKind: 'hueco', swingClear: 'not-applicable', observation: 'Vano vacío sin hoja' }] });
    await expect(assertRenderFidelity(vision, image, image, view, undefined, 0, false, undefined, false, false,
      { context: withoutDoor, image })).resolves.toMatchObject({ status: 'passed' });
  });
  it('exige revisar el espacio compartido sin opening y rechaza la puerta inventada', async () => {
    const shared = structuredClone(context);
    shared.levels[0]!.openAreas = [{ id: 'A1', roomIds: ['R1', 'R2'], names: ['Pasillo', 'Lavadero'] }];
    const run = (extra: Record<string, unknown>) => assertRenderFidelity(adapter({ ...approved, ...checks, ...extra }),
      image, image, view, undefined, 0, false, undefined, false, false, { context: shared, image });
    await expect(run({})).rejects.toThrow('no comprobó todas');
    await expect(run({ openAreaChecks: [{ id: 'A1', status: 'fail', observation: 'Hoja nueva al entrar al lavadero' }] }))
      .rejects.toThrow('lavadero');
  });
  it.each(['fail', 'uncertain'])('una piscina añadida con estado %s impide aprobar la arquitectura', async status => {
    const result = await reviewRenderFidelity(adapter({ ...approved,
      constructionCheck: { status, observation: 'Piscina en una terraza que no la contiene en la referencia' } }), image, image, view);
    expect(result.fidelity).toMatchObject({ status: 'rejected', constructionCheck: { status },
      criteria: expect.arrayContaining([expect.objectContaining({ id: 'cameraAndGeometryPreserved', status: 'fail' })]) });
  });
});
