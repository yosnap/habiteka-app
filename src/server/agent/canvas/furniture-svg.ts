import type { StructObj } from '@/canvas/types';

/** Símbolos reconocibles en planta: un mueble no debe parecer un tabique. */
export function furnitureDetailSvg(o: StructObj): string {
  const w = o.width, h = o.height;
  const rect = (x: number, y: number, width: number, height: number) =>
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="#f4efe6" stroke="#756b60" stroke-width="1.2"/>`;
  const circle = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#756b60" stroke-width="1.2"/>`;
  let content = '';
  if (o.kind === 'sofa') {
    content = rect(w * .05, h * .05, w * .9, h * .18);
    for (let i = 0; i < 3; i++) content += rect(w * (.1 + i * .27), h * .28, w * .25, h * .6);
  } else if (o.kind === 'cama') {
    content = rect(w * .06, h * .08, w * .4, h * .2) + rect(w * .54, h * .08, w * .4, h * .2) + rect(w * .06, h * .35, w * .88, h * .6);
  } else if (o.kind === 'silla') {
    content = rect(w * .08, h * .05, w * .84, h * .15) + rect(w * .15, h * .3, w * .7, h * .6);
  } else if (o.kind === 'mesa' || o.kind === 'mesilla') {
    content = rect(w * .04, h * .04, w * .92, h * .92);
  } else if (o.kind === 'fregadero' || o.kind === 'lavabo' || o.kind === 'banera' || o.kind === 'ducha') {
    content = rect(w * .12, h * .12, w * .76, h * .76) + circle(w * .5, h * .5, Math.min(w, h) * .04);
  } else if (o.kind === 'vitroceramica') {
    for (const x of [.28, .72]) for (const y of [.28, .72]) content += circle(w * x, h * y, Math.min(w, h) * .16);
  }
  return content ? `<g transform="translate(${o.x} ${o.y})">${content}</g>` : '';
}
