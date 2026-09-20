import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const definitions = [
  ['grass-natural', 'Césped natural', '#658247'], ['grass-artificial', 'Césped artificial', '#447446'],
  ['soil', 'Tierra', '#715339'], ['gravel', 'Gravilla', '#aaa69a'],
  ['pine-bark', 'Corteza de pino', '#8c583a'], ['sand', 'Arena', '#cdb98d'],
  ['asphalt', 'Asfalto / parking', '#595d5e'], ['paving', 'Pavimento exterior', '#b6b0a1'],
];
await mkdir('public/materials/outdoor', { recursive: true });
for (const [id, , color] of definitions) {
  let shapes = '';
  for (let i = 0; i < 1800; i++) {
    const x = (i * 73.317) % 256, y = (i * 41.719) % 256;
    const tint = i % 2 ? '#ffffff' : '#000000';
    shapes += id!.startsWith('grass')
      ? `<path d="M${x} ${y}l${i % 5 - 2} -${4 + i % 7}" stroke="${tint}" opacity=".14"/>`
      : `<rect x="${x}" y="${y}" width="${id === 'pine-bark' ? 4 + i % 12 : 1 + i % 5}" height="${1 + i % 4}" fill="${tint}" opacity=".16"/>`;
  }
  if (id === 'grass-artificial') for (let x = 0; x < 256; x += 32) shapes += `<rect x="${x}" width="16" height="256" fill="#ffffff" opacity=".05"/>`;
  if (id === 'paving') shapes += '<path d="M0 0H256V256H0ZM0 128H256M128 0V256" fill="none" stroke="#ddd8c9" stroke-width="3"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${color}"/>${shapes}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/materials/outdoor/${id}.png`);
}
await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 128, g: 128, b: 255 } } }).png().toFile('public/materials/outdoor/normal.png');
await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 230, g: 230, b: 230 } } }).png().toFile('public/materials/outdoor/roughness.png');
await writeFile('public/materials/outdoor/license.txt', 'Texturas procedurales originales de Habiteka, generadas por scripts/generate-outdoor-materials.ts. Sin assets de terceros.');
