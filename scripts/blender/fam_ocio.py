"""Exterior y parque en metros: soportes, tejidos, pavimentos y piscinas de borde bajo."""
import math
import hk_geo as g
from fam_equipamiento import umbrella, awning, grill
from fam_ocio_instalaciones import BUILDERS as INSTALLATIONS


def dims(spec): return [v / 1000 for v in spec['dims']]


def rug(piece, spec):
    w, d, h = dims(spec)
    if spec['params'].get('round'):
        piece.add(g.lathe([(w / 2, 0), (w / 2, h)], 64), 'tela')
        for k in range(1, 14):
            r = w / 2 * k / 14
            piece.add(g.tube([(r * math.cos(a * math.tau / 64), r * math.sin(a * math.tau / 64), h)
                              for a in range(64)], .0015, 6, closed=True), 'madera')
    else:
        piece.add(g.box(w, d, h, .008, 3), 'tela')
        for k in range(1, 30):
            piece.add(g.box(w - .03, .003, .001, at=(0, -d / 2 + k * d / 30, h)), 'madera')


def hammock(piece, spec):
    w, d, h = dims(spec); slot = 'metal' if spec['params'].get('metal') else 'madera'
    for sx in (-1, 1):
        piece.add(g.tube([(sx * w * .22, -d * .42, h), (sx * w * .22, -d * .3, .25),
                          (sx * w * .22, 0, .1), (sx * w * .22, d * .3, .25), (sx * w * .22, d * .42, h)], .045, 12), slot)
    for sy in (-1, 1):
        piece.add(g.box(w, .1, .07, .02, 3, at=(0, sy * d * .27, 0)), slot)
        for sx in (-1, 1):
            piece.add(g.tube([(0, sy * d * .42, h), (sx * w * .4, sy * d * .32, h * .72)], .006), 'tela')
    piece.add(g.surface(24,40,lambda u,v: ((u-.5)*w*.8, (v-.5)*d*.65,
              h * (.4 + .32 * (2*v-1)**2) + .09*(2*u-1)**2)), 'tela')


def pool(piece, spec):
    w, d, h = dims(spec); p = spec['params']; round_pool = p.get('round'); rim = .18
    # Solo el coronamiento y el agua son visibles en las enterradas: no hay pared exterior elevada.
    if round_pool:
        r = w / 2
        piece.add(g.lathe([(r, 0), (r, h), (r-rim, h), (r-rim, .012)], 64), 'blanco')
        piece.add(g.lathe([(r-rim, .01), (r-rim, h * .55)], 64), 'agua', sharp=0)
        for k in range(24):
            a=k*math.tau/24
            piece.add(g.tube([((r-rim)*math.cos(a),(r-rim)*math.sin(a),h+.001),
                              (r*math.cos(a),r*math.sin(a),h+.001)], .002, 6), 'piedra')
    else:
        for y in (-d/2+rim/2,d/2-rim/2):
            piece.add(g.box(w,rim,h,.02,3,at=(0,y,0)), 'piedra')
        for x in (-w/2+rim/2,w/2-rim/2):
            piece.add(g.box(rim,d-2*rim,h,.02,3,at=(x,0,0)), 'piedra')
        piece.add(g.box(w-2*rim,d-2*rim,h*.55,.008,3), 'agua')
    if not p.get('buried'):
        for x in (-.24,.24):
            piece.add(g.tube([(x,-d/2+.3,.05),(x,-d/2+.3,h+.15),(x,-d/2-.25,h+.15),(x,-d/2-.25,.02)], .022, 12), 'inox')
        for z in (.2,.45,.7,.95):
            if z<h: piece.add(g.box(.48,.1,.035,.006,2,at=(0,-d/2-.25,z)), 'inox')


def street(piece, spec):
    w,d,h=dims(spec)
    piece.add(g.box(w,d,h*.35), 'asfalto')
    for x in (-w/2+.4,w/2-.4):
        piece.add(g.box(.8,d,h,at=(x,0,0)), 'piedra')
    for y in (-d*.35,0,d*.35):
        piece.add(g.box(.045,d*.18,.003,at=(0,y,h*.35+.001)), 'blanco')


def sidewalk(piece,spec):
    w,d,h=dims(spec)
    piece.add(g.box(w,d,h,.006,2), 'piedra')
    for i in range(1,int(d/.5)):
        piece.add(g.box(w,.004,.002,at=(0,-d/2+i*.5,h)), 'metal')


def swing(piece,spec):
    w,d,h=dims(spec); seats=spec['params']['seats']
    for sx in (-1,1):
        x=sx*(w/2-.12)
        for sy in (-1,1):
            piece.add(g.tube([(x,sy*d/2,0),(x,0,h)], .06, 16), 'madera')
    piece.add(g.tube([(-w/2,0,h),(w/2,0,h)], .07, 16), 'madera')
    for i in range(seats):
        x=(i-(seats-1)/2)*.95
        piece.add(g.box(.48,.27,.04,.015,3,at=(x,0,.48)), 'goma')
        for sx in (-1,1):
            for sy in (-1,1):
                piece.add(g.tube([(x+sx*.21,sy*.11,.52),(x+sx*.25,0,h-.04)], .009), 'inox')


def slide(piece,spec):
    w,d,h=dims(spec); top=h*.8
    for x in (-w*.35,w*.35):
        piece.add(g.tube([(x,d*.35,0),(x,d*.22,top),(x,d*.22,h)], .035), 'metal')
        piece.add(g.tube([(x,d*.22,h),(x,d*.05,h)], .025), 'metal')
    piece.add(g.box(w*.72,.5,.055,.01,3,at=(0,d*.15,top)), 'pintura')
    for k in range(1,7):
        piece.add(g.box(w*.65,.12,.04,.007,3,at=(0,d*.35-k*.035,k*top/7)), 'madera')
    path=[(d*.05-d*.5*t,top*(1-t)**1.4+.08*t) for t in [k/24 for k in range(25)]]
    piece.add(g.surface(16,24,lambda u,v: ((u-.5)*w*.7,d*.05-d*.5*v,top*(1-v)**1.4+.08*v)), 'rojo')
    for sx in (-1,1):
        piece.add(g.tube([(sx*w*.35,y,z+.1) for y,z in path], .035), 'rojo')


BUILDERS = {**INSTALLATIONS, 'rug':rug,'hammock':hammock,'pool':pool,'street':street,'sidewalk':sidewalk,
            'swing':swing,'slide':slide,'umbrella':umbrella,'awning':awning,'grill':grill}
