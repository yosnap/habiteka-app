"""Familia de taburetes: de barra (asiento a 65 o 75 cm), bajos de cocina, de madera, metálicos, tapizados y
giratorios con y sin respaldo. Metros; frente hacia -Y; el alto de asiento es params.seat_h (mm).

Huecos: «madera», «estructura» (metal), «tapiceria» y «base» (columna y pie de los giratorios).
"""
import math

import hk_geo as geo
import hk_parts as parts


def _seat_h(spec):
    return spec['params']['seat_h'] / 1000


def _footring(z, radius, slot='estructura', tube=.009):
    return geo.tube(geo.arc(0, 0, z, radius, 0, 360, 40)[:-1], tube, 10, closed=True), slot


def _splayed(profile, z_top, x, y, sx, sy, splay, segments=14):
    """Pata de revolución construida hacia abajo desde (x, y, z_top) y abierta `splay` grados."""
    leg = geo.lathe(profile, segments)
    angle = math.radians(splay)
    geo.transform(leg, rot=(angle * sy, -angle * sx, 0 if segments != 4 else math.pi / 4))
    return geo.transform(leg, loc=(x, y, z_top))


def stool_wood(piece, spec):
    """Taburete de madera: asiento redondo ligeramente cóncavo, cuatro patas abiertas y travesaños o aro."""
    w, _d, _h = (v / 1000 for v in spec['dims'])
    seat = _seat_h(spec)
    r = w / 2 - .01
    piece.add(geo.lathe([(0, seat - .006), (r - .015, seat - .002), (r, seat + .006), (r, seat + .02), (r - .012, seat + .03),
                         (r * .6, seat + .028), (0, seat + .022)], 40, at=(0, 0, -.025)), 'madera', 'y')
    leg_len = seat - .025
    inset = r * .55
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        sx, sy = math.cos(a), math.sin(a)
        piece.add(_splayed([(.013, -leg_len / math.cos(math.radians(7))), (.017, -leg_len * .5), (.018, 0)], seat - .025,
                           inset * sx, inset * sy, sx, sy, 7), 'madera', 'z')
    rail = .28 if seat > .55 else .16
    spread = inset + (seat - .025 - rail) * math.tan(math.radians(7))
    for k in range(4):
        a0, a1 = math.pi / 4 + k * math.pi / 2, math.pi / 4 + (k + 1) * math.pi / 2
        piece.add(geo.tube([(spread * math.cos(a0), spread * math.sin(a0), rail), (spread * math.cos(a1), spread * math.sin(a1), rail)],
                           .011, 10), 'madera', 'x')


def stool_metal(piece, spec):
    """Taburete industrial de chapa: asiento con borde vuelto, patas cónicas cuadradas y aro reposapiés."""
    w, _d, _h = (v / 1000 for v in spec['dims'])
    seat = _seat_h(spec)
    r = w / 2 - .01
    piece.add(geo.lathe([(0, seat - .012), (r - .01, seat - .012), (r, seat - .006), (r + .002, seat), (r - .004, seat + .004),
                         (0, seat + .002)], 40), 'estructura', 'x')
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        sx, sy = math.cos(a), math.sin(a)
        piece.add(_splayed([(.015, -(seat - .012) / math.cos(math.radians(8))), (.022, 0)], seat - .012, r * .62 * sx, r * .62 * sy,
                           sx, sy, 8, segments=4), 'estructura', 'z')
    ring_z = .3 if seat > .55 else .15
    spread = r * .62 + (seat - ring_z) * math.tan(math.radians(8))
    bm, slot = _footring(ring_z, spread * .99)
    piece.add(bm, slot, 'x')


def stool_upholstered(piece, spec):
    """Taburete tapizado sobre bastidor de tubo cuadrado, con reposapiés y respaldo bajo opcional."""
    w, d, h = (v / 1000 for v in spec['dims'])
    seat = _seat_h(spec)
    tube = geo.rounded_rect(.022, .022, .004, 2)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (w / 2 - .04), sy * (d / 2 - .04)
            piece.add(geo.sweep([(x, y, 0), (x, y, seat - .07)], tube), 'estructura', 'z')
    ring = .3 if seat > .55 else .14
    frame = [(-w / 2 + .04, -d / 2 + .04, ring), (w / 2 - .04, -d / 2 + .04, ring), (w / 2 - .04, d / 2 - .04, ring),
             (-w / 2 + .04, d / 2 - .04, ring)]
    piece.add(geo.sweep(frame, tube, closed=True), 'estructura', 'x')
    top = [(x, y, seat - .07) for x, y, _ in frame]
    piece.add(geo.sweep(top, tube, closed=True), 'estructura', 'x')
    piece.add(geo.soft_box(w, d, .07, (.05, .05, .03), (.004, .004, .012), wrinkle=.0015, at=(0, 0, seat - .07), density=.025),
              'tapiceria', 'x', 0)
    piece.add(parts.cushion_piping(w, d, .07, (.05, .05, .03), seat - .07, both=False), 'tapiceria', 'x', 0)
    if spec['params'].get('back'):
        for sx in (-1, 1):
            piece.add(geo.sweep([(sx * (w / 2 - .04), d / 2 - .04, seat - .07), (sx * (w / 2 - .045), d / 2 - .02, h - .1)], tube),
                      'estructura', 'z')
        back = geo.soft_box(w - .02, .05, .2, (.03, .02, .04), (.004, .01, .006), wrinkle=.0015, density=.025)
        geo.transform(back, rot=(-math.radians(10), 0, 0))
        piece.add(geo.transform(back, loc=(0, d / 2 - .01, h - .2)), 'tapiceria', 'x', 0)


def stool_swivel(piece, spec):
    """Taburete giratorio de altura de barra: pie redondo, columna cromada, aro reposapiés y asiento tapizado;
    con respaldo envolvente si params.back."""
    w, d, h = (v / 1000 for v in spec['dims'])
    seat = _seat_h(spec)
    piece.add(geo.lathe([(0, 0), (.2, 0), (.205, .006), (.195, .014), (.06, .03), (.035, .05), (0, .05)], 48), 'base', 'x')
    piece.add(geo.lathe([(.026, .04), (.026, seat - .1), (.034, seat - .09), (.05, seat - .07), (.05, seat - .06)], 24), 'base', 'z')
    ring_z = .3 if seat > .55 else .16
    ring = geo.tube(geo.arc(0, 0, ring_z, .17, 0, 360, 40)[:-1], .009, 10, closed=True)
    spokes = [geo.tube([(.026 * math.cos(a), .026 * math.sin(a), ring_z), (.165 * math.cos(a), .165 * math.sin(a), ring_z)], .007, 8)
              for a in (math.pi / 2, math.pi / 2 + 2.09, math.pi / 2 - 2.09)]
    piece.add(geo.merge([ring, *spokes]), 'base', 'x')
    r = min(w, d) / 2 - .01
    piece.add(geo.soft_box(2 * r, 2 * r, .075, (r * .85, r * .85, .03), (0, 0, .012), wrinkle=.0015, at=(0, 0, seat - .065),
                           density=.025), 'tapiceria', 'x', 0)
    if spec['params'].get('back'):
        band = geo.arc(0, -.02, seat + (h - seat) / 2, r + .01, 25, 155, 20)
        piece.add(geo.sweep(band, geo.rounded_rect(h - seat - .02, .05, .02, 3), up=(0, 0, 1), round_ends=.02), 'tapiceria', 'x', 0)


BUILDERS = {'stool_wood': stool_wood, 'stool_metal': stool_metal, 'stool_upholstered': stool_upholstered,
            'stool_swivel': stool_swivel}
