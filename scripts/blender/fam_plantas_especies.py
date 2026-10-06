"""Familia «plantas»: olivo, bambú, helecho y sansevieria (ver fam_plantas.py).

- Olivo: tronco retorcido y ramas con corteza CC0 («corteza»), ramillas hasta la copa y hojas estrechas en pares
  opuestos (unas verde grisáceo y otras plateadas, como el envés que deja ver el viento).
- Bambú: cañas con nudos, ramillas en los nudos altos y abanicos de hojas lanceoladas colgantes.
- Helecho: frondas CC0 (Poly Haven fern_02, silueta natural) que salen de la corona y caen por fuera de la maceta.
- Sansevieria: hojas carnosas macizas (sección en media luna, en punta) con bandas propias sobre tejido CC0.
"""
import math

import numpy as np
from mathutils import Vector

import fam_plantas_geo as pg
import fam_plantas_hojas as hojas
import fam_plantas_img as img

GOLDEN = math.radians(137.5)
UP = Vector((0, 0, 1))


def _yaw_pitch(direction):
    d = direction.normalized()
    return math.atan2(d.y, d.x), math.asin(max(-1.0, min(1.0, d.z)))


def side_of(tangent, fallback):
    side = tangent.cross(UP)
    return side.normalized() if side.length > 1e-4 else fallback


def along(path, f):
    """Punto y tangente a la fracción f (0..1) de una polilínea de puntos equiespaciados."""
    x = f * (len(path) - 1)
    k = min(len(path) - 2, int(x))
    return path[k].lerp(path[k + 1], x - k), (path[k + 1] - path[k]).normalized()


# ---------------------------------------------------------------- olivo

def olivo(piece, spec):
    """Olivo en maceta: tronco limpio y retorcido, copa redondeada de ramillas con hojas plateadas."""
    plant = pg.Plant(piece, spec)
    soil = plant.pot()
    rng, leaves = plant.rng, plant.foliage
    bark, tile = pg.MeshBuf(), pg.tile_of(piece.finishes.get('corteza'))
    atlas, source = img.Atlas(512, 256), img.Source(piece.finishes['hojas'])
    cells = [(k * 46, 0, 46, 250) for k in range(8)]
    for k, rect in enumerate(cells):
        silver = k >= 6
        atlas.shaped(rect, source, hojas.specimen('clara', k), hojas.lanceolate(90 + k, aspect=.18, widest=.5, power=.75,
                     parallel=False, midrib=.8), img.look(.22, .16 if silver else .4, .82 if silver else .56, .9), 1.0, .25)
    scale = plant.h / 1.2
    crown_base = soil + (plant.h - soil) * .47
    radius = .022 * scale
    trunk = [Vector((.025 * scale * math.sin(f * 5.1 + 1) * f, .02 * scale * math.sin(f * 4.3 + 2) * f, soil - .03 + (crown_base - soil + .03) * f))
             for f in (k / 14 for k in range(15))]
    pg.tube(bark, trunk, [radius * (1.25 - .45 * k / 14) for k in range(15)], 12, tile=tile, jitter=.2, seed=1)
    top = trunk[-1]
    rz = (plant.h - crown_base) / 2
    rxy = min(plant.w, plant.d) / 2 * .92
    center = top + Vector((0, 0, rz * .95))
    branches = []
    for k in range(5):
        az = k * 2 * math.pi / 5 + rng.uniform(-.35, .35)
        el = math.radians(rng.uniform(38, 66))
        length = rxy * rng.uniform(.5, .7)
        end = top + Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el) * 1.15)) * length
        path = pg.resample(pg.hermite(top - Vector((0, 0, .03)), UP, end, end - top, 8), 8)
        pg.tube(bark, path, [radius * (.62 - .4 * j / 8) for j in range(9)], 8, tile=tile, jitter=.12, seed=k)
        branches.append(path)
    points = [(p, path) for path in branches for p in path[3:]]
    twigs = int(100 * scale ** 1.1)
    for j in range(twigs):
        z = rng.uniform(-.35, 1.0)
        a = rng.uniform(0, 2 * math.pi)
        d = Vector((math.sqrt(1 - z * z) * math.cos(a), math.sqrt(1 - z * z) * math.sin(a), z))
        end = center + Vector((d.x * rxy, d.y * rxy, d.z * rz)) * rng.uniform(.78, 1.0)
        start, _path = min(points, key=lambda item: (item[0] - end).length)
        path = pg.resample(pg.hermite(start, end - start + UP * .05, end, end - center, 5), 5)
        pg.tube(bark, path, [.0052 - .0034 * q / 5 for q in range(6)], 4, tile=tile)
        span = (end - start).length
        pairs = max(2, int(span * .7 / (.017 * scale ** .4)))
        for q in range(pairs + 1):
            f = .3 + .7 * q / pairs
            point, tangent = along(path, f)
            side = side_of(tangent, Vector((1, 0, 0)))
            for sign in (-1, 1):
                if q == pairs and sign > 0:
                    continue
                phi = rng.uniform(.6, 1.2)
                d = tangent * math.cos(phi) + side * sign * math.sin(phi) + Vector((0, 0, rng.uniform(-.25, .25)))
                yaw, pitch = _yaw_pitch(d)
                length = rng.uniform(.04, .06) * (.85 + .15 * scale)
                pg.leaf(leaves, atlas, cells[rng.randrange(8)], point, yaw, pitch, length, length * .18,
                        droop=rng.uniform(0, .35), roll=rng.uniform(-.7, .7), fold=.35, nu=2, nv=2)
    plant.fit([leaves, bark])
    bark.to_object(piece, 'corteza', piece.material('corteza'))
    leaves.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.55, normal_strength=.6, specular=.3))


# ---------------------------------------------------------------- bambú

def bambu(piece, spec):
    """Bambú de interior: cañas con nudos y abanicos de hojas lanceoladas en las ramillas altas."""
    plant = pg.Plant(piece, spec)
    soil = plant.pot()
    p, rng, buf = plant.params, plant.rng, plant.foliage
    atlas, source = img.Atlas(512, 512), img.Source(piece.finishes['hojas'])
    cells = [(k * 64, 0, 64, 490) for k in range(6)]
    for k, rect in enumerate(cells):
        atlas.shaped(rect, source, hojas.specimen('clara', k), hojas.lanceolate(70 + k, aspect=.13, widest=.28, power=.7),
                     img.look(.27, 1.0, .68 + .05 * (k % 3)), 1.2, .3)
    culm_cell, twig_cell = (392, 0, 56, 500), (452, 0, 56, 500)
    atlas.strip(culm_cell, (.47, .55, .25), seed=10, streaks=.1)
    atlas.strip(twig_cell, (.40, .44, .22), seed=11)
    culm_uv, twig_uv = atlas.rect_uv(culm_cell), atlas.rect_uv(twig_cell)
    scale = (plant.h / 1.8) ** .5
    for c in range(p.get('culms', 6)):
        az = c * GOLDEN + rng.uniform(-.3, .3)
        out = Vector((math.cos(az), math.sin(az), 0))
        foot = Vector((out.x * rng.uniform(.0, .055), out.y * rng.uniform(.0, .055), soil - .03))
        height = (plant.h - soil) * (1.0 if c == 0 else rng.uniform(.68, .95)) * .93
        lean = out * height * rng.uniform(.02, .09)
        steps = max(12, int(height / .03))
        path = pg.resample(pg.hermite(foot, UP, foot + lean + Vector((0, 0, height)), lean + UP * height * 2, steps), steps)
        internode = rng.uniform(.17, .24) * scale
        nodes = [internode * (k + 1) for k in range(int(height / internode))]
        radius = rng.uniform(.009, .013) * scale
        radii = []
        for k in range(steps + 1):
            arc = height * k / steps
            near = min((abs(arc - n) for n in nodes), default=1)
            radii.append(radius * (1 - .25 * k / steps) * (1.14 if near < height / steps * .6 else 1))
        pg.tube(buf, path, radii, 8, rect=culm_uv, cap=True)
        for n in nodes:
            f = n / height
            if f < .25:
                continue
            point, tangent = along(path, f)
            for _b in range(2 if rng.random() < .5 else 3):
                b_az = rng.uniform(0, 2 * math.pi)
                d = Vector((math.cos(b_az) * .8, math.sin(b_az) * .8, rng.uniform(.3, .7))).normalized()
                length = rng.uniform(.07, .2) * scale * (1.1 - .5 * f)
                end = point + d * length + Vector((0, 0, -.015))
                pg.tube(buf, pg.hermite(point, d, end, d - UP * .3, 4), [.0026, .0022, .002, .0017, .0015], 5, rect=twig_uv)
                for leaf_index in range(rng.randint(5, 8)):
                    spread = rng.uniform(-1.1, 1.1)
                    yaw = math.atan2(d.y, d.x) + spread
                    size = rng.uniform(.13, .21) * scale
                    pg.leaf(buf, atlas, cells[(leaf_index + c) % 6], end, yaw, math.radians(rng.uniform(-15, 25)), size, size * .13,
                            droop=rng.uniform(.5, 1.0), roll=rng.uniform(-.5, .5), fold=.3, nu=2, nv=6,
                            twist=rng.uniform(-.5, .5))
    plant.fit([buf])
    buf.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.5, normal_strength=.8, specular=.35))


# ---------------------------------------------------------------- helecho

def helecho(piece, spec):
    """Helecho de Boston: frondas CC0 arqueadas desde la corona que caen por fuera de la maceta."""
    plant = pg.Plant(piece, spec)
    soil = plant.pot()
    rng, buf = plant.rng, plant.foliage
    atlas, source = img.Atlas(1024, 1024), img.Source(piece.finishes['hojas'])
    cells, x = [], 0
    for k, frond in enumerate(hojas.SPECIMENS['fronda']):
        w = round(900 * 2 * frond['half'])
        cells.append(((x, 0, w, 900), frond['half']))
        atlas.natural((x, 0, w, 900), source, frond, img.look(.26, 1.1, 1.0, .5))
        x += w + 4
    n = spec['params'].get('fronds', 40)
    rise = plant.h - soil
    for i in range(n):
        frac = i / max(1, n - 1)
        rect, half = cells[i % len(cells)]
        az = i * GOLDEN + rng.uniform(-.2, .2)
        base = plant.around(.035) + Vector((0, 0, .02))
        elevation = math.radians(38 + 46 * frac + rng.uniform(-6, 6))
        length = rise * rng.uniform(1.0, 1.35) * (1 - .25 * frac)
        pg.leaf(buf, atlas, rect, base, az, elevation, length, length * 2 * half,
                droop=(2.3 - 1.5 * frac) * rng.uniform(.85, 1.1), roll=rng.uniform(-.35, .35), fold=.25, nu=2, nv=12,
                twist=rng.uniform(-.5, .5), side=rng.uniform(-.1, .1))
    plant.fit([buf])
    buf.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.6, normal_strength=.8, specular=.3))


# ---------------------------------------------------------------- sansevieria

def _sansevieria_look(seed, margin):
    def paint(rgb, s, t):
        detail = rgb.mean(-1, keepdims=True)
        detail = detail / max(float(detail.mean()), 1e-3)
        noise = img.value_noise(s.shape, 10, seed)
        bands = img.smooth(.5, .85, .5 + .5 * np.sin(2 * np.pi * (t * 15 + 1.6 * noise + .25 * np.sin(2 * np.pi * s * 2))))
        dark = np.array([.07, .15, .08], np.float32)
        light = np.array([.30, .40, .27], np.float32)
        color = dark + (light - dark) * bands[..., None] * (.6 + .4 * img.value_noise(s.shape, 4, seed + 1))[..., None]
        color = color * (.75 + .25 * detail)
        if margin:
            edge = np.minimum.reduce([np.abs(s), np.abs(s - .5), np.abs(s - 1)])
            yellow = img.smooth(.035, .02, edge)[..., None]
            color = color * (1 - yellow) + np.array([.68, .62, .22], np.float32) * yellow * (.85 + .15 * detail)
        return color
    return paint


def fleshy_leaf(buf, atlas, rect, foot, yaw, lean, length, width, thick, twist, curve, segments=12, rings=14):
    """Hoja carnosa maciza: sección en media luna, más ancha a media altura y acabada en punta."""
    h = Vector((math.cos(yaw), math.sin(yaw), 0))
    center, rows, uvs = foot.copy(), [], []
    for i in range(rings + 1):
        t = i / rings
        a = lean + curve * t * t
        tangent = h * math.sin(a) + UP * math.cos(a)
        if i:
            center = center + tangent * length / rings
        right = h.cross(UP).normalized()
        normal = tangent.cross(right).normalized()
        roll = twist * t
        right, normal = right * math.cos(roll) + normal * math.sin(roll), normal * math.cos(roll) - right * math.sin(roll)
        w = width * (.7 + .3 * math.sin(math.pi * min(1.0, t / .9))) * max(0.0, 1 - t ** 2.5) ** .6
        th = thick * (1 - t) ** .5 + .0008
        ring, ring_uv = [], []
        for k in range(segments + 1):
            theta = 2 * math.pi * k / segments
            c, s = math.cos(theta), math.sin(theta)
            ring.append(center + right * (w / 2 * c) + normal * (th / 2 * s + .16 * w * c * c))
            ring_uv.append(atlas.uv(rect, k / segments, t))
        rows.append(ring)
        uvs.append(ring_uv)
    buf.grid(rows, uvs)


def sansevieria(piece, spec):
    """Sansevieria trifasciata: matas de hojas erguidas en espada con bandas transversales y margen amarillo."""
    plant = pg.Plant(piece, spec)
    soil = plant.pot()
    rng, buf = plant.rng, plant.foliage
    atlas, source = img.Atlas(512, 512), img.Source(piece.finishes['hojas'])
    cells = [(k * 170, 0, 170, 512) for k in range(3)]
    for k, rect in enumerate(cells):
        atlas.shaped(rect, source, hojas.specimen('oscura', k, tissue=(.2, .8)), hojas.solid(), _sansevieria_look(20 + k, k != 2),
                     1.0, 0.0)
    n = spec['params'].get('leaves', 12)
    rise = plant.h - soil
    width = .05 + .035 * (plant.h - .55) / .35
    clumps = [plant.around(plant.soil_r * .45) for _ in range(3)]
    for i in range(n):
        frac = i / max(1, n - 1)
        foot = clumps[i % 3] + Vector((rng.uniform(-.015, .015), rng.uniform(-.015, .015), -.01))
        yaw = i * GOLDEN + rng.uniform(-.3, .3)
        lean = math.radians(rng.uniform(4, 12) + 20 * (1 - frac))
        length = rise * (1.03 if i == n - 1 else rng.uniform(.62, .98)) / math.cos(lean)
        fleshy_leaf(buf, atlas, cells[i % 3], foot, yaw, lean, length, width * rng.uniform(.8, 1.1), .007,
                     rng.uniform(-.5, .5), math.radians(rng.uniform(0, 10)))
    plant.fit([buf])
    buf.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.4, normal_strength=.5, specular=.45,
                                                 cutout=False))


BUILDERS = {
    'olivo': olivo,
    'bambu': bambu,
    'helecho': helecho,
    'sansevieria': sansevieria,
}
