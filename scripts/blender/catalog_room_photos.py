"""Fotos de portada del catálogo para las estancias Infantil, Recibidor, Lavadero y Garaje (Cycles, Blender 5).

Lo lanza scripts/build-catalog-room-photos.mjs con un trabajo JSON: rutas de los GLB ya descomprimidos, texturas CC0
(color, normal, rugosidad y tamaño real del mosaico), HDRI, muestras y resolución. Cada escena monta una habitación
(suelo, paredes con huecos, techo y rodapiés), coloca muebles del repositorio, añade los complementos modelados aquí
(libros, juguetes, cestas, toallas, puertas, ventanas, cortinas…) y se ilumina con el HDRI que entra por las ventanas.

Ejes: X = ancho de la habitación, Y = fondo (la cámara mira hacia +Y), Z = alto; suelo en Z = 0. Interior de la
habitación: x ∈ [0, W], y ∈ [0, D]. Las paredes se nombran back (y = D), front (y = 0), left (x = 0) y right (x = W);
en cada pared, `a` es la coordenada a lo largo de ella (x en back/front, y en left/right) y `c` la profundidad hacia
fuera desde la cara interior.
No modifica módulos de la fábrica: solo importa primitivas de hk_geo.
"""
import json
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hk_geo as geo  # noqa: E402

WALL_T = .15
BOOK_COLORS = ['#e6dccb', '#9caf88', '#c27c5a', '#d9c3a0', '#7d8f75', '#b9a48a', '#6f8796', '#e9d8b4', '#a65d47',
               '#f2efe8']
_SUN_CACHE = {}


# ── utilidades de materiales ──────────────────────────────────────────────────────────────────────────────────────

def rgb(hex_color, alpha=1.0):
    value = hex_color.lstrip('#')
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in srgb) + (alpha,)


def _set(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


def _new_material(name):
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


def mat(name, color='#cccccc', rough=.5, metal=0.0, coat=0.0, sheen=0.0, bump=0.0, bump_scale=300.0,
        emission=None, strength=0.0):
    """Material liso (pinturas, metales, tejidos, cerámica) con microrrelieve opcional de ruido."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    material, tree, bsdf = _new_material(name)
    for key, value in {'Base Color': rgb(color), 'Roughness': rough, 'Metallic': metal, 'Coat Weight': coat,
                       'Coat Roughness': .1, 'Sheen Weight': sheen, 'Sheen Roughness': .4,
                       'Emission Strength': strength if emission else 0.0, 'Emission Color': rgb(emission or '#000000')}.items():
        _set(bsdf, key, value)
    if bump:
        noise = tree.nodes.new('ShaderNodeTexNoise')
        _set(noise, 'Scale', bump_scale)
        _set(noise, 'Detail', 6.0)
        node = tree.nodes.new('ShaderNodeBump')
        _set(node, 'Strength', bump)
        tree.links.new(noise.outputs['Fac'], node.inputs['Height'])
        tree.links.new(node.outputs['Normal'], bsdf.inputs['Normal'])
    return material


def tex_mat(name, tex, tint='#ffffff', value=1.0, sat=1.0, rough=(0.0, 1.0), normal=1.0, tile=None, coat=0.0):
    """Material PBR con una textura CC0 proyectada en caja sobre coordenadas de objeto (metros reales)."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    material, tree, bsdf = _new_material(name)
    coords = tree.nodes.new('ShaderNodeTexCoord')
    mapping = tree.nodes.new('ShaderNodeMapping')
    size = tile or tex['tile']
    mapping.inputs['Scale'].default_value = (1 / size, 1 / size, 1 / size)
    tree.links.new(coords.outputs['Object'], mapping.inputs['Vector'])

    def image(path, non_color):
        node = tree.nodes.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(path, check_existing=True)
        if non_color:
            node.image.colorspace_settings.name = 'Non-Color'
        node.projection, node.projection_blend = 'BOX', .15
        tree.links.new(mapping.outputs['Vector'], node.inputs['Vector'])
        return node

    color = image(tex['color'], False)
    hsv = tree.nodes.new('ShaderNodeHueSaturation')
    _set(hsv, 'Saturation', sat)
    _set(hsv, 'Value', value)
    tree.links.new(color.outputs['Color'], hsv.inputs['Color'])
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
    _set(bsdf, 'Coat Weight', coat)
    _set(bsdf, 'Coat Roughness', .15)
    return material


def sheer_mat(name='cortina', color='#f4f0e8'):
    """Visillo de lino: mezcla de transparencia, translucidez y tejido."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    material, tree, bsdf = _new_material(name)
    output = next(n for n in tree.nodes if n.type == 'OUTPUT_MATERIAL')
    _set(bsdf, 'Base Color', rgb(color))
    _set(bsdf, 'Roughness', .9)
    _set(bsdf, 'Sheen Weight', .6)
    translucent = tree.nodes.new('ShaderNodeBsdfTranslucent')
    _set(translucent, 'Color', rgb(color))
    transparent = tree.nodes.new('ShaderNodeBsdfTransparent')
    cloth, final = tree.nodes.new('ShaderNodeMixShader'), tree.nodes.new('ShaderNodeMixShader')
    cloth.inputs['Fac'].default_value, final.inputs['Fac'].default_value = .45, .55
    tree.links.new(bsdf.outputs['BSDF'], cloth.inputs[1])
    tree.links.new(translucent.outputs['BSDF'], cloth.inputs[2])
    tree.links.new(transparent.outputs['BSDF'], final.inputs[1])
    tree.links.new(cloth.outputs['Shader'], final.inputs[2])
    tree.links.new(final.outputs['Shader'], output.inputs['Surface'])
    return material


# ── geometría y colocación ────────────────────────────────────────────────────────────────────────────────────────

class Batch:
    """Acumula mallas bmesh por material y crea un objeto por material (menos objetos y menos memoria)."""

    def __init__(self, name):
        self.name, self.parts = name, {}

    def add(self, bm, material):
        self.parts.setdefault(material.name, (material, []))[1].append(bm)
        return bm

    def flush(self, smooth=30):
        objects = []
        for material, meshes in self.parts.values():
            objects.append(add_object(geo.merge(meshes), material, f'{self.name}-{material.name}', smooth))
        self.parts = {}
        return objects


def add_object(bm, material, name, smooth=30):
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


def cube(w, d, h, at, material, r=0.0, name='caja', rot=0.0):
    bm = geo.box(w, d, h, r=r, segments=2)
    geo.transform(bm, loc=at, rot=(0, 0, rot))
    return add_object(bm, material, name, smooth=30 if r else 0)


def moved(bm, loc=(0, 0, 0), rot=0.0):
    return geo.transform(bm, loc=loc, rot=(0, 0, math.radians(rot)))


def import_glb(path, name):
    """Importa un GLB y lo cuelga de un vacío cuyo origen es el centro de la base del modelo."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in new if obj.type == 'MESH']
    if not meshes:
        raise RuntimeError(f'{path} no contiene mallas')
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    low = Vector([min(c[k] for c in corners) for k in range(3)])
    high = Vector([max(c[k] for c in corners) for k in range(3)])
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    offset = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    for obj in new:
        if obj.parent is None:
            obj.parent = root
            obj.location -= offset
    root['dims'] = list(high - low)
    return root


def place(models, key, loc=(0, 0, 0), rot=0.0, scale=1.0):
    root = import_glb(models[key], key)
    root.location = loc
    root.rotation_euler.z = math.radians(rot)
    root.scale = (scale, scale, scale)
    bpy.context.view_layer.update()
    return root


def dims(root):
    return Vector(root['dims']) * root.scale[0]


def surface_z(x, y, z_top=3.0, z_min=0.0):
    """Cota de la primera superficie bajo (x, y) (para apoyar objetos en baldas y encimeras importadas)."""
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    hit, location, *_ = bpy.context.scene.ray_cast(depsgraph, Vector((x, y, z_top)), Vector((0, 0, -1)))
    return location.z if hit and location.z >= z_min else z_min


# ── habitación ────────────────────────────────────────────────────────────────────────────────────────────────────

class Room:
    """Caja de la habitación con huecos: openings = {pared: [(a0, a1, z0, z1), ...]}."""

    ANGLES = {'back': 0.0, 'front': 180.0, 'left': 90.0, 'right': -90.0}

    def __init__(self, W, D, H, floor, wall, ceiling, openings=None, skirting=True):
        self.W, self.D, self.H = W, D, H
        self.openings = openings or {}
        t = WALL_T
        cube(W + 2 * t, D + 2 * t, .05, (W / 2, D / 2, -.05), floor, name='suelo')
        cube(W + 2 * t, D + 2 * t, t, (W / 2, D / 2, H), ceiling, name='techo')
        self._wall('back', 'x', -t, W + t, D, D + t, wall)
        front = self._wall('front', 'x', -t, W + t, -t, 0, wall)
        front.visible_camera = False  # la cámara puede retroceder detrás; sigue reflejándose y rebotando luz
        self._wall('left', 'y', 0, D, -t, 0, wall)
        self._wall('right', 'y', 0, D, W, W + t, wall)
        if skirting:
            self._skirting(mat('rodapie', '#efebe4', rough=.45))

    def _wall(self, name, axis, a0, a1, c0, c1, material):
        holes = self.openings.get(name, [])
        cuts = sorted({a0, a1, *[v for hole in holes for v in hole[:2]]})
        blocks = []
        for p, q in zip(cuts, cuts[1:]):
            if q - p < 1e-6:
                continue
            mid = (p + q) / 2
            z = 0.0
            for zb, zt in sorted((h[2], h[3]) for h in holes if h[0] < mid < h[1]) + [(self.H, self.H)]:
                if zb > z + 1e-6:
                    if axis == 'x':
                        blocks.append(geo.box(q - p, c1 - c0, zb - z, at=((p + q) / 2, (c0 + c1) / 2, z)))
                    else:
                        blocks.append(geo.box(c1 - c0, q - p, zb - z, at=((c0 + c1) / 2, (p + q) / 2, z)))
                z = max(z, zt)
        return add_object(geo.merge(blocks), material, f'pared-{name}', smooth=0)

    def frame(self, wall, a):
        """Punto de la cara interior de la pared y giro (grados) que orienta el frente de un mueble hacia la sala."""
        point = {'back': (a, self.D), 'front': (a, 0.0), 'left': (0.0, a), 'right': (self.W, a)}[wall]
        return Vector((*point, 0.0)), self.ANGLES[wall]

    def inward(self, wall):
        return {'back': Vector((0, -1, 0)), 'front': Vector((0, 1, 0)), 'left': Vector((1, 0, 0)),
                'right': Vector((-1, 0, 0))}[wall]

    def on_wall(self, bm, wall, a, z=0.0):
        """Lleva una malla local (X a lo largo de la pared, +Y hacia fuera, Z absoluta) a la pared."""
        point, angle = self.frame(wall, a)
        return geo.transform(bm, loc=(point.x, point.y, z), rot=(0, 0, math.radians(angle)))

    def against(self, models, key, wall, a, gap=.01, z=0.0, scale=1.0, depth=None):
        """Coloca un GLB con la espalda contra la pared, centrado en `a` y mirando a la habitación."""
        root = place(models, key, scale=scale)
        point, angle = self.frame(wall, a)
        half = (depth if depth is not None else dims(root).y) / 2
        root.location = point + self.inward(wall) * (half + gap) + Vector((0, 0, z))
        root.rotation_euler.z = math.radians(angle)
        bpy.context.view_layer.update()
        return root

    def _skirting(self, material):
        batch = Batch('rodapie')
        for wall in ('back', 'front', 'left', 'right'):
            length = self.W if wall in ('back', 'front') else self.D
            doors = sorted((h[0], h[1]) for h in self.openings.get(wall, []) if h[2] < .1)
            start = 0.0
            for d0, d1 in doors + [(length, length)]:
                if d0 - start > .02:
                    bm = geo.box(d0 - start, .012, .08, at=(0, -.006, 0))
                    batch.add(self.on_wall(bm, wall, (start + d0) / 2), material)
                start = max(start, d1)
        batch.flush(smooth=0)

    def window(self, wall, a0, a1, z0, z1, frame_mat, sill_mat=None, mullions=1, portal=True):
        """Carpintería fina (marco perimetral y montantes), vierteaguas interior y portal de luz en el hueco."""
        batch, w, h, f = Batch(f'ventana-{wall}'), a1 - a0, z1 - z0, .05
        depth = (.06, .1)
        cy = (depth[0] + depth[1]) / 2
        pieces = [(w, f, 0, z0), (w, f, 0, z1 - f), (f, h, -w / 2 + f / 2, z0), (f, h, w / 2 - f / 2, z0)]
        for i in range(1, mullions + 1):
            pieces.append((f * .8, h, -w / 2 + w * i / (mullions + 1), z0))
        pieces.append((w, f * .8, 0, z0 + h * .72))
        for pw, ph, px, pz in pieces:
            batch.add(self.on_wall(geo.box(pw, depth[1] - depth[0], ph, at=(px, cy, pz)), wall, (a0 + a1) / 2),
                      frame_mat)
        if sill_mat:
            batch.add(self.on_wall(geo.box(w + .08, .06 + .04, .025, r=.004, at=(0, .01, z0 - .025)), wall,
                                   (a0 + a1) / 2), sill_mat)
        batch.flush(smooth=0)
        if portal:
            data = bpy.data.lights.new(f'portal-{wall}', 'AREA')
            data.shape, data.size, data.size_y = 'RECTANGLE', w, h
            data.cycles.is_portal = True
            light = bpy.data.objects.new(f'portal-{wall}', data)
            point, _ = self.frame(wall, (a0 + a1) / 2)
            light.location = point - self.inward(wall) * WALL_T + Vector((0, 0, (z0 + z1) / 2))
            target = light.location + self.inward(wall)
            light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.scene.collection.objects.link(light)

    def curtain(self, wall, a, width, z_top, z_bottom, folds=7, material=None, offset=.12, seed=0):
        """Visillo fruncido colgado delante de la pared."""
        rng = random.Random(seed)
        phases = [rng.uniform(0, 1) for _ in range(4)]

        def fn(u, v):
            x = (u - .5) * width
            wave = math.sin(u * folds * 2 * math.pi + phases[0]) * .035 + math.sin(u * 23 + phases[1]) * .008
            sway = (1 - v) * .02 * math.sin(u * 5 + phases[2])
            return (x, -offset + wave + sway, z_bottom + v * (z_top - z_bottom))

        bm = geo.surface(int(folds * 10), 12, fn)
        add_object(self.on_wall(bm, wall, a), material or sheer_mat(), f'cortina-{wall}-{a:.2f}', smooth=80)


# ── escena, luz, cámara y render ─────────────────────────────────────────────────────────────────────────────────

def reset():
    for collection in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras,
                       bpy.data.worlds, bpy.data.node_groups, bpy.data.curves):
        for item in list(collection):
            collection.remove(item)
    for image in list(bpy.data.images):
        if not image.filepath.endswith('.hdr'):
            bpy.data.images.remove(image)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)


def _gpu():
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        found = False
        for device in prefs.devices:
            device.use = device.type == 'METAL'
            found = found or device.use
        return found
    except Exception:  # noqa: BLE001 - sin Metal se renderiza con la CPU
        return False


def setup_render(job, exposure=0.0, kelvin=6500):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU' if _gpu() else 'CPU'
    scene.cycles.samples = job['samples']
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = .008
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    scene.cycles.max_bounces, scene.cycles.diffuse_bounces, scene.cycles.glossy_bounces = 12, 6, 6
    scene.cycles.transmission_bounces, scene.cycles.transparent_max_bounces = 8, 24
    scene.cycles.sample_clamp_indirect = 6.0
    scene.cycles.caustics_reflective = scene.cycles.caustics_refractive = False
    scene.render.resolution_x, scene.render.resolution_y = job['resolution']
    scene.render.resolution_percentage, scene.render.film_transparent = 100, False
    settings = scene.render.image_settings
    settings.file_format, settings.color_mode, settings.color_depth = 'PNG', 'RGB', '16'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = exposure
    scene.view_settings.use_white_balance = True  # neutraliza el sol bajo del HDRI hasta un blanco cálido
    scene.view_settings.white_balance_temperature = kelvin
    try:
        scene.view_settings.look = 'AgX - Base Contrast'
    except TypeError:  # nombres de «look» distintos en otras versiones
        pass


def hdri_sun(path):
    """Acimut (grados, 0 = +X, sentido antihorario) y elevación del píxel más brillante del HDRI."""
    if path not in _SUN_CACHE:
        image = bpy.data.images.load(path, check_existing=True)
        width, height = image.size
        pixels = np.empty(width * height * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        pixels = pixels.reshape(height, width, 4)
        luminance = pixels[..., 0] * .2126 + pixels[..., 1] * .7152 + pixels[..., 2] * .0722
        row, col = np.unravel_index(int(np.argmax(luminance)), luminance.shape)
        u, v = (col + .5) / width, (row + .5) / height
        # Convención de Blender comprobada: dirección = (cos φ, sin φ) con φ = (0,5 − u)·2π.
        _SUN_CACHE[path] = (math.degrees((.5 - u) * 2 * math.pi), math.degrees((v - .5) * math.pi))
    return _SUN_CACHE[path]


def world(job, sun_azimuth, strength=1.0):
    """Ilumina con el HDRI girado para que su sol llegue desde `sun_azimuth` (grados; 0 = +X, 90 = +Y)."""
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new('mundo')
    tree = scene.world.node_tree
    background = next((n for n in tree.nodes if n.type == 'BACKGROUND'), None)
    if background is None:
        background = tree.nodes.new('ShaderNodeBackground')
        out = tree.nodes.new('ShaderNodeOutputWorld')
        tree.links.new(background.outputs['Background'], out.inputs['Surface'])
    coords = tree.nodes.new('ShaderNodeTexCoord')
    mapping = tree.nodes.new('ShaderNodeMapping')
    image_azimuth, elevation = hdri_sun(job['hdri'])
    mapping.inputs['Rotation'].default_value = (0, 0, math.radians(image_azimuth - sun_azimuth))
    environment = tree.nodes.new('ShaderNodeTexEnvironment')
    environment.image = bpy.data.images.load(job['hdri'], check_existing=True)
    tree.links.new(coords.outputs['Generated'], mapping.inputs['Vector'])
    tree.links.new(mapping.outputs['Vector'], environment.inputs['Vector'])
    tree.links.new(environment.outputs['Color'], background.inputs['Color'])
    background.inputs['Strength'].default_value = strength
    print(f'HK-SOL elevación {elevation:.1f}° · acimut en escena {sun_azimuth:.0f}°', flush=True)


def camera(loc, yaw=0.0, lens=24.0, shift=(0.0, 0.0), focus=None, fstop=5.6):
    """Cámara de arquitectura: eje horizontal (verticales rectas) y desplazamiento óptico en lugar de cabeceo."""
    data = bpy.data.cameras.new('camara')
    data.lens, data.sensor_width = lens, 36
    data.shift_x, data.shift_y = shift
    data.clip_start = .05
    if focus:
        data.dof.use_dof = True
        data.dof.focus_distance = focus
        data.dof.aperture_fstop = fstop
    obj = bpy.data.objects.new('camara', data)
    obj.location = loc
    obj.rotation_euler = (math.radians(90), 0, math.radians(yaw))
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.scene.camera = obj
    return obj


def _light(kind, loc, power, color, name):
    data = bpy.data.lights.new(name, kind)
    data.energy, data.color = power, rgb(color)[:3]
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    bpy.context.scene.collection.objects.link(obj)
    return obj


def point_light(loc, power, color='#ffd9a8', radius=.05, name='luz'):
    obj = _light('POINT', loc, power, color, name)
    obj.data.shadow_soft_size = radius
    return obj


def area_light(loc, target, size, power, color='#fff3e3', name='relleno'):
    """Relleno suave invisible para la cámara y los reflejos (simula la luz que rebota desde detrás del fotógrafo)."""
    obj = _light('AREA', loc, power, color, name)
    obj.data.shape, obj.data.size = 'DISK', size
    obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    obj.visible_camera = obj.visible_glossy = False
    return obj


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ── complementos modelados (coordenadas locales: X a lo ancho, frente hacia -Y, base en Z = 0) ─────────────────

def color_mat(prefix, color, **kwargs):
    return mat(f'{prefix}-{color}', color, **kwargs)


def book_row(batch, loc, rot, length, depth=.17, seed=0, hmin=.17, hmax=.25, colors=BOOK_COLORS):
    """Fila de libros de pie con grosores, alturas y colores variados."""
    rng, x = random.Random(seed), -length / 2
    while True:
        t = rng.uniform(.016, .04)
        if x + t > length / 2:
            break
        bm = geo.box(t, depth * rng.uniform(.86, 1), rng.uniform(hmin, hmax), r=.002, segments=1, at=(x + t / 2, 0, 0))
        batch.add(moved(bm, loc, rot), color_mat('libro', rng.choice(colors), rough=.55))
        x += t + .0015


def book_stack(batch, loc, rot, count=3, seed=0):
    rng, z = random.Random(seed), 0.0
    for _ in range(count):
        t, w, d = rng.uniform(.02, .035), rng.uniform(.17, .23), rng.uniform(.13, .17)
        bm = geo.box(w, d, t, r=.002, segments=1, at=(rng.uniform(-.01, .01), 0, z))
        batch.add(moved(bm, loc, rot + rng.uniform(-8, 8)), color_mat('libro', rng.choice(BOOK_COLORS), rough=.55))
        z += t


def open_box(w, d, h, t=.012, r=.004):
    """Caja abierta por arriba (cestas rectangulares, cubos)."""
    return geo.merge([geo.box(w, d, t, r=r), geo.box(t, d, h, r=r, at=(-w / 2 + t / 2, 0, 0)),
                      geo.box(t, d, h, r=r, at=(w / 2 - t / 2, 0, 0)), geo.box(w, t, h, r=r, at=(0, -d / 2 + t / 2, 0)),
                      geo.box(w, t, h, r=r, at=(0, d / 2 - t / 2, 0))])


def round_basket(r, h, wall=.012):
    return geo.lathe([(0, 0), (r * .9, 0), (r, h), (r - wall, h), (r * .9 - wall, wall), (0, wall)], segments=40)


def linens(batch, loc, rot, w, d, colors, seed=0, height=.06):
    """Ropa o mantas arrugadas asomando de una cesta."""
    rng = random.Random(seed)
    for i, color in enumerate(colors):
        bm = geo.soft_box(w * rng.uniform(.6, .9), d * rng.uniform(.6, .9), height, .03, bulge=(.01, .01, .02),
                          wrinkle=.012, seed=seed + i)
        batch.add(moved(geo.transform(bm, loc=(rng.uniform(-w, w) * .15, rng.uniform(-d, d) * .15, i * height * .45),
                                      rot=(0, 0, rng.uniform(-.5, .5))), loc, rot),
                  color_mat('tela', color, rough=1, sheen=.7, bump=.25, bump_scale=900))


def towels(batch, loc, rot, colors, w=.32, d=.24, t=.05):
    for i, color in enumerate(colors):
        bm = geo.soft_box(w, d, t, .022, bulge=(0, .004, .006), at=((i % 2) * .006, 0, i * t * .96))
        batch.add(moved(bm, loc, rot), color_mat('toalla', color, rough=1, sheen=.8, bump=.5, bump_scale=1600))


def teddy(batch, loc, rot, scale=1.0, fur='#c9a47c'):
    """Osito de peluche sentado."""
    fur_mat = color_mat('peluche', fur, rough=1, sheen=1, bump=.35, bump_scale=1100)
    light, dark = color_mat('peluche', '#ead6bd', rough=1, sheen=1), mat('ojos', '#1d1814', rough=.25)
    parts = [(.11, (0, 0, .11), 1.15, fur_mat), (.085, (0, -.01, .3), 1.0, fur_mat), (.032, (-.062, 0, .37), .55, fur_mat),
             (.032, (.062, 0, .37), .55, fur_mat), (.035, (0, -.08, .28), .8, light), (.045, (-.1, -.035, .15), 1.6, fur_mat),
             (.045, (.1, -.035, .15), 1.6, fur_mat), (.05, (-.06, -.1, .045), .8, fur_mat),
             (.05, (.06, -.1, .045), .8, fur_mat), (.011, (0, -.113, .29), 1, dark), (.009, (-.03, -.078, .32), 1, dark),
             (.009, (.03, -.078, .32), 1, dark)]
    for radius, at, flatten, material in parts:
        bm = geo.sphere(radius * scale, at=tuple(v * scale for v in at), segments=14, flatten=flatten)
        batch.add(moved(bm, loc, rot), material)


def wood_blocks(batch, loc, seed=0, count=6):
    rng = random.Random(seed)
    colors = ['#d9b98c', '#9caf88', '#c27c5a', '#e0b45a', '#e8dfcf', '#a9bfcc']
    stack = 0.0
    for i in range(count):
        s = rng.choice((.05, .06))
        if i < 3:
            at, stack = (0, 0, stack), stack + s
        else:
            at = (rng.uniform(-.25, .25), rng.uniform(-.2, .2), 0)
        bm = geo.box(s, s, s, r=.004, segments=2, at=at)
        batch.add(moved(geo.transform(bm, rot=(0, 0, rng.uniform(-.6, .6))), loc), color_mat('juguete', colors[i % 6], rough=.5))


def tipi(batch, loc, rot, size=1.1, height=1.6, fabric='#efe8dc'):
    """Tipi de juego: cuatro palos de madera y lona con la entrada abierta hacia el frente (-Y)."""
    cloth, r, apex = mat('lona', fabric, rough=.95, sheen=.5, bump=.2, bump_scale=800), size / 2, Vector((0, 0, height))
    corners = [Vector((r * math.cos(t), r * math.sin(t), 0)) for t in (math.radians(45 + 90 * i) for i in range(4))]
    for c in corners:
        batch.add(moved(geo.tube([c * 1.03, apex + (apex - c) * .16], .013, 8), loc, rot), mat('palo', '#cfae84', rough=.6))
    for i in range(4):
        a, b, bm = corners[i], corners[(i + 1) % 4], bmesh.new()
        if a.y < 0 and b.y < 0:
            low_a, low_b, top = a + (b - a) * .3, a + (b - a) * .7, (a + b) / 2 + (apex - (a + b) / 2) * .62
            for quad in ((a, low_a, top, apex), (low_b, b, apex, top)):
                bm.faces.new([bm.verts.new(v) for v in quad])
        else:
            bm.faces.new([bm.verts.new(v) for v in (a, b, apex)])
        batch.add(moved(bm, loc, rot), cloth)
    batch.add(moved(geo.soft_box(.5, .5, .1, .04, bulge=(0, 0, .02)), loc, rot), mat('cojin', '#9caf88', rough=1, sheen=.8))


def bunting(batch, room, wall, a0, a1, z, colors=('#c27c5a', '#e0b45a', '#9caf88', '#a9bfcc', '#efe8dc'), n=9):
    """Banderín de tela en catenaria sobre la pared."""
    sag = lambda t: z - .14 * math.sin(math.pi * t)  # noqa: E731
    ac, span = (a0 + a1) / 2, a1 - a0
    batch.add(room.on_wall(geo.tube([Vector((span * (t / 20 - .5), -.02, sag(t / 20))) for t in range(21)], .002, 6),
                           wall, ac), mat('cordel', '#d9c9ad', rough=.8))
    for i in range(n):
        t0, t1 = (i + .1) / n, (i + .9) / n
        bm, x0, x1 = bmesh.new(), span * (t0 - .5), span * (t1 - .5)
        bm.faces.new([bm.verts.new(v) for v in ((x0, -.021, sag(t0)), ((x0 + x1) / 2, -.021, (sag(t0) + sag(t1)) / 2 - .15),
                                                 (x1, -.021, sag(t1)))])
        batch.add(room.on_wall(bm, wall, ac), color_mat('bandera', colors[i % len(colors)], rough=.9, sheen=.4))


def table_lamp(batch, loc, base='#d8cbb8'):
    """Lámpara de sobremesa: pie cerámico y pantalla de lino encendida."""
    profile = [(0, 0), (.055, 0), (.085, .06), (.095, .13), (.07, .22), (.022, .26), (.012, .3), (0, .3)]
    batch.add(moved(geo.lathe(profile, 32), loc), color_mat('ceramica', base, rough=.35, coat=.3))
    shade = geo.surface(40, 2, lambda u, v: ((.13 - .025 * v) * math.cos(u * 2 * math.pi),
                                             (.13 - .025 * v) * math.sin(u * 2 * math.pi), .26 + .2 * v))
    batch.add(moved(shade, loc), mat('pantalla', '#efe4d2', rough=.9, emission='#ffcf96', strength=1.6))
    point_light((loc[0], loc[1], loc[2] + .36), 9, radius=.03, name='bombilla')


def vase_stems(batch, loc, seed=0, count=7, height=.55):
    """Ramas secas de pampa en un jarrón: tallos finos y penachos esponjosos."""
    rng = random.Random(seed)
    for _ in range(count):
        angle, tilt = rng.uniform(0, 2 * math.pi), rng.uniform(.08, .3)
        top = Vector((math.cos(angle) * tilt * height, math.sin(angle) * tilt * height, height * rng.uniform(.8, 1.1)))
        batch.add(moved(geo.tube([Vector((0, 0, 0)), top * .5, top], .003, segments=6), loc), mat('tallo', '#b49a73', rough=.8))
        plume = geo.sphere(.035, segments=10, flatten=3.2)
        tilt = (-math.atan2(top.y, top.z) * .9, math.atan2(top.x, top.z) * .9, 0)
        geo.transform(plume, loc=top + top.normalized() * .09, rot=tilt)
        batch.add(moved(plume, loc), mat('pampa', '#e8dcc4', rough=1, sheen=1, bump=.8, bump_scale=500))


def wall_print(batch, room, wall, a, z, w, h, kind):
    """Lámina enmarcada sin texto: arcoíris de bandas o sol sobre colinas."""
    oak, paper = mat('marco', '#c9a57a', rough=.5), mat('papel', '#f1ebdf', rough=.9)
    pieces = [geo.box(w, .025, .022, at=(0, -.0125, 0)), geo.box(w, .025, .022, at=(0, -.0125, h - .022)),
              geo.box(.022, .025, h, at=(-w / 2 + .011, -.0125, 0)), geo.box(.022, .025, h, at=(w / 2 - .011, -.0125, 0))]
    for bm in pieces:
        batch.add(room.on_wall(bm, wall, a, z), oak)
    batch.add(room.on_wall(geo.box(w - .03, .006, h - .03, at=(0, -.006, .015)), wall, a, z), paper)

    def band(r0, r1, a0, a1, cz, cx=0.0, n=40):
        bm = bmesh.new()
        ring = [(bm.verts.new((cx + r0 * math.cos(t), -.0095, cz + r0 * math.sin(t))),
                 bm.verts.new((cx + r1 * math.cos(t), -.0095, cz + r1 * math.sin(t))))
                for t in (a0 + (a1 - a0) * i / n for i in range(n + 1))]
        for (i0, o0), (i1, o1) in zip(ring, ring[1:]):
            bm.faces.new((i0, i1, o1, o0) if r0 > 1e-4 else (i0, o1, o0))
        return bm

    if kind == 'arcoiris':
        for i, color in enumerate(['#c27c5a', '#e0b45a', '#9caf88', '#a9bfcc']):
            r1 = w * .34 - i * w * .07
            batch.add(room.on_wall(band(r1 - w * .06, r1, 0, math.pi, h * .3), wall, a, z), color_mat('lamina', color, rough=.9))
    else:
        for color, radius, end, height, cx in (('#e0b45a', .14, 2, .62, .12), ('#9caf88', .38, 1, .12, -.1),
                                                 ('#7d8f75', .3, 1, .12, .2)):
            bm = band(0, w * radius, 0, end * math.pi, h * height, cx=w * cx)
            batch.add(room.on_wall(bm, wall, a, z), color_mat('lamina', color, rough=.9))


def shoe(batch, loc, rot, upper, sole='#f4f1ea'):
    batch.add(moved(geo.soft_box(.095, .26, .075, .035, bulge=(.004, .004, .008), at=(0, .01, .018)), loc, rot),
              color_mat('zapato', upper, rough=.6))
    batch.add(moved(geo.box(.1, .27, .022, r=.009, at=(0, .01, 0)), loc, rot), color_mat('suela', sole, rough=.7))


def cardboard(batch, loc, rot, w, d, h, carton, tape='#c9b08a'):
    batch.add(moved(geo.box(w, d, h, r=.004, segments=1), loc, rot), carton)
    batch.add(moved(geo.box(.05, d + .002, .0015, at=(0, 0, h)), loc, rot), color_mat('cinta', tape, rough=.35))


def front_door(batch, room, a0, a1, h, paint='#8f9f86'):
    """Puerta de entrada maciza pintada en salvia, con molduras, tapajuntas, tirador de latón y umbral."""
    w, ac = a1 - a0, (a0 + a1) / 2
    leaf, trim = color_mat('puerta', paint, rough=.42, coat=.2), mat('tapajuntas', '#f1ede6', rough=.45)
    brass = mat('laton', '#b5904f', rough=.22, metal=1)
    batch.add(room.on_wall(geo.box(w - .01, .045, h - .006, at=(0, .07, .003)), 'back', ac), leaf)
    m, pw = .022, (w - .26) / 2
    for side, pz, ph in ((-1, .18, .9), (1, .18, .9), (-1, 1.2, .78), (1, 1.2, .78)):
        px = side * (pw / 2 + .05)
        for bw, bh, ox, oz in ((pw, m, 0, 0), (pw, m, 0, ph - m), (m, ph, -pw / 2 + m / 2, 0), (m, ph, pw / 2 - m / 2, 0)):
            batch.add(room.on_wall(geo.box(bw, .012, bh, r=.004, at=(px + ox, .043, pz + oz)), 'back', ac), leaf)
    for bw, bh, ox, oz in ((.075, h + .075, -w / 2 - .0375, 0), (.075, h + .075, w / 2 + .0375, 0), (w + .15, .075, 0, h)):
        batch.add(room.on_wall(geo.box(bw, .02, bh, r=.003, at=(ox, -.01, oz)), 'back', ac), trim)
    hx = w / 2 - .09
    upright = (math.pi / 2, 0, 0)
    rose = geo.transform(geo.lathe([(0, 0), (.026, 0), (.024, .012), (0, .014)], 24), rot=upright, loc=(hx, .047, 1.02))
    lever = geo.box(.13, .018, .018, r=.008, at=(hx - .06, .026, 1.011))
    knob = geo.transform(geo.lathe([(0, 0), (.022, 0), (.02, .02), (0, .024)], 20), rot=upright, loc=(hx, .047, 1.38))
    for bm in (rose, lever, knob):
        batch.add(room.on_wall(bm, 'back', ac), brass)
    batch.add(room.on_wall(geo.box(w, .14, .018, r=.003, at=(0, .03, 0)), 'back', ac), mat('umbral', '#d9d2c5', rough=.4))


def bicycle(batch, loc, rot, frame='#8e9c8a', lean=0.0):
    """Bicicleta urbana de perfil en el plano XZ (ruedas con radios, cuadro, sillín, manillar y plato), inclinada
    `lean` grados hacia +Y local para apoyarse en una pared."""
    black, steel = mat('neumatico', '#1f1e1c', rough=.75), mat('llanta', '#c4c6c8', rough=.25, metal=1)
    paint, r = color_mat('cuadro', frame, rough=.25, coat=.6), .34
    rear, front, bb = Vector((-.53, 0, r)), Vector((.53, 0, r)), Vector((-.04, 0, .31))
    seat, head = Vector((-.2, 0, .86)), Vector((.4, 0, .84))

    def put(bm, material):
        batch.add(moved(geo.transform(bm, rot=(-math.radians(lean), 0, 0)), loc, rot), material)

    for hub in (rear, front):
        def ring(radius, hub=hub):
            return [hub + Vector((math.cos(t * math.pi / 20), 0, math.sin(t * math.pi / 20))) * radius for t in range(40)]
        put(geo.tube(ring(r - .02), .02, 8, closed=True), black)
        put(geo.tube(ring(r - .05), .009, 6, closed=True), steel)
        for k in range(16):
            tip = hub + Vector((math.cos(k * math.pi / 8), 0, math.sin(k * math.pi / 8))) * (r - .05)
            put(geo.tube([hub + Vector((0, (k % 2 - .5) * .04, 0)), tip], .0016, 4), steel)
    fork = head + Vector((.02, 0, -.12))
    for path in ((rear, bb), (rear, seat), (bb, seat), (bb, fork), (seat, head), (fork, front)):
        put(geo.tube(list(path), .016, 8), paint)
    stem = head + Vector((-.06, 0, .14))
    put(geo.tube([head, stem], .014, 8), steel)
    put(geo.tube([stem + Vector((.05, -.27, .02)), stem, stem + Vector((.05, .27, .02))], .011, 8), black)
    put(geo.tube([seat, seat + Vector((-.02, 0, .1))], .012, 8), steel)
    put(geo.soft_box(.26, .13, .05, .025, at=tuple(seat + Vector((-.01, 0, .1)))), mat('sillin', '#7a5338', rough=.5))
    chainring = geo.lathe([(0, 0), (.1, 0), (.1, .006), (0, .006)], 28)
    put(geo.transform(chainring, rot=(math.pi / 2, 0, 0), loc=tuple(bb + Vector((0, .05, 0)))), steel)


def garage_door(batch, room, a0, a1, h, panel='#ebe8e2'):
    """Puerta seccional: cuatro paneles nervados, ventanillas esmeriladas, guías, carriles y motor de techo."""
    w, ac, n = a1 - a0, (a0 + a1) / 2, 4
    paint = color_mat('seccional', panel, rough=.38, coat=.15)
    steel = mat('guia', '#a3a5a7', rough=.35, metal=.85)
    frosted = mat('esmerilado', '#f3f1ec', rough=.5, emission='#fff3e2', strength=2.2)
    section = (h + .04) / n
    for i in range(n):
        z = i * section
        batch.add(room.on_wall(geo.box(w + .1, .045, section - .008, r=.007, at=(0, -.03, z)), 'back', ac), paint)
        for k in (1, 2):
            batch.add(room.on_wall(geo.box(w + .06, .006, .01, r=.002, at=(0, -.054, z + k * section / 3)), 'back', ac), paint)
    for k in range(4):
        x = -w / 2 + w * (k + .5) / 4
        pane = geo.box(w / 4 - .2, .006, section * .42, r=.01, at=(x, -.057, (n - .7) * section))
        batch.add(room.on_wall(pane, 'back', ac), frosted)
    for side in (-1, 1):
        x = side * (w / 2 + .085)
        batch.add(room.on_wall(geo.box(.05, .07, h + .1, at=(x, -.06, 0)), 'back', ac), steel)
        batch.add(room.on_wall(geo.box(.05, 2.9, .05, at=(x, -1.5, h + .12)), 'back', ac), steel)
    batch.add(room.on_wall(geo.box(.04, 3.0, .035, at=(0, -1.55, room.H - .2)), 'back', ac), steel)
    motor = mat('motor', '#dcdad5', rough=.45)
    batch.add(room.on_wall(geo.box(.3, .42, .17, r=.02, at=(0, -3.1, room.H - .33)), 'back', ac), motor)
    batch.add(room.on_wall(geo.box(.18, .02, .07, r=.01, at=(0, -.06, .25)), 'back', ac), mat('asa', '#2b2b2b', rough=.4))


# ── escenas ───────────────────────────────────────────────────────────────────────────────────────────────────────

def base_materials(tex, floor_rough=(.3, .75), floor_tint='#ffffff', wall_tint='#f6f1e8'):
    floor = tex_mat('suelo', tex['suelo'], tint=floor_tint, rough=floor_rough, normal=.6)
    wall = tex_mat('pared', tex['pared'], tint=wall_tint, value=1.15, sat=.15, rough=(.75, .95), normal=.25)
    return floor, wall, mat('techo', '#f4f1eb', rough=.9)


def scene_infantil(job, spec):
    models, tex = spec['models'], spec['textures']
    floor, wall, ceiling = base_materials(tex, floor_tint='#fff9f0')
    W, D = 3.6, 3.5
    room = Room(W, D, 2.6, floor, wall, ceiling, openings={'back': [(2.68, 3.48, .55, 2.32)]})
    frame_mat = mat('carpinteria', '#2a2927', rough=.4, metal=.4)
    room.window('back', 2.68, 3.48, .55, 2.32, frame_mat, mat('vierteaguas', '#ece6dc', rough=.4), mullions=0)
    for a in (2.6, 3.52):
        room.curtain('back', a, .3, 2.45, .02, folds=4, seed=int(a * 10))
    add_object(room.on_wall(geo.box(1.3, .02, .02, r=.008, at=(0, -.12, 2.46)), 'back', 3.06), frame_mat, 'barra')
    bed = place(models, 'cama')
    bed.location = (dims(bed).x / 2 + .02, D - dims(bed).y / 2 - .005, 0)
    room.against(models, 'mesilla', 'back', 1.42, gap=.02)
    shelf = room.against(models, 'estanteria', 'back', 2.16, gap=.01)
    place(models, 'alfombra', loc=(1.8, 1.25, 0))
    place(models, 'planta', loc=(W - .45, D - .5, 0), rot=30)
    batch = Batch('infantil')
    wall_print(batch, room, 'back', .36, 1.3, .36, .46, 'arcoiris')
    wall_print(batch, room, 'back', .82, 1.36, .3, .38, 'sol')
    bunting(batch, room, 'back', .05, 1.6, 2.2)
    z_top = surface_z(1.42, D - .2, 1.0)
    table_lamp(batch, (1.34, D - .2, z_top))
    place(models, 'maceta', loc=(1.55, D - .22, z_top), scale=.9)
    bx = bed.location.x
    teddy(batch, (bx + .18, D - .38, surface_z(bx + .18, D - .38, 1.2)), rot=-20, scale=1.0)
    sx, sy, sd = shelf.location.x, shelf.location.y, dims(shelf)
    cols, cube_w = (sx - sd.x / 4, sx + sd.x / 4), sd.x / 2 - .03
    rows = [surface_z(cols[0], sy, (k + .5) * sd.z / 4) for k in range(4)]  # rayo desde el centro de cada cubo
    wicker = tex_mat('cesta', tex['cesta'], tint='#e2c9a3', rough=(.6, .9))
    for x in cols:
        batch.add(moved(open_box(cube_w - .03, .3, .27), (x, sy - .02, rows[0])), wicker)
    book_row(batch, (cols[0], sy, rows[1]), 0, cube_w - .04, depth=.2, seed=3)
    wood_blocks(batch, (cols[1] - .04, sy - .06, rows[1]), seed=2, count=3)
    book_stack(batch, (cols[1], sy, rows[2]), 0, count=4, seed=5)
    book_row(batch, (cols[0] - .05, sy, rows[2]), 0, cube_w * .55, depth=.2, seed=7, hmin=.2, hmax=.28)
    wood_blocks(batch, (cols[0], sy - .04, rows[3]), seed=8, count=3)
    book_row(batch, (cols[1], sy, rows[3]), 0, cube_w * .7, depth=.2, seed=11, hmin=.15, hmax=.22)
    teddy(batch, (cols[1], sy, sd.z + .002), rot=0, scale=.7, fur='#e3cfb5')
    book_stack(batch, (cols[0], sy, sd.z + .002), 10, count=3, seed=9)
    tipi(batch, (W - .68, 1.55, 0), -32, size=1.0, height=1.5)
    wood_blocks(batch, (1.95, 1.2, .01), seed=4)
    batch.add(geo.sphere(.1, at=(2.1, 1.0, .01), segments=20), mat('pelota', '#c9805f', rough=.45))
    batch.add(moved(round_basket(.2, .26), (1.3, 1.15, 0)), wicker)
    linens(batch, (1.3, 1.15, .19), 0, .3, .3, ['#9caf88', '#f1ebe0'], seed=3)
    batch.flush()
    area_light((1.8, -1.6, 1.9), (1.8, 2.5, 1.0), 3.0, 350, color='#fffaf2')
    world(job, 58, strength=2.0)
    setup_render(job, exposure=2.2, kelvin=5300)
    camera((1.85, -1.05, 1.25), yaw=0, lens=27, shift=(0, -.08), focus=3.7, fstop=6.3)
    render(spec['output'])


def scene_recibidor(job, spec):
    models, tex = spec['models'], spec['textures']
    floor = tex_mat('suelo', tex['suelo'], tint='#fbf6ef', sat=.55, rough=(.2, .5), normal=.6)
    _, wall, ceiling = base_materials(tex)
    room, pa = Room(3.8, 2.6, 2.6, floor, wall, ceiling,
                    openings={'back': [(2.55, 3.45, 0, 2.15)], 'right': [(.55, 1.6, .9, 2.25)]}), 1.85
    frame_mat = mat('carpinteria', '#2a2927', rough=.4, metal=.4)
    room.window('right', .55, 1.6, .9, 2.25, frame_mat, mat('vierteaguas', '#ece6dc', rough=.4))
    batch = Batch('recibidor')
    front_door(batch, room, 2.55, 3.45, 2.15)
    room.against(models, 'consola', 'back', 1.25, gap=.01)
    room.against(models, 'espejo', 'back', 1.25, gap=0, z=1.2)
    z_top = surface_z(1.25, 2.4, 1.2)
    table_lamp(batch, (.88, 2.43, z_top))
    vase = place(models, 'jarron', loc=(1.5, 2.42, z_top))
    vase_stems(batch, (1.5, 2.42, z_top + dims(vase).z - .03), seed=3)
    tray = geo.lathe([(0, 0), (.1, 0), (.11, .015), (.1, .018), (.0, .006)], 32)
    batch.add(moved(tray, (1.22, 2.4, z_top)), mat('bandeja', '#c9a57a', rough=.45))
    shelf_z = surface_z(1.25, 2.43, z_top * .5)  # balda baja de la consola
    wicker = tex_mat('cesta', tex['cesta'], tint='#e2c9a3', rough=(.6, .9))
    for x in (1.02, 1.48):
        batch.add(moved(round_basket(.15, .2), (x, 2.42, shelf_z)), wicker)
    place(models, 'planta', loc=(2.1, 2.27, 0), rot=-20, scale=.85)
    mat_coir = tex_mat('felpudo', tex['felpudo'], tint='#b08a5c', sat=.8, rough=(.8, 1.0), normal=1.2)
    add_object(geo.box(.8, .5, .016, r=.006, at=(3.0, 2.2, 0)), mat_coir, 'felpudo')
    room.against(models, 'banco', 'left', pa, gap=.01)
    room.against(models, 'perchero', 'left', pa, gap=0, z=1.62)
    bag = geo.soft_box(.34, .1, .36, .035, bulge=(.01, .02, .0), at=(0, -.075, 1.18))
    batch.add(room.on_wall(bag, 'left', pa + .16), mat('bolsa', '#a8b59a', rough=.9, sheen=.5, bump=.3, bump_scale=700))
    for side in (-.09, .09):
        strap = geo.tube([Vector((side, -.06, 1.53)), Vector((side * .4, -.08, 1.72)), Vector((0, -.09, 1.76))], .008)
        batch.add(room.on_wall(strap, 'left', pa + .16), mat('bolsa', '#a8b59a'))
    hat = geo.lathe([(0, 0), (.19, 0), (.19, .008), (.1, .012), (.095, .1), (.07, .115), (0, .118)], 40)
    batch.add(room.on_wall(geo.transform(hat, rot=(math.pi / 2, 0, 0), loc=(0, -.06, 1.5)), 'left', pa - .17),
              mat('paja', '#d9bf8f', rough=.85, bump=.5, bump_scale=600))
    shelf_y = surface_z(.18, pa, surface_z(.18, pa, .45, 0) - .08, 0)
    for k, (dy, color) in enumerate(((-.3, '#ece6da'), (-.18, '#ece6da'), (.12, '#9b6b47'), (.24, '#9b6b47'))):
        shoe(batch, (.2, pa + dy, shelf_y), 90 + (k % 2) * 4, color)
    batch.flush()
    area_light((1.8, -2.0, 1.8), (1.8, 2.0, 1.1), 3.0, 300, color='#fffaf2')
    world(job, -25, strength=2.0)
    setup_render(job, exposure=1.95, kelvin=5700)
    camera((1.85, -1.15, 1.25), yaw=0, lens=26, shift=(0, -.07), focus=3.5, fstop=6.3)
    render(spec['output'])


def scene_lavadero(job, spec):
    models, tex = spec['models'], spec['textures']
    floor = tex_mat('suelo', tex['suelo'], tint='#f6f1e8', sat=.45, rough=(.15, .45), normal=.6)
    _, wall, ceiling = base_materials(tex)
    room = Room(2.5, 2.3, 2.5, floor, wall, ceiling, openings={'right': [(.75, 1.75, 1.05, 2.15)]})
    frame_mat = mat('carpinteria', '#2a2927', rough=.4, metal=.4)
    room.window('right', .75, 1.75, 1.05, 2.15, frame_mat, mat('vierteaguas', '#ece6dc', rough=.4))
    oak = tex_mat('roble', tex['roble'], tint='#f3e6d2', rough=(.35, .6), normal=.4)
    washer = room.against(models, 'lavadora', 'back', .37, gap=.03)
    room.against(models, 'secadora', 'back', 1.02, gap=.03)
    top = dims(washer).z + .015
    D = room.D
    add_object(geo.box(1.47, .64, .035, r=.003, at=(.735, D - .32, top)), oak, 'encimera')
    add_object(geo.box(.03, .64, top, at=(1.455, D - .32, 0)), oak, 'costado')
    tiles = tex_mat('azulejo', tex['azulejo'], tint='#fbf7f0', rough=(.05, .3), normal=.8)
    add_object(geo.box(1.47, .01, .62, at=(.735, D - .005, top + .035)), tiles, 'frente-azulejo')
    batch = Batch('lavadero')
    wicker = tex_mat('cesta', tex['cesta'], tint='#e2c9a3', rough=(.6, .9))
    for z in (1.72, 2.08):
        batch.add(geo.box(1.4, .28, .03, r=.003, at=(.73, D - .14, z)), oak)
        for x in (.12, 1.34):
            batch.add(geo.box(.025, .2, .1, at=(x, D - .1, z - .1)), mat('escuadra', '#2a2927', rough=.4, metal=.4))
    for x in (.28, .73, 1.18):
        batch.add(moved(open_box(.36, .26, .2), (x, D - .14, 1.75)), wicker)
        linens(batch, (x, D - .14, 1.84), 0, .28, .2, ['#f1ebe0'], seed=int(x * 10), height=.05)
    towels(batch, (.3, D - .15, 2.11), 0, ['#f3efe7', '#9caf88', '#f3efe7', '#e3d5bf'])
    towels(batch, (.72, D - .15, 2.11), 0, ['#e3d5bf', '#f3efe7', '#b7c2a8'])
    jar = geo.lathe([(0, 0), (.06, 0), (.065, .02), (.065, .2), (.04, .23), (.04, .25), (0, .25)], 28)
    batch.add(moved(jar, (1.15, D - .14, 2.11)), color_mat('ceramica', '#e6dccb', rough=.35, coat=.3))
    towels(batch, (1.12, D - .3, top + .035), 0, ['#9caf88', '#f3efe7', '#e3d5bf'], w=.34, d=.26)
    bottle = geo.lathe([(0, 0), (.05, 0), (.055, .03), (.055, .2), (.03, .24), (.018, .26), (0, .27)], 24)
    batch.add(moved(bottle, (.62, D - .45, top + .035)), mat('botella', '#e9e3d6', rough=.35, coat=.3))
    batch.add(moved(geo.lathe([(0, 0), (.08, 0), (.08, .07), (0, .07)], 24), (.85, D - .45, top + .035)), wicker)
    place(models, 'planta', loc=(.2, D - .32, top + .035), scale=1.05)
    batch.add(moved(round_basket(.22, .55), (1.85, D - .32, 0)), wicker)
    linens(batch, (1.85, D - .32, .5), 0, .34, .34, ['#f1ebe0', '#a9bfcc', '#e3d5bf', '#f6f3ee'], seed=5, height=.08)
    place(models, 'planta', loc=(2.4, 1.25, 1.05), scale=1.1)
    room.against(models, 'escalera', 'left', 1.25, gap=.0)
    for k, colors in enumerate((['#f3efe7', '#e3d5bf'], ['#9caf88', '#f3efe7', '#b7c2a8'])):
        z = surface_z(.24 - k * .07, 1.25, .45 + k * .45, z_min=.1)
        towels(batch, (.24 - k * .07, 1.25, z), 90, colors, w=.3, d=.2, t=.045)
    batch.flush()
    area_light((1.3, -1.6, 1.8), (1.0, 2.0, 1.1), 3.0, 250, color='#fffaf2')
    world(job, -35, strength=2.0)
    setup_render(job, exposure=2.2, kelvin=7000)
    camera((1.2, -.95, 1.25), yaw=0, lens=26, shift=(0, -.06), focus=3.0, fstop=6.3)
    render(spec['output'])


def scene_garaje(job, spec):
    models, tex = spec['models'], spec['textures']
    floor = tex_mat('suelo', tex['suelo'], tint='#f2ede6', value=1.1, rough=(.08, .35), normal=.3, coat=.4)
    _, wall, ceiling = base_materials(tex)
    W, D = 4.4, 5.6
    room = Room(W, D, 2.65, floor, wall, ceiling, openings={'back': [(.95, 3.55, 0, 2.2)], 'left': [(2.6, 3.8, 1.25, 2.15)]})
    frame_mat, sill = mat('carpinteria', '#2a2927', rough=.4, metal=.4), mat('vierteaguas', '#ece6dc', rough=.4)
    room.window('left', 2.6, 3.8, 1.25, 2.15, frame_mat, sill)
    batch = Batch('garaje')
    garage_door(batch, room, .95, 3.55, 2.2)
    bicycle(batch, (.42, 3.3, 0), 90, lean=8)  # el extremo del manillar toca la pared
    wood, steel = mat('mango', '#c9a57a', rough=.55), mat('herramienta', '#8d9093', rough=.35, metal=.9)
    batch.add(room.on_wall(geo.box(.62, .03, .05, r=.005, at=(0, -.015, 1.55)), 'back', .45), frame_mat)
    for dx, head in ((-.2, (.28, .03, .05)), (0, (.2, .025, .27)), (.2, (.3, .07, .1))):
        batch.add(room.on_wall(geo.tube([Vector((dx, -.05, .3)), Vector((dx, -.05, 1.6))], .014, 8), 'back', .45), wood)
        tool = steel if dx <= 0 else mat('cepillo', '#3a3631', rough=.9)
        batch.add(room.on_wall(geo.box(*head, r=.01, at=(dx, -.05, .32 - head[2])), 'back', .45), tool)
    shelf = room.against(models, 'estanteria', 'right', 3.9, gap=.02)
    carton = tex_mat('carton', tex['carton'], tint='#e8d2b0', rough=(.7, .95), normal=.6)
    for level in (.35, .95, 1.5, 2.4):
        for k, dy in enumerate((-.75, -.25, .3, .78)):
            y = shelf.location.y + dy
            z = surface_z(W - .35, y, level + .3, z_min=-1)
            if .05 < z < 2.35:
                w, h = (.42, .3) if (k + int(level * 10)) % 3 else (.36, .24)
                cardboard(batch, (W - .36, y, z), 90 + (k * 7) % 11 - 5, w, .38, h, carton)
    bins = mat('cubo', '#d9d5cd', rough=.4)
    batch.add(moved(open_box(.6, .42, .34, t=.015, r=.01), (W - .3, 2.4, 0), 90), bins)
    batch.add(moved(geo.box(.62, .44, .03, r=.01), (W - .3, 2.4, .34), 90), mat('tapa', '#7d8f75', rough=.4))
    cardboard(batch, (W - .3, 2.42, .37), 94, .46, .36, .26, carton)
    led = mat('led', '#ffffff', emission='#fff1dc', strength=14)
    for x in (W * .3, W * .7):
        add_object(geo.box(.1, 1.4, .04, r=.01, at=(x, D * .45, room.H - .045)), mat('regleta', '#eeeeec', rough=.4), 'regleta')
        add_object(geo.box(.07, 1.36, .004, at=(x, D * .45, room.H - .049)), led, 'led')
    batch.flush()
    area_light((2.2, -1.6, 2.0), (2.2, 4.0, 1.0), 3.0, 450, color='#fffaf2')
    world(job, 205, strength=2.0)
    setup_render(job, exposure=2.4, kelvin=7300)
    camera((2.2, -.9, 1.4), yaw=0, lens=26, shift=(0, -.07), focus=4.5, fstop=6.3)
    render(spec['output'])


SCENES = {'infantil': scene_infantil, 'recibidor': scene_recibidor, 'lavadero': scene_lavadero, 'garaje': scene_garaje}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if '--job' not in argv:
        raise RuntimeError('Uso: blender -b --python catalog_room_photos.py -- --job trabajo.json')
    with open(argv[argv.index('--job') + 1], encoding='utf-8') as handle:
        job = json.load(handle)
    for name, spec in job['scenes'].items():
        if name not in SCENES:
            raise RuntimeError(f'Escena desconocida: {name}')
        reset()
        print(f'HK-ESCENA {name}', flush=True)
        SCENES[name](job, spec)
        if not os.path.exists(spec['output']):
            raise RuntimeError(f'La escena {name} no produjo {spec["output"]}')
        print(f'HK-OK {name}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception:  # noqa: BLE001 - el lanzador necesita un código de salida distinto de cero
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        os._exit(1)
