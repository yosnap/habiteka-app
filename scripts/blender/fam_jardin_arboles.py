"""Familia «jardin»: árboles (plátano de sombra, olivo y naranjo), arbusto, seto recortado y formio.

Huecos: «hojas» (atlas CC0 con alfa: fuente de las hojas de los ramilletes), «corteza» (tronco y ramas, textura CC0 a
escala real), «suelo» (alcorque de mantillo) y «fruto» (naranjas). El esqueleto de ramas son tubos con la corteza;
el follaje, tarjetas de ramilletes (fam_jardin_follaje) en racimos alrededor de las puntas de rama.
"""
import math
import random
import zlib

import numpy as np
from mathutils import Vector, noise as mnoise

import fam_jardin_follaje as fol
import fam_plantas_geo as pg
import fam_plantas_hojas as hojas
import fam_plantas_img as img
import hk_geo as geo

UP = Vector((0, 0, 1))


def _rng(spec):
    seed = zlib.crc32(spec['id'].encode())
    return random.Random(seed), np.random.default_rng(seed)


def _dims(spec):
    return tuple(v / 1000 for v in spec['dims'])


def _dir(az, el):
    return Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))


class Tree:
    """Esqueleto de un árbol: tubos de corteza y puntas de rama donde nacen los racimos de ramilletes."""

    def __init__(self, piece, rng):
        self.piece, self.rng = piece, rng
        self.bark = pg.MeshBuf()
        self.tile = pg.tile_of(piece.finishes.get('corteza'), 1.0)
        self.tips = []

    def branch(self, start, direction, end, r0, r1, segments=8, steps=8, jitter=.08, tip=True):
        path = pg.resample(pg.hermite(start, direction, end, Vector(end) - Vector(start) + UP * .2, steps), steps)
        pg.tube(self.bark, path, [r0 + (r1 - r0) * k / steps for k in range(steps + 1)], segments, tile=self.tile,
                jitter=jitter, seed=self.rng.random() * 50, cap=True)
        if tip:
            self.tips.append(path[-1])
        return path

    def fork(self, path, count, length, radius, spread=40, rise=20, lo=.4, hi=.95, tip=True, segments=6, steps=5):
        """Ramas hijas a lo largo de `path`, abiertas `spread` grados del rumbo de la madre y elevadas `rise`."""
        children = []
        for k in range(count):
            f = lo + (hi - lo) * (k + self.rng.uniform(.1, .9)) / count
            x = f * (len(path) - 1)
            i = min(len(path) - 2, int(x))
            point = path[i].lerp(path[i + 1], x - i)
            along = (path[i + 1] - path[i]).normalized()
            az = math.atan2(along.y, along.x) + math.radians(self.rng.uniform(spread * .5, spread)) * (1 if k % 2 else -1)
            el = math.asin(max(-1, min(1, along.z))) + math.radians(self.rng.uniform(-rise, rise) * .5 + rise * .3)
            el = max(math.radians(-25), min(math.radians(80), el))
            end = point + _dir(az, el) * length * self.rng.uniform(.75, 1.1)
            children.append(self.branch(point, along, end, radius, radius * .35, segments, steps, .05, tip))
        return children


def _species_atlas(piece, leaves, nrng, hue, sprays=8, sunlit=4, inner=4, **options):
    """Atlas 1024² de ramilletes: celdas normales, al sol (más claras, para lo alto de la copa) y de interior (oscuras)."""
    atlas = img.Atlas(1024, 1024)
    cells = [(c * 256, r * 256, 256, 256) for r in range(4) for c in range(4)]
    for k, rect in enumerate(cells[:sprays + sunlit + inner]):
        # Cada ramillete con su matiz y brillo (hojas más amarillas o más azuladas); al sol, más claras y cálidas.
        tint = np.array([nrng.uniform(.9, 1.06), nrng.uniform(.92, 1.05), nrng.uniform(.85, 1.05)]) * nrng.uniform(.85, 1.08)
        if sprays <= k < sprays + sunlit:
            tint = tint * np.array([1.22, 1.2, 1.02])
        elif k >= sprays + sunlit:
            tint = tint * .68
        own = (lambda base, tint: lambda rgb: base(rgb) * tint)(hue, tint)
        fol.spray(atlas, rect, leaves, nrng, hue=own, **options)
    return atlas, cells[:sprays], cells[sprays:sprays + sunlit], cells[sprays + sunlit:sprays + sunlit + inner]


def _finish(piece, buffers, w, d, h, atlas, roughness=.6, specular=.35):
    fol.fit(buffers, w, d, h)
    for buf, slot in buffers.items():
        if slot == 'hojas':
            buf.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=roughness, normal_strength=.9,
                                                        specular=specular))
        else:
            buf.to_object(piece, slot, piece.material(slot))


# ---------------------------------------------------------------- plátano de sombra

def shade_tree(piece, spec):
    """Plátano de sombra joven: tronco limpio con la corteza moteada, cruz de cuatro brazos y copa redonda."""
    w, d, h = _dims(spec)
    rng, nrng = _rng(spec)
    leaves = fol.leaves_of(piece.finishes['hojas'])
    hue = img.look(.2, .7, .7, .55)
    atlas, cells, sun, inner = _species_atlas(piece, leaves, nrng, lambda rgb: hue(rgb, 0, 0), count=8, leaf=.3, spread=55,
                                         sides=2, twig=(.36, .30, .22))
    tree = Tree(piece, rng)
    crown_z, rz, rxy = h * .66, h * .32, min(w, d) / 2 * .9
    top = Vector((.04, -.03, h * .45))
    trunk = pg.resample(pg.hermite(Vector((0, 0, 0)), UP, top, UP + Vector((.05, -.03, 0)), 12), 12)
    radii = [.17, .135, .12] + [.118 - .035 * k / 9 for k in range(10)]
    pg.tube(tree.bark, trunk, radii, 14, tile=tree.tile, jitter=.06, seed=3)
    center = Vector((0, 0, crown_z))
    limbs = []
    for k in range(4):
        az = k * math.pi / 2 + rng.uniform(-.35, .35)
        end = center + _dir(az, math.radians(rng.uniform(15, 45))) * rxy * .62
        limbs.append(tree.branch(top - Vector((0, 0, .1)), UP, end, .075, .035, 10, 8))
    limbs.append(tree.branch(top, UP, center + Vector((0, 0, rz * .62)), .07, .03, 10, 8))
    seconds = []
    for limb in limbs:
        seconds += tree.fork(limb, 3, rxy * .55, .03, spread=45, rise=25)
    for second in seconds:
        tree.fork(second, 3, rxy * .3, .014, spread=40, rise=20, lo=.45, segments=5, steps=4)
    leaves_buf = pg.MeshBuf()
    fol.spray_cards(leaves_buf, atlas, cells, inner, nrng, tree.tips, center, (rxy, rxy, rz), 16, .52, spread=.45,
                    top_cells=sun)
    _finish(piece, {leaves_buf: 'hojas', tree.bark: 'corteza'}, w, d, h, atlas, roughness=.62)


# ---------------------------------------------------------------- olivo

def _olive_leaves(piece):
    """Hojas de olivo con silueta propia (lanceoladas y estrechas) sobre tejido CC0: haz verde y envés plateado."""
    source, atlas = img.Source(piece.finishes['hojas']), img.Atlas(512, 256)
    rects = [(k * 46, 0, 46, 250) for k in range(8)]
    for k, rect in enumerate(rects):
        silver = k >= 5
        atlas.shaped(rect, source, hojas.specimen('clara', k), hojas.lanceolate(90 + k, aspect=.18, widest=.5, power=.75,
                     parallel=False, midrib=.8), img.look(.22, .16 if silver else .4, .82 if silver else .56, .9), 1.0, .25)
    return fol.leaves_from_atlas(atlas, rects)


def olive_tree(piece, spec):
    """Olivo adulto: tronco grueso y retorcido de dos pies, ramas abiertas y copa ancha e irregular plateada."""
    w, d, h = _dims(spec)
    rng, nrng = _rng(spec)
    leaves = _olive_leaves(piece)
    atlas, cells, sun, inner = _species_atlas(piece, leaves, nrng, lambda rgb: rgb, count=9, leaf=.2, spread=38, pairs=True,
                                              sides=2, twig=(.42, .40, .34), width=1.8)
    tree = Tree(piece, rng)
    crown_z, rz, rxy = h * .7, h * .27, min(w, d) / 2 * .92
    center = Vector((0, 0, crown_z))
    tops = []
    for k, (lean, height) in enumerate(((.0, h * .4), (2.4, h * .34))):
        top = Vector((math.cos(lean) * .28, math.sin(lean) * .22, height))
        foot = Vector((math.cos(lean) * .06, math.sin(lean) * .05, 0))
        path = pg.resample(pg.hermite(foot, UP + Vector((math.cos(lean), math.sin(lean), 0)) * .4, top,
                                      UP + Vector((math.cos(lean) * .6, math.sin(lean) * .6, 0)), 12), 12)
        radii = [.2, .16, .14] + [.13 - .045 * j / 9 for j in range(10)]
        pg.tube(tree.bark, path, radii, 14, tile=tree.tile, jitter=.28, seed=7 + k)
        tops.append(top)
    limbs = []
    for k in range(6):
        az = k * math.pi / 3 + rng.uniform(-.3, .3)
        start = tops[k % 2]
        end = center + _dir(az, math.radians(rng.uniform(-5, 30))) * rxy * rng.uniform(.6, .8)
        limbs.append(tree.branch(start, (end - start).normalized() + UP * .5, end, .085, .03, 10, 8, jitter=.18))
    seconds = []
    for limb in limbs:
        seconds += tree.fork(limb, 3, rxy * .45, .028, spread=50, rise=30)
    for second in seconds:
        tree.fork(second, 2, rxy * .28, .012, spread=45, rise=25, lo=.45, segments=5, steps=4)
    leaves_buf = pg.MeshBuf()
    fol.spray_cards(leaves_buf, atlas, cells, inner, nrng, tree.tips, center, (rxy, rxy, rz), 11, .44, spread=.38,
                    top_cells=sun, lift=.35)
    _finish(piece, {leaves_buf: 'hojas', tree.bark: 'corteza'}, w, d, h, atlas, roughness=.55, specular=.3)


# ---------------------------------------------------------------- naranjo

def _sphere_buf(buf, center, radius, segments=10, rings=6):
    """Esfera con UV de latitud y longitud (frutos)."""
    rows, uvs = [], []
    for i in range(rings + 1):
        phi = math.pi * i / rings
        row, row_uv = [], []
        for j in range(segments + 1):
            th = 2 * math.pi * j / segments
            row.append(Vector(center) + Vector((math.sin(phi) * math.cos(th), math.sin(phi) * math.sin(th), -math.cos(phi))) * radius)
            row_uv.append((j / segments, i / rings))
        rows.append(row)
        uvs.append(row_uv)
    buf.grid(rows, uvs)


def orange_tree(piece, spec):
    """Naranjo: tronco corto, copa densa y redonda que baja casi al suelo, hojas brillantes y naranjas maduras."""
    w, d, h = _dims(spec)
    rng, nrng = _rng(spec)
    leaves = fol.leaves_of(piece.finishes['hojas'])
    hue = img.look(.26, .9, .5, .5)
    atlas, cells, sun, inner = _species_atlas(piece, leaves, nrng, lambda rgb: hue(rgb, 0, 0), count=9, leaf=.27, spread=50,
                                              sides=2, twig=(.30, .32, .2))
    tree = Tree(piece, rng)
    crown_z, rz, rxy = h * .6, h * .39, min(w, d) / 2 * .92
    center = Vector((0, 0, crown_z))
    top = Vector((.02, .01, h * .26))
    trunk = pg.resample(pg.hermite(Vector((0, 0, 0)), UP, top, UP, 8), 8)
    pg.tube(tree.bark, trunk, [.1, .085, .08, .078, .076, .074, .072, .07, .068], 12, tile=tree.tile, jitter=.1, seed=5)
    limbs = []
    for k in range(4):
        az = k * math.pi / 2 + rng.uniform(-.3, .3)
        end = center + _dir(az, math.radians(rng.uniform(10, 50))) * rxy * .6
        limbs.append(tree.branch(top, UP, end, .055, .025, 9, 7))
    limbs.append(tree.branch(top, UP, center + Vector((0, 0, rz * .6)), .05, .02, 9, 7))
    seconds = []
    for limb in limbs:
        seconds += tree.fork(limb, 3, rxy * .5, .022, spread=50, rise=25)
    for second in seconds:
        tree.fork(second, 2, rxy * .3, .01, spread=45, rise=20, lo=.45, segments=5, steps=4)
    leaves_buf, fruit = pg.MeshBuf(), pg.MeshBuf()
    fol.spray_cards(leaves_buf, atlas, cells, inner, nrng, tree.tips, center, (rxy, rxy, rz), 19, .46, spread=.42,
                    top_cells=sun)
    for _ in range(38):
        tip = tree.tips[int(nrng.integers(0, len(tree.tips)))]
        p = tip + Vector((0, 0, -.045))
        tree.branch(tip, -UP, p, .002, .001, segments=4, steps=2, jitter=0, tip=False)
        _sphere_buf(fruit, p, float(nrng.uniform(.034, .042)))
    _finish(piece, {leaves_buf: 'hojas', tree.bark: 'corteza', fruit: 'fruto'}, w, d, h, atlas, roughness=.38, specular=.5)


# ---------------------------------------------------------------- arbusto

def shrub(piece, spec):
    """Arbusto redondeado de hoja perenne: varios tallos desde el suelo y follaje que llega casi a tierra."""
    w, d, h = _dims(spec)
    rng, nrng = _rng(spec)
    leaves = fol.leaves_of(piece.finishes['hojas'])
    hue = img.look(.24, .75, .62, .5)
    atlas, cells, sun, inner = _species_atlas(piece, leaves, nrng, lambda rgb: hue(rgb, 0, 0), count=8, leaf=.3, spread=50,
                                              sides=2, twig=(.3, .27, .18))
    tree = Tree(piece, rng)
    center = Vector((0, 0, h * .5))
    radii = (w / 2 * .9, d / 2 * .9, h * .48)
    for k in range(7):
        az = k * 2 * math.pi / 7 + rng.uniform(-.3, .3)
        foot = Vector((math.cos(az) * .04, math.sin(az) * .04, 0))
        end = center + Vector((math.cos(az) * radii[0] * .55, math.sin(az) * radii[1] * .55, radii[2] * rng.uniform(-.1, .5)))
        stem = tree.branch(foot, UP + (end - foot).normalized() * .5, end, .016, .007, 6, 6)
        tree.fork(stem, 3, min(radii) * .45, .007, spread=45, rise=25, lo=.35, segments=4, steps=3)
    leaves_buf = pg.MeshBuf()
    fol.spray_cards(leaves_buf, atlas, cells, inner, nrng, tree.tips, center, radii, 13, .34, spread=.26, top_cells=sun)
    _finish(piece, {leaves_buf: 'hojas', tree.bark: 'corteza'}, w, d, h, atlas, roughness=.55)


# ---------------------------------------------------------------- seto y bolas de boj

def boxwood_materials(piece, nrng, sprigs=8, hue_value=.25):
    """Atlas de ramitas de boj (tarjetas con alfa) y textura continua opaca del interior del seto."""
    leaves = fol.leaves_of(piece.finishes['hojas'])
    hue = img.look(hue_value, .8, .62, .45)
    tone = lambda rgb: hue(rgb, 0, 0)  # noqa: E731
    atlas = img.Atlas(1024, 512)
    cells = [(c * 256, r * 256, 256, 256) for r in range(2) for c in range(4)][:sprigs]
    for rect in cells:
        fol.cluster(atlas, rect, leaves, nrng, count=int(nrng.integers(6, 9)), leaf=.78, spread=50, hue=tone)
    base = img.Atlas(512, 512)
    fol.fill(base, (0, 0, 512, 512), leaves, nrng, density=150, leaf=.3, base_rgb=(.03, .05, .02), gain=(.45, .9), hue=tone)
    return atlas, cells, base


def _box_samples(nrng, w, d, h, count, ends=True):
    """Puntos y normales al azar sobre las caras visibles de una caja centrada en X/Y y apoyada en Z = 0."""
    faces = [((0, 0, 1), w * d), ((0, -1, 0), w * h), ((0, 1, 0), w * h)]
    if ends:
        faces += [((-1, 0, 0), d * h * .6), ((1, 0, 0), d * h * .6)]
    total = sum(area for _n, area in faces)
    out = []
    for normal, area in faces:
        for _ in range(int(count * area / total)):
            u, v = nrng.uniform(-.5, .5), nrng.uniform(0, 1)
            if normal[2]:
                p = Vector((u * w, nrng.uniform(-.5, .5) * d, h))
            elif normal[1]:
                p = Vector((u * w, normal[1] * d / 2, v * h))
            else:
                p = Vector((normal[0] * w / 2, u * d, v * h))
            out.append((p + Vector(normal) * float(nrng.uniform(-.015, .02)), normal))
    return out


def hedge(piece, spec):
    """Seto recortado de boj: bloque de aristas redondeadas con textura de hojas y ramitas que asoman por fuera.

    Las testas (caras de los extremos) son rectas y miden exactamente el ancho del módulo: en el editor el seto se
    alarga repitiendo módulos sin costuras.
    """
    w, d, h = _dims(spec)
    rng, nrng = _rng(spec)
    atlas, cells, base = boxwood_materials(piece, nrng, hue_value=spec.get('params', {}).get('hue', .25))
    inset = .05

    def bumpy(p, normal):
        # Las testas no se deforman: al repetirse el módulo, sus caras coinciden con las del vecino.
        return p if abs(normal.x) > .5 else p + normal * .018 * mnoise.noise(p * 6.0)
    bm = geo.soft_box(w, d - 2 * inset, h - inset, (.003, .09, .09), deform=bumpy, density=.08)
    solid = fol.opaque_buf(bm, .45)
    cards = pg.MeshBuf()
    card_count = spec.get('params', {}).get('foliageCards', 2000)
    fol.surface_cards(cards, atlas, cells, nrng, _box_samples(nrng, max(.05, w - .14), d - 2 * inset, h - inset, card_count, ends=False), min(.17, h * .4))
    fol.fit([solid, cards], w, d, h, keep_x=True)
    cards.verts = [(max(-w / 2, min(w / 2, x)), y, z) for x, y, z in cards.verts]
    solid.to_object(piece, 'hojas-base', base.material(f'{piece.name}-boj', roughness=.7, normal_strength=.8, specular=.3,
                                                      cutout=False))
    cards.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.6, normal_strength=.9, specular=.3))


# ---------------------------------------------------------------- formio

def phormium(piece, spec):
    """Formio (Phormium tenax): mata de hojas largas en espada, erguidas y arqueadas hacia fuera, verde y bronce."""
    w, d, h = _dims(spec)
    rng, nrng = _rng(spec)
    source, atlas = img.Source(piece.finishes['hojas']), img.Atlas(512, 1024)
    cells = [(k * 64, 0, 64, 1000) for k in range(8)]
    for k, rect in enumerate(cells):
        tone = img.look(.07, .45, .5, .7) if k >= 6 else img.look(.21, .6, .6, .8)
        atlas.shaped(rect, source, hojas.specimen('oscura', k), hojas.lanceolate(120 + k, aspect=.055, widest=.45, power=.55),
                     tone, 1.1, .35)
    buf = pg.MeshBuf()
    count = 34
    for i in range(count):
        frac = i / (count - 1)
        az = i * math.radians(137.5) + rng.uniform(-.2, .2)
        foot = Vector((math.cos(az) * .05 * rng.random(), math.sin(az) * .05 * rng.random(), 0))
        length = h * rng.uniform(.82, 1.05) * (1 - .35 * frac)
        pitch = math.radians(rng.uniform(62, 86) - 18 * frac)
        pg.leaf(buf, atlas, cells[i % 8], foot, az, pitch, length, length * .055, droop=rng.uniform(.4, 1.1) * (.5 + frac),
                roll=rng.uniform(-.4, .4), fold=.3, twist=rng.uniform(-.3, .3), nu=2, nv=9)
    fol.fit([buf], w, d, h)
    buf.to_object(piece, 'hojas', atlas.material(f'{piece.name}-hojas', roughness=.5, normal_strength=.8, specular=.35))


BUILDERS = {'shade_tree': shade_tree, 'olive_tree': olive_tree, 'orange_tree': orange_tree, 'shrub': shrub,
            'hedge': hedge, 'phormium': phormium}
