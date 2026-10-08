import type { Furniture } from '@/lib/editor-document/schema';
import { criticalFixtureKind, type FixtureKind } from '@/lib/editor-document/critical-fixtures';

/** Símbolos de la referencia técnica: diferencian función, nunca sustituyen un render final. */
export function fixtureTopSymbol(item: Furniture, kind: FixtureKind | undefined = criticalFixtureKind(item)): string | undefined {
  if (!kind) return undefined;
  const w = item.widthMm, d = item.depthMm;
  const rect = (x: number, y: number, width: number, depth: number, fill: string, radius = .04) =>
    `<rect x="${x*w}" y="${y*d}" width="${width*w}" height="${depth*d}" rx="${radius*Math.min(w,d)}" fill="${fill}" stroke="#59696d" stroke-width="14"/>`;
  const oval = (x: number, y: number, rx: number, ry: number, fill: string) =>
    `<ellipse cx="${x*w}" cy="${y*d}" rx="${rx*w}" ry="${ry*d}" fill="${fill}" stroke="#59696d" stroke-width="12"/>`;
  let symbol: string;
  if (kind === 'cooktop') {
    symbol = rect(0, 0, 1, 1, '#20282b');
    symbol += [.27, .72].flatMap(x => [.28, .7].map(y =>
      `<circle cx="${x*w}" cy="${y*d}" r="${Math.min(w,d)*.15}" fill="none" stroke="#bec6ca" stroke-width="16"/>`)).join('');
  } else if (kind === 'toilet') {
    symbol = oval(.5, .58, .42, .4, '#f3f5f4') + rect(.06, .01, .88, .24, '#f3f5f4')
      + oval(.5, .6, .27, .25, '#b5cdd2');
  } else if (kind === 'washbasin' || kind === 'kitchen-sink') {
    symbol = rect(0, 0, 1, 1, '#e5eaea') + rect(.12, .2, .76, .66, '#b5cdd2', .15)
      + rect(.45, .05, .1, .22, '#53646b');
  } else if (kind === 'bidet') {
    symbol = oval(.5, .5, .42, .46, '#f3f5f4') + oval(.5, .58, .26, .25, '#b5cdd2')
      + rect(.45, .05, .1, .2, '#53646b');
  } else if (kind === 'bath') {
    symbol = rect(0, 0, 1, 1, '#f3f5f4', .15) + rect(.1, .08, .8, .84, '#b5cdd2', .25)
      + rect(.42, .04, .16, .12, '#53646b');
  } else {
    symbol = rect(0, 0, 1, 1, '#e8efef') + oval(.5, .5, .045, .045, '#53646b')
      + `<path d="M ${w*.06} ${d*.94} L ${w*.94} ${d*.94} L ${w*.94} ${d*.06}" fill="none" stroke="#6ab7dd" stroke-width="30"/>`;
  }
  return `<g transform="translate(${item.x} ${item.y}) rotate(${item.rotation})">${symbol}</g>`;
}
