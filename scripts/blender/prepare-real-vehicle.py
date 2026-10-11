"""Normaliza un vehículo autorizado y genera la foto del mismo modelo, sin inventar su carrocería."""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).parent))
import hk_render

args = sys.argv[sys.argv.index('--') + 1:]
source, output, photo, length_mm, rotation = args
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# Fija las transformaciones importadas antes de quitar los nodos vacíos.
for obj in objects:
    matrix = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = matrix
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        bpy.data.objects.remove(obj, do_unlink=True)
corners = [obj.matrix_world @ Vector(c) for obj in objects for c in obj.bound_box]
low = Vector(tuple(min(c[k] for c in corners) for k in range(3)))
high = Vector(tuple(max(c[k] for c in corners) for k in range(3)))
scale = float(length_mm) / 1000 / (high.y - low.y)
origin = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
transform = Matrix.Rotation(float(rotation) * math.pi, 4, 'Z') @ Matrix.Scale(scale, 4) @ Matrix.Translation(-origin)
for obj in objects:
    obj.data.transform(transform)
    obj.data.update()
# Solo los materiales originales de carrocería admiten el cambio de color.
for material in bpy.data.materials:
    if material.name.startswith('primary') or material.name.lower().startswith('carpaint'):
        material.name = 'pintura' if not bpy.data.materials.get('pintura') else f'pintura_{material.name}'
for obj in objects:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', use_selection=True,
                         export_animations=False, export_cameras=False, export_lights=False)
hk_render.setup(samples=48)
hk_render.render(objects, photo, elevation=26)
print('VEHICLE_READY', json.dumps({'objects': len(objects), 'lengthMm': float(length_mm)}))
