"""Macetas huecas, jardineras y bancales con vegetación de hojas del generador común."""
import math
from mathutils import Matrix
import hk_geo as geo
import fam_jardin_arboles as trees


def pot(piece, w, d, h):
    profile = [(0, 0), (.32, 0), (.35, .04), (.46, .87), (.5, .89), (.5, 1),
               (.43, 1), (.43, .89), (.32, .12), (0, .12)]
    piece.add(geo.transform(geo.lathe(profile, 48), scale=(w, d, h)), 'maceta')
    piece.add(geo.transform(geo.lathe([(0, 0), (.42, 0), (.42, .02), (0, .02)], 40),
                            scale=(w, d, h), loc=(0, 0, h * .87)), 'tierra')


def foliage(piece, spec, w, d, h, at, builder=trees.hedge):
    start = len(piece.objects)
    builder(piece, {**spec, 'dims': [w * 1000, d * 1000, h * 1000]})
    for obj in piece.objects[start:]:
        obj.matrix_world = Matrix.Translation(at) @ obj.matrix_world


def garden_pot(piece, spec):
    pot(piece, *(v / 1000 for v in spec['dims']))


def timber_bed(piece, w, d, h):
    for z in range(3):
        for side in [-1, 1]:
            piece.add(geo.box(w, .035, h / 3 - .006, .004, at=(0, side * (d / 2 - .018), z * h / 3)), 'madera')
            piece.add(geo.box(.035, d - .07, h / 3 - .006, .004, at=(side * (w / 2 - .018), 0, z * h / 3)), 'madera')
    piece.add(geo.box(w - .075, d - .075, .04, .012, at=(0, 0, h - .07)), 'tierra')


def planter_box(piece, spec):
    w, d, h = (v / 1000 for v in spec['dims'])
    timber_bed(piece, w, d, h * .5)
    foliage(piece, spec, w * .94, d * .95, h * .53, (0, 0, h * .47))


def planter_trough(piece, spec):
    w, d, h = (v / 1000 for v in spec['dims'])
    pot(piece, w, d, h * .45)
    foliage(piece, spec, w * .9, d * .9, h * .62, (0, 0, h * .38), trees.phormium)


def raised_bed(piece, spec):
    w, d, h = (v / 1000 for v in spec['dims'])
    timber_bed(piece, w, d, h * .55)
    # Plantas independientes: hileras legibles y tierra visible entre ellas.
    for x in range(5):
        for y in range(2):
            foliage(piece, {**spec, 'id': f"{spec['id']}-{x}-{y}", 'params': {'foliageCards': 220}}, w / 6, d / 3, h * .48,
                    ((x - 2) * w / 5.5, (y - .5) * d / 2.4, h * .52))


BUILDERS = {'garden_pot': garden_pot, 'planter_box': planter_box,
            'planter_trough': planter_trough, 'raised_bed': raised_bed}
