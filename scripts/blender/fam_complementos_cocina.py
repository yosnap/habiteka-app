"""Pequeños electrodomésticos sin marcas. Apoyados en Z=0 para colocarlos sobre encimeras existentes."""
import math
import hk_geo as g


def dims(spec):
    return [v / 1000 for v in spec['dims']]


def controls(piece, w, y, z, offset=0):
    for x in (-w * .2, w * .2):
        piece.add(g.transform(g.lathe([(.012, 0), (.012, .012)], 20),
                              rot=(math.pi / 2, 0, 0), loc=(x + offset, y, z)), 'metal')


def blender(piece, spec):
    w, d, h = dims(spec)
    r = w * .39
    piece.add(g.box(w, d, h * .35, .035, 4), 'carcasa')
    piece.add(g.lathe([(r * .7, 0), (r * .75, .03), (r, h * .48), (r * .98, h * .53)], 32,
                      at=(0, 0, h * .35)), 'vidrio', sharp=0)
    piece.add(g.lathe([(r * 1.03, 0), (r * 1.03, .018)], 32, at=(0, 0, h * .88)), 'negro')
    piece.add(g.lathe([(.022, 0), (.018, h * .07)], 24, at=(0, 0, h * .9)), 'negro')
    piece.add(g.tube([(r, 0, h * .8), (r + .022, 0, h * .77),
                      (r + .022, 0, h * .48), (r * .85, 0, h * .43)], .009), 'negro')
    for z in (.48, .6, .72):
        piece.add(g.box(.025, .002, .003, at=(0, -r * .92, h * z)), 'metal')
    controls(piece, w, -d / 2 - .003, h * .18)


def juicer(piece, spec):
    w, d, h = dims(spec)
    piece.add(g.box(w * .85, d * .8, h * .62, .03, 4), 'carcasa')
    piece.add(g.lathe([(w * .36, 0), (w * .36, .045), (w * .29, h * .17)], 32,
                      at=(0, 0, h * .62)), 'vidrio', sharp=0)
    piece.add(g.lathe([(w * .15, 0), (w * .15, h * .16)], 28, at=(0, 0, h * .79)), 'negro')
    piece.add(g.tube([(0, -d * .4, h * .55), (0, -d * .53, h * .55),
                      (0, -d * .55, h * .47)], .022), 'metal')
    controls(piece, w, -d * .41, h * .23)


def processor(piece, spec):
    w, d, h = dims(spec)
    piece.add(g.box(w, d, h * .34, .04, 5), 'carcasa')
    piece.add(g.lathe([(w * .23, 0), (w * .29, h * .4), (w * .27, h * .44)], 40,
                      at=(0, d * .09, h * .34)), 'metal', sharp=0)
    piece.add(g.lathe([(w * .3, 0), (w * .3, .018)], 40,
                      at=(0, d * .09, h * .78)), 'negro')
    piece.add(g.lathe([(.025, 0), (.025, h * .16)], 24, at=(0, d * .09, h * .8)), 'vidrio')
    piece.add(g.tube([(w * .27, 0, h * .7), (w * .4, 0, h * .7),
                      (w * .4, 0, h * .42), (w * .25, 0, h * .42)], .016), 'negro')
    piece.add(g.box(w * .36, .007, h * .17, .008, 3, at=(-w * .15, -d / 2, h * .08)), 'negro')
    controls(piece, w * .3, -d / 2, h * .19)


def mixer(piece, spec):
    w, d, h = dims(spec)
    piece.add(g.box(w, d, .035, .02, 3), 'carcasa')
    piece.add(g.box(w * .6, d * .28, h * .74, .028, 4, at=(0, d * .32, .035)), 'carcasa')
    piece.add(g.box(w * .72, d * .8, h * .2, .027, 4, at=(0, d * .04, h * .77)), 'carcasa')
    piece.add(g.lathe([(w * .22, 0), (w * .44, h * .36), (w * .42, h * .4),
                      (w * .38, h * .39), (w * .19, .03)], 40, at=(0, -d * .19, .04)), 'metal', sharp=0)
    piece.add(g.tube([(0, -d * .18, h * .76), (0, -d * .18, h * .33)], .008), 'metal')
    for k in range(6):
        a = k * math.pi / 3
        piece.add(g.tube([(0, -d * .18, h * .69), (.055 * math.cos(a), -d * .18 + .055 * math.sin(a), h * .4),
                          (0, -d * .18, h * .33)], .003), 'metal')


def microwave(piece, spec):
    w, d, h = dims(spec)
    piece.add(g.box(w, d, h, .015, 4), 'carcasa')
    piece.add(g.box(w * .72, .014, h * .75, .009, 3, at=(-w * .08, -d / 2 - .014, h * .12)), 'negro')
    piece.add(g.box(w * .58, .004, h * .53, .007, 3, at=(-w * .1, -d / 2 - .018, h * .23)), 'vidrio')
    piece.add(g.box(.014, .025, h * .56, .006, 3, at=(w * .22, -d / 2 - .04, h * .22)), 'metal')
    controls(piece, w * .2, -d / 2 - .016, h * .35, w * .37)
    piece.add(g.box(w * .14, .008, .023, .003, 2, at=(w * .37, -d / 2 - .018, h * .71)), 'negro')


BUILDERS = {'blender': blender, 'juicer': juicer, 'processor': processor, 'mixer': mixer, 'microwave': microwave}
