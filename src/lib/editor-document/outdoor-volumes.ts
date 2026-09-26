import type { Furniture } from './schema';
import type { FurnitureVolume } from './furniture-profiles';
import { furnitureSpatial } from './spatial-properties';

/** Geometría paramétrica compartida por la vista 3D y las colisiones, en mm. */
export function outdoorVolumes(item: Furniture): FurnitureVolume[] {
  const { heightMm: h, elevationMm: e, color } = furnitureSpatial(item), w = item.widthMm, d = item.depthMm;
  const parts: FurnitureVolume[] = [];
  const box = (x: number, y: number, z: number, a: number, b: number, c: number, tint = color, extra: Partial<FurnitureVolume> = {}) => {
    parts.push({ x: x * w, y: y * d, widthMm: a * w, depthMm: b * d, bottom: e + z * h, top: e + (z + c) * h, color: tint, ...extra });
  };
  const posts = (top = .9) => { for (const x of [0, .94]) for (const y of [0, .94]) box(x, y, 0, .06, .06, top); };
  const basin = () => {
    box(0, 0, 0, 1, 1, .08); box(0, 0, .08, .06, 1, .92); box(.94, 0, .08, .06, 1, .92);
    box(.06, 0, .08, .88, .06, .92); box(.06, .94, .08, .88, .06, .92);
  };
  switch (item.kind) {
    case 'pergola': case 'pergola-aluminio': case 'pergola-metal': posts(); box(0, 0, .86, 1, .08, .08); box(0, .92, .86, 1, .08, .08);
      for (let i = 0; i < 9; i++) box(i / 9, 0, .94, .06, 1, .06); break;
    case 'carpa': {
      // Frente abierto; los laterales recogidos dejan solo un rollo alto, fuera del paso a altura de persona.
      posts(.8);
      box(0, 0, .8, 1, 1, .04); box(.08, .08, .84, .84, .84, .06); box(.2, .2, .9, .6, .6, .06); box(.35, .35, .96, .3, .3, .04);
      const clear = { opacity: .3 };
      const leftRolled = item.rolledSides === 'left' || item.rolledSides === 'both';
      const rightRolled = item.rolledSides === 'right' || item.rolledSides === 'both';
      box(0, 0, 0, 1, .015, .8, '#dfe9ec', clear);
      if (leftRolled) box(0, .06, .76, .018, .88, .04, '#dfe9ec', { opacity: .72 });
      else box(0, 0, 0, .015, 1, .8, '#dfe9ec', clear);
      if (rightRolled) box(.982, .06, .76, .018, .88, .04, '#dfe9ec', { opacity: .72 });
      else box(.985, 0, 0, .015, 1, .8, '#dfe9ec', clear);
      break;
    }
    case 'toldo':
      box(0, 0, .92, 1, .05, .08, '#737976');
      for (const x of [.08, .88]) box(x, 0, .88, .04, 1, .03, '#737976');
      for (let i = 0; i < 10; i++) box(0, i / 10, .94 - i * .015, 1, .1, .018); break;
    case 'sombrilla': box(.35, .35, 0, .3, .3, .05, '#666b68'); box(.48, .48, .05, .04, .04, .95, '#776549');
      box(0, 0, .82, 1, 1, .035); box(.1, .1, .855, .8, .8, .04); box(.25, .25, .895, .5, .5, .055); break;
    case 'valla-madera': case 'cerca-metal': {
      const count = Math.ceil(w / 2000), post = Math.min(120, w / 3);
      for (let i = 0; i <= count; i++) box((w - post) * i / count / w, 0, 0, post / w, 1, 1);
      for (const z of [.25, .7]) box(0, .3, z, 1, .4, .06);
      const slats = Math.max(1, Math.ceil(w / 170));
      for (let i = 0; i < slats; i++) box(i / slats, .25, .06, Math.min(70, w / slats) / w, .5, .9);
      break;
    }
    case 'seto': {
      const count = Math.ceil(w / 1000);
      for (let i = 0; i < count; i++) {
        box(i / count, .1, 0, 1 / count, .8, .8);
        box((i + .1) / count, .15, .7, .8 / count, .7, .3);
      }
      break;
    }
    case 'arbol': box(.44, .44, 0, .12, .12, .65, '#77583d'); box(.12, .12, .48, .76, .76, .28);
      box(0, .2, .6, 1, .6, .2); box(.25, .05, .7, .5, .9, .2); box(.3, .3, .85, .4, .4, .15); break;
    case 'arbusto': case 'planta-exterior':
      box(.1, .1, 0, .8, .8, .75); box(0, .18, .15, 1, .64, .6); box(.15, .15, .7, .7, .7, .3); break;
    case 'maceta-exterior': basin(); break;
    case 'huerto': case 'jardinera-exterior': basin(); box(.06, .06, .1, .88, .88, .25, '#624530');
      for (let i = 0; i < 4; i++) box(.13 + i * .2, .16, .35, .12, .68, .65, '#5e883e'); break;
    case 'camino': for (let i = 0; i < 5; i++) box(.03, i / 5, 0, .94, .18, 1); break;
    case 'parking': box(0, 0, 0, 1, 1, .7); for (const x of [.03, .95]) box(x, 0, .7, .02, 1, .3, '#f3efda');
      box(.03, 0, .7, .94, .02, .3, '#f3efda'); break;
    case 'coche':
      box(.06, .04, .22, .88, .92, .3); box(.15, .3, .52, .7, .42, .43, '#53646b'); box(.18, .32, .95, .64, .38, .05);
      for (const x of [0, .86]) for (const y of [.16, .7]) box(x, y, 0, .14, .16, .32, '#303331');
      for (const x of [.12, .72]) box(x, .02, .35, .16, .03, .1, '#f6e9bf'); break;
    case 'piscina': case 'estanque': basin(); box(.06, .06, .75, .88, .88, .02, '#64afbe'); break;
    case 'fuente':
      box(0, 0, 0, 1, 1, .15); box(.08, .08, .15, .84, .84, .025, '#6bb3be');
      box(.44, .44, .15, .12, .12, .65); box(.2, .2, .7, .6, .6, .1); box(.48, .48, .8, .04, .04, .2, '#a8d4dc'); break;
    case 'barbacoa':
      posts(.6); box(0, 0, .6, 1, 1, .08, '#b5b3a8'); box(.2, .15, .68, .6, .7, .15, '#383c3a');
      for (let i = 0; i < 10; i++) box(.22 + i * .056, .17, .83, .018, .66, .02, '#bec2be');
      box(.2, .1, .85, .6, .08, .15); box(.05, .08, .25, .9, .84, .06); break;
    case 'drenaje': case 'sumidero':
      box(0, 0, 0, 1, 1, .3, '#242d2a');
      for (let i = 0; i < 12; i++) box(i / 12, 0, .3, .04, 1, .7); break;
    case 'roca': box(.12, .12, 0, .76, .76, .5); box(0, .15, .2, .9, .6, .45); box(.23, .22, .5, .55, .5, .5); break;
    case 'piedras': for (let i = 0; i < 5; i++) box(i * .18, (i % 2) * .35, 0, .17, .5, .65 + (i % 2) * .35); break;
    case 'setas': box(.44, .44, 0, .12, .12, .7, '#ebdfbf'); box(.05, .05, .7, .9, .9, .16); box(.25, .25, .86, .5, .5, .14); break;
    case 'aspersor': box(.2, .2, 0, .6, .6, .7); box(0, .2, .7, 1, .6, .3); break;
    case 'riego-goteo': box(0, .25, 0, 1, .5, .6); for (let i = 0; i < 8; i++) box(i / 8, 0, .4, .025, 1, .6); break;
    case 'tira-led': box(0, 0, 0, 1, 1, .5, '#aab2b0'); box(0, .1, .5, 1, .8, .5); break;
    case 'puf-exterior': box(.05, .05, 0, .9, .9, .85); box(0, 0, .2, 1, 1, .65); box(.1, .1, .85, .8, .8, .15); break;
  }
  return parts;
}
