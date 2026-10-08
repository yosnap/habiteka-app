/** Uso: bun --conditions=react-server scripts/reconstruction/prepare-draft.ts --visit ID --image image-2 --design archivo.json --out /ruta/privada */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prisma } from '../../src/server/db/prisma';
import { propertyVisitAcceptedFrames, propertyVisitAnchors, propertyVisitSourceDocument } from '../../src/server/walkthrough/property-visit-sources';
import type { PropertyVisitJob } from '../../src/lib/editor-document/property-visit-job';
import { getStorageAdapter } from '../../src/server/storage/s3-storage-adapter';
import { reconstructionGeometry, reconstructionMaterials, validateReconstruction } from './design-scene';
import type { MemberRole } from '../../src/server/auth/org-context';

const args = process.argv.slice(2);
function arg(name: string) { const index = args.indexOf(name); if (index < 0 || !args[index + 1]) throw new Error(`Falta ${name}`); return args[index + 1]!; }
try {
  const id = arg('--visit'), imageId = arg('--image'), out = resolve(arg('--out'));
  if (['public', 'docs'].some(dir => out === resolve(dir) || out.startsWith(resolve(dir) + '/'))) throw new Error('Usa una carpeta privada fuera de public y docs.');
  const row = await prisma.deliverable.findFirstOrThrow({ where: { id, deletedAt: null }, include: { project: true } });
  const job = row.payload as unknown as PropertyVisitJob;
  if (job.mode !== 'property-visit-ai' || row.project.deletedAt) throw new Error('Paseo no disponible.');
  const frame = job.images.find(image => image.id === imageId);
  if (!frame?.sourceId) throw new Error('Falta el encuadre aceptado.');
  const source = await prisma.deliverable.findUniqueOrThrow({ where: { id: frame.sourceId } });
  const acceptance = (source.payload as { generation?: { acceptance?: { userId?: string } } }).generation?.acceptance;
  if (!acceptance?.userId) throw new Error('El encuadre necesita aceptación humana.');
  // CLI local de solo lectura: conserva el actor de aceptación; no crea sesión ni escribe decisiones.
  const member = await prisma.member.findFirstOrThrow({ where: { organizationId: row.project.organizationId, userId: acceptance.userId } });
  if (!['owner', 'admin', 'member'].includes(member.role)) throw new Error('Miembro sin rol compatible.');
  const ctx = { organizationId: row.project.organizationId, userId: acceptance.userId, role: member.role as MemberRole };
  const scope = { projectId: row.projectId, zoneId: row.zoneId };
  const frames = await propertyVisitAcceptedFrames(ctx, scope, id, job, [imageId]);
  const anchors = await propertyVisitAnchors(ctx, scope, job), document = await propertyVisitSourceDocument(ctx, scope, job);
  const refs = [...anchors, ...frames];
  const design = validateReconstruction(JSON.parse(await readFile(arg('--design'), 'utf8')), refs.map(ref => ref.id));
  const meshes = reconstructionGeometry(document, design), materials = reconstructionMaterials(design);
  await mkdir(out, { recursive: true });
  const references = [];
  for (const [index, ref] of refs.entries()) {
    const payload = ref.payload as { assetKey?: string };
    if (!payload.assetKey) throw new Error('La referencia no tiene archivo interno.');
    const path = resolve(out, `reference-${index + 1}.png`);
    await writeFile(path, await getStorageAdapter().get(payload.assetKey));
    references.push({ id: ref.id, path, ...(Object.hasOwn(ref, 'version') ? { version: (ref as { version: number }).version } : {}) });
  }
  const packet = { purpose: 'reconstruction-draft', eligibleForFinalVideo: false, approvalId: job.approvalId,
    approvedRevision: job.approvedRevision, approvedFingerprint: job.approvedFingerprint, references,
    camera: frame.frame.camera, meshes, materials, objects: design.objects, unresolved: design.unresolved,
    publicDir: resolve('public'), outDir: out };
  await writeFile(resolve(out, 'scene.json'), JSON.stringify(packet));
  console.log(JSON.stringify({ output: resolve(out, 'scene.json'), meshes: meshes.length, objects: design.objects.length,
    references: references.length, finalEligible: false, paidCalls: 0 }));
} finally { await prisma.$disconnect(); }
