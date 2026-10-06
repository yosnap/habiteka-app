"""Rocas de silueta irregular y setas de cerámica torneada, con acabados de la fábrica."""
import math
import random
from mathutils import noise, Vector
import hk_geo as geo


def stone(piece, w, d, h, at=(0, 0, 0), seed=0):
    bm = geo.sphere(1, segments=24)
    for vertex in bm.verts:
        p = vertex.co
        p *= 1 + .17 * noise.noise_vector(p * 2.3 + Vector((seed, 0, 0))).x
    mins = [min(v.co[k] for v in bm.verts) for k in range(3)]
    spans = [max(v.co[k] for v in bm.verts) - mins[k] for k in range(3)]
    for vertex in bm.verts:
        for k, size in enumerate((w, d, h)):
            vertex.co[k] = (vertex.co[k] - mins[k]) / spans[k] * size + at[k] - (size / 2 if k < 2 else 0)
    piece.add(bm, 'piedra', sharp=30)


def rock(piece, spec):
    stone(piece, *(v / 1000 for v in spec['dims']))


def stones(piece, spec):
    w, d, h = (v / 1000 for v in spec['dims'])
    rng = random.Random(71)
    for i in range(12):
        angle = i * math.pi * 2 / 12
        stone(piece, w * .25, d * .3, h * rng.uniform(.55, 1),
              (math.cos(angle) * w * .36, math.sin(angle) * d * .34, 0), i)


def mushrooms(piece, spec):
    w, d, h = (v / 1000 for v in spec['dims'])
    for x, y, scale in [(-.22, -.18, .7), (.18, .12, 1), (.22, -.26, .45)]:
        radius = w * .26 * scale
        height = h * scale
        piece.add(geo.lathe([(0, 0), (radius * .3, 0), (radius * .2, height * .65), (0, height * .72)], 24,
                            at=(x * w, y * d, 0)), 'pie')
        piece.add(geo.lathe([(0, height * .62), (radius, height * .63), (radius * .95, height * .75),
                            (radius * .6, height * .95), (0, height)], 32, at=(x * w, y * d, 0)), 'sombrero')


BUILDERS = {'rock': rock, 'stones': stones, 'mushrooms': mushrooms}
