"""Coníferas y palmera con ramificación y hojas individuales; semillas estables, metros y Z arriba."""
import math
import random
import bmesh
from mathutils import Vector
import hk_geo as geo


def conifer(piece, spec):
    w, d, h = (v / 1000 for v in spec['dims'])
    rng = random.Random(981)
    narrow = spec['type'] == 'cypress'
    piece.add(geo.lathe([(0, 0), (w * .06, 0), (w * .035, h * .7), (0, h)], 20), 'corteza')
    needles = bmesh.new()
    levels = 17 if narrow else 10
    for level in range(levels):
        f = level / levels
        z = h * ((.07 if narrow else .3) + f * (.89 if narrow else .66))
        reach = w / 2 * (math.sin(math.pi * (.12 + .82 * f)) if narrow else (1 - f) ** .55)
        for branch in range(7):
            az = branch * math.tau / 7 + level * 1.83
            start = Vector((0, 0, z))
            end = Vector((math.cos(az) * reach, math.sin(az) * reach * d / w, z + h * .04))
            piece.add(geo.tube([start, start.lerp(end, .6) - Vector((0, 0, h * .025)), end], max(.003, .016 * (1-f)), 5), 'corteza')
            for k in range(80):
                t = rng.uniform(.25, 1)
                center = start.lerp(end, t)
                spread = w * (.13 if narrow else .09) * (1 - f * .6)
                for side in [-1, 1]:
                    theta = az + side * rng.uniform(.35, 1.8)
                    length = spread * rng.uniform(.8, 1.8)
                    tip = center + Vector((math.cos(theta) * length, math.sin(theta) * length, length * .55))
                    cross = Vector((-math.sin(theta), math.cos(theta), 0)) * length * (.17 if narrow else .1)
                    a, b, c = [needles.verts.new(p) for p in (center-cross, center+cross, tip)]
                    needles.faces.new((a, b, c))
    piece.add(needles, 'hojas', sharp=0)


def palm(piece, spec):
    w, d, h = (v / 1000 for v in spec['dims'])
    profile = [(0, 0), (w * .047, 0)]
    for i in range(45):
        z = h * .68 * i / 45
        profile.extend([(w * (.042 - i * .00025), z), (w * (.047 - i * .00025), z + h * .009)])
    profile.append((0, h * .7))
    piece.add(geo.lathe(profile, 24), 'corteza')
    for i in range(18):
        az = i * 2.39996
        reach = w * (.35 + (i % 3) * .07)
        path = [Vector((math.cos(az)*reach*t, math.sin(az)*reach*t*d/w,
                        h * .69 + h * .3 * math.sin(t * math.pi * .95) - h * .14 * t*t)) for t in [k/16 for k in range(17)]]
        piece.add(geo.tube(path, .012, 6), 'hojas')
        mesh = bmesh.new()
        for k in range(1, 31):
            t = k / 32
            idx = min(15, int(t * 16))
            center = path[idx].lerp(path[idx+1], t*16-idx)
            length = reach * .3 * math.sin(t * math.pi) ** .45
            for side in [-1, 1]:
                direction = Vector((math.cos(az+side*1.1), math.sin(az+side*1.1), -.25))
                tip = center + direction * length
                mid = center.lerp(tip, .45) + Vector((0,0,.04))
                cross = Vector((-direction.y, direction.x, 0)) * .023
                v = [mesh.verts.new(p) for p in (center, mid-cross, tip, mid+cross)]
                mesh.faces.new((v[0],v[1],v[2])); mesh.faces.new((v[0],v[2],v[3]))
        piece.add(mesh, 'hojas', sharp=0)


BUILDERS = {'pine': conifer, 'cypress': conifer, 'palm': palm}
