"""Ruedas con neumáticos, llantas y radios; cuadros, motor, sillín y manillar. Frente -Y."""
import math
import bmesh
import hk_geo as g


def wheel(piece, y, r, width, spokes=16):
    # Revolución radial, después orientada para que el eje de rueda sea X.
    profile = [(r - width * .6, -width / 2), (r - .005, -width * .35),
               (r, 0), (r - .005, width * .35), (r - width * .6, width / 2),
               (r - width, width * .35), (r - width, -width * .35),
               (r - width * .6, -width / 2)]
    tire = g.lathe(profile, 48)
    # La primitiva de revolución tapa extremos por defecto; un neumático necesita el centro abierto.
    bmesh.ops.delete(tire, geom=[v for v in tire.verts if v.co.x**2 + v.co.y**2 < 1e-10], context='VERTS')
    piece.add(g.transform(tire, rot=(0, math.pi / 2, 0), loc=(0, y, r)), 'goma', sharp=0)
    for sx in (-1, 1):
        ring = [(sx * width * .32, y + (r - width) * math.cos(k * math.pi / 24),
                 r + (r - width) * math.sin(k * math.pi / 24)) for k in range(48)]
        piece.add(g.tube(ring, .008, 8, closed=True), 'inox')
        for k in range(spokes):
            a = k * math.tau / spokes
            piece.add(g.tube([(sx * width * .25, y, r),
                              (sx * width * .32, y + (r - width) * math.cos(a), r + (r - width) * math.sin(a))], .003), 'inox')
    piece.add(g.transform(g.lathe([(.025, -width / 2), (.025, width / 2)], 20),
                          rot=(0, math.pi / 2, 0), loc=(0, y, r)), 'metal')


def handlebar(piece, w, y, z):
    piece.add(g.tube([(0, y + .04, z - .12), (0, y, z), (-w / 2, y + .04, z)], .014), 'metal')
    piece.add(g.tube([(0, y, z), (w / 2, y + .04, z)], .014), 'metal')
    for sx in (-1, 1):
        piece.add(g.tube([(sx * w * .35, y + .04, z), (sx * w / 2, y + .04, z)], .022), 'goma')


def bicycle(piece, spec):
    w, d, h = [v / 1000 for v in spec['dims']]; r = .335
    front = -d / 2 + r; rear = d / 2 - r
    wheel(piece, front, r, .035); wheel(piece, rear, r, .035)
    a = (0, rear, r); b = (0, .12, .31); c = (0, .12, h * .79)
    e = (0, front + .18, h * .78); f = (0, front, r)
    for path in ([a, b, c, a], [b, e, c], [e, f]): piece.add(g.tube(path, .021, 12), 'pintura')
    for sx in (-1, 1):
        piece.add(g.tube([(sx * .055, rear, r), (sx * .06, .12, .31)], .012), 'metal')
    piece.add(g.box(.18, .28, .045, .025, 4, at=(0, .16, h * .79)), 'goma')
    piece.add(g.tube([(0, .12, h * .79), (0, .12, h * .64)], .015), 'metal')
    handlebar(piece, w, front + .18, h)
    piece.add(g.transform(g.lathe([(.08, -.015), (.08, .015)], 24),
                          rot=(0, math.pi / 2, 0), loc=(.06, .12, .31)), 'metal')
    for sx in (-1, 1):
        piece.add(g.tube([(sx * .07, .12, .31), (sx * .1, .12, .31 + sx * .12)], .009), 'inox')
        piece.add(g.box(.08, .1, .025, .004, 2, at=(sx * .13, .12, .31 + sx * .12)), 'goma')
    piece.add(g.tube([(.09, rear, r), (.09, .12, .24), (.09, .12, .37), (.09, rear, r)], .003), 'metal')
    if spec['params'].get('basket'):
        xw = .3; y = front; z = h * .75
        for i in range(7):
            x = -xw / 2 + i * xw / 6
            piece.add(g.tube([(x, y - .11, z + .16), (x, y - .11, z), (x, y + .11, z), (x, y + .11, z + .16)], .003), 'metal')
        for height in (z, z + .08, z + .16):
            piece.add(g.tube([(-.15, y - .11, height), (.15, y - .11, height),
                              (.15, y + .11, height), (-.15, y + .11, height)], .004, closed=True), 'metal')


def motorcycle(piece, spec):
    w, d, h = [v / 1000 for v in spec['dims']]; p = spec['params']; r = .3 if not p.get('scooter') else .23
    front = -d / 2 + r; rear = d / 2 - r
    wheel(piece, front, r, .105, 10); wheel(piece, rear, r, .14, 10)
    piece.add(g.box(.33, .42, .3, .035, 4, at=(0, .05, .27)), 'metal')
    for z in (.31, .35, .39, .43, .47):
        piece.add(g.box(.36, .4, .012, .005, 2, at=(0, .05, z)), 'inox')
    piece.add(g.tube([(0, rear, r), (0, .08, .36), (0, front + .16, h * .7), (0, .2, h * .63), (0, rear, r)], .032), 'metal')
    for sx in (-1, 1):
        piece.add(g.tube([(sx * .09, front, r), (sx * .09, front + .16, h * .78)], .028), 'inox')
        piece.add(g.tube([(sx * .1, rear, r), (sx * .14, .35, h * .61)], .018), 'metal')
    piece.add(g.box(.38, d * .27, .09, .035, 5, at=(0, d * .17, h * .59)), 'goma')
    if p.get('scooter'):
        piece.add(g.box(w * .65, .18, h * .57, .06, 5, at=(0, front + .24, .27)), 'pintura')
        piece.add(g.box(w * .6, d * .35, .08, .025, 4, at=(0, .04, .24)), 'pintura')
    else:
        piece.add(g.box(.4, .42, .24, .085, 6, at=(0, -.15, h * .57)), 'pintura')
    handlebar(piece, w, front + .17, h * .87)
    piece.add(g.transform(g.lathe([(.075, 0), (.075, .045)], 32),
                          rot=(math.pi / 2, 0, 0), loc=(0, front + .04, h * .8)), 'faro')
    for sx in (-1, 1):
        piece.add(g.tube([(sx * w * .35, front + .17, h * .87), (sx * w * .39, front + .12, h)], .007), 'inox')
        piece.add(g.box(.08, .025, .06, .015, 4, at=(sx * w * .39, front + .12, h)), 'espejo')
    piece.add(g.tube([(.21, .1, .3), (.23, rear, .38)], .045), 'inox')
    piece.add(g.box(.14, .025, .04, .007, 3, at=(0, rear + .02, h * .58)), 'piloto')


BUILDERS = {'bicycle': bicycle, 'motorcycle': motorcycle}
