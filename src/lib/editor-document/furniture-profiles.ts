import { outdoorVolumes } from './outdoor-volumes';
import type { Furniture } from './schema';
import { furnitureSpatial } from './spatial-properties';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { isKitchenRun } from './kitchen-run-types';

export interface FurnitureVolume {
  x: number; y: number; widthMm: number; depthMm: number;
  bottom: number; top: number; color?: string;
  rotation?: number; shape?: 'box' | 'cylinder'; part?: 'post' | 'gate' | 'slot'; gateId?: string; slotId?: string; materialId?: string;
  /** Transparencia del sólido (lona transparente, vidrio); por defecto opaco. */
  opacity?: number;
}

/** El mueble lleva un color distinto al de catálogo: el usuario lo ha pintado. */
export function isPainted(item: Furniture): boolean {
  // Un mueble de cocina lleva cada color en su composición; su color base nunca tiñe encimera ni aparatos.
  if (isKitchenRun(item)) return false;
  const entry = getFurnitureCatalogEntry(item.catalogId);
  return !!item.color && item.color !== (entry?.color ?? '#8ea69b');
}

// Herrajes y patas oscuros conservan su color aunque el mueble se pinte; el resto de acentos (encimera, cojines,
// frentes) siguen al color pintado para que el mueble se vea del color elegido también en 3D.
const HARDWARE = new Set(['#67513b', '#434743', '#444944', '#64716f', '#313d3e', '#665849', '#6d6a66', '#8a8d89', '#a5a8a3']);

const WINDOW_DRESSING = new Set(['curtain', 'curtain-open', 'roller', 'venetian', 'vertical-blind', 'shutter']);
/** Cortinas, estores y persianas: objetos con una cobertura de ventana regulable. */
export function isWindowDressing(item: Pick<Furniture, 'catalogId'>): boolean {
  const profile = getFurnitureCatalogEntry(item.catalogId)?.profile;
  return !!profile && WINDOW_DRESSING.has(profile);
}
/** Cobertura efectiva: la guardada o, por defecto, cerrada del todo salvo la cortina abierta, que nace recogida. */
export function windowCoverage(item: Pick<Furniture, 'catalogId' | 'coverage'>): number {
  if (item.coverage !== undefined) return Math.max(0, Math.min(1, item.coverage));
  return getFurnitureCatalogEntry(item.catalogId)?.profile === 'curtain-open' ? .4 : 1;
}
/** Normalized local solids: one geometry contract for rendering and collision. */
export function catalogFurnitureVolumes(item: Furniture): FurnitureVolume[] | null {
  const entry = getFurnitureCatalogEntry(item.catalogId);
  if (!entry) return null;
  if (entry.profile === 'outdoor') return outdoorVolumes(item);
  const { heightMm: h, elevationMm: elevation, color } = furnitureSpatial(item);
  const painted = isPainted(item);
  const w = item.widthMm, d = item.depthMm, result: FurnitureVolume[] = [], coverage = windowCoverage(item);
  const box = (x: number, y: number, z: number, width: number, depth: number, height: number, tint = color) => {
    const applied = painted && tint !== color && !HARDWARE.has(tint) ? color : tint;
    result.push({ x: x * w, y: y * d, widthMm: width * w, depthMm: depth * d,
      bottom: elevation + z * h, top: elevation + (z + height) * h, color: applied });
  };
  const legs = (top: number, inset = .06) => {
    for (const x of [inset, .94 - inset]) for (const y of [inset, .94 - inset])
      box(x, y, 0, .06, .06, top, '#67513b');
  };
  switch (entry.profile) {
    case 'sofa':
      legs(.2); box(0, 0, .2, 1, 1, .23); box(0, 0, .43, 1, .18, .57);
      box(0, .18, .43, .12, .82, .32); box(.88, .18, .43, .12, .82, .32);
      for (let i = 0; i < 3; i++) box(.13 + i * .25, .2, .43, .24, .77, .16);
      break;
    case 'sofa-chaise':
      // Cuerpo de tres plazas y módulo alargado a la derecha que llega al fondo completo; sin patas bajo el hueco de la L.
      for (const [x, y] of [[.03, .03], [.91, .03], [.03, .51], [.6, .51], [.66, .91], [.91, .91]]) box(x!, y!, 0, .06, .06, .2, '#67513b');
      box(0, 0, .2, 1, .6, .23); box(0, 0, .43, 1, .11, .57); box(0, .11, .43, .07, .49, .32);
      box(.66, .58, .2, .34, .42, .23);
      for (let i = 0; i < 2; i++) box(.09 + i * .29, .13, .43, .28, .45, .16);
      box(.67, .13, .43, .31, .85, .16);
      break;
    case 'sofa-corner':
      // Tramo largo arriba y tramo corto a la derecha, unidos por el módulo de esquina; sin patas bajo el hueco de la L.
      for (const [x, y] of [[.03, .03], [.91, .03], [.03, .34], [.6, .34], [.66, .91], [.91, .91]]) box(x!, y!, 0, .06, .06, .2, '#67513b');
      box(0, 0, .2, 1, .43, .23); box(.66, .43, .2, .34, .57, .23);
      box(0, 0, .43, 1, .08, .57); box(.92, .08, .43, .08, .92, .57);
      box(0, .08, .43, .06, .35, .32); box(.66, .94, .43, .26, .06, .32);
      for (let i = 0; i < 3; i++) box(.08 + i * .28, .1, .43, .26, .31, .16);
      for (let j = 0; j < 2; j++) box(.68, .45 + j * .24, .43, .23, .22, .16);
      break;
    case 'sofa-modular':
      legs(.2);
      for (let m = 0; m < 3; m++) { box(m / 3 + .005, 0, .2, .323, 1, .23); box(m / 3 + .005, 0, .43, .323, .18, .57); box(m / 3 + .02, .2, .43, .293, .77, .16); }
      box(0, .18, .43, .06, .82, .32); box(.94, .18, .43, .06, .82, .32);
      break;
    case 'sofa-bed':
      legs(.2); box(0, 0, .2, 1, 1, .28); box(0, 0, .48, 1, .18, .52);
      box(0, .18, .48, .1, .82, .3); box(.9, .18, .48, .1, .82, .3);
      box(.1, .2, .48, .8, .76, .12); box(.1, .94, .3, .8, .04, .1, '#f3eee3');
      break;
    case 'bed':
      legs(.25); box(.02, .02, .25, .96, .96, .23, '#866b4c');
      box(.03, .1, .48, .94, .88, .2); box(0, 0, .25, 1, .06, .75);
      box(.08, .12, .68, .38, .16, .1, '#f3eee3');
      box(.54, .12, .68, .38, .16, .1, '#f3eee3');
      break;
    case 'chair':
      legs(.46); box(0, .06, .46, 1, .94, .1); box(0, 0, .46, 1, .08, .54);
      break;
    case 'table':
      legs(.92); box(0, 0, .92, 1, 1, .08);
      break;
    case 'bench':
      legs(.5); box(0, .08, .5, 1, .92, .14); box(0, 0, .55, 1, .07, .45);
      break;
    case 'shelf':
      box(0, 0, 0, .06, 1, 1); box(.94, 0, 0, .06, 1, 1); box(.06, 0, 0, .88, .04, 1);
      for (const z of [0, .24, .48, .72, .96]) box(.06, .04, z, .88, .96, .04);
      break;
    case 'cabinet':
      box(0, 0, 0, 1, .94, 1); box(.01, .94, .01, .48, .04, .98);
      box(.51, .94, .01, .48, .04, .98);
      box(.43, .98, .45, .03, .02, .1, '#434743'); box(.54, .98, .45, .03, .02, .1, '#434743');
      break;
    case 'kitchen':
      box(.02, .02, 0, .96, .94, .92); box(0, 0, .92, 1, 1, .08, '#e0dbcf');
      box(.1, .96, .8, .8, .04, .025, '#444944');
      break;
    case 'sink':
    case 'bath': {
      const rim = entry.profile === 'sink' ? .12 : .08;
      box(0, 0, 0, 1, 1, .12);
      box(0, 0, .12, rim, 1, .88); box(1 - rim, 0, .12, rim, 1, .88);
      box(rim, 0, .12, 1 - 2 * rim, rim, .88); box(rim, 1 - rim, .12, 1 - 2 * rim, rim, .88);
      break;
    }
    case 'toilet':
      box(.18, .3, 0, .64, .56, .4); box(.05, .24, .4, .9, .74, .16);
      box(.05, 0, 0, .9, .24, 1); box(.25, .4, .56, .5, .4, .025, '#a0b6b5');
      break;
    case 'shower':
      box(0, 0, 0, 1, 1, .035); box(0, 0, .035, 1, .025, .965, '#acc8ca');
      box(0, .025, .035, .025, .975, .965, '#acc8ca');
      break;
    case 'lamp':
      box(.15, .15, 0, .7, .7, .04, '#444944'); box(.47, .47, .04, .06, .06, .69, '#444944');
      box(0, 0, .73, 1, 1, .25); box(.15, .15, .98, .7, .7, .02, '#fff0bd');
      break;
    case 'plant':
      box(.22, .22, 0, .56, .56, .3, '#aa7960'); box(.46, .46, .3, .08, .08, .55, '#735437');
      box(.05, .3, .4, .65, .3, .22); box(.3, .05, .6, .3, .75, .22);
      box(.35, .35, .8, .3, .3, .2); box(.55, .35, .5, .45, .3, .18);
      break;
    case 'decor':
      box(.18, .18, 0, .64, .64, .08); box(.1, .1, .08, .8, .8, .72); box(.24, .24, .8, .52, .52, .2);
      break;
    case 'rug':
      box(0, 0, 0, 1, 1, 1);
      break;
    case 'curtain':
    case 'curtain-open': {
      // Dos paños que se corren desde los extremos hacia el centro: la cobertura reparte los pliegues entre ambos lados.
      const folds = Math.round(5 * coverage);
      for (let i = 0; i < folds; i++) { box(i * .1, i % 2 ? .25 : 0, 0, .1, .75, .97); box(.9 - i * .1, i % 2 ? .25 : 0, 0, .1, .75, .97); }
      box(0, .4, .97, 1, .2, .03, '#665849');
      break;
    }
    case 'roller': {
      // El tubo arriba; la tela baja desde él tanto como indique la cobertura.
      const drop = .93 * coverage;
      box(0, 0, .95, 1, 1, .05, '#6d6a66');
      if (drop > .01) { box(.02, .4, .95 - drop, .96, .2, drop); box(.02, .35, .95 - drop, .96, .3, .02, '#6d6a66'); }
      break;
    }
    case 'venetian': {
      box(0, 0, .95, 1, 1, .05, '#8a8d89');
      const slats = Math.round(12 * coverage);
      for (let i = 0; i < slats; i++) box(.02, .25, .95 - (i + 1) * .078, .96, .5, .02);
      break;
    }
    case 'vertical-blind': {
      // Las lamas se recogen hacia un lado: cubren desde la izquierda la fracción indicada.
      box(0, .3, .97, 1, .4, .03, '#8a8d89');
      const slats = Math.round(12 * coverage);
      for (let i = 0; i < slats; i++) box(i / 12 + .005, .2, 0, .06, .6, .96);
      break;
    }
    case 'shutter': {
      box(0, 0, .8, 1, 1, .2, '#a5a8a3');
      const slats = Math.round(10 * coverage);
      for (let i = 0; i < slats; i++) box(.03, .3, .8 - (i + 1) * .08, .94, .4, .06);
      break;
    }
    case 'screen':
      box(.25, .1, 0, .5, .8, .06, '#363b3b'); box(.46, .42, .06, .08, .16, .16, '#363b3b');
      box(0, .36, .22, 1, .28, .78); box(.04, .64, .26, .92, .02, .7, '#263c42');
      break;
    case 'appliance':
      box(0, 0, 0, 1, .96, 1); box(.03, .96, .05, .94, .04, .7, '#64716f');
      box(.06, .96, .83, .88, .04, .06, '#313d3e');
      break;
    default:
      box(0, 0, 0, 1, 1, 1);
  }
  return result;
}
