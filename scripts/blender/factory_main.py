"""Punto de entrada de la fábrica de muebles dentro de Blender (sin interfaz).

Uso (lo invoca scripts/build-furniture-factory.mjs):
  Blender -b --factory-startup --python scripts/blender/factory_main.py -- --job <trabajo.json>

El trabajo lista piezas ya resueltas (medidas en mm, parámetros y acabados con rutas de textura) y el directorio de
salida. Por cada pieza se construye la geometría, se exporta un GLB sin optimizar y se renderiza la foto de producto.
Los resultados (o el error de cada pieza) se escriben en el JSON `results` del trabajo; una pieza fallida no detiene
las demás.

Cada familia «x» se construye con scripts/blender/fam_x.py, que expone BUILDERS (tipo de la especificación → función
constructora); se importa por convención, sin listas de familias en este archivo.
"""
import importlib
import json
import os
import sys
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import hk_build  # noqa: E402
import hk_render  # noqa: E402




def _clear():
    rig = bpy.data.collections.get(hk_render.RIG)
    keep = set(rig.objects) if rig else set()
    for obj in [obj for obj in bpy.data.objects if obj not in keep]:
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in [item for item in block if item.users == 0]:
            block.remove(item)


def _export(obj, path):
    for other in bpy.context.scene.objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_texcoords=True, export_normals=True,
                              export_materials='EXPORT', export_image_format='AUTO', export_cameras=False,
                              export_lights=False)


def build(spec, out_dir, render):
    module = importlib.import_module(f"fam_{spec['family']}")
    builder = module.BUILDERS.get(spec['type'])
    if builder is None:
        raise KeyError(f"La familia {spec['family']} no tiene el tipo «{spec['type']}»")
    piece = hk_build.Piece(spec['id'], spec['finishes'])
    builder(piece, spec)
    obj = piece.join()
    glb, png = os.path.join(out_dir, f"{spec['id']}.glb"), os.path.join(out_dir, f"{spec['id']}.png")
    _export(obj, glb)
    if render:
        hk_render.render([obj], png)
    size = [round(v * 1000) for v in obj.dimensions]
    return {'glb': glb, 'png': png if render else None, 'triangles': hk_build.triangle_count(obj),
            'blenderDimensionsMm': size}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if '--job' not in argv:
        raise SystemExit('Falta --job <trabajo.json>')
    with open(argv[argv.index('--job') + 1], encoding='utf-8') as handle:
        job = json.load(handle)
    os.makedirs(job['outDir'], exist_ok=True)
    render = job.get('render', True)
    if render:
        hk_render.setup(samples=job.get('samples', 96))
    results = []
    for spec in job['pieces']:
        started = time.time()
        try:
            _clear()
            result = build(spec, job['outDir'], render)
            results.append({'id': spec['id'], 'ok': True, 'seconds': round(time.time() - started, 1), **result})
            print(f"HK-OK {spec['id']} {result['triangles']} tri {time.time() - started:.1f}s", flush=True)
        except Exception as error:  # noqa: BLE001 - se informa y se sigue con la siguiente pieza
            results.append({'id': spec['id'], 'ok': False, 'error': f'{error}\n{traceback.format_exc()}'})
            print(f"HK-ERROR {spec['id']}: {error}", flush=True)
        with open(job['results'], 'w', encoding='utf-8') as handle:
            json.dump(results, handle, indent=1)


main()
