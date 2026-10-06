"""Fotos de producto de las fichas de Construir (paredes, habitaciones, cocina, formas, escaleras, rampas, columnas,
huecos y superficies exteriores) renderizadas con Cycles.

Uso (lo invoca scripts/build-construction-photos.mjs):
  Blender -b --factory-startup --python scripts/blender/construction_photos.py -- --job <trabajo.json>

El trabajo indica las escenas, las texturas CC0 ya resueltas ({clave: {color, normal, roughness, tile}} con el mosaico
real en metros), las muestras, el tamaño y el directorio de salida. Cada escena se modela aquí con primitivas de
hk_geo y se fotografía con el mismo estudio que las fichas de muebles (hk_render: vista 3/4, luz suave de estudio,
sombra de contacto y fondo transparente que el lanzador compone sobre un fondo claro neutro).

Unidades en metros. X = ancho, Y = fondo (la cámara mira desde -Y), Z = alto con el suelo en Z = 0. No modifica
módulos de la fábrica: solo importa hk_geo y hk_render.
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import hk_geo as geo  # noqa: E402
import hk_render  # noqa: E402

TEX = {}
WALL_H, WALL_T = 2.5, .15
RISE, RUN, STAIR_W = .18, .28, .9
RAIL = '#3f474b'


# ── materiales ────────────────────────────────────────────────────────────────────────────────────────────────────

def rgb(hex_color):
    value = hex_color.lstrip('#')
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in srgb) + (1.0,)


def _set(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


def _material(name):
    material = bpy.data.materials.new(name)
    if hasattr(material, 'use_nodes') and not material.use_nodes:
        material.use_nodes = True
    tree = material.node_tree
    bsdf = next((n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        tree.nodes.clear()
        bsdf = tree.nodes.new('ShaderNodeBsdfPrincipled')
        out = tree.nodes.new('ShaderNodeOutputMaterial')
        tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return material, tree, bsdf


def plain(name, color, rough=.5, metal=0.0, coat=0.0, bump=0.0, bump_scale=400.0, glass=False):
    """Acabado liso (pintura, laca, metal, vidrio) con microrrelieve opcional."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    material, tree, bsdf = _material(name)
    for key, value in {'Base Color': rgb(color), 'Roughness': rough, 'Metallic': metal, 'Coat Weight': coat,
                       'Coat Roughness': .08}.items():
        _set(bsdf, key, value)
    if glass:
        _set(bsdf, 'Transmission Weight', 1.0)
        _set(bsdf, 'IOR', 1.5)
    if bump:
        noise = tree.nodes.new('ShaderNodeTexNoise')
        _set(noise, 'Scale', bump_scale)
        _set(noise, 'Detail', 8.0)
        node = tree.nodes.new('ShaderNodeBump')
        _set(node, 'Strength', bump)
        tree.links.new(noise.outputs['Fac'], node.inputs['Height'])
        tree.links.new(node.outputs['Normal'], bsdf.inputs['Normal'])
    return material


def textured(name, key, tint='#ffffff', value=1.0, sat=1.0, rough=(0.0, 1.0), normal=1.0, rotate=0.0, scale=1.0):
    """Textura CC0 (color, normal y rugosidad) proyectada en caja sobre coordenadas de objeto: metros reales."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    tex = TEX[key]
    material, tree, bsdf = _material(name)
    coords = tree.nodes.new('ShaderNodeTexCoord')
    mapping = tree.nodes.new('ShaderNodeMapping')
    size = tex['tile'] * scale
    mapping.inputs['Scale'].default_value = (1 / size, 1 / size, 1 / size)
    mapping.inputs['Rotation'].default_value = (0, 0, math.radians(rotate))
    tree.links.new(coords.outputs['Object'], mapping.inputs['Vector'])

    def image(path, non_color):
        node = tree.nodes.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(path, check_existing=True)
        if non_color:
            node.image.colorspace_settings.name = 'Non-Color'
        node.projection, node.projection_blend = 'BOX', .2
        tree.links.new(mapping.outputs['Vector'], node.inputs['Vector'])
        return node

    hsv = tree.nodes.new('ShaderNodeHueSaturation')
    _set(hsv, 'Saturation', sat)
    _set(hsv, 'Value', value)
    tree.links.new(image(tex['color'], False).outputs['Color'], hsv.inputs['Color'])
    mix = tree.nodes.new('ShaderNodeMix')
    mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    tree.links.new(hsv.outputs['Color'], mix.inputs['A'])
    mix.inputs['B'].default_value = rgb(tint)
    tree.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    rough_map = tree.nodes.new('ShaderNodeMapRange')
    tree.links.new(image(tex['roughness'], True).outputs['Color'], rough_map.inputs['Value'])
    rough_map.inputs['To Min'].default_value, rough_map.inputs['To Max'].default_value = rough
    tree.links.new(rough_map.outputs['Result'], bsdf.inputs['Roughness'])
    normal_map = tree.nodes.new('ShaderNodeNormalMap')
    normal_map.inputs['Strength'].default_value = normal
    tree.links.new(image(tex['normal'], True).outputs['Color'], normal_map.inputs['Color'])
    tree.links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    return material


def grass_material():
    """Briznas de césped: verde variable por brizna, más oscuro en la base y algo translúcido."""
    if 'cesped' in bpy.data.materials:
        return bpy.data.materials['cesped']
    material, tree, bsdf = _material('cesped')
    output = next(n for n in tree.nodes if n.type == 'OUTPUT_MATERIAL')
    tone, height = tree.nodes.new('ShaderNodeAttribute'), tree.nodes.new('ShaderNodeAttribute')
    tone.attribute_name, height.attribute_name = 'tono', 'altura'
    ramp = tree.nodes.new('ShaderNodeValToRGB')
    stops = ramp.color_ramp.elements
    stops[0].position, stops[0].color = 0.0, rgb('#2f4a1c')
    stops[1].position, stops[1].color = .75, rgb('#5f8a32')
    extra = stops.new(1.0)
    extra.color = rgb('#9a9a4a')
    tree.links.new(tone.outputs['Fac'], ramp.inputs['Fac'])
    shade = tree.nodes.new('ShaderNodeMix')
    shade.data_type, shade.blend_type = 'RGBA', 'MULTIPLY'
    curve = tree.nodes.new('ShaderNodeMapRange')
    curve.inputs['To Min'].default_value, curve.inputs['To Max'].default_value = .35, 1.0
    tree.links.new(height.outputs['Fac'], curve.inputs['Value'])
    tree.links.new(curve.outputs['Result'], shade.inputs['Factor'])
    tree.links.new(ramp.outputs['Color'], shade.inputs['A'])
    shade.inputs['B'].default_value = (1, 1, 1, 1)
    darken = tree.nodes.new('ShaderNodeMix')
    darken.data_type = 'RGBA'
    tree.links.new(curve.outputs['Result'], darken.inputs['Factor'])
    darken.inputs['A'].default_value = rgb('#1a2410')
    tree.links.new(ramp.outputs['Color'], darken.inputs['B'])
    tree.links.new(darken.outputs['Result'], bsdf.inputs['Base Color'])
    _set(bsdf, 'Roughness', .55)
    _set(bsdf, 'Specular IOR Level', .35)
    translucent = tree.nodes.new('ShaderNodeBsdfTranslucent')
    tree.links.new(darken.outputs['Result'], translucent.inputs['Color'])
    mixer = tree.nodes.new('ShaderNodeMixShader')
    mixer.inputs['Fac'].default_value = .25
    tree.links.new(bsdf.outputs['BSDF'], mixer.inputs[1])
    tree.links.new(translucent.outputs['BSDF'], mixer.inputs[2])
    tree.links.new(mixer.outputs['Shader'], output.inputs['Surface'])
    return material


def finishes():
    """Acabados comunes de las escenas (se crean una vez y se reutilizan)."""
    return {
        'yeso': textured('yeso', 'plaster', tint='#f3eee6', value=1.04, sat=.5, rough=(.78, .95), normal=1.0),
        'zocalo': plain('zocalo', '#e6e1d8', rough=.3, bump=.02),
        'tarima': textured('tarima', 'oak', tint='#fbf4ea', sat=.9, rough=(.35, .7), normal=.6),
        'roble': textured('roble', 'oak', tint='#fffaf2', rough=(.4, .7), normal=.5),
        'losa': plain('losa', '#d9d4cb', rough=.9, bump=.08, bump_scale=60.0),
        'carril': plain('barandilla', RAIL, rough=.38, metal=.85),
    }


# ── geometría ─────────────────────────────────────────────────────────────────────────────────────────────────────

def add(bm, material, name, smooth=0):
    """Crea un objeto con la malla bmesh y lo enlaza a la escena."""
    mesh = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        mesh.shade_smooth()
        mesh.set_sharp_from_angle(angle=math.radians(smooth))
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def box(w, d, h, at, material, name='caja', r=0.0, rot=0.0):
    """Caja apoyada por el centro de su base en `at`; `rot` en grados alrededor de Z."""
    bm = geo.box(w, d, h, r=r, segments=2)
    geo.transform(bm, loc=at, rot=(0, 0, math.radians(rot)))
    return add(bm, material, name, smooth=30 if r else 0)


def offset(points, d):
    """Desplaza un polígono antihorario `d` metros hacia fuera (negativo: hacia dentro) con esquinas a inglete."""
    out, n = [], len(points)
    for i in range(n):
        p0, p1, p2 = Vector(points[i - 1]), Vector(points[i]), Vector(points[(i + 1) % n])
        e1, e2 = (p1 - p0).normalized(), (p2 - p1).normalized()
        n1, n2 = Vector((e1.y, -e1.x)), Vector((e2.y, -e2.x))
        out.append(tuple(p1 + (n1 + n2) * (d / (1 + n1.dot(n2)))))
    return out


def prism(points, z0, z1):
    """Polígono (x, y) extruido entre z0 y z1; admite polígonos cóncavos."""
    bm = bmesh.new()
    bottom = [bm.verts.new((x, y, z0)) for x, y in points]
    top = [bm.verts.new((x, y, z1)) for x, y in points]
    bm.faces.new(bottom[::-1])
    bm.faces.new(top)
    for i in range(len(points)):
        j = (i + 1) % len(points)
        bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def ring(points, d, z0, z1):
    """Banda cerrada entre un polígono y su desplazamiento `d` (muros de una habitación, zócalos)."""
    outer = offset(points, d)
    bm = bmesh.new()
    ib, it = [bm.verts.new((x, y, z0)) for x, y in points], [bm.verts.new((x, y, z1)) for x, y in points]
    ob, ot = [bm.verts.new((x, y, z0)) for x, y in outer], [bm.verts.new((x, y, z1)) for x, y in outer]
    for i in range(len(points)):
        j = (i + 1) % len(points)
        for face in ((it[i], it[j], ot[j], ot[i]), (ib[i], ob[i], ob[j], ib[j]), (ob[i], ob[j], ot[j], ot[i]),
                     (ib[j], ib[i], it[i], it[j])):
            bm.faces.new(face)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def profile_x(points, x0, x1):
    """Perfil (y, z) extruido a lo largo de X entre x0 y x1 (tramos de escalera, rampas)."""
    bm = prism(points, x0, x1)
    # El prisma se construye sobre XY y se lleva a YZ: (y, z, x) → (x, y, z).
    for vert in bm.verts:
        y, z, x = vert.co
        vert.co = (x, y, z)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def footprint(x0, x1, y0, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def wall(x0, x1, y, h, material, name, t=WALL_T, skirting=None):
    """Muro recto a lo largo de X centrado en `y`, con zócalo opcional que lo rodea (también en sus testas)."""
    objects = [box(x1 - x0, t, h, ((x0 + x1) / 2, y, 0), material, name)]
    if skirting:
        objects.append(add(ring(footprint(x0, x1, y - t / 2, y + t / 2), .012, 0, .1), skirting, f'{name}-zocalo'))
    return objects


def tube(points, radius, material, name):
    return add(geo.tube(points, radius, segments=12, round_ends=radius), material, name, smooth=60)


def railing(path, material, name, height=.9, spacing=1.0):
    """Barandilla metálica: pasamanos a `height` sobre la trayectoria y balaustres verticales cada `spacing` m."""
    pts = [Vector(p) for p in path]
    objects = [tube([p + Vector((0, 0, height)) for p in pts], .022, material, f'{name}-pasamanos')]
    length = sum((b - a).length for a, b in zip(pts, pts[1:]))
    count = max(2, round(length / spacing) + 1)
    for k in range(count):
        target, walked = length * k / (count - 1), 0.0
        for a, b in zip(pts, pts[1:]):
            seg = (b - a).length
            if walked + seg >= target - 1e-6:
                p = a.lerp(b, (target - walked) / seg if seg else 0)
                objects.append(tube([p, p + Vector((0, 0, height))], .014, material, f'{name}-balaustre'))
                break
            walked += seg
    return objects


def flight(steps, z0, origin, direction, material, tread):
    """Tramo macizo de escalera: `steps` peldaños desde la cota z0 en `direction` (0, 90, 180, 270 grados)."""
    objects = []
    angle = math.radians(direction)
    forward = Vector((-math.sin(angle), math.cos(angle), 0))
    for k in range(steps):
        top = z0 + (k + 1) * RISE
        center = Vector((*origin, 0)) + forward * ((k + .5) * RUN)
        objects.append(box(STAIR_W, RUN, top - .03, (*center.xy, 0), material, 'peldano-cuerpo', rot=direction))
        nose = center - forward * .01
        objects.append(box(STAIR_W + .01, RUN + .02, .03, (*nose.xy, top - .03), tread, 'huella', r=.003, rot=direction))
    return objects


def stair_path(origin, direction, steps, z0, lateral):
    """Recorrido del pasamanos a lo largo del borde lateral (`lateral` = -1 izquierda, 1 derecha) de un tramo."""
    angle = math.radians(direction)
    forward, side = Vector((-math.sin(angle), math.cos(angle), 0)), Vector((math.cos(angle), math.sin(angle), 0))
    edge = Vector((*origin, 0)) + side * (lateral * (STAIR_W / 2 - .05))
    return [edge + forward * (RUN * .5) + Vector((0, 0, z0 + RISE)),
            edge + forward * (RUN * (steps - .5)) + Vector((0, 0, z0 + steps * RISE))]


def grass(width, depth, z, density=26000, seed=7, height=(.035, .085), exclude=None):
    """Césped de briznas reales (malla) sobre un rectángulo centrado en el origen; `exclude` = semiejes de un hueco."""
    rng = random.Random(seed)
    count = int(width * depth * density)
    verts, faces, tone, level = [], [], [], []
    for _ in range(count):
        x, y = rng.uniform(-width / 2, width / 2), rng.uniform(-depth / 2, depth / 2)
        if exclude and abs(x) < exclude[0] and abs(y) < exclude[1]:
            continue
        h, yaw, lean, w = rng.uniform(*height), rng.uniform(0, math.tau), rng.uniform(.1, .55), rng.uniform(.0025, .0042)
        dx, dy = math.cos(yaw), math.sin(yaw)
        lx, ly = -dy * lean * h, dx * lean * h
        base = len(verts)
        verts += [(x - dx * w / 2, y - dy * w / 2, z), (x + dx * w / 2, y + dy * w / 2, z),
                  (x - dx * w * .35 + lx * .35, y - dy * w * .35 + ly * .35, z + h * .55),
                  (x + dx * w * .35 + lx * .35, y + dy * w * .35 + ly * .35, z + h * .55),
                  (x + lx, y + ly, z + h * (1 - lean * .35))]
        faces += [(base, base + 1, base + 3, base + 2), (base + 2, base + 3, base + 4)]
        shade = rng.random() ** 1.4
        tone += [shade] * 5
        level += [0.0, 0.0, .55, .55, 1.0]
    mesh = bpy.data.meshes.new('cesped')
    mesh.from_pydata(verts, [], faces)
    for name, values in (('tono', tone), ('altura', level)):
        attribute = mesh.attributes.new(name, 'FLOAT', 'POINT')
        attribute.data.foreach_set('value', values)
    mesh.materials.append(grass_material())
    obj = bpy.data.objects.new('cesped', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


# ── escenas ───────────────────────────────────────────────────────────────────────────────────────────────────────

def scene_pared(m):
    """Muro enlucido con zócalo; la testa izquierda, cortada, deja ver el ladrillo entre las dos capas de yeso."""
    brick = textured('ladrillo', 'brick', tint='#f2e6dc', sat=.8, rough=(.7, .95), normal=1.0)
    skin, x0, x1 = .015, -1.5, 1.5
    core = WALL_T - 2 * skin
    objects = [box(x1 - x0, core, WALL_H - skin, ((x0 + x1) / 2, 0, 0), brick, 'pared-ladrillo')]
    for y in (-(core + skin) / 2, (core + skin) / 2):
        objects.append(box(x1 - x0, skin, WALL_H, ((x0 + x1) / 2, y, 0), m['yeso'], 'pared-enlucido'))
    objects.append(box(x1 - x0, core, skin, ((x0 + x1) / 2, 0, WALL_H - skin), m['yeso'], 'pared-enlucido'))
    objects.append(box(skin, core, WALL_H - skin, (x1 - skin / 2, 0, 0), m['yeso'], 'pared-enlucido'))
    for y in (-WALL_T / 2 - .006, WALL_T / 2 + .006):
        objects.append(box(x1 - x0 + .012, .012, .1, ((x0 + x1) / 2 + .006, y, 0), m['zocalo'], 'pared-zocalo'))
    return objects


def scene_murete(m):
    cap = textured('albardilla', 'stone', tint='#fbf6ee', rough=(.35, .6), normal=.4)
    return [box(2.2, WALL_T, 1.07, (0, 0, 0), m['yeso'], 'murete'),
            box(2.24, WALL_T + .04, .03, (0, 0, 1.07), cap, 'albardilla', r=.004)]


def overhead_light(size, height, power):
    """Luz cenital amplia (como un lucernario): el estudio de hk_render no llega al suelo entre muros altos."""
    data = bpy.data.lights.new('cenital', 'AREA')
    data.shape, data.size, data.energy = 'DISK', size, power
    light = bpy.data.objects.new('cenital', data)
    light.location = (0, 0, height)
    bpy.context.scene.collection.objects.link(light)
    return light


def room(points, m, door=True):
    """Habitación vacía sin techo: suelo de tarima, muros enlucidos, zócalo interior, losa vista y un paso de puerta."""
    overhead_light(4.0, 6.0, 260)
    walls = add(ring(points, WALL_T, 0, WALL_H), m['yeso'], 'muros')
    skirting = add(ring(points, -.012, .015, .09), m['zocalo'], 'zocalo')
    objects = [walls, add(prism(points, 0, .015), m['tarima'], 'tarima'),
               add(prism(offset(points, WALL_T), -.12, 0), m['losa'], 'losa'), skirting]
    if door:
        (ax, ay), (bx, by) = points[0], points[1]
        cutter = box(.9, WALL_T * 4, 2.1, (ax + (bx - ax) * .62, ay + (by - ay) * .62 - WALL_T / 2, 0), m['yeso'], 'hueco-puerta')
        cutter.hide_render = True
        for target in (walls, skirting):
            modifier = target.modifiers.new('puerta', 'BOOLEAN')
            modifier.operation, modifier.object, modifier.solver = 'DIFFERENCE', cutter, 'EXACT'
    return objects


def centered(points):
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    return [(x - cx, y - cy) for x, y in points]


ROOM_SHAPES = {
    'rect': centered([(0, 0), (4.2, 0), (4.2, 3.2), (0, 3.2)]),
    'L': centered([(0, 0), (4.4, 0), (4.4, 2.0), (2.0, 2.0), (2.0, 3.8), (0, 3.8)]),
    'U': centered([(0, 0), (4.6, 0), (4.6, 3.6), (3.2, 3.6), (3.2, 1.6), (1.4, 1.6), (1.4, 3.6), (0, 3.6)]),
    'T': centered([(1.5, 0), (3.1, 0), (3.1, 2.0), (4.6, 2.0), (4.6, 3.6), (0, 3.6), (0, 2.0), (1.5, 2.0)]),
}


def scene_habitacion(m):
    return room(ROOM_SHAPES['rect'], m)


def scene_habitacion_shape(shape):
    return lambda m: room(ROOM_SHAPES[shape], m)


SHAPE_OUTLINES = {
    'L': [(0, 0), (1.6, 0), (1.6, .45), (.45, .45), (.45, 1.5), (0, 1.5)],
    'U': [(0, 0), (1.7, 0), (1.7, 1.4), (1.25, 1.4), (1.25, .45), (.45, .45), (.45, 1.4), (0, 1.4)],
    'T': [(.6, 0), (1.1, 0), (1.1, 1.0), (1.7, 1.0), (1.7, 1.45), (0, 1.45), (0, 1.0), (.6, 1.0)],
}


def scene_forma(shape):
    return lambda m: [add(prism(centered(SHAPE_OUTLINES[shape]), 0, 1.1), m['yeso'], f'forma-{shape}')]


def scene_cocina(m):
    front = plain('frente-lacado', '#97a18c', rough=.42, bump=.01)
    counter = textured('encimera', 'marble', tint='#ffffff', rough=(.12, .3), normal=.2)
    steel = plain('acero', '#c9cbcc', rough=.22, metal=1.0)
    dark = plain('rodapie', '#4a4743', rough=.6)
    hob = plain('vitro', '#0d0e10', rough=.06, coat=1.0)
    carcass = plain('casco', '#e9e5dd', rough=.6)
    modules, width, depth = 4, .6, .58
    left = -modules * width / 2
    objects = [box(modules * width, depth - .05, .1, (0, .025, 0), dark, 'rodapie'),
               box(modules * width - .004, depth - .02, .76, (0, .01, .1), carcass, 'cascos')]
    layouts = [[.245, .245, .245], [.75], [.37, .37], [.75]]
    for i, heights in enumerate(layouts):
        x = left + (i + .5) * width
        z = .105
        for h in heights:
            objects.append(box(width - .004, .018, h, (x, -depth / 2 - .009, z), front, 'frente', r=.0015))
            objects.append(box(.16, .012, .012, (x, -depth / 2 - .042, z + h - .045), steel, 'tirador', r=.005))
            for dx in (-.07, .07):
                objects.append(box(.01, .025, .01, (x + dx, -depth / 2 - .028, z + h - .044), steel, 'tirador-pie'))
            z += h + .004
    top = box(modules * width + .02, depth + .04, .03, (0, -.01, .86), counter, 'encimera', r=.002)
    sink_x = left + 1.5 * width
    cutter = box(.48, .38, .3, (sink_x, -.02, .7), counter, 'hueco-fregadero')
    cutter.hide_render = True
    modifier = top.modifiers.new('fregadero', 'BOOLEAN')
    modifier.operation, modifier.object, modifier.solver = 'DIFFERENCE', cutter, 'EXACT'
    objects.append(top)
    basin = geo.merge([geo.box(.48, .38, .004, at=(sink_x, -.02, .69)), geo.box(.004, .38, .2, at=(sink_x - .238, -.02, .69)),
                       geo.box(.004, .38, .2, at=(sink_x + .238, -.02, .69)), geo.box(.48, .004, .2, at=(sink_x, -.208, .69)),
                       geo.box(.48, .004, .2, at=(sink_x, .168, .69))])
    objects.append(add(basin, steel, 'seno'))
    objects.append(tube([(sink_x, .2, .89), (sink_x, .2, 1.18), (sink_x, .14, 1.24), (sink_x, .06, 1.2), (sink_x, .05, 1.12)],
                        .012, steel, 'grifo'))
    objects.append(box(.05, .05, .02, (sink_x, .2, .89), steel, 'grifo-base', r=.01))
    hob_x = left + 2.5 * width
    objects.append(box(.58, .5, .006, (hob_x, -.02, .89), hob, 'placa', r=.003))
    ring_mat = plain('serigrafia', '#5d5f63', rough=.4)
    for cx, cy, r in ((-.14, -.12, .09), (.14, -.12, .07), (-.14, .1, .07), (.14, .1, .09)):
        circle = [(hob_x + cx + r * math.cos(a), -.02 + cy + r * math.sin(a), .8965)
                  for a in [k * math.tau / 48 for k in range(48)]]
        objects.append(add(geo.tube(circle, .0012, segments=6, closed=True), ring_mat, 'zona'))
    return objects


def scene_escalera_recta(m):
    origin = (0, -1.6)
    objects = flight(11, 0, origin, 0, m['yeso'], m['roble'])
    objects += railing(stair_path(origin, 0, 11, 0, 1), m['carril'], 'barandilla')
    return objects


def scene_escalera_l(m):
    first, second = 6, 6
    objects = flight(first, 0, (0, -1.3), 0, m['yeso'], m['roble'])
    land_y = -1.3 + first * RUN + STAIR_W / 2
    top = first * RISE
    objects.append(box(STAIR_W, STAIR_W, top - .03, (0, land_y, 0), m['yeso'], 'rellano'))
    objects.append(box(STAIR_W + .01, STAIR_W + .01, .03, (0, land_y, top - .03), m['roble'], 'rellano-suelo', r=.003))
    start = (STAIR_W / 2, land_y)
    objects += flight(second, top, start, 270, m['yeso'], m['roble'])
    objects += railing(stair_path((0, -1.3), 0, first, 0, 1), m['carril'], 'barandilla-1')
    objects += railing(stair_path(start, 270, second, top, -1), m['carril'], 'barandilla-2')
    return objects


def scene_escalera_u(m):
    first, second, gap = 6, 6, .1
    x1, x2 = -(STAIR_W + gap) / 2, (STAIR_W + gap) / 2
    objects = flight(first, 0, (x1, -1.0), 0, m['yeso'], m['roble'])
    land_y = -1.0 + first * RUN + STAIR_W / 2
    top = first * RISE
    width = 2 * STAIR_W + gap
    objects.append(box(width, STAIR_W, top - .03, (0, land_y, 0), m['yeso'], 'rellano'))
    objects.append(box(width + .01, STAIR_W + .01, .03, (0, land_y, top - .03), m['roble'], 'rellano-suelo', r=.003))
    start = (x2, land_y - STAIR_W / 2)
    objects += flight(second, top, start, 180, m['yeso'], m['roble'])
    objects += railing(stair_path((x1, -1.0), 0, first, 0, -1), m['carril'], 'barandilla-1')
    objects += railing(stair_path(start, 180, second, top, -1), m['carril'], 'barandilla-2')
    return objects


def microcement():
    return textured('microcemento', 'microcement', tint='#f2efea', rough=(.45, .7), normal=.4)


def scene_descansillo(m):
    """Plataforma de 1,2 × 1,2 m a la llegada de un tramo corto, que es como se usa en el editor."""
    size, steps = 1.2, 4
    height = steps * RISE
    objects = [box(size, size, height - .03, (0, 0, 0), m['yeso'], 'descansillo'),
               box(size + .01, size + .01, .03, (0, 0, height - .03), m['roble'], 'descansillo-suelo', r=.003)]
    start = (-size / 2 - steps * RUN, -size / 2 + STAIR_W / 2)
    return objects + flight(steps, 0, start, 270, m['yeso'], m['roble'])


def scene_rampa(m):
    length, width, rise = 3.2, 1.2, .42
    surface = microcement()
    y0 = -length / 2
    body = add(profile_x([(y0, 0), (y0 + length, rise - .02), (y0 + length, 0)], -width / 2, width / 2), m['yeso'], 'rampa')
    deck = add(profile_x([(y0 - .002, 0), (y0 + length, rise - .02), (y0 + length, rise), (y0, .02)],
                         -width / 2 - .005, width / 2 + .005), surface, 'rampa-suelo')
    # Una sola barandilla, la del lado lejano: la de delante taparía la pendiente en la foto.
    x = width / 2 - .05
    return [body, deck] + railing([(x, y0 + .15, .02 + rise * .15 / length), (x, y0 + length - .1, rise)], m['carril'],
                                  'barandilla', spacing=.8)


def scene_columna(m):
    return [box(.4, .4, 2.6, (0, 0, 0), m['yeso'], 'columna'),
            add(ring(footprint(-.2, .2, -.2, .2), .012, 0, .08), m['zocalo'], 'zocalo')]


def scene_paso(m):
    gap, head = .9, 2.1
    objects = wall(-1.5, -gap / 2, 0, WALL_H, m['yeso'], 'pared-izquierda', skirting=m['zocalo'])
    objects += wall(gap / 2, 1.5, 0, WALL_H, m['yeso'], 'pared-derecha', skirting=m['zocalo'])
    objects.append(box(gap, WALL_T, WALL_H - head, (0, 0, head), m['yeso'], 'dintel'))
    return objects


def surface_slab(width, depth, top_material, base_material, thickness=.1, top=.03, name='superficie'):
    return [box(width, depth, thickness - top, (0, 0, 0), base_material, f'{name}-base'),
            box(width, depth, top, (0, 0, thickness - top), top_material, name, r=.002)]


def scene_patio(m):
    """Terraza de baldosa de gran formato sobre una solera, con una franja de césped alrededor."""
    tiles = textured('baldosa-exterior', 'patio', tint='#f6f1e9', sat=.55, value=1.05, rough=(.55, .85), normal=.6, scale=2.2)
    base = plain('solera', '#bdb7ad', rough=.95, bump=.15, bump_scale=80.0)
    soil = plain('tierra', '#5b4636', rough=1.0, bump=.6, bump_scale=60.0)
    ground = textured('suelo-cesped', 'grass', tint='#c7c7b6', value=.75, rough=(.8, 1.0), normal=.8)
    width, depth, lawn = 2.4, 1.7, .32
    terrace = [(-width / 2, -depth / 2), (width / 2, -depth / 2), (width / 2, depth / 2), (-width / 2, depth / 2)]
    objects = [box(width + 2 * lawn, depth + 2 * lawn, .1, (0, 0, 0), soil, 'tierra'),
               add(ring(terrace, lawn, .1, .11), ground, 'tierra-superficie')]
    objects += [box(width, depth, .09, (0, 0, .03), base, 'terraza-base'),
                box(width, depth, .025, (0, 0, .12), tiles, 'terraza', r=.002)]
    objects.append(grass(width + 2 * lawn, depth + 2 * lawn, .11, exclude=(width / 2 + .005, depth / 2 + .005)))
    return objects


def scene_pavimento(m):
    pavers = textured('adoquin', 'pavers', tint='#f1ece4', value=1.2, sat=.8, rough=(.6, .9), normal=1.4)
    base = plain('arena', '#b9a98e', rough=1.0, bump=.3, bump_scale=120.0)
    return surface_slab(2.2, 1.5, pavers, base, thickness=.12, top=.06, name='pavimento')


def scene_terreno(m):
    soil = plain('tierra', '#5b4636', rough=1.0, bump=.6, bump_scale=60.0)
    ground = textured('suelo-cesped', 'grass', tint='#c7c7b6', value=.75, rough=(.8, 1.0), normal=.8)
    width, depth, thickness = 2.0, 1.35, .14
    return [box(width, depth, thickness - .01, (0, 0, 0), soil, 'tierra'),
            box(width, depth, .01, (0, 0, thickness - .01), ground, 'tierra-superficie'),
            grass(width, depth, thickness)]


# Escena → (constructor, acimut, elevación de la cámara en grados).
SCENES = {
    'pared': (scene_pared, -55, 18),
    'murete': (scene_murete, -34, 18),
    'habitacion': (scene_habitacion, -28, 52),
    'habitacion-l': (scene_habitacion_shape('L'), -28, 52),
    'habitacion-u': (scene_habitacion_shape('U'), -28, 52),
    'habitacion-t': (scene_habitacion_shape('T'), -28, 52),
    'cocina': (scene_cocina, -30, 18),
    'forma-l': (scene_forma('L'), -32, 46),
    'forma-u': (scene_forma('U'), -32, 46),
    'forma-t': (scene_forma('T'), -32, 46),
    'escalera-recta': (scene_escalera_recta, -48, 22),
    'escalera-l': (scene_escalera_l, -40, 28),
    'escalera-u': (scene_escalera_u, -72, 34),
    'descansillo': (scene_descansillo, -34, 24),
    'rampa': (scene_rampa, -62, 18),
    'columna': (scene_columna, -34, 14),
    'paso-abierto': (scene_paso, -30, 14),
    'patio': (scene_patio, -30, 30),
    'pavimento': (scene_pavimento, -30, 30),
    'terreno': (scene_terreno, -30, 26),
}


# ── ejecución ─────────────────────────────────────────────────────────────────────────────────────────────────────

def clear():
    rig = bpy.data.collections.get(hk_render.RIG)
    keep = set(rig.objects) if rig else set()
    for obj in [obj for obj in bpy.data.objects if obj not in keep]:
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in [mesh for mesh in bpy.data.meshes if mesh.users == 0]:
        bpy.data.meshes.remove(mesh)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(argv) != 2 or argv[0] != '--job':
        raise SystemExit('Uso: construction_photos.py -- --job <trabajo.json>')
    with open(argv[1], encoding='utf-8') as handle:
        job = json.load(handle)
    TEX.update(job['textures'])
    scenes = job['scenes'] or list(SCENES)
    unknown = [scene for scene in scenes if scene not in SCENES]
    if unknown:
        raise SystemExit(f'Escenas desconocidas: {", ".join(unknown)} (válidas: {", ".join(SCENES)})')
    hk_render.setup(samples=job['samples'], size=tuple(job['size']))
    m = finishes()
    for scene in scenes:
        builder, azimuth, elevation = SCENES[scene]
        clear()
        objects = builder(m)
        hk_render.render([obj for obj in objects if not obj.hide_render], os.path.join(job['output'], f'{scene}.png'),
                         azimuth=azimuth, elevation=elevation)
        print(f'HK-OK {scene}', flush=True)


main()
