"""Montaje de una pieza: mallas bmesh → objetos con material, UV a escala real y sombreado suave."""
import math

import bpy

from hk_materials import make_material

AXES = {'x': 0, 'y': 1, 'z': 2}


def box_uv(mesh, tile_m, grain_axis, grain_u):
    """Proyección cúbica en metros dividida por el tamaño real de la textura (sin estirados).

    grain_axis es el eje del mundo en que debe correr la veta o la trama; grain_u indica que en la imagen la veta
    corre en horizontal (U) en lugar de en vertical (V).
    """
    layer = mesh.uv_layers.new(name='UVMap')
    vertices, loops = mesh.vertices, mesh.loops
    for polygon in mesh.polygons:
        normal = polygon.normal
        axis = max(range(3), key=lambda k: abs(normal[k]))
        others = [k for k in range(3) if k != axis]
        if grain_axis in others:
            v_axis = grain_axis
            u_axis = others[0] if others[1] == grain_axis else others[1]
        else:
            u_axis, v_axis = others
        if grain_u:
            u_axis, v_axis = v_axis, u_axis
        for index in polygon.loop_indices:
            co = vertices[loops[index].vertex_index].co
            layer.data[index].uv = (co[u_axis] / tile_m, co[v_axis] / tile_m)


class Piece:
    """Acumula las partes de un mueble. Cada parte usa un hueco de material de la especificación."""

    def __init__(self, name, finishes):
        self.name = name
        self.finishes = finishes
        self.materials = {}
        self.objects = []

    def material(self, slot):
        if slot not in self.finishes:
            raise KeyError(f'La especificación de {self.name} no define el material «{slot}»')
        if slot not in self.materials:
            self.materials[slot] = make_material(slot, self.finishes[slot])
        return self.materials[slot]

    def add(self, bm, slot, grain='x', sharp=35):
        """Añade una malla. sharp = ángulo (grados) a partir del cual una arista es viva; 0 = todo suave."""
        finish = self.finishes.get(slot) or {}
        material = self.material(slot)
        mesh = bpy.data.meshes.new(f'{self.name}-{slot}')
        bm.normal_update()
        bm.to_mesh(mesh)
        bm.free()
        box_uv(mesh, max(finish.get('tile_mm', 500), 1) / 1000, AXES[grain], bool(finish.get('grain_u')))
        mesh.shade_smooth()
        if sharp:
            mesh.set_sharp_from_angle(angle=math.radians(sharp))
        mesh.materials.append(material)
        obj = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        self.objects.append(obj)
        return obj

    def join(self):
        if not self.objects:
            raise ValueError(f'{self.name} no tiene geometría')
        for obj in bpy.context.scene.objects:
            obj.select_set(False)
        for obj in self.objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = self.objects[0]
        if len(self.objects) > 1:
            bpy.ops.object.join()
        joined = bpy.context.view_layer.objects.active
        joined.name = joined.data.name = self.name
        self.objects = [joined]
        return joined


def triangle_count(obj):
    return sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
