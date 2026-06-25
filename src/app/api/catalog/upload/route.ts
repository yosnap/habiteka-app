/**
 * POST /api/catalog/upload
 *
 * Sube un item custom al catálogo de la organización.
 * Body: multipart/form-data con los campos:
 *   name       string
 *   category   string
 *   family     string (opcional)
 *   widthM     number (metros)
 *   depthM     number (metros)
 *   heightM    number (metros, default 0)
 *   thumbnail  File  (JPG o PNG, máx 5 MB)
 *   model      File  (GLB, opcional, máx 25 MB)
 *
 * Validaciones servidor:
 *   - thumbnail: content-type image/jpeg|image/png
 *   - model: magic bytes glTF (0x676C5446), máx 25 MB
 *   - rate limit: 10 uploads/org/hora
 *   - org_id: siempre del JWT, nunca del body
 */
import { NextResponse } from 'next/server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { prisma } from '@/server/db/prisma';
import { uploadBuffer } from '@/server/storage/client';

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_GLB_BYTES = 25 * 1024 * 1024;         // 25 MB
const RATE_LIMIT_PER_HOUR = 10;
const GLB_MAGIC = Buffer.from([0x67, 0x6c, 0x54, 0x46]); // "glTF"

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40);
}

export async function POST(request: Request) {
  const ctx = await requireOrgContext();

  // ── Rate limit ────────────────────────────────────────────────────────────
  const oneHourAgo = new Date(Date.now() - 3600_000);
  const recentCount = await prisma.catalogItem.count({
    where: {
      organizationId: ctx.organizationId,
      source: 'custom',
      createdAt: { gte: oneHourAgo },
      deletedAt: null,
    },
  });
  if (recentCount >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: 'Límite de uploads alcanzado (10 por hora). Inténtalo más tarde.' },
      { status: 429 },
    );
  }

  // ── Parse multipart ───────────────────────────────────────────────────────
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Body no es multipart/form-data válido.' }, { status: 400 });
  }

  const name = (form.get('name') as string | null)?.trim();
  const category = (form.get('category') as string | null)?.trim();
  const family = (form.get('family') as string | null)?.trim() || undefined;
  const widthM = parseFloat(form.get('widthM') as string);
  const depthM = parseFloat(form.get('depthM') as string);
  const heightM = parseFloat((form.get('heightM') as string) ?? '0') || 0;
  const thumbnailFile = form.get('thumbnail') as File | null;
  const modelFile = form.get('model') as File | null;

  if (!name || !category || isNaN(widthM) || isNaN(depthM) || !thumbnailFile) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: name, category, widthM, depthM, thumbnail.' },
      { status: 400 },
    );
  }

  // ── Validar thumbnail ─────────────────────────────────────────────────────
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(thumbnailFile.type)) {
    return NextResponse.json(
      { error: 'La miniatura debe ser JPG, PNG o WebP.' },
      { status: 400 },
    );
  }
  if (thumbnailFile.size > MAX_THUMBNAIL_BYTES) {
    return NextResponse.json(
      { error: 'La miniatura no puede superar 5 MB.' },
      { status: 400 },
    );
  }

  // ── Validar GLB si se proporcionó ─────────────────────────────────────────
  let glbBuffer: Buffer | undefined;
  if (modelFile && modelFile.size > 0) {
    if (modelFile.size > MAX_GLB_BYTES) {
      return NextResponse.json({ error: 'El modelo GLB no puede superar 25 MB.' }, { status: 400 });
    }
    glbBuffer = Buffer.from(await modelFile.arrayBuffer());
    // Verificar magic bytes glTF
    if (!glbBuffer.subarray(0, 4).equals(GLB_MAGIC)) {
      return NextResponse.json(
        { error: 'El archivo de modelo no es un GLB válido (magic bytes incorrectos).' },
        { status: 400 },
      );
    }
  }

  // ── Crear item en BD (obtener id primero) ─────────────────────────────────
  const kind = `custom_${slugify(name)}_${Date.now()}`;
  const ext = thumbnailFile.type === 'image/png' ? 'png' : thumbnailFile.type === 'image/webp' ? 'webp' : 'jpg';
  const base = `orgs/${ctx.organizationId}/catalog/${kind}`;
  const thumbnailKey = `${base}/thumbnail.${ext}`;
  const modelKey = glbBuffer ? `${base}/model.glb` : undefined;

  // ── Subir a storage ────────────────────────────────────────────────────────
  const thumbBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
  try {
    await uploadBuffer(thumbnailKey, thumbBuffer, thumbnailFile.type);
    if (glbBuffer && modelKey) {
      await uploadBuffer(modelKey, glbBuffer, 'model/gltf-binary');
    }
  } catch {
    return NextResponse.json(
      { error: 'Error al subir los archivos al storage. Revisa la configuración STORAGE_*.' },
      { status: 502 },
    );
  }

  // ── Insertar en BD ────────────────────────────────────────────────────────
  const item = await prisma.catalogItem.create({
    data: {
      organizationId: ctx.organizationId,
      kind,
      label: name,
      source: 'custom',
      category,
      family,
      thumbnailKey,
      modelKey,
      widthM,
      depthM,
      heightM,
      tags: [],
    },
  });

  return NextResponse.json({
    id: item.id,
    kind: item.kind,
    label: item.label,
    category: item.category,
    family: item.family,
    thumbnailKey: item.thumbnailKey,
    modelKey: item.modelKey,
    widthM: item.widthM,
    depthM: item.depthM,
    heightM: item.heightM,
  });
}
