"""Familia «plantas»: plantas de interior realistas en maceta. Metros, Z arriba, suelo en Z = 0, frente hacia -Y.

Huecos: «maceta», «tierra», «hojas» (acabado CC0 con alfa: fuente del atlas de la planta), «tutor» (fibra de coco
de la monstera), «corteza» (olivo) y «cuerda» (macramé del potus colgante).

Cada planta pinta su atlas de hojas (fam_plantas_img), coloca las láminas con filotaxis, inclinación, giro y caída por
peso (fam_plantas_geo.leaf) y une cada hoja a la tierra o a su tallo con un pecíolo. Aquí están las tropicales de
hoja grande (monstera, ficus lyrata, strelitzia y kentia); el resto, en fam_plantas_especies y fam_plantas_varias.
"""
import math

from mathutils import Vector

import fam_plantas_especies as especies
import fam_plantas_geo as pg
import fam_plantas_hojas as hojas
import fam_plantas_img as img
import fam_plantas_varias as varias

GOLDEN = math.radians(137.5)


# ---------------------------------------------------------------- monstera

def monstera(piece, spec):
    """Monstera deliciosa: hojas perforadas y partidas sobre pecíolos largos; con tutor de fibra de coco en las grandes."""
    plant = pg.Plant(piece, spec)
    soil = plant.pot()
    p = plant.params
    atlas, source = img.Atlas(1024, 1024), img.Source(piece.finishes['hojas'])
    cells = [(0, 0, 470, 512), (470, 0, 470, 512), (0, 512, 470, 512), (470, 512, 470, 512)]
    grading = img.look(.30, 1.2, .74)
    for k, rect in enumerate(cells):
        shape = hojas.monstera(k * 7 + 3, splits=6 + k % 2, entire=k == 3, holes=.75 if k < 2 else .45)
        atlas.shaped(rect, source, hojas.specimen('oscura', (0, 1, 2, 4)[k]), shape, grading, 1.2, .3)
    stem_cell, root_cell = (944, 0, 80, 512), (944, 512, 80, 512)
    atlas.strip(stem_cell, (.20, .30, .11), seed=2)
    atlas.strip(root_cell, (.30, .22, .14), seed=3)
    stem_uv, root_uv = atlas.rect_uv(stem_cell), atlas.rect_uv(root_cell)
    rng, buf = plant.rng, plant.foliage
    n, lmax = p.get('leaves', 9), p.get('leaf', 380) / 1000
    reach = min(plant.w, plant.d) / 2
    nodes = []
    pole_parts = []
    if p.get('pole'):
        top = soil + (plant.h - soil) * .62
        pole = pg.MeshBuf()
        pg.tube(pole, [(0, 0, soil - .03), (0, 0, top)], .03, 14, tile=pg.tile_of(piece.finishes.get('tutor')), cap=True)
        pole_parts.append(pole)
        path = [Vector((.042 * math.cos(z * 9), .042 * math.sin(z * 9), z)) for z in
                [soil - .01 + (top - .05 - soil) * k / 24 for k in range(25)]]
        pg.tube(buf, path, [.013 - .004 * k / 24 for k in range(25)], 8, rect=stem_uv)
        for k in range(n - 3):
            nodes.append(path[min(24, 4 + round(20 * k / max(1, n - 4)))])
        for k in range(5):
            a = path[6 + k * 3]
            down = a + Vector((math.cos(k * 2.1) * .08, math.sin(k * 2.1) * .08, -(a.z - soil) * .7))
            pg.tube(buf, pg.hermite(a, (a.x, a.y, -.2), down, (0, 0, -1), 6), [.004, .003, .003, .0025, .002, .002, .0015], 5,
                    rect=root_uv)
    while len(nodes) < n:
        nodes.append(plant.around(.035))
    for i in range(n):
        frac = i / max(1, n - 1)
        young = i >= n - 2 and n > 5
        length = lmax * (1 - .3 * frac) * rng.uniform(.88, 1.06) * (.62 if young else 1)
        width = length * .92
        az = i * GOLDEN + rng.uniform(-.25, .25)
        pitch = math.radians(rng.uniform(-8, 8) - 10 + 42 * frac)
        start = nodes[i]
        low = .26 if p.get('pole') else .14
        rise = soil + (plant.h - soil) * (low + (.9 - low) * frac) - length * math.sin(pitch) * .5
        dist = max(.06, reach - length * math.cos(pitch) * .95)
        dist *= rng.uniform(.85, 1.0) if not young else .55
        base = Vector((dist * math.cos(az), dist * math.sin(az), max(rise, start.z + .12)))
        cell = cells[3] if young else cells[i % 3]
        tangent = pg.leaf(buf, atlas, cell, base, az + rng.uniform(-.2, .2), pitch, length, width, attach=.16,
                          droop=rng.uniform(.35, .65), roll=rng.uniform(-.25, .25), fold=.28, cup=-.03, wave=.015,
                          side=rng.uniform(-.08, .08), nu=8, nv=10, phase=rng.random() * 6)
        out = Vector((math.cos(az), math.sin(az), 0))
        pg.petiole(buf, start, out * .35 + Vector((0, 0, 1)), base, tangent + Vector((0, 0, .9)),
                   .0075 * length / .4 + .002, .005 * length / .4 + .0015, stem_uv, segments=7, steps=12)
    plant.fit([buf] + pole_parts)
    for part in pole_parts:
        part.to_object(piece, 'tutor', piece.material('tutor'))
    buf.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.55, normal_strength=.8, specular=.35))


# ---------------------------------------------------------------- ficus lyrata

def ficus_lyrata(piece, spec):
    """Ficus lyrata: tallo único con hojas de violín alternas en espiral y pecíolo corto (desde abajo en la joven)."""
    plant = pg.Plant(piece, spec)
    soil = plant.pot()
    p, rng, buf = plant.params, plant.rng, plant.foliage
    atlas, source = img.Atlas(1024, 1024), img.Source(piece.finishes['hojas'])
    cells = [(k * 300, 0, 300, 400) for k in range(3)] + [(k * 300, 420, 300, 400) for k in range(3)]
    for k, rect in enumerate(cells):
        atlas.shaped(rect, source, hojas.specimen('oscura', 1 + k % 2, side=1 - 2 * (k // 2 % 2)), hojas.ficus_lyrata(11 + k, aspect=.75),
                     img.look(.27, 1.15, .9 + .04 * (k % 3)), 1.4, .45)
    trunk_cell, green_cell = (900, 0, 60, 900), (962, 0, 60, 900)
    atlas.strip(trunk_cell, (.42, .37, .29), seed=4)
    atlas.strip(green_cell, (.26, .34, .14), seed=5)
    trunk_uv, green_uv = atlas.rect_uv(trunk_cell), atlas.rect_uv(green_cell)
    n, lmax = p.get('leaves', 20), p.get('leaf', 290) / 1000
    top = plant.h - lmax * .45
    foot = Vector((0, 0, soil - .02))
    path = pg.hermite(foot, (0, 0, 1), foot + Vector((rng.uniform(-.03, .03), rng.uniform(-.03, .03), top - soil)),
                      (rng.uniform(-.1, .1), rng.uniform(-.1, .1), 1), 16)
    r0 = .006 + .012 * (plant.h / 1.8)
    pg.tube(buf, path, [r0 * (1 - .6 * k / 16) for k in range(17)], 9, rect=trunk_uv, cap=True)
    # Las jóvenes (bush) visten el tallo desde la tierra; las altas tienen el tronco limpio hasta un 30 %.
    first = .04 if p.get('bush') else .3
    for i in range(n):
        frac = i / max(1, n - 1)
        node = path[min(16, round((first + (1 - first) * frac) * 16))]
        node = node + (path[-1] - path[0]).normalized() * rng.uniform(-.02, .02)
        az = i * GOLDEN + rng.uniform(-.2, .2)
        out = Vector((math.cos(az), math.sin(az), 0))
        length = lmax * (.62 + .38 * math.sin(math.pi * (.25 + .7 * (1 - frac)))) * rng.uniform(.9, 1.05)
        if i == n - 1:
            length *= .7
        pitch = math.radians(rng.uniform(-5, 10) + 8 + 45 * frac ** 1.5)
        base = node + out * (.035 + .01 * length / .3) + Vector((0, 0, .02))
        tangent = pg.leaf(buf, atlas, cells[i % 6], base, az + rng.uniform(-.3, .3), pitch, length, length * .75,
                          attach=.03, droop=rng.uniform(.2, .45), roll=rng.uniform(-.3, .3), fold=.1, cup=-.04,
                          wave=.03, waves=2.5, side=rng.uniform(-.06, .06), nu=8, nv=10, phase=rng.random() * 6)
        pg.petiole(buf, node, out + Vector((0, 0, .6)), base, tangent, .0045, .0035, green_uv, 6, 5)
    plant.fit([buf])
    buf.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.42, normal_strength=1.0, specular=.4))


# ---------------------------------------------------------------- strelitzia

def strelitzia(piece, spec):
    """Strelitzia nicolai: abanicos de hojas en pala sobre pecíolos largos, con desgarros en las adultas."""
    plant = pg.Plant(piece, spec)
    soil = plant.pot()
    p, rng, buf = plant.params, plant.rng, plant.foliage
    atlas, source = img.Atlas(1024, 1024), img.Source(piece.finishes['hojas'])
    cells = [(k * 180, 0, 180, 500) for k in range(5)] + [(k * 180, 510, 180, 500) for k in range(5)]
    for k, rect in enumerate(cells):
        shape = hojas.strelitzia(30 + k) if k < 8 else hojas.strelitzia(30 + k, aspect=.36)
        atlas.shaped(rect, source, hojas.specimen('oscura', k), shape, img.look(.37, .75, 1.0 + .05 * (k % 2)), 1.0, .5)
    stalk_cell, sheath_cell = (902, 0, 60, 1000), (964, 0, 60, 1000)
    atlas.strip(stalk_cell, (.30, .36, .22), seed=6)
    atlas.strip(sheath_cell, (.36, .32, .22), seed=7)
    stalk_uv, sheath_uv = atlas.rect_uv(stalk_cell), atlas.rect_uv(sheath_cell)
    n = p.get('leaves', 9)
    fans = 2 if n < 11 else 3
    height = plant.h - soil
    for f in range(fans):
        theta = f * math.pi / fans + rng.uniform(-.3, .3)
        fan = Vector((math.cos(theta), math.sin(theta), 0))
        foot = Vector((rng.uniform(-.05, .05), rng.uniform(-.05, .05), soil - .02))
        count = n // fans + (1 if f < n % fans else 0)
        for j in range(count):
            age = 1 - j / max(1, count - 1)
            side = 1 if j % 2 else -1
            tilt = math.radians(6 + 30 * age + rng.uniform(-4, 4)) * side
            stalk = height * rng.uniform(.42, .5) * (1 - .15 * age)
            direction = Vector((fan.x * math.sin(tilt), fan.y * math.sin(tilt), math.cos(tilt)))
            base = foot + direction * stalk + Vector((0, 0, .04))
            blade = height * rng.uniform(.4, .46) * (.75 if j == count - 1 else 1)
            yaw = math.atan2(direction.y, direction.x) if abs(math.sin(tilt)) > .02 else theta
            pitch = math.asin(max(-1, min(1, direction.z)))
            tangent = pg.leaf(buf, atlas, cells[(j + f * 3) % (8 if age > .4 else 10)], base, yaw, pitch, blade, blade * .36,
                              droop=rng.uniform(.3, .7) * (.4 + age), roll=math.pi / 2 * side + rng.uniform(-.3, .3),
                              fold=.18, cup=.02, wave=.02, waves=4, twist=rng.uniform(-.4, .4), nu=6, nv=12)
            pg.petiole(buf, foot + Vector((0, 0, .01)), direction, base, tangent, .014, .008, stalk_uv, 8, 10)
            pg.tube(buf, [foot, foot + direction * height * .14], [.024, .015], 8, rect=sheath_uv)
    plant.fit([buf])
    buf.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.5, normal_strength=.9, specular=.35))


# ---------------------------------------------------------------- kentia

def kentia(piece, spec):
    """Palmera kentia: frondas arqueadas desde la tierra con folíolos colgantes a ambos lados del raquis."""
    plant = pg.Plant(piece, spec)
    soil = plant.pot()
    p, rng, buf = plant.params, plant.rng, plant.foliage
    atlas, source = img.Atlas(512, 1024), img.Source(piece.finishes['hojas'])
    cells = [(k * 64, 0, 64, 1000) for k in range(6)]
    for k, rect in enumerate(cells):
        atlas.shaped(rect, source, hojas.specimen('oscura', k), hojas.lanceolate(50 + k, aspect=.066, widest=.3, power=.7),
                     img.look(.29, 1.0, .95 + .04 * (k % 3)), 1.2, .3)
    rachis_cell, sheath_cell = (400, 0, 50, 1000), (456, 0, 50, 1000)
    atlas.strip(rachis_cell, (.24, .32, .13), seed=8)
    atlas.strip(sheath_cell, (.33, .27, .18), seed=9)
    rachis_uv, sheath_uv = atlas.rect_uv(rachis_cell), atlas.rect_uv(sheath_cell)
    n = p.get('fronds', 9)
    height = plant.h - soil
    clusters = [plant.around(plant.soil_r * .45) for _ in range(3)]
    reach = min(plant.w, plant.d) / 2
    for i in range(n):
        frac = i / max(1, n - 1)
        az = i * GOLDEN + rng.uniform(-.2, .2)
        out = Vector((math.cos(az), math.sin(az), 0))
        foot = clusters[i % 3] + Vector((rng.uniform(-.01, .01), rng.uniform(-.01, .01), 0))
        length = height * rng.uniform(1.12, 1.28) * (1 - .2 * frac)
        rise = math.radians(48 + 30 * frac + rng.uniform(-5, 5))
        span = reach * (1 - .45 * frac) * rng.uniform(.85, 1.0)
        apex = foot + Vector((0, 0, length * math.sin(rise) * 1.15)) + out * span * .5
        tip = foot + out * span + Vector((0, 0, length * math.sin(rise) * (.4 + .35 * frac)))
        rachis = pg.resample(pg.bezier(foot, foot + Vector((0, 0, length * .3)) + out * span * .14, apex, tip, 30), 30)
        pg.tube(buf, rachis, [.009 * (1 - .8 * k / 30) + .0015 for k in range(31)], 6, rect=rachis_uv)
        pg.tube(buf, rachis[:5], [.016, .014, .012, .011, .01], 7, rect=sheath_uv)
        count = 24
        lmax = min(.42, length * .3)
        for k in range(count):
            s = .2 + .78 * k / (count - 1)
            idx = min(29, int(s * 30))
            point = rachis[idx].lerp(rachis[idx + 1], s * 30 - idx)
            along = (rachis[idx + 1] - rachis[idx]).normalized()
            side_dir = along.cross(Vector((0, 0, 1)))
            side_dir = side_dir.normalized() if side_dir.length > 1e-4 else out.cross(Vector((0, 0, 1)))
            leaflet = lmax * math.sin(math.pi * min(.97, (s - .14) / .86)) ** .55 * rng.uniform(.88, 1.05)
            for sign in (-1, 1):
                d = (side_dir * sign * .75 + along * .55 + Vector((0, 0, -.15))).normalized()
                yaw = math.atan2(d.y, d.x)
                pitch = math.asin(max(-1, min(1, d.z)))
                pg.leaf(buf, atlas, cells[(k + i + (sign > 0)) % 6], point, yaw, pitch, leaflet, leaflet * .066,
                        droop=rng.uniform(.7, 1.1) * (.6 + .5 * s), roll=sign * .35, fold=.5, nu=2, nv=5,
                        twist=sign * rng.uniform(0, .4))
    plant.fit([buf])
    buf.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.45, normal_strength=.8, specular=.4))


BUILDERS = {
    'monstera': monstera,
    'ficus_lyrata': ficus_lyrata,
    'strelitzia': strelitzia,
    'kentia': kentia,
    **especies.BUILDERS,
    **varias.BUILDERS,
}
