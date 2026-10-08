"""Materiales PBR de la fábrica: texturas CC0 (color, normal y rugosidad) o acabados lisos (metal, laca, vidrio).

El lanzador (scripts/build-furniture-factory.mjs) resuelve cada acabado de la especificación en un diccionario:
  {kind: 'texture'|'metal'|'paint'|'glass', color: '#rrggbb', roughness, metallic, sheen, normal_strength,
   maps: {color, normal, roughness} (rutas absolutas ya teñidas), tile_mm, grain_u}
Solo se usan nodos que el exportador glTF traduce (imagen → color, rugosidad y mapa de normales; transmisión; sheen).
"""
import bpy


def _rgb(hex_color):
    value = hex_color.lstrip('#')
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in srgb) + (1.0,)


def _image(path, non_color):
    image = bpy.data.images.load(path, check_existing=True)
    if non_color:
        image.colorspace_settings.name = 'Non-Color'
    return image


def _set(bsdf, name, value):
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = value


def make_material(name, spec):
    material = bpy.data.materials.new(name)
    if hasattr(material, 'use_nodes') and not material.use_nodes:
        material.use_nodes = True
    tree = material.node_tree
    bsdf = next((node for node in tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        tree.nodes.clear()
        bsdf = tree.nodes.new('ShaderNodeBsdfPrincipled')
        output = tree.nodes.new('ShaderNodeOutputMaterial')
        tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    kind = spec['kind']
    _set(bsdf, 'Base Color', _rgb(spec.get('color', '#cccccc')))
    _set(bsdf, 'Roughness', spec.get('roughness', .6))
    _set(bsdf, 'Metallic', spec.get('metallic', 1.0 if kind == 'metal' else 0.0))
    maps = spec.get('maps')
    if maps:
        color = tree.nodes.new('ShaderNodeTexImage')
        color.image = _image(maps['color'], False)
        tree.links.new(color.outputs['Color'], bsdf.inputs['Base Color'])
        rough = tree.nodes.new('ShaderNodeTexImage')
        rough.image = _image(maps['roughness'], True)
        tree.links.new(rough.outputs['Color'], bsdf.inputs['Roughness'])
        normal_image = tree.nodes.new('ShaderNodeTexImage')
        normal_image.image = _image(maps['normal'], True)
        normal_map = tree.nodes.new('ShaderNodeNormalMap')
        normal_map.inputs['Strength'].default_value = spec.get('normal_strength', 1.0)
        tree.links.new(normal_image.outputs['Color'], normal_map.inputs['Color'])
        tree.links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    if spec.get('sheen'):
        _set(bsdf, 'Sheen Weight', spec['sheen'])
        _set(bsdf, 'Sheen Roughness', .35)
    if kind == 'glass':
        _set(bsdf, 'Transmission Weight', 1.0)
        _set(bsdf, 'IOR', 1.5)
        _set(bsdf, 'Roughness', spec.get('roughness', .02))
    if spec.get('coat'):
        _set(bsdf, 'Coat Weight', spec['coat'])
        _set(bsdf, 'Coat Roughness', .08)
    return material
