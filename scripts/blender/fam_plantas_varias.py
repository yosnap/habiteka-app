"""Familia «plantas»: potus (de sobremesa y colgante con macramé), cactus columnar y centro de suculentas.

- Potus: hojas acorazonadas CC0 (LeafSet004, silueta natural) con jaspeado dorado propio, en tallos que nacen de la
  tierra, forman una mata y caen por el borde (en la de sobremesa hasta apoyarse en el mueble, nunca bajo Z = 0).
- Potus colgante: maceta colgada de un aro a 2,2 m con macramé (cuerdas, nudos y borla) y tallos que caen hasta
  ~1,15 m; la fábrica guarda esa cota como elevationMm.
- Cactus y suculentas: cuerpos carnosos con texturas propias pintadas por código (costillas con areolas y espinas;
  rosetas con pruina y puntas rosadas) y grava decorativa sobre la tierra.
"""
import math

import numpy as np
from mathutils import Vector

import fam_plantas_especies as especies
import fam_plantas_geo as pg
import fam_plantas_hojas as hojas
import fam_plantas_img as img
import hk_geo as geo

GOLDEN = math.radians(137.5)
UP = Vector((0, 0, 1))


# ---------------------------------------------------------------- potus

def _golden(seed, amount):
    """Jaspeado dorado del potus: vetas crema que siguen los nervios laterales."""
    grid = np.random.default_rng(seed).random((64, 64)).astype(np.float32)[..., None]

    def paint(rgb, s, t):
        rgb = img.grade(rgb, .27, 1.1, .92, .6)
        x = np.abs(s - .5)
        n = img.sample(grid, x * 5 + 3, (t - x * 1.1) * 42 + 8)[..., 0]
        streak = (img.smooth(.62, .8, n) * amount)[..., None]
        cream = np.array([.80, .76, .40], np.float32)
        return rgb * (1 - streak) + cream * (.7 + .6 * rgb.mean(-1, keepdims=True)) * streak
    return paint


def _potus_atlas(piece):
    atlas, source = img.Atlas(1024, 1024), img.Source(piece.finishes['hojas'])
    cells, x, y = [], 0, 0
    for k, leaf in enumerate(hojas.SPECIMENS['potus']):
        w = round(400 * 2 * leaf['half'])
        if x + w > 912:
            x, y = 0, 420
        atlas.natural((x, y, w, 400), source, leaf, _golden(40 + k, (.35, .7, .2, .55, .45)[k]))
        cells.append(((x, y, w, 400), leaf['half'] * 2, leaf['attach']))
        x += w + 4
    stem = (920, 0, 50, 400)
    atlas.strip(stem, (.36, .45, .18), seed=12)
    return atlas, cells, atlas.rect_uv(stem)


def _vine(plant, atlas, cells, stem_uv, path, size, spacing=.05, start=.15):
    """Tallo de potus por `path` con hojas alternas: pecíolo corto y lámina hacia fuera (o colgando)."""
    rng, buf = plant.rng, plant.foliage
    pts = pg.resample(path, 24)
    length = sum((b - a).length for a, b in zip(pts, pts[1:]))
    pg.tube(buf, pts, [.0034 - .0014 * k / 24 for k in range(25)], 6, rect=stem_uv)
    count = max(2, int(length * (1 - start) / spacing))
    for k in range(count):
        f = start + (1 - start) * (k + .5) / count
        point, tangent = especies.along(pts, f)
        out = Vector((point.x, point.y, 0))
        out = out.normalized() if out.length > 1e-3 else Vector((1, 0, 0))
        side = especies.side_of(tangent, out.cross(UP)) * (1 if k % 2 else -1)
        rect, aspect, attach = cells[rng.randrange(len(cells))]
        leaf = size * (1 - .4 * f) * rng.uniform(.85, 1.1)
        if tangent.z < -.45:
            stalk = (out * .8 + side * .5 + UP * .25).normalized()
            yaw, pitch, droop = math.atan2(out.y, out.x) + rng.uniform(-.5, .5), math.radians(rng.uniform(-80, -50)), .15
        elif point.z < .03:
            stalk = (side + UP * .3).normalized()
            yaw, pitch, droop = math.atan2(stalk.y, stalk.x), math.radians(rng.uniform(2, 14)), .1
        else:
            stalk = (out * .5 + side * .5 + UP * .7).normalized()
            yaw, pitch, droop = math.atan2(stalk.y, stalk.x) + rng.uniform(-.4, .4), math.radians(rng.uniform(5, 40)), .3
        end = point + stalk * rng.uniform(.025, .045)
        tangent_leaf = pg.leaf(buf, atlas, rect, end, yaw, pitch, leaf, leaf * aspect, attach=attach, droop=droop,
                               roll=rng.uniform(-.4, .4), fold=.18, cup=.04, nu=4, nv=6, side=rng.uniform(-.1, .1))
        pg.petiole(buf, point, stalk, end, tangent_leaf, .0018, .0015, stem_uv, 5, 4)


def _over_rim(plant, az, rim_z, rim_r, bottom, table=0.0):
    """Recorrido de un tallo que sale de la tierra, pasa por encima del borde y cae por fuera."""
    d = Vector((math.cos(az), math.sin(az), 0))
    foot = plant.around(.03)
    pts = [foot, foot + UP * .03 + d * rim_r * .3, d * (rim_r * .85) + UP * (rim_z + .04),
           d * (rim_r + .03) + UP * (rim_z + .015), d * (rim_r + .05) + UP * (rim_z - .08),
           d * (rim_r + .06) + UP * max(bottom + .05, (rim_z + bottom) / 2), d * (rim_r + .065) + UP * bottom]
    if table:
        pts += [d * (rim_r + .07 + table * .4) + UP * .012, d * (rim_r + .07 + table) + UP * .012]
    return geo.fillet(pts, .04, 5)


def potus(piece, spec):
    """Potus de sobremesa: mata de hojas sobre la maceta y tallos que caen por el borde hasta el mueble."""
    plant = pg.Plant(piece, spec)
    soil = plant.pot()
    rng = plant.rng
    atlas, cells, stem_uv = _potus_atlas(piece)
    rim_z, rim_r = plant.pot_h, plant.pot_r
    for k in range(5):
        az = k * 2 * math.pi / 5 + rng.uniform(-.3, .3)
        d = Vector((math.cos(az), math.sin(az), 0))
        foot = plant.around(.03)
        top = foot + d * rng.uniform(.03, .07) + UP * rng.uniform(.1, .17)
        _vine(plant, atlas, cells, stem_uv, pg.hermite(foot, UP, top, d + UP, 8), .095, .035, .05)
    for k in range(5):
        az = k * 2 * math.pi / 5 + rng.uniform(-.4, .4) + .6
        _vine(plant, atlas, cells, stem_uv, _over_rim(plant, az, rim_z, rim_r, .03, rng.uniform(.04, .14)), .085)
    plant.fit([plant.foliage], lo=.9, hi=1.1)
    plant.foliage.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.4, normal_strength=.8, specular=.4))


def _macrame(piece, top, rim_z, pot_r, pot_bottom):
    """Colgador de macramé: aro, nudo de reunión, cuatro pares de cordones con nudos en rombo y borla inferior."""
    cord, r = 'cuerda', .0035
    piece.add(geo.tube(geo.arc(0, 0, 0, .028, 0, 360, 24)[:-1], .005, 8, closed=True), cord, 'x', 0)
    ring = piece.objects[-1]
    ring.rotation_euler = (math.pi / 2, 0, 0)
    ring.location = (0, 0, top - .033)
    knot_top, knot_bottom = top - .07, pot_bottom - .035
    piece.add(geo.lathe([(0, knot_top - .03), (.011, knot_top - .028), (.013, knot_top - .015), (.011, knot_top), (0, knot_top + .002)], 12), cord, 'z', 0)
    piece.add(geo.lathe([(0, knot_bottom - .045), (.012, knot_bottom - .043), (.014, knot_bottom - .02), (.012, knot_bottom), (0, knot_bottom + .002)], 12), cord, 'z', 0)
    for k in range(2):
        piece.add(geo.tube([(0, -.012 * (1 - 2 * k), top - .06), (0, -.026 * (1 - 2 * k), top - .035), (0, -.012 * (1 - 2 * k), top - .012)], r, 6), cord, 'z', 0)
    z_knot, z_mid = rim_z + .12, rim_z - .045
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        for j in (-1, 1):
            az0, az1 = a + j * .05, a + j * math.pi / 4
            p_knot = Vector((math.cos(a) * (pot_r + .012), math.sin(a) * (pot_r + .012), z_knot))
            p_rim = Vector((math.cos(az0 + j * .2) * (pot_r + .007), math.sin(az0 + j * .2) * (pot_r + .007), rim_z))
            p_mid = Vector((math.cos(az1) * (pot_r * .97 + .007), math.sin(az1) * (pot_r * .97 + .007), z_mid))
            p_low = Vector((math.cos(az1) * (pot_r * .6), math.sin(az1) * (pot_r * .6), pot_bottom + .006))
            path = [Vector((0, 0, knot_top - .03)), p_knot + Vector((0, 0, .02)), p_knot, p_rim, p_mid, p_low,
                    Vector((0, 0, knot_bottom))]
            piece.add(geo.tube(geo.fillet(path, .03, 4), r, 6), cord, 'z', 0)
        piece.add(geo.sphere(.009, (math.cos(a) * (pot_r + .012), math.sin(a) * (pot_r + .012), z_knot), 8, 1.3), cord, 'z', 0)
        mid_a = a + math.pi / 4
        piece.add(geo.sphere(.008, (math.cos(mid_a) * (pot_r * .97 + .009), math.sin(mid_a) * (pot_r * .97 + .009), z_mid), 8, 1.2),
                  cord, 'z', 0)
    for k in range(10):
        a = k * 2 * math.pi / 10
        end = Vector((math.cos(a) * .022, math.sin(a) * .022, knot_bottom - .21 - .03 * (k % 3)))
        piece.add(geo.tube(geo.fillet([(0, 0, knot_bottom - .04), (math.cos(a) * .012, math.sin(a) * .012, knot_bottom - .08), end], .03, 3),
                           .0028, 5), cord, 'z', 0)
    return knot_bottom - .27


def potus_colgante(piece, spec):
    """Potus en maceta colgada con macramé de un aro a 2,2 m; los tallos caen por todo el contorno."""
    plant = pg.Plant(piece, spec)
    p = plant.params['pot']
    top = 2.2
    rim = top - .62
    plant.pot(at_z=rim - p['h'] / 1000)
    rng = plant.rng
    atlas, cells, stem_uv = _potus_atlas(piece)
    lowest = top - plant.h
    _macrame(piece, top, rim, plant.pot_r, rim - p['h'] / 1000)
    for k in range(5):
        az = k * 2 * math.pi / 5 + rng.uniform(-.3, .3)
        d = Vector((math.cos(az), math.sin(az), 0))
        foot = plant.around(.03)
        tip = foot + d * rng.uniform(.04, .08) + UP * rng.uniform(.06, .12)
        _vine(plant, atlas, cells, stem_uv, pg.hermite(foot, UP, tip, d + UP, 8), .09, .035, .05)
    vines = 9
    for k in range(vines):
        az = k * 2 * math.pi / vines + rng.uniform(-.2, .2) + .3
        bottom = lowest + (0 if k == 0 else rng.uniform(.02, .35))
        _vine(plant, atlas, cells, stem_uv, _over_rim(plant, az, rim, plant.pot_r, bottom), .085, .055)
    plant.foliage.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.4, normal_strength=.8, specular=.4))


# ---------------------------------------------------------------- cactus y suculentas

def _pebbles(piece, plant, count, keep_out=0.0, size=.011):
    rng = plant.rng
    for _ in range(count):
        for _try in range(12):
            a, r = rng.uniform(0, 2 * math.pi), (plant.soil_r - .012) * math.sqrt(rng.random())
            if r > keep_out:
                break
        radius = size * rng.uniform(.6, 1.2)
        bm = geo.sphere(radius, (0, 0, 0), 8, rng.uniform(.45, .7))
        geo.transform(bm, loc=(r * math.cos(a), r * math.sin(a), plant.soil_z + radius * .25), rot=(0, 0, rng.uniform(0, 3)),
                      scale=(1, rng.uniform(.7, 1), 1))
        piece.add(bm, 'grava', 'x', 0)


def _cactus_texture(ribs=8, seed=0):
    """Piel de cactus (una vuelta = 512 px, 3 areolas por costilla en la altura): verde glauco, areolas y espinas."""
    h, w = 256, 512
    v, u = np.mgrid[0:h, 0:w].astype(np.float32)
    phase = (u / w * ribs) % 1
    ridge = np.abs(np.cos(np.pi * phase))
    noise = img.value_noise((h, w), 6, seed) - .5
    streaks = img.value_noise((h, w // 16), 40, seed + 1).repeat(16, axis=1) - .5
    base = np.array([.21, .35, .33], np.float32)
    color = base * (.6 + .45 * ridge[..., None] ** 1.5 + .18 * noise[..., None] + .2 * streaks[..., None])
    height = ridge * 2.0
    for row in range(3):
        cy = (row + .5) * h / 3
        for k in range(ribs):
            cx = (k * w / ribs) % w
            dx, dy = u - cx, v - cy
            dx = np.where(dx > w / 2, dx - w, np.where(dx < -w / 2, dx + w, dx))
            dist = np.hypot(dx, dy)
            felt = img.smooth(6, 4, dist)
            color = color * (1 - felt[..., None]) + np.array([.78, .74, .62], np.float32) * felt[..., None]
            height = height + felt * 1.5
            angle = np.arctan2(dy, dx)
            for spine in range(7):
                sa = spine * 2 * np.pi / 7 + .3
                across = np.abs(np.sin(angle - sa)) * dist
                on = (np.cos(angle - sa) > 0) & (dist > 4) & (dist < 15 + 4 * (spine % 3))
                line = img.smooth(1.2, .4, across) * on
                color = color * (1 - .85 * line[..., None]) + np.array([.48, .40, .30], np.float32) * .85 * line[..., None]
    return color, height


def cactus(piece, spec):
    """Cactus columnar (Cereus): columna acanalada con brazos acodados, areolas con espinas y grava sobre la tierra."""
    plant = pg.Plant(piece, spec)
    soil = plant.pot()
    rng, body = plant.rng, pg.MeshBuf()
    tile, ribs = .09, 8

    def column(path, radius):
        pts = pg.resample(path, max(8, int(sum((b - a).length for a, b in zip(path, path[1:])) / .025)))
        total = sum((b - a).length for a, b in zip(pts, pts[1:]))
        radii, arc = [], 0.0
        for k, point in enumerate(pts):
            if k:
                arc += (point - pts[k - 1]).length
            dome = max(0.0, arc - (total - radius * 1.2)) / (radius * 1.2)
            radii.append(radius * math.sqrt(max(0.02, 1 - dome * dome)) * (1 - .06 * arc / total))
        pg.tube(body, pts, radii, ribs * 4, tile=tile, cap=True, ribs=ribs, rib_depth=.16)

    height = plant.h
    column(pg.hermite((0, 0, soil - .03), UP, (.012, -.008, height), (.05, -.03, 1), 20), .046 * height ** .3)
    for k in range(3):
        a = k * 2.3 + rng.uniform(-.3, .3)
        d = Vector((math.cos(a), math.sin(a), 0))
        z0 = soil + (height - soil) * rng.uniform(.28, .5)
        reach = rng.uniform(.07, .11)
        z1 = soil + (height - soil) * rng.uniform(.62, .86)
        path = geo.fillet([Vector((0, 0, z0 - .02)), d * reach + UP * (z0 + .015), d * (reach + .01) + UP * (z0 + .1), d * (reach + .015) + UP * z1],
                          .06, 6)
        column(path, .034 * height ** .3 * rng.uniform(.85, 1.05))
    color, bumps = _cactus_texture(ribs, 3)
    body.to_object(piece, 'cactus', img.opaque_material(f'{piece.name}-cuerpo', color, roughness=.7, height=bumps,
                                                        normal_strength=.8, specular=.35))
    _pebbles(piece, plant, 60, keep_out=.055, size=.009)


def _echeveria_paint(kind):
    def paint(s, t):
        if kind == 'haworthia':
            base = np.array([.10, .20, .12], np.float32)
            stripes = img.smooth(.75, .9, .5 + .5 * np.sin(2 * np.pi * t * 9)) * (np.abs(s - .75) < .2)
            dots = stripes * img.smooth(.45, .6, img.value_noise(s.shape, 3, 9))
            return base * (1 - dots[..., None]) + np.array([.85, .86, .80], np.float32) * dots[..., None]
        green = {'azul': [.48, .60, .58], 'rosa': [.62, .58, .62], 'verde': [.42, .55, .30]}[kind]
        base = np.array(green, np.float32) * (.8 + .25 * t[..., None])
        blush = img.smooth(.72, 1.0, t)[..., None] * (.75 if kind != 'verde' else .35)
        pink = np.array([.72, .40, .45], np.float32)
        pale = img.smooth(.25, 0, t)[..., None] * .25
        color = base * (1 - blush) + pink * blush
        return color * (1 - pale) + np.array([.78, .82, .70], np.float32) * pale
    return paint


def suculentas(piece, spec):
    """Centro de suculentas en cuenco de hormigón: equeverias azuladas y rosadas, una haworthia y grava."""
    plant = pg.Plant(piece, spec)
    soil = plant.pot()
    rng, buf = plant.rng, plant.foliage
    atlas = img.Atlas(512, 256)
    kinds = ['azul', 'rosa', 'haworthia', 'verde']
    cells = {}
    for k, kind in enumerate(kinds):
        cells[kind] = (k * 128, 0, 128, 256)
        atlas.paint(cells[kind], _echeveria_paint(kind))
    rosettes = [('azul', .085, .02, 0), ('rosa', .068, .085, 1.2), ('azul', .055, .095, 2.7), ('verde', .05, .09, 4.0),
                ('haworthia', .042, .1, 5.1), ('rosa', .045, .06, 3.5)]
    reach = plant.soil_r - .02
    for kind, radius, dist, a in rosettes:
        center = Vector((min(dist, reach - radius * .6) * math.cos(a), min(dist, reach - radius * .6) * math.sin(a), soil - .004))
        count = 16 if kind == 'haworthia' else 22
        for k in range(count):
            age = 1 - k / count
            yaw = k * GOLDEN + rng.uniform(-.1, .1)
            if kind == 'haworthia':
                lean, length, width = math.radians(10 + 35 * age), radius * (1.2 + .8 * age), radius * .28
                thick, curve = width * .45, math.radians(-8)
            else:
                lean, length, width = math.radians(18 + 64 * age), radius * (.45 + .6 * age), radius * (.32 + .3 * age)
                thick, curve = width * .32, math.radians(-25)
            foot = center + Vector((math.cos(yaw), math.sin(yaw), 0)) * radius * .08 * age
            especies.fleshy_leaf(buf, atlas, cells[kind], foot, yaw, lean, length, width, thick, 0.0, curve, segments=8, rings=5)
    buf.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.5, normal_strength=.5, specular=.35,
                                                 cutout=False))
    _pebbles(piece, plant, 95, size=.0075)


BUILDERS = {
    'potus': potus,
    'potus_colgante': potus_colgante,
    'cactus': cactus,
    'suculentas': suculentas,
}
