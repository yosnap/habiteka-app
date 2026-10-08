"""Blender --background --python scripts/blender/reconstruction_render.py -- --job /privado/scene.json.

Reconstrucción experimental: no publica resultados, no acepta diseños ni llama a IA.
"""
import argparse
import json
import math
import sys
import time
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))
from hk_render import _gpu
from reconstruction_assets import material, objects, point


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--job', required=True)
    parser.add_argument('--samples', type=int, default=32)
    parser.add_argument('--width', type=int, default=1280)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    packet = json.loads(Path(args.job).read_text())
    if packet['purpose'] != 'reconstruction-draft' or packet['eligibleForFinalVideo'] is not False:
        raise ValueError('Solo se admite un borrador explícito.')
    if not packet['references'] or not packet['unresolved']:
        raise ValueError('Faltan referencias o limitaciones del borrador.')
    for ref in packet['references']:
        if not Path(ref['path']).is_file():
            raise ValueError('Referencia no disponible.')
    start = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene['purpose'] = 'reconstruction-draft'
    scene['eligibleForFinalVideo'] = False
    scene['unresolved'] = json.dumps(packet['unresolved'], ensure_ascii=False)
    scene['approvedFingerprint'] = packet['approvedFingerprint']
    mats = {key: material(key, value, packet['publicDir']) for key, value in packet['materials'].items()}
    for part in packet['meshes']:
        vertices = part['vertices']
        faces = part['triangles']
        mesh = bpy.data.meshes.new(part['id'])
        mesh.from_pydata([point(vertices[i:i + 3]) for i in range(0, len(vertices), 3)], [], [faces[i:i + 3] for i in range(0, len(faces), 3)])
        mesh.update()
        obj = bpy.data.objects.new(part['id'], mesh)
        obj['sourceId'] = part['sourceId']
        scene.collection.objects.link(obj)
        obj.data.materials.append(mats[part['material']])
    objects(packet['objects'], mats, packet['publicDir'])
    for ref in packet['references']:
        img = bpy.data.images.load(ref['path'])
        img.name = 'Referencia aceptada:' + ref['id']
        img.pack()
    camera = bpy.data.objects.new('Cámara del encuadre aceptado', bpy.data.cameras.new('Encuadre'))
    scene.collection.objects.link(camera)
    pose = packet['camera']
    camera.location = point(pose['position'])
    camera.rotation_euler = (point(pose['focus']) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.sensor_fit = 'VERTICAL'
    camera.data.lens = camera.data.sensor_height / (2 * math.tan(math.radians(pose['fovDeg']) / 2))
    camera.data.clip_start, camera.data.clip_end = .03, 200
    scene.camera = camera
    world = bpy.data.worlds.new('Luz de día provisional')
    scene.world = world
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    sky = nodes.new('ShaderNodeTexSky')
    types = sky.bl_rna.properties['sky_type'].enum_items.keys()
    sky.sky_type = 'NISHITA' if 'NISHITA' in types else 'MULTIPLE_SCATTERING'
    sky.sun_elevation, sky.sun_rotation = math.radians(52), math.radians(125)
    sky.sun_size, sky.air_density = math.radians(3), 1
    if hasattr(sky, 'dust_density'):
        sky.dust_density = 2
    background = nodes.get('Background')
    links.new(sky.outputs['Color'], background.inputs['Color'])
    background.inputs['Strength'].default_value = .6
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU' if _gpu() else 'CPU'
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces, scene.cycles.transmission_bounces = 12, 8
    scene.render.resolution_x, scene.render.resolution_y = args.width, round(args.width * 9 / 16)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = 0
    out = Path(packet['outDir'])
    scene.render.filepath = str(out / 'reconstruction-draft.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(out / 'reconstruction-draft.blend'))
    bpy.ops.render.render(write_still=True)
    result = {'elapsedSeconds': round(time.monotonic() - start, 2), 'samples': args.samples, 'width': args.width,
              'device': scene.cycles.device, 'objects': len(scene.objects), 'paidCalls': 0, 'eligibleForFinalVideo': False}
    (out / 'render-report.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == '__main__':
    main()
