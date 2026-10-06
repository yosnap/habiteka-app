/**
 * Salidas de la fábrica en public/models/habiteka:
 *   <id>.glb y thumbs/<id>.webp   modelo optimizado y foto de producto de cada pieza
 *   manifest/<familia>.json       procedencia de la familia (autor, versión del generador, parámetros, acabados y
 *                                 fuente CC0 de cada textura). Un archivo por familia: dos familias pueden generarse a la
 *                                 vez sin pisarse.
 *   catalog.json                  registro de TODAS las familias que importa la app
 *                                 (src/lib/editor-document/habiteka-furniture.ts); se recompone en cada ejecución a partir
 *                                 de las especificaciones y de los manifiestos que hay en disco.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const OUT_DIR = fileURLToPath(new URL('../../public/models/habiteka/', import.meta.url));
export const THUMBS_DIR = fileURLToPath(new URL('../../public/models/habiteka/thumbs/', import.meta.url));
const MANIFEST_DIR = fileURLToPath(new URL('../../public/models/habiteka/manifest/', import.meta.url));
const REGISTRY = fileURLToPath(new URL('../../public/models/habiteka/catalog.json', import.meta.url));

export const AUTHOR = 'Habiteka (modelo propio)';
export const LICENSE = 'LicenseRef-Habiteka';

/** Escritura atómica: nunca deja un JSON a medias si otra ejecución lo lee a la vez. */
async function writeAtomic(file, text) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, text);
  await rename(temporary, file);
}

export async function readManifest(family) {
  const file = `${MANIFEST_DIR}${family}.json`;
  if (!existsSync(file)) return { models: {}, textures: {} };
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  return { models: manifest.models ?? {}, textures: manifest.textures ?? {} };
}

export async function writeManifest(family, manifest, generatorVersion) {
  await mkdir(MANIFEST_DIR, { recursive: true });
  const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
  await writeAtomic(`${MANIFEST_DIR}${family}.json`, `${JSON.stringify({
    _comment: `Muebles propios de Habiteka (familia ${family}) generados con scripts/build-furniture-factory.mjs (Blender). Geometría propia; texturas CC0 1.0 de Poly Haven y ambientCG con su procedencia.`,
    family, author: AUTHOR, license: LICENSE, generatorVersion, models: sorted(manifest.models), textures: sorted(manifest.textures),
  }, null, 1)}\n`);
}

/**
 * Variante inmediatamente más estrecha del mismo producto, con los mismos acabados y las mismas opciones no numéricas
 * (lado, estilo, módulo…): Amueblar la prueba cuando la elegida no cabe.
 */
function smallerVariant(piece, pieces) {
  const options = (item) => JSON.stringify(Object.entries(item.params).filter(([, value]) => typeof value !== 'number' && !Array.isArray(value)).sort());
  return pieces.filter((other) => other.productId === piece.productId && other.dims[0] < piece.dims[0] - 50
    && JSON.stringify(other.finishes) === JSON.stringify(piece.finishes) && options(other) === options(piece))
    .sort((a, b) => b.dims[0] - a.dims[0])[0]?.id;
}

/** Registro del catálogo en el orden de las especificaciones, solo con piezas generadas y con archivo. */
export async function writeRegistry(pieces, families) {
  const manifests = Object.fromEntries(await Promise.all(families.map(async (family) => [family, await readManifest(family)])));
  const built = (piece) => {
    const model = manifests[piece.family]?.models[piece.id];
    return model && existsSync(`${OUT_DIR}${model.file}`) && existsSync(`${OUT_DIR}${model.thumbnail}`) ? model : null;
  };
  const available = pieces.filter(built);
  const entries = available.flatMap((piece) => {
    const model = built(piece);
    const [widthMm, depthMm, heightMm] = model.dimensionsMm;
    return [{
      id: piece.id, productId: piece.productId, family: piece.family, label: piece.label, variantLabel: piece.variantLabel,
      room: piece.room, profile: piece.profile, style: piece.style, material: piece.material, color: piece.color,
      widthMm, depthMm, heightMm, file: model.file, thumbnail: model.thumbnail, sha256: model.sha256, proposal: piece.proposal,
      // Solo las piezas colgadas llevan elevación (cota medida de su hueco inferior); las demás van al suelo.
      ...(model.elevationMm > 0 ? { elevationMm: model.elevationMm } : {}),
      // Estados de cortinas y persianas: modelos que la app elige por medida y cobertura, fuera del catálogo.
      ...(piece.hidden ? { hidden: true } : {}),
      // Cota de la encimera o del borde de un lavabo o fregadero (la sección no dibuja el grifo).
      ...(piece.counterMm ? { counterMm: piece.counterMm } : {}),
      ...(smallerVariant(piece, available) ? { smaller: smallerVariant(piece, available) } : {}),
    }];
  });
  await writeAtomic(REGISTRY, `[\n${entries.map((entry) => ` ${JSON.stringify(entry)}`).join(',\n')}\n]\n`);
  return entries;
}
