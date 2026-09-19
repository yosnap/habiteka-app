import { outdoorVolumes } from './outdoor-volumes';
import type { Furniture } from './schema';
import { furnitureSpatial } from './spatial-properties';
import { getFurnitureCatalogEntry } from './furniture-catalog';

export interface FurnitureVolume {
  x: number; y: number; widthMm: number; depthMm: number;
  bottom: number; top: number; color?: string;
  rotation?: number; shape?: 'box' | 'cylinder'; part?: 'post' | 'gate'; gateId?: string; materialId?: string;
}

/** Normalized local solids: one geometry contract for rendering and collision. */
export function catalogFurnitureVolumes(item: Furniture): FurnitureVolume[] | null {
  const entry = getFurnitureCatalogEntry(item.catalogId);
  if (!entry) return null;
  if (entry.profile === 'outdoor') return outdoorVolumes(item);
  const { heightMm: h, elevationMm: elevation, color } = furnitureSpatial(item);
  const w = item.widthMm, d = item.depthMm, result: FurnitureVolume[] = [];
  const box = (x: number, y: number, z: number, width: number, depth: number, height: number, tint = color) => {
    result.push({ x: x * w, y: y * d, widthMm: width * w, depthMm: depth * d,
      bottom: elevation + z * h, top: elevation + (z + height) * h, color: tint });
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
    case 'rug':
      box(0, 0, 0, 1, 1, 1);
      break;
    case 'curtain':
      for (let i = 0; i < 10; i++) box(i / 10, i % 2 ? .25 : 0, 0, .1, .75, .97);
      box(0, .4, .97, 1, .2, .03, '#665849');
      break;
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
