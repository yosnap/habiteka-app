import 'server-only';
import { prisma } from '@/server/db/prisma';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { neutralizeInstruction } from '@/server/quality/evidence/instruction-evidence';
import { spatialOpenings } from '../editor-v2/spatial-opening-geometry';
import { spatialOpenAreas, spatialPools } from '../editor-v2/render-spatial-context';

type Payload = Record<string, unknown>;
const record = (value: unknown): Payload => value && typeof value === 'object' && !Array.isArray(value) ? value as Payload : {};

/** Recupera también la referencia de versiones antiguas que perdieron sus metadatos. */
export async function loadDesignPlanContext(organizationId: string, projectId: string, deliverableId: string) {
  const original = await prisma.deliverable.findFirst({
    where: { id: deliverableId, projectId, deletedAt: null, project: { organizationId } },
    select: { id: true, payload: true, zoneId: true },
  });
  if (!original) return null;
  let source = original, payload = record(source.payload);
  const visited = new Set<string>();
  while (!payload.generation && !visited.has(source.id) && visited.size < 20) {
    visited.add(source.id);
    const iteration = await prisma.iteration.findFirst({ where: { resultRef: source.id,
      deliverable: { projectId, project: { organizationId } } }, orderBy: { createdAt: 'desc' }, select: { deliverableId: true } });
    if (!iteration) break;
    const parent = await prisma.deliverable.findFirst({ where: { id: iteration.deliverableId, projectId,
      deletedAt: null, project: { organizationId } }, select: { id: true, payload: true, zoneId: true } });
    if (!parent) break;
    source = parent; payload = record(source.payload);
  }
  const generation = record(payload.generation);
  const revision = typeof generation.documentRevision === 'number' ? generation.documentRevision : null;
  const state = await prisma.editorDocumentState.findFirst({ where: { projectId, zoneId: original.zoneId,
    project: { organizationId } }, select: { id: true, headRevision: true } });
  if (!state) return null;
  const row = await prisma.editorDocumentRevision.findUnique({
    where: { stateId_revision: { stateId: state.id, revision: revision ?? state.headRevision } }, select: { document: true },
  });
  if (!row) return null;
  const document = row.document as unknown as EditorDocument;
  const levelId = record(generation.view).levelId;
  const level = typeof levelId === 'string' ? buildingDocuments(document).find((entry) => entry.id === levelId)?.document : document;
  if (!level) return null;
  return { plan: designPlanContext(level),
    source: revision === null ? 'current-editor' : 'generation-revision',
    documentRevision: revision ?? state.headRevision,
    ...(payload.camera ? { camera: payload.camera } : {}),
    ...(payload.generation ? { generation: payload.generation } : {}) };
}

/** Datos espaciales, nunca órdenes del usuario; las coordenadas pertenecen al plano, no a píxeles. */
export function designPlanContext(document: EditorDocument) {
  const rooms = deriveRoomsSafe(document);
  const entries = document.labels.slice(0, 100).filter((label) => Number.isFinite(label.x) && Number.isFinite(label.y)).map((label, index) => {
      const room = rooms.find((room) => pointInPolygon(label, room.boundary));
      return { id: `L1-R${index + 1}`, name: neutralizeInstruction(label.text.slice(0, 100)).text, x: label.x, y: label.y,
        ...(room ? { boundary: room.boundary.map(({ x, y }) => ({ x, y })) } : {}) };
    });
  return { units: 'mm', coordinateSystem: 'floor-plan coordinates, not image pixels', rooms: entries,
    openings: spatialOpenings(document, 'L1'), pools: spatialPools(document),
    openAreas: spatialOpenAreas(entries.map(room => ({ ...room, anchor: { x: room.x, y: room.y } })), 'L1') };
}
