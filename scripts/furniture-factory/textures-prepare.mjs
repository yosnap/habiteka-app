/**
 * Prepara las texturas CC0 de cada acabado para Blender: descarga (con caché) desde Poly Haven o ambientCG, extrae la
 * rugosidad y, en los acabados teñibles, lleva el mapa de color al tono del acabado conservando la trama.
 * Las texturas con `alpha: true` (atlas de hojas) entregan el color como PNG RGBA con la opacidad en el canal alfa.
 */
import { existsSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { cc0Material } from '../lib/cc0-sources.mjs';

const downloads = new Map();

function sourceOf(key, library) {
  if (!downloads.has(key)) {
    const texture = library.textures[key];
    downloads.set(key, cc0Material(texture.source, texture.id, { alpha: Boolean(texture.alpha) }));
  }
  return downloads.get(key);
}

const rgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));

/** Pasa el color a gris y lo desplaza al tono pedido, conservando el 75 % del contraste de la trama. */
async function tint(buffer, hex) {
  const { data, info } = await sharp(buffer).greyscale().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height, stride = info.channels, contrast = .75;
  let sum = 0;
  for (let i = 0; i < pixels; i++) sum += data[i * stride];
  const mean = sum / pixels, target = rgb(hex), out = Buffer.alloc(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    const delta = (data[i * stride] - mean) * contrast;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.max(0, Math.min(255, Math.round(target[c] + delta)));
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
}

/** Provenance de una textura para el manifiesto. */
export async function textureProvenance(key, library) {
  const texture = library.textures[key], material = await sourceOf(key, library);
  return {
    source: texture.source, id: texture.id, title: material.title, authors: material.authors, pageUrl: material.pageUrl,
    license: 'CC0-1.0', sizeMm: material.dimensionsMm?.[0] ?? texture.tileMm, downloads: material.downloads,
  };
}

/** Acabado listo para Blender (rutas absolutas de mapas, tamaño real de la muestra y valores PBR). */
export async function resolveFinish(name, workDir, library) {
  const finish = library.finishes[name];
  if (!finish) throw new Error(`Acabado desconocido: ${name}`);
  const base = { roughness: finish.roughness, metallic: finish.metallic, sheen: finish.sheen, coat: finish.coat };
  if (!finish.texture) return { kind: finish.kind, color: finish.color, ...base };
  const texture = library.textures[finish.texture], material = await sourceOf(finish.texture, library);
  const tinted = texture.tint && finish.color;
  const tileMm = texture.scaleMm ?? material.dimensionsMm?.[0] ?? texture.tileMm;
  // La resolución se mide por muestra repetida: una tela de 27 cm a 768 px ya da casi 3 px/mm; maderas y mármoles,
  // con muestras de 1 m o más, conservan 1024 px.
  const px = texture.px ?? (tileMm < 600 ? 768 : 1024);
  // La ruta incluye la fuente y el recurso: cambiar el id de una textura con la misma clave no reutiliza mapas viejos.
  const dir = path.join(workDir, 'textures', finish.texture, `${texture.source}-${texture.id}`, `${tinted ? finish.color.slice(1) : 'base'}-${px}`);
  const alpha = Boolean(texture.alpha);
  const maps = { color: path.join(dir, alpha ? 'color.png' : 'color.jpg'), normal: path.join(dir, 'normal.jpg'), roughness: path.join(dir, 'roughness.jpg') };
  if (!Object.values(maps).every((file) => existsSync(file))) {
    await mkdir(dir, { recursive: true });
    const roughness = material.maps.roughnessChannel === 'green'
      ? await sharp(material.maps.roughness).extractChannel('green').jpeg({ quality: 92 }).toBuffer()
      : material.maps.roughness;
    // Escritura atómica: otra ejecución en paralelo puede estar preparando la misma textura.
    const put = async (file, data) => { await writeFile(`${file}.${process.pid}.tmp`, data); await rename(`${file}.${process.pid}.tmp`, file); };
    const resize = (buffer) => sharp(buffer).resize(px, px, { fit: 'inside', withoutEnlargement: true });
    const fit = (buffer) => resize(buffer).jpeg({ quality: 92 }).toBuffer();
    // Atlas con alfa: el color y la opacidad (a la misma escala) se unen en un PNG RGBA sin pérdidas.
    const withOpacity = async (buffer) => {
      const [color, opacity] = await Promise.all([resize(buffer).removeAlpha().png().toBuffer(),
        resize(material.maps.opacity).greyscale().extractChannel(0).png().toBuffer()]);
      return sharp(color).joinChannel(opacity).png().toBuffer();
    };
    const colorMap = tinted ? await tint(material.maps.color, finish.color) : material.maps.color;
    await Promise.all([
      put(maps.color, alpha ? await withOpacity(colorMap) : await fit(colorMap)),
      put(maps.normal, await fit(material.maps.normal)),
      put(maps.roughness, await fit(roughness)),
    ]);
  }
  return {
    kind: 'texture', color: '#ffffff', ...base, maps, tile_mm: tileMm,
    grain_u: Boolean(texture.grainU), normal_strength: texture.normal ?? 1, ...(alpha ? { alpha: true } : {}),
  };
}
