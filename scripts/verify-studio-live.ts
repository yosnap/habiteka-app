/** Prueba real opt-in: usa los adaptadores configurados; genera dos imágenes facturables. */
import { mkdir, writeFile } from 'node:fs/promises';
import { BUILTIN_TEMPLATES } from '../src/canvas/templates';
import { serializeDocToPrompt } from '../src/canvas/serialize-doc-to-prompt';
import { rasterizeCanvasDoc } from '../src/server/agent/canvas/rasterize-canvas-doc';
import { generateCenitalFromImage } from '../src/server/ai/design/cenital-pipeline';
import { redrawPlan } from '../src/server/ai/design/redraw-plan-pipeline';
import { getChatVisionAdapter, getImageAdapterForAction } from '../src/server/ai';
import { extractSketchGeometry } from '../src/server/ai/sketch/extract-sketch-geometry';
import { normalizeSketch } from '../src/server/ai/sketch/normalize-geometry';
import { detectWallsFromImage } from '../src/server/plan/detect-walls-raster';
import { planoToSvg } from '../src/lib/plan-svg/geometry-to-svg';
import { readStudioImage } from '../src/server/plan/studio-image';
import { prisma } from '../src/server/db/prisma';
import {
  ProviderImageAdapter,
  createActiveProvider,
} from '../src/server/ai/image/provider-image-adapter';

const projectId = process.argv[2];
if (!projectId) throw new Error('Uso: bun scripts/verify-studio-live.ts <projectId>');
const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
const context = { organizationId: project.organizationId };
const model = process.argv[3];
const output = `plans/reports/studio-live-260908${model ? '-' + model.replace(/[^a-z0-9-]/gi, '-') : ''}`;
await mkdir(output, { recursive: true });
const doc = BUILTIN_TEMPLATES.find((t) => t.id === 'salon-comedor')!.doc;
const raster = await rasterizeCanvasDoc(doc);
await writeFile(`${output}/canvas.png`, Buffer.from(raster.base64, 'base64'));
const image = model
  ? new ProviderImageAdapter(createActiveProvider(model))
  : await getImageAdapterForAction(context, 'render3d');
const started = Date.now();
const cenital = await generateCenitalFromImage(
  { image },
  raster,
  'moderno',
  '',
  serializeDocToPrompt(doc) ?? undefined,
);
const cenitalBytes = await readStudioImage(cenital);
await writeFile(`${output}/canvas-cenital.png`, Buffer.from(cenitalBytes.base64, 'base64'));
console.log(`Canvas → cenital: ${Math.round((Date.now() - started) / 1000)} s`);
const redrawn = await redrawPlan({ image }, raster);
const source = await readStudioImage(redrawn);
await writeFile(`${output}/redrawn.png`, Buffer.from(source.base64, 'base64'));
const chat = await getChatVisionAdapter(context, 'vision');
const raw = await extractSketchGeometry(chat, [
  { type: 'image_url', base64: source.base64, mimeType: source.mimeType },
]);
const detected = await detectWallsFromImage(Buffer.from(source.base64, 'base64'));
const plano = normalizeSketch(raw, {
  wallsOverride: detected.walls,
  imageHeightOverWidth: detected.heightOverWidth,
});
await writeFile(
  `${output}/editable.svg`,
  planoToSvg(plano, { showDimensions: false, showLabels: false }),
);
await writeFile(`${output}/geometry.json`, JSON.stringify(plano, null, 2));
console.log(
  `Plano → editable: ${plano.zones.length} zonas, ${plano.zones.flatMap((z) => z.walls).length} muros`,
);
await prisma.$disconnect();
