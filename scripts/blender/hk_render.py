"""Estudio de «foto de producto» con Cycles: vista 3/4, luz suave de estudio y sombra de contacto.

El fondo sale transparente con un captador de sombras; el lanzador lo compone sobre un fondo claro neutro.
"""
import math

import bpy
from mathutils import Vector

RIG = 'hk-estudio'


def _gpu():
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        devices = [device for device in prefs.devices if device.type == 'METAL']
        for device in prefs.devices:
            device.use = device.type == 'METAL'
        return bool(devices)
    except Exception:  # noqa: BLE001 - sin GPU se renderiza con la CPU
        return False


def _area(collection, name, location, target, size, power):
    data = bpy.data.lights.new(name, 'AREA')
    data.shape, data.size, data.energy = 'DISK', size, power
    light = bpy.data.objects.new(name, data)
    light.location = location
    light.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
    collection.objects.link(light)
    return light


def setup(samples=96, size=(768, 576)):
    """Prepara una vez la escena de estudio (cámara, luces y suelo captador de sombras)."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU' if _gpu() else 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    # El vidrio deja ver el fondo claro de la foto en lugar de refractar el cielo vacío.
    for owner in (scene.render, scene.cycles):
        if hasattr(owner, 'film_transparent_glass'):
            owner.film_transparent_glass = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = -.6
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:  # nombres de «look» distintos en otras versiones de Blender
        pass
    world = bpy.data.worlds.new('hk-mundo')
    scene.world = world
    background = next((n for n in world.node_tree.nodes if n.type == 'BACKGROUND'), None)
    if background is None:
        background = world.node_tree.nodes.new('ShaderNodeBackground')
        output = world.node_tree.nodes.new('ShaderNodeOutputWorld')
        world.node_tree.links.new(background.outputs['Background'], output.inputs['Surface'])
    background.inputs['Color'].default_value = (.82, .82, .82, 1)
    background.inputs['Strength'].default_value = .3
    collection = bpy.data.collections.new(RIG)
    scene.collection.children.link(collection)
    bpy.ops.mesh.primitive_plane_add(size=40)
    floor = bpy.context.active_object
    floor.name = 'hk-suelo'
    floor.is_shadow_catcher = True
    for owner in floor.users_collection:
        owner.objects.unlink(floor)
    collection.objects.link(floor)
    camera_data = bpy.data.cameras.new('hk-camara')
    camera_data.lens, camera_data.sensor_width = 50, 36
    camera = bpy.data.objects.new('hk-camara', camera_data)
    collection.objects.link(camera)
    scene.camera = camera
    return collection


def render(objects, path, azimuth=-34.0, elevation=21.0):
    """Encuadra la pieza en vista 3/4 desde delante a la izquierda y la renderiza en `path` (PNG con alfa)."""
    scene = bpy.context.scene
    collection = bpy.data.collections[RIG]
    for light in [obj for obj in collection.objects if obj.type == 'LIGHT']:
        bpy.data.objects.remove(light)
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = Vector(tuple(min(c[k] for c in corners) for k in range(3)))
    high = Vector(tuple(max(c[k] for c in corners) for k in range(3)))
    center, extent = (low + high) / 2, (high - low).length
    az, el = math.radians(azimuth), math.radians(elevation)
    direction = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    camera = scene.camera
    camera.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    camera.location = center + direction * extent * 3
    bpy.context.view_layer.update()
    coords = [value for corner in corners for value in corner]
    location, _scale = camera.camera_fit_coords(bpy.context.evaluated_depsgraph_get(), coords)
    camera.location = location + direction * (location - center).length * .12
    span = max(extent, 1.0)
    _area(collection, 'hk-principal', center + Vector((-1.6, -2.2, 2.6)) * span, center, 1.8 * span, 240 * span ** 2)
    _area(collection, 'hk-relleno', center + Vector((2.4, -1.4, 1.2)) * span, center, 2.5 * span, 45 * span ** 2)
    _area(collection, 'hk-contra', center + Vector((.8, 2.4, 2.4)) * span, center, 1.6 * span, 90 * span ** 2)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
