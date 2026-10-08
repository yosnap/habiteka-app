"""Materiales y objetos explícitos del borrador de reconstrucción. Sin servicios de IA."""
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def point(value):
    return Vector((value[0], -value[2], value[1]))


def rgb(value):
    def linear(c):
        c = int(c, 16) / 255
        return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
    return tuple(linear(value[i:i + 2]) for i in (1, 3, 5)) + (1,)


def local_asset(root, relative):
    path = (Path(root) / relative.lstrip('/')).resolve()
    if not path.is_relative_to(Path(root).resolve()) or not path.is_file():
        raise ValueError(f'Archivo local no disponible: {relative}')
    return str(path)


def material(name, spec, root):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = rgb(spec['color'])
    bsdf.inputs['Roughness'].default_value = spec.get('roughness', .7)
    bsdf.inputs['Metallic'].default_value = spec.get('metalness', 0)
    if spec.get('glass'):
        bsdf.inputs['Transmission Weight'].default_value = 1
        bsdf.inputs['IOR'].default_value = 1.45
    coords = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeVectorMath')
    mapping.operation = 'SCALE'
    mapping.inputs['Scale'].default_value = 1 / spec.get('scaleM', 1)
    links.new(coords.outputs['Object'], mapping.inputs[0])
    for kind, relative in (spec.get('maps') or {}).items():
        if kind not in ('color', 'roughness', 'normal') or not relative:
            continue
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(local_asset(root, relative), check_existing=True)
        tex.projection, tex.projection_blend = 'BOX', .15
        links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
        if kind == 'color':
            links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        else:
            tex.image.colorspace_settings.name = 'Non-Color'
            if kind == 'roughness':
                links.new(tex.outputs['Color'], bsdf.inputs['Roughness'])
            # Las mallas exportadas no tienen UV tangentes: relieve escalar suave,
            # sin interpretar incorrectamente un mapa normal tangente como mundial.
    return mat


def primitive(name, shape, location, size, mat, rotation=0):
    if shape == 'box':
        bpy.ops.mesh.primitive_cube_add(size=1)
    elif shape == 'cylinder':
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=.5, depth=1)
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=.5)
    obj = bpy.context.object
    obj.name, obj.location = name, point(location)
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.z = rotation
    obj.data.materials.append(mat)
    if shape in ('box', 'cylinder'):
        bevel = obj.modifiers.new('Bordes físicos', 'BEVEL')
        bevel.width, bevel.segments = .012, 3
        obj.modifiers.new('Normales', 'WEIGHTED_NORMAL')
    else:
        for face in obj.data.polygons:
            face.use_smooth = True
    return obj


def model(item, root):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=local_asset(root, item['model']))
    added = set(bpy.data.objects) - before
    meshes = [obj for obj in added if obj.type == 'MESH']
    if not meshes:
        raise ValueError(f'Modelo vacío: {item["id"]}')
    front = Matrix.Rotation(item.get('frontRotation', 0), 4, 'Z')
    coordinates = [front @ obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    lo = Vector(tuple(min(v[i] for v in coordinates) for i in range(3)))
    hi = Vector(tuple(max(v[i] for v in coordinates) for i in range(3)))
    origin = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    size = item['size']
    fit = Matrix.Diagonal(Vector((size[0] / max(hi.x - lo.x, .001), size[2] / max(hi.y - lo.y, .001), size[1] / max(hi.z - lo.z, .001), 1)))
    # position es el centro de la base del modelo; las formas usan el centro del sólido.
    transform = Matrix.Translation(point(item['position'])) @ Matrix.Rotation(item.get('rotation', 0), 4, 'Z') @ fit @ Matrix.Translation(-origin) @ front
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        obj.data = obj.data.copy()
        obj.data.transform(transform @ world)
        obj.name = item['id'] + ':' + obj.name
        if item.get('tint'):
            for slot in obj.material_slots:
                mat = slot.material
                if mat and any(key.lower() in mat.name.lower() for key in item.get('tintMaterials', [])):
                    slot.material = mat.copy()
                    node = slot.material.node_tree.nodes.get('Principled BSDF')
                    if node:
                        for link in list(node.inputs['Base Color'].links):
                            slot.material.node_tree.links.remove(link)
                        node.inputs['Base Color'].default_value = rgb(item['tint'])
    for obj in added - set(meshes):
        bpy.data.objects.remove(obj, do_unlink=True)


def fountain(item, mats, root):
    x, y, z = item['position']
    w, h, d = item['size']
    stone = mats[item['material']]
    primitive(item['id'] + ':base', 'box', [x, y + .07, z], [w, .14, d], stone)
    for dx, dz, sx, sz in [(-w / 2 + .055, 0, .11, d), (w / 2 - .055, 0, .11, d), (0, -d / 2 + .055, w - .22, .11), (0, d / 2 - .055, w - .22, .11)]:
        primitive(item['id'] + ':borde', 'box', [x + dx, y + h / 2, z + dz], [sx, h, sz], stone)
    water = material('Agua de fuente', {'color': '#84bdc4', 'glass': True, 'roughness': .08}, root)
    water.node_tree.nodes.get('Principled BSDF').inputs['IOR'].default_value = 1.333
    primitive(item['id'] + ':agua', 'box', [x, y + h - .06, z], [w - .22, .025, d - .22], water)
    primitive(item['id'] + ':surtidor', 'cylinder', [x, y + h + .07, z], [.018, .25, .018], water)
    primitive(item['id'] + ':gota', 'sphere', [x, y + h + .20, z], [.05, .065, .05], water)


def objects(items, mats, root):
    for item in items:
        if item.get('model'):
            model(item, root)
        elif item['shape'] == 'fountain':
            fountain(item, mats, root)
        else:
            primitive(item['id'], item['shape'], item['position'], item['size'], mats[item['material']], item.get('rotation', 0))
