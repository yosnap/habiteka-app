"""Familia de comedor: mesas rectangulares, redondas y extensibles, sillas y bancos (metros; frente hacia -Y).

Huecos de material: «sobre» (tablero), «estructura» (patas, faldón, bastidor), «madera», «tapiceria», «asiento».
"""
import math

import hk_geo as geo
import hk_parts as parts


def _dims(spec):
    return tuple(value / 1000 for value in spec['dims'])


def _top_rect(piece, w, d, z, th, slot='sobre', seams=()):
    """Tablero con canto suavizado; seams = posiciones X de juntas (mesas extensibles)."""
    if not seams:
        piece.add(geo.box(w, d, th, .004 if th > .015 else .002, 3, at=(0, 0, z)), slot, 'x')
        return
    edges = [-w / 2, *seams, w / 2]
    for a, b in zip(edges, edges[1:]):
        piece.add(geo.box(b - a - .003, d, th, .004, 3, at=((a + b) / 2, 0, z)), slot, 'x')


def _apron(piece, w, d, z_top, slot, inset=.07, h=.08, t=.022):
    for sy in (-1, 1):
        piece.add(geo.box(w - 2 * inset, t, h, .002, 1, at=(0, sy * (d / 2 - inset), z_top - h)), slot, 'x')
    for sx in (-1, 1):
        piece.add(geo.box(t, d - 2 * inset, h, .002, 1, at=(sx * (w / 2 - inset), 0, z_top - h)), slot, 'y')


def table(piece, spec):
    """Mesa rectangular: base de cuatro patas, patas cónicas nórdicas, trineo metálico, caballete o patas de acero."""
    w, d, h = _dims(spec)
    params = spec['params']
    th = params.get('top_th', 35) / 1000
    leg_top = h - th
    base = params['base']
    seams = [x / 1000 for x in params.get('seams', [])]
    _top_rect(piece, w, d, leg_top, th, seams=seams)
    if base in ('patas', 'conicas'):
        _apron(piece, w, d, leg_top, 'estructura')
        kind = 'recta' if base == 'patas' else 'conica'
        parts.four_legs(piece, 'estructura', kind, w, d, leg_top, inset=.07 if base == 'patas' else .11,
                        size=1.4 if base == 'patas' else 1.6)
    elif base == 'trineo':
        for sx in (-1, 1):
            x = sx * (w / 2 - .14)
            loop = geo.fillet([(x, -d / 2 + .1, .01), (x, d / 2 - .1, .01), (x, d / 2 - .1, leg_top - .01),
                               (x, -d / 2 + .1, leg_top - .01)], .025, 4, closed=True)
            piece.add(geo.sweep(loop, geo.rounded_rect(.05, .022, .004, 2), closed=True), 'estructura', 'z')
        piece.add(geo.box(w - .3, .04, .03, .003, 1, at=(0, 0, leg_top - .03)), 'estructura', 'x')
    elif base == 'caballete':
        for sx in (-1, 1):
            x = sx * (w / 2 - .28)
            piece.add(geo.box(.07, d - .3, leg_top - .1, .006, 2, at=(x, 0, .05)), 'estructura', 'z')
            piece.add(geo.box(.09, d - .16, .05, .008, 2, at=(x, 0, 0)), 'estructura', 'y')
            piece.add(geo.box(.09, d - .2, .05, .008, 2, at=(x, 0, leg_top - .05)), 'estructura', 'y')
        piece.add(geo.box(w - .56, .05, .07, .005, 2, at=(0, 0, .28)), 'estructura', 'x')
    elif base == 'acero':
        for sx in (-1, 1):
            for sy in (-1, 1):
                piece.add(geo.lathe([(.02, 0), (.02, leg_top)], 20, at=(sx * (w / 2 - .1), sy * (d / 2 - .1), 0)),
                          'estructura', 'z')
            piece.add(geo.box(.025, d - .2, .025, .004, 2, at=(sx * (w / 2 - .1), 0, leg_top - .03)), 'estructura', 'y')
    else:
        raise ValueError(f'Base de mesa desconocida: {base}')


def round_table(piece, spec):
    """Mesa redonda: pie de tulipa, pie central de madera o cuatro patas."""
    w, _d, h = _dims(spec)
    params = spec['params']
    r, th = w / 2, params.get('top_th', 30) / 1000
    z = h - th
    piece.add(geo.lathe([(0, z), (r - .006, z), (r, z + .006), (r, h - .005), (r - .005, h), (0, h)], 64), 'sobre', 'x')
    base = params['base']
    if base == 'tulipa':
        rb = min(.3, r * .55)
        piece.add(geo.lathe([(0, 0), (rb, 0), (rb, .012), (rb * .82, .03), (rb * .45, .09), (.075, .22), (.05, .4),
                             (.048, z - .07), (.09, z - .015), (.11, z)], 48), 'estructura', 'z')
    elif base == 'columna':
        rb = min(.28, r * .5)
        piece.add(geo.lathe([(0, 0), (rb, 0), (rb, .03), (rb - .02, .05), (.06, .07), (.055, z - .04), (.09, z - .02),
                             (.12, z)], 40), 'estructura', 'z')
    elif base == 'patas':
        inset = r * .3
        for k in range(4):
            a = math.pi / 4 + k * math.pi / 2
            piece.add(parts.leg('conica', z, (r - inset) * math.cos(a), (r - inset) * math.sin(a),
                                round(math.cos(a)), round(math.sin(a)), size=1.5), 'estructura', 'z')
        ring = geo.arc(0, 0, z - .05, r - inset, 0, 360, 40)
        piece.add(geo.sweep(ring[:-1], geo.rounded_rect(.06, .022, .003, 2), closed=True), 'estructura', 'x')
    else:
        raise ValueError(f'Base de mesa redonda desconocida: {base}')


def _chair_frame_legs(piece, slot, w, d, seat_z, back_h, kind, back_tilt=8):
    """Patas delanteras y traseras; las traseras siguen rectas hasta el asiento y se inclinan hacia atrás en el
    respaldo. Devuelve post_y(z): la Y del poste trasero a la altura z, para apoyar en él los travesaños."""
    slope = math.tan(math.radians(back_tilt))
    base_y = d / 2 - .03 - (back_h - seat_z) * slope
    profile = geo.rounded_rect(.032, .032, .006, 2) if kind == 'recta' else geo.circle(.016, 12)
    for sx in (-1, 1):
        x = sx * (w / 2 - .03)
        piece.add(parts.leg(kind, seat_z, sx * (w / 2 - .04), -d / 2 + .04, sx, -1, splay=3), slot, 'z')
        path = geo.fillet([(x, base_y, 0), (x, base_y, seat_z), (x, base_y + (back_h - seat_z) * slope, back_h)], .06, 4)
        piece.add(geo.sweep(path, profile), slot, 'z')
    return lambda z: base_y + max(0.0, z - seat_z) * slope


def chair(piece, spec):
    """Sillas: nórdica de madera, tapizada, metálica tipo bistró, Windsor y de cocina con asiento de enea."""
    w, d, h = _dims(spec)
    style = spec['params']['style']
    seat = .46
    if style == 'nordica':
        post_y = _chair_frame_legs(piece, 'madera', w, d, seat - .03, h, 'conica')
        dish = geo.soft_box(w - .01, d - .04, .03, (.04, .04, .012), (0, 0, -.004), at=(0, -.01, seat - .03), density=.03)
        piece.add(dish, 'madera', 'y', 0)
        rail_y = post_y(h - .06)
        back = [(x, rail_y - .045 * (x / (w / 2)) ** 2 + .025, h - .06) for x in [(-w / 2 + .02) + (w - .04) * k / 16 for k in range(17)]]
        piece.add(geo.sweep(back, geo.rounded_rect(.1, .018, .007, 3), up=(0, 0, 1)), 'madera', 'x')
        for sx in (-1, 1):
            piece.add(geo.tube([(sx * (w / 2 - .035), -d / 2 + .04, .17), (sx * (w / 2 - .035), d / 2 - .05, .17)], .009, 10), 'madera', 'y')
        piece.add(geo.tube([(-w / 2 + .035, -d / 2 + .04, .2), (w / 2 - .035, -d / 2 + .04, .2)], .009, 10), 'madera', 'x')
    elif style == 'tapizada':
        _chair_frame_legs(piece, 'patas', w, d, seat - .09, .55, 'conica', 6)
        piece.add(geo.soft_box(w, d - .03, .09, (.04, .04, .035), (.004, .004, .012), wrinkle=.0015,
                               at=(0, -.015, seat - .09), density=.03), 'tapiceria', 'y', 0)
        back = geo.soft_box(w - .02, .07, h - seat - .04, (.035, .03, .04), (.004, .012, .006), wrinkle=.0015, density=.03)
        geo.transform(back, rot=(-math.radians(8), 0, 0))
        piece.add(geo.transform(back, loc=(0, d / 2 - .06, seat + .02)), 'tapiceria', 'x', 0)
    elif style == 'metalica':
        for sx in (-1, 1):
            for sy in (-1, 1):
                leg = geo.lathe([(.018, -seat + .03), (.024, -.004), (.026, 0)], 4)
                geo.transform(leg, rot=(math.radians(5) * sy, -math.radians(5) * sx, math.pi / 4))
                piece.add(geo.transform(leg, loc=(sx * (w / 2 - .06), sy * (d / 2 - .07), seat - .02)), 'estructura', 'z')
        piece.add(geo.box(w - .04, d - .06, .03, .02, 3, at=(0, -.01, seat - .03)), 'estructura', 'y')
        back = geo.arc(0, -.05, h - .1, d * .62, 35, 145, 18)
        piece.add(geo.sweep(back, geo.rounded_rect(.17, .01, .004, 2), up=(0, 0, 1)), 'estructura', 'x')
        for sx in (-1, 1):
            piece.add(geo.tube([(sx * (w / 2 - .07), d / 2 - .12, seat - .01), (sx * (w / 2 - .07), d / 2 - .1, h - .12)], .012, 8), 'estructura', 'z')
    elif style == 'windsor':
        for sx in (-1, 1):
            for sy in (-1, 1):
                leg = geo.lathe([(.014, -seat + .04), (.018, -seat + .12), (.022, -.22), (.016, -.16), (.024, -.1), (.022, 0)], 14)
                geo.transform(leg, rot=(math.radians(10) * sy, -math.radians(10) * sx, 0))
                piece.add(geo.transform(leg, loc=(sx * (w / 2 - .09), sy * (d / 2 - .1), seat - .04)), 'madera', 'z')
        piece.add(geo.soft_box(w, d - .02, .045, (.08, .07, .015), (0, 0, -.006), at=(0, 0, seat - .045), density=.03), 'madera', 'y', 0)
        for sx in (-1, 1):
            piece.add(geo.tube([(sx * (w / 2 - .02), -d / 2 + .06, .2), (sx * (w / 2 - .02), d / 2 - .06, .2)], .011, 10), 'madera', 'y')
        piece.add(geo.tube([(-w / 2 + .02, 0, .2), (w / 2 - .02, 0, .2)], .01, 10), 'madera', 'x')
        crest = geo.arc(0, -.02, h - .04, w * .55, 25, 155, 20)
        piece.add(geo.sweep(crest, geo.rounded_rect(.055, .028, .01, 3), up=(0, 0, 1), round_ends=.014), 'madera', 'x')
        for k in range(7):
            a = math.radians(32 + 116 * k / 6)
            top = (w * .55 * math.cos(a), -.02 + w * .55 * math.sin(a), h - .05)
            base = (top[0] * .72, d / 2 - .07, seat)
            piece.add(geo.tube([base, top], .0075, 8), 'madera', 'z')
    elif style == 'cocina':
        post_y = _chair_frame_legs(piece, 'estructura', w, d, seat - .02, h, 'recta', 5)
        for y in (-d / 2 + .03, post_y(seat)):
            piece.add(geo.box(w - .02, .03, .04, .003, 1, at=(0, y, seat - .04)), 'estructura', 'x')
        for sx in (-1, 1):
            piece.add(geo.box(.03, d - .04, .04, .003, 1, at=(sx * (w / 2 - .03), 0, seat - .04)), 'estructura', 'y')
        piece.add(geo.soft_box(w - .05, d - .05, .03, (.02, .02, .012), (.002, .002, .006), at=(0, 0, seat - .035), density=.025), 'asiento', 'x', 0)
        for k, z in enumerate((h - .07, h - .2, h - .33)):
            slat = geo.box(w - .05, .02, .055 if k else .07, .004, 2)
            geo.transform(slat, rot=(-math.radians(5), 0, 0))
            piece.add(geo.transform(slat, loc=(0, post_y(z), z)), 'estructura', 'x')
        for sx in (-1, 1):
            piece.add(geo.box(.025, d - .06, .025, .003, 1, at=(sx * (w / 2 - .03), 0, .16)), 'estructura', 'y')
    else:
        raise ValueError(f'Silla desconocida: {style}')


def bench(piece, spec):
    """Banco de madera maciza o banco tapizado con patas de metal."""
    w, d, h = _dims(spec)
    if spec['params']['style'] == 'madera':
        piece.add(geo.box(w, d, .04, .005, 3, at=(0, 0, h - .04)), 'madera', 'x')
        for sx in (-1, 1):
            piece.add(geo.box(.04, d - .06, h - .04, .004, 2, at=(sx * (w / 2 - .12), 0, 0)), 'madera', 'z')
        piece.add(geo.box(w - .28, .03, .06, .003, 2, at=(0, 0, .12)), 'madera', 'x')
        return
    piece.add(geo.soft_box(w, d, .1, (.035, .035, .04), (.004, .006, .014), wrinkle=.0015, at=(0, 0, h - .1), density=.035),
              'tapiceria', 'x', 0)
    piece.add(parts.cushion_piping(w, d, .1, (.035, .035, .04), h - .1), 'tapiceria', 'x', 0)
    for sx in (-1, 1):
        loop = geo.fillet([(sx * (w / 2 - .08), -d / 2 + .05, 0), (sx * (w / 2 - .08), -d / 2 + .05, h - .1),
                           (sx * (w / 2 - .08), d / 2 - .05, h - .1), (sx * (w / 2 - .08), d / 2 - .05, 0)], .02, 3)
        piece.add(geo.sweep(loop, geo.rounded_rect(.025, .025, .004, 2)), 'estructura', 'z')


BUILDERS = {'table': table, 'round_table': round_table, 'chair': chair, 'bench': bench}
