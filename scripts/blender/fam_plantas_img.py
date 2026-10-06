"""Atlas de hojas de la familia «plantas»: imágenes RGBA compuestas con numpy y material con recorte alfa (MASK).

Cada planta pinta su propio atlas (1024 px) con celdas rectangulares. En cada celda la hoja ocupa todo el marco con su
eje en vertical: s (0..1) es la coordenada transversal (0,5 = nervio central) y t (0..1) va de la base a la punta. Las
celdas se pintan de dos formas:
- natural: se copia una hoja CC0 tal cual (silueta y alfa de su atlas), girada y escalada a la celda;
- máscara propia: la silueta (monstera, ficus lyrata, strelitzia, folíolos…) se dibuja por código y el color se toma
  del interior de una hoja CC0 deformada para seguir el contorno nuevo; los nervios se pintan encima.
El color de las zonas transparentes se rellena con el de la hoja vecina (sin halos claros u oscuros al reducir).
El mapa de normales se gira con la hoja (espacio tangente) y se guarda a mitad de resolución.

El material lleva Image Texture (RGBA) → Alpha → Math ROUND → Alpha del Principled BSDF y el color de la misma imagen,
sin ocultación de caras traseras: el exportador glTF lo escribe como alphaMode MASK (corte 0,5) y doubleSided.
"""
import math
import os

import bpy
import numpy as np


# ---------------------------------------------------------------- utilidades de imagen

def load(path):
    """Imagen de disco como array float32 (alto, ancho, 4) de arriba abajo, valores tal cual (sRGB en el color)."""
    image = bpy.data.images.load(path, check_existing=True)
    w, h = image.size
    data = np.empty(w * h * 4, np.float32)
    image.pixels.foreach_get(data)
    return data.reshape(h, w, 4)[::-1].copy()


def save(name, array, non_color=False):
    """Guarda un array (alto, ancho, 3|4) de arriba abajo como PNG en la carpeta temporal y lo carga en Blender."""
    h, w, c = array.shape
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :c] = np.clip(array, 0, 1)
    image = bpy.data.images.new(name, w, h, alpha=c == 4)
    image.pixels.foreach_set(rgba[::-1].ravel())
    path = os.path.join(bpy.app.tempdir or '/tmp', f'{name}.png')
    image.filepath_raw = path
    image.file_format = 'PNG'
    image.save()
    if non_color:
        image.colorspace_settings.name = 'Non-Color'
    return image


def sample(img, x, y):
    """Muestreo bilineal (x, y en píxeles, arrays) con coordenadas recortadas al borde."""
    h, w = img.shape[:2]
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    x0, y0 = np.floor(x).astype(np.int32), np.floor(y).astype(np.int32)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    a, b = img[y0, x0], img[y0, x0 + 1]
    c, d = img[y0 + 1, x0], img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def box_blur(img, radius):
    """Desenfoque de caja separable (bordes replicados)."""
    if radius < 1:
        return img
    out = img
    for axis in (0, 1):
        pad = [(0, 0)] * img.ndim
        pad[axis] = (radius + 1, radius)
        padded = np.pad(out, pad, mode='edge')
        cumsum = np.cumsum(padded, axis=axis)
        n = out.shape[axis]
        hi = np.take(cumsum, np.arange(2 * radius + 1, 2 * radius + 1 + n), axis=axis)
        lo = np.take(cumsum, np.arange(0, n), axis=axis)
        out = (hi - lo) / (2 * radius + 1)
    return out


def fill_transparent(rgb, alpha):
    """Rellena el color de los píxeles transparentes con el de los opacos cercanos (push-pull por niveles)."""
    levels, color, weight = [], rgb * alpha[..., None], alpha.copy()
    while min(weight.shape) > 2:
        levels.append((color, weight))
        h, w = (weight.shape[0] // 2) * 2, (weight.shape[1] // 2) * 2
        color = color[:h, :w].reshape(h // 2, 2, w // 2, 2, -1).sum(axis=(1, 3))
        weight = weight[:h, :w].reshape(h // 2, 2, w // 2, 2).sum(axis=(1, 3))
    filled = color / np.maximum(weight, 1e-6)[..., None]
    for color, weight in reversed(levels):
        up = np.repeat(np.repeat(filled, 2, axis=0), 2, axis=1)
        up = np.pad(up, ((0, weight.shape[0] - up.shape[0]), (0, weight.shape[1] - up.shape[1]), (0, 0)), mode='edge')
        own = color / np.maximum(weight, 1e-6)[..., None]
        k = np.clip(weight, 0, 1)[..., None]
        filled = own * k + up * (1 - k)
    return filled


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    delta = mx - mn + 1e-8
    h = np.where(mx == r, ((g - b) / delta) % 6, np.where(mx == g, (b - r) / delta + 2, (r - g) / delta + 4)) / 6
    s = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return np.stack([h, s, mx], -1)


def hsv_to_rgb(hsv):
    h, s, v = hsv[..., 0] % 1, hsv[..., 1], hsv[..., 2]
    i = np.floor(h * 6).astype(np.int32) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    table = [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    out = np.zeros(h.shape + (3,), np.float32)
    for k, (r, g, b) in enumerate(table):
        mask = i == k
        out[mask] = np.stack([r[mask], g[mask], b[mask]], -1)
    return out


def grade(rgb, hue=None, sat=1.0, val=1.0, hue_mix=1.0):
    """Lleva el color hacia un tono (0..1), multiplica saturación y brillo conservando la variación de la hoja."""
    hsv = rgb_to_hsv(rgb)
    if hue is not None:
        mean = float(np.median(hsv[..., 0]))
        delta = ((hue - mean + .5) % 1) - .5
        hsv[..., 0] = hsv[..., 0] + delta * hue_mix
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 1)
    hsv[..., 2] = np.clip(hsv[..., 2] * val, 0, 1)
    return hsv_to_rgb(hsv)


def look(hue, sat, val, hue_mix=.85):
    """Tono final de una especie: look(rgb, s, t) → rgb graduado (ver grade)."""
    return lambda rgb, s, t: grade(rgb, hue, sat, val, hue_mix)


def smooth(edge0, edge1, x):
    k = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return k * k * (3 - 2 * k)


def value_noise(shape, scale, seed):
    """Ruido de valor suave (0..1) del tamaño `shape`, con celdas de `scale` píxeles."""
    rng = np.random.default_rng(seed)
    gh, gw = shape[0] // max(1, scale) + 3, shape[1] // max(1, scale) + 3
    grid = rng.random((gh, gw)).astype(np.float32)
    y, x = np.mgrid[0:shape[0], 0:shape[1]].astype(np.float32) / max(1, scale)
    return sample(grid[..., None], x, y)[..., 0]


def height_to_normal(height, strength):
    """Mapa de normales (OpenGL, 0..1) a partir de un campo de alturas en píxeles."""
    gy, gx = np.gradient(height)
    n = np.stack([-gx * strength, gy * strength, np.ones_like(height)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * .5 + .5


# ---------------------------------------------------------------- fuentes CC0

class Source:
    """Atlas CC0 con alfa (color RGBA y normales) preparado por el lanzador para un acabado con `alpha`."""

    def __init__(self, finish):
        maps = finish.get('maps') or {}
        if not finish.get('alpha') or not maps.get('color'):
            raise ValueError('El acabado de hojas debe ser una textura CC0 con alpha')
        self.rgba = load(maps['color'])
        self.normal = load(maps['normal'])[..., :3]
        if self.normal.shape[:2] != self.rgba.shape[:2]:
            ys = np.linspace(0, self.normal.shape[0] - 1, self.rgba.shape[0])
            xs = np.linspace(0, self.normal.shape[1] - 1, self.rgba.shape[1])
            self.normal = sample(self.normal, *np.meshgrid(xs, ys))
        self.h, self.w = self.rgba.shape[:2]
        self.blurred = None

    def frame(self, specimen):
        """Base, punta (píxeles) y vector transversal unitario de un ejemplar dado en coordenadas 0..1 de la imagen."""
        base = np.array([specimen['base'][0] * self.w, specimen['base'][1] * self.h], np.float32)
        tip = np.array([specimen['tip'][0] * self.w, specimen['tip'][1] * self.h], np.float32)
        axis = tip - base
        unit = axis / np.linalg.norm(axis)
        return base, axis, np.array([-unit[1], unit[0]], np.float32)

    def widths(self, specimen, samples=64):
        """Semianchura (píxeles) de la hoja a cada lado del eje en `samples` puntos de la base a la punta."""
        base, axis, perp = self.frame(specimen)
        t = np.linspace(0, 1, samples)
        r = np.arange(0, np.linalg.norm(axis) * .8, 1.0, dtype=np.float32)
        out = np.zeros((2, samples), np.float32)
        for side_index, side in enumerate((-1, 1)):
            px = base[0] + t[:, None] * axis[0] + side * r[None, :] * perp[0]
            py = base[1] + t[:, None] * axis[1] + side * r[None, :] * perp[1]
            alpha = sample(self.rgba[..., 3:], px, py)[..., 0]
            opaque = alpha > .5
            # Primer hueco tras la zona opaca (el pecíolo puede ser más estrecho que la lámina).
            first = np.argmax(~opaque, axis=1)
            out[side_index] = np.where(opaque.all(axis=1), r[-1], r[first])
        return t, out


def _rotate_normals(normal, perp):
    """Lleva las normales tangentes de la fuente (ejes de imagen) al marco de la hoja (s a la derecha, t arriba).

    En la imagen (y hacia abajo) la dirección transversal es perp y el eje base → punta es u = (perp.y, -perp.x).
    """
    n = normal * 2 - 1
    px, py = float(perp[0]), float(perp[1])
    ux, uy = py, -px
    out = np.empty_like(n)
    out[..., 0] = n[..., 0] * px - n[..., 1] * py
    out[..., 1] = n[..., 0] * ux - n[..., 1] * uy
    out[..., 2] = n[..., 2]
    return out * .5 + .5


# ---------------------------------------------------------------- atlas

class Atlas:
    """Lienzo RGBA + normales de una planta. Las celdas son rectángulos (x, y, ancho, alto) en píxeles, y hacia abajo."""

    def __init__(self, width=1024, height=1024):
        self.w, self.h = width, height
        self.color = np.zeros((height, width, 3), np.float32)
        self.alpha = np.zeros((height, width), np.float32)
        self.normal = np.tile(np.array([.5, .5, 1], np.float32), (height, width, 1))

    def uv(self, rect, s, t):
        """UV (u, v) de un punto (s, t) de una celda."""
        x0, y0, w, h = rect
        return (x0 + s * w) / self.w, 1 - (y0 + (1 - t) * h) / self.h

    def rect_uv(self, rect):
        """Rectángulo UV (u0, v0, u1, v1) de una celda: para tubos que recorren la celda a lo largo."""
        return (*self.uv(rect, 0, 0), *self.uv(rect, 1, 1))

    @staticmethod
    def grid(rect):
        x0, y0, w, h = rect
        j, i = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
        return (j + .5) / w, 1 - (i + .5) / h

    def _put(self, rect, rgb, alpha, normal=None):
        x0, y0, w, h = rect
        self.color[y0:y0 + h, x0:x0 + w] = rgb
        self.alpha[y0:y0 + h, x0:x0 + w] = alpha
        if normal is not None:
            self.normal[y0:y0 + h, x0:x0 + w] = normal

    def natural(self, rect, source, specimen, look=None):
        """Copia una hoja CC0 con su silueta. specimen: base y tip (0..1 de la imagen) y half (semiancho / largo)."""
        s, t = self.grid(rect)
        base, axis, perp = source.frame(specimen)
        half = specimen['half'] * np.linalg.norm(axis)
        px = base[0] + t * axis[0] + (s - .5) * 2 * half * perp[0]
        py = base[1] + t * axis[1] + (s - .5) * 2 * half * perp[1]
        rgba = sample(source.rgba, px, py)
        rgb = rgba[..., :3] if look is None else look(rgba[..., :3], s, t)
        self._put(rect, rgb, rgba[..., 3], _rotate_normals(sample(source.normal, px, py), perp))

    def shaped(self, rect, source, specimen, shape, look=None, normal_strength=1.0, vein_gain=.35):
        """Hoja con silueta propia: shape(s, t, ancho, alto) → (alfa, envolvente, altura, nervios 0..1).

        El color sale del interior de la hoja CC0 `specimen` deformada a la envolvente; los nervios se aclaran
        `vein_gain` y look(rgb, s, t) da el tono final de la especie.
        """
        s, t = self.grid(rect)
        alpha, envelope, height, veins = shape(s, t, rect[2], rect[3])
        base, axis, perp = source.frame(specimen)
        ts, widths = source.widths(specimen)
        lo, hi = specimen.get('range', (.1, .97))
        tt = lo + t * (hi - lo)
        q = np.clip((s - .5) / np.maximum(envelope * .5, 1e-3), -1, 1)
        # Solo el tejido de un lado de la hoja CC0 (entre el 18 % y el 85 % de su semiancho), en espejo: su nervio
        # central, que puede ser curvo, no se cruza con el nervio propio dibujado en el eje.
        side = 1 if specimen.get('side', 1) > 0 else 0
        width = np.interp(tt, ts, widths[side]) * (1 if side else -1)
        lo_q, hi_q = specimen.get('tissue', (.25, .85))
        across = width * (lo_q + (hi_q - lo_q) * np.abs(q))
        if source.blurred is None:
            source.blurred = box_blur(source.rgba[..., :3], 3)
        px = base[0] + tt * axis[0] + across * perp[0]
        py = base[1] + tt * axis[1] + across * perp[1]
        detail = specimen.get('detail', .6)
        rgb = sample(source.blurred, px, py) * (1 - detail) + sample(source.rgba[..., :3], px, py) * detail
        rgb = rgb * (1 + vein_gain * veins[..., None])
        if look is not None:
            rgb = look(rgb, s, t)
        normal = height_to_normal(height, normal_strength) if height is not None else None
        self._put(rect, rgb, alpha, normal)

    def strip(self, rect, color, seed=0, streaks=.06):
        """Celda opaca para tallos y pecíolos: color con estrías finas a lo largo (t) y variación suave."""
        x0, y0, w, h = rect
        noise = value_noise((h, w), 3, seed)[..., None] - .5
        along = value_noise((h, w), 24, seed + 1)[..., None] - .5
        stripes = np.sin(np.linspace(0, 9 * math.pi, w))[None, :, None] * .5
        base = np.array(color, np.float32)
        rgb = base * (1 + streaks * stripes + .08 * noise + .1 * along)
        self._put(rect, rgb, np.ones((h, w), np.float32))

    def paint(self, rect, fn):
        """Celda opaca pintada por código: fn(s, t) → rgb (y opcionalmente altura para normales)."""
        s, t = self.grid(rect)
        result = fn(s, t)
        rgb, height = result if isinstance(result, tuple) else (result, None)
        normal = height_to_normal(height, 1.0) if height is not None else None
        self._put(rect, rgb, np.ones(s.shape, np.float32), normal)

    def material(self, name, roughness=.5, normal_strength=1.0, specular=.5, cutout=True):
        """Imágenes finales y material con recorte alfa (MASK) a doble cara (opaco si cutout=False)."""
        rgb = fill_transparent(self.color, (self.alpha > .5).astype(np.float32))
        color = save(f'{name}-color', np.concatenate([rgb, self.alpha[..., None]], -1) if cutout else rgb)
        nh, nw = self.h // 2, self.w // 2
        normal = self.normal[:nh * 2, :nw * 2].reshape(nh, 2, nw, 2, 3).mean(axis=(1, 3))
        normal_image = save(f'{name}-normal', normal, non_color=True)
        return leaf_material(name, color, normal_image, roughness, normal_strength, specular, cutout)


def leaf_material(name, color_image, normal_image=None, roughness=.5, normal_strength=1.0, specular=.5, cutout=True):
    material = bpy.data.materials.new(name)
    if hasattr(material, 'use_nodes') and not material.use_nodes:
        material.use_nodes = True
    material.use_backface_culling = False
    tree = material.node_tree
    bsdf = next((node for node in tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        tree.nodes.clear()
        bsdf = tree.nodes.new('ShaderNodeBsdfPrincipled')
        output = tree.nodes.new('ShaderNodeOutputMaterial')
        tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    texture = tree.nodes.new('ShaderNodeTexImage')
    texture.image = color_image
    tree.links.new(texture.outputs['Color'], bsdf.inputs['Base Color'])
    if cutout:
        cut = tree.nodes.new('ShaderNodeMath')
        cut.operation = 'ROUND'
        tree.links.new(texture.outputs['Alpha'], cut.inputs[0])
        tree.links.new(cut.outputs['Value'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = roughness
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = specular
    if normal_image is not None:
        normal_texture = tree.nodes.new('ShaderNodeTexImage')
        normal_texture.image = normal_image
        normal_map = tree.nodes.new('ShaderNodeNormalMap')
        normal_map.inputs['Strength'].default_value = normal_strength
        tree.links.new(normal_texture.outputs['Color'], normal_map.inputs['Color'])
        tree.links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    return material


def opaque_material(name, rgb_array, roughness=.6, height=None, normal_strength=1.0, specular=.5):
    """Material sin alfa con una imagen propia (cuerpo de cactus, suculentas) y normales opcionales."""
    color = save(f'{name}-color', rgb_array)
    normal = save(f'{name}-normal', height_to_normal(height, 1.0), non_color=True) if height is not None else None
    return leaf_material(name, color, normal, roughness, normal_strength, specular, cutout=False)
