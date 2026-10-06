"""Familia de exterior: sofás y sillones de ratán sintético, teca y aluminio, chill-out, sillas, tumbonas y mesas.

Metros; frente hacia -Y. Huecos: «trenzado» (ratán), «madera» (teca), «estructura» (aluminio o metal),
«tapiceria» (cojines de exterior), «carcasa» (polipropileno), «cuerda», «patas» y «sobre».
"""
import math

import hk_geo as geo
import hk_parts as parts
import fam_comedor


def _dims(spec):
    return tuple(value / 1000 for value in spec['dims'])


def _seat_cushions(x0, x1, y_front, y_back, z, count, th=.13, seed=0):
    out, width = [], (x1 - x0) / count
    for i in range(count):
        cx, cy, depth = x0 + width * (i + .5), (y_front + y_back) / 2, y_back - y_front
        radius = (.04, .04, th * .4)
        out.append((geo.soft_box(width - .008, depth, th, radius, (.004, .006, .014), wrinkle=.0018, seed=seed + i,
                                 at=(cx, cy, z), density=.04), 'tapiceria', 'y', 0))
        out.append((parts.cushion_piping(width - .008, depth, th, radius, z, (cx, cy)), 'tapiceria', 'x', 0))
    return out


def _back_cushions(x0, x1, y, z, height, count, th=.15, tilt=12, seed=20):
    out, width = [], (x1 - x0) / count
    for i in range(count):
        cushion = geo.soft_box(width - .012, th, height, (.05, .06, .055), (.008, .024, .01), wrinkle=.0025,
                               seed=seed + i, density=.04)
        geo.transform(cushion, rot=(-math.radians(tilt), 0, 0))
        out.append((geo.transform(cushion, loc=(x0 + width * (i + .5), y, z)), 'tapiceria', 'x', 0))
    return out


def rattan_run(length, depth, height, arms=(True, True), seats=None, low=False, back_ext=0.0, inset=0.0):
    """Tramo de sofá de ratán sintético: estructura trenzada y cojines gruesos con vivo (respaldo hacia +Y)."""
    out, aw, bt, foot = [], .11, .12, .03
    base_top = .2 if low else .3
    arm_h, back_h = (.5, .62) if low else (.62, .74)
    out.append((geo.box(length, depth, base_top - foot, .025, 3, at=(0, 0, foot)), 'trenzado', 'x', 0))
    for side, on in ((-1, arms[0]), (1, arms[1])):
        if on:
            out.append((geo.box(aw, depth, arm_h - foot, .03, 3, at=(side * (length / 2 - aw / 2), 0, foot)), 'trenzado', 'y', 0))
    out.append((geo.box(length + back_ext, bt, back_h - foot, .03, 3, at=(back_ext / 2, depth / 2 - bt / 2, foot)), 'trenzado', 'x', 0))
    for sx in (-1, 1):
        for sy in (-1, 1):
            out.append((geo.box(.05, .05, foot, .004, 1, at=(sx * (length / 2 - .06), sy * (depth / 2 - .06), 0)), 'patas', 'z', 35))
    x0, x1 = -length / 2 + (aw if arms[0] else inset), length / 2 - (aw if arms[1] else 0)
    count = seats or max(1, round((x1 - x0) / .62))
    out += _seat_cushions(x0, x1, -depth / 2 - .01, depth / 2 - bt, base_top, count)
    out += _back_cushions(x0, x1, depth / 2 - bt - .07, base_top + .1, height - base_top - .12, count)
    return out


def sofa_rattan(piece, spec):
    w, d, h = _dims(spec)
    parts.emit(piece, rattan_run(w, d, h, seats=spec['params'].get('seats')))


def chillout(piece, spec):
    """Conjunto chill-out: rinconera baja de ratán con cojines y mesa de centro a juego."""
    w, d, h = _dims(spec)
    depth = .8
    parts.emit(piece, parts.place(rattan_run(w, depth, h, arms=(False, True), low=True, inset=.12), (0, d / 2 - depth / 2, 0)))
    wing = d - depth
    parts.emit(piece, parts.place(rattan_run(wing, depth, h, arms=(True, False), low=True, back_ext=depth),
                                  (-w / 2 + depth / 2, -d / 2 + wing / 2, 0), math.pi / 2))
    tx, ty = .25, -.2
    piece.add(geo.box(.8, .8, .28, .02, 3, at=(tx, ty, 0)), 'trenzado', 'x', 0)
    piece.add(geo.box(.82, .82, .03, .004, 2, at=(tx, ty, .28)), 'madera', 'x')


def sofa_teak(piece, spec):
    """Sofá de teca: laterales con listones, respaldo inclinado de lamas y cojines."""
    w, d, h = _dims(spec)
    arm_h, seat_z = .62, .3
    for sx in (-1, 1):
        x = sx * (w / 2 - .035)
        for y in (-d / 2 + .035, d / 2 - .035):
            piece.add(geo.box(.05, .05, arm_h - .03, .004, 2, at=(x, y, 0)), 'madera', 'z')
        piece.add(geo.box(.1, d + .02, .03, .006, 2, at=(x, 0, arm_h - .03)), 'madera', 'y')
        for z in (.36, .46):
            piece.add(geo.box(.022, d - .1, .05, .003, 1, at=(x, 0, z)), 'madera', 'y')
        piece.add(geo.box(.035, d - .1, .06, .004, 1, at=(x, 0, .12)), 'madera', 'y')
    for y in (-d / 2 + .035, d / 2 - .1):
        piece.add(geo.box(w - .1, .04, .08, .004, 2, at=(0, y, seat_z - .08)), 'madera', 'x')
    tilt, length = math.radians(14), h - seat_z - .09
    slats = max(8, round((w - .14) / .09))
    for i in range(slats):
        slat = geo.box((w - .14) / slats - .025, .02, length, .003, 1)
        geo.transform(slat, rot=(-tilt, 0, 0))
        piece.add(geo.transform(slat, loc=(-w / 2 + .07 + (w - .14) / slats * (i + .5), d / 2 - .1, seat_z)), 'madera', 'z')
    top = geo.box(w - .1, .05, .05, .006, 2)
    geo.transform(top, rot=(-tilt, 0, 0))
    piece.add(geo.transform(top, loc=(0, d / 2 - .1 + length * math.sin(tilt), seat_z + length * math.cos(tilt) - .02)), 'madera', 'x')
    count = spec['params'].get('seats') or max(1, round((w - .2) / .6))
    parts.emit(piece, _seat_cushions(-w / 2 + .09, w / 2 - .09, -d / 2 + .02, d / 2 - .12, seat_z, count, th=.12))
    parts.emit(piece, _back_cushions(-w / 2 + .09, w / 2 - .09, d / 2 - .19, seat_z + .1, h - seat_z - .14, count, tilt=14))


def sofa_aluminium(piece, spec):
    """Sofá de aluminio lacado: bastidores de tubo rectangular, plataforma y cojines gruesos."""
    w, d, h = _dims(spec)
    arm_h, seat_z, tube = .6, .32, geo.rounded_rect(.04, .04, .006, 2)
    for sx in (-1, 1):
        x = sx * (w / 2 - .02)
        loop = geo.fillet([(x, -d / 2 + .02, .01), (x, d / 2 - .02, .01), (x, d / 2 - .02, arm_h), (x, -d / 2 + .02, arm_h)], .03, 3, closed=True)
        piece.add(geo.sweep(loop, tube, closed=True), 'estructura', 'z')
    back = geo.fillet([(-w / 2 + .02, d / 2 - .02, arm_h), (-w / 2 + .02, d / 2 - .02, h - .1), (w / 2 - .02, d / 2 - .02, h - .1),
                       (w / 2 - .02, d / 2 - .02, arm_h)], .04, 3)
    piece.add(geo.sweep(back, tube), 'estructura', 'x')
    piece.add(geo.box(w - .06, d - .06, .04, .004, 2, at=(0, 0, seat_z - .04)), 'estructura', 'x')
    count = spec['params'].get('seats') or 3
    parts.emit(piece, _seat_cushions(-w / 2 + .05, w / 2 - .05, -d / 2 + .01, d / 2 - .17, seat_z, count, th=.14))
    parts.emit(piece, _back_cushions(-w / 2 + .05, w / 2 - .05, d / 2 - .13, seat_z + .1, h - seat_z - .12, count, th=.17, tilt=10))


def chair_stack(piece, spec):
    """Silla apilable de polipropileno con brazos, de una sola pieza."""
    w, d, h = _dims(spec)
    seat = .45
    for sx in (-1, 1):
        for sy in (-1, 1):
            leg = geo.lathe([(.016, -seat + .02), (.022, -.01), (.026, 0)], 12)
            geo.transform(leg, rot=(math.radians(6) * sy, -math.radians(6) * sx, 0))
            piece.add(geo.transform(leg, loc=(sx * (w / 2 - .07), sy * (d / 2 - .07), seat - .02)), 'carcasa', 'z')
        arm = geo.fillet([(sx * (w / 2 - .04), d / 2 - .1, .66), (sx * (w / 2 - .03), -d / 2 + .09, .64),
                          (sx * (w / 2 - .06), -d / 2 + .09, seat)], .05, 4)
        piece.add(geo.sweep(arm, geo.rounded_rect(.04, .022, .009, 3)), 'carcasa', 'y')
    piece.add(geo.soft_box(w - .08, d - .1, .035, (.04, .04, .014), (0, 0, -.004), at=(0, -.02, seat - .03), density=.03),
              'carcasa', 'x', 0)
    back = geo.soft_box(w - .1, .03, h - seat - .02, (.05, .012, .05), (0, -.012, 0), density=.03)
    geo.transform(back, rot=(-math.radians(12), 0, 0))
    piece.add(geo.transform(back, loc=(0, d / 2 - .12, seat - .02)), 'carcasa', 'x', 0)


def chair_rattan(piece, spec):
    """Silla de bistró: estructura de tubo y asiento y respaldo de ratán trenzado."""
    w, d, h = _dims(spec)
    seat = .46
    for sx in (-1, 1):
        piece.add(parts.leg('metal', seat, sx * (w / 2 - .06), -d / 2 + .07, sx, -1, size=1.4, splay=6), 'estructura', 'z')
        post = geo.fillet([(sx * (w / 2 - .07), d / 2 - .06, 0), (sx * (w / 2 - .07), d / 2 - .1, seat),
                           (sx * (w / 2 - .05), d / 2 - .04, h - .03)], .08, 4)
        piece.add(geo.tube(post, .013, 10), 'estructura', 'z')
    ring = geo.fillet([(-w / 2 + .05, -d / 2 + .05, seat), (w / 2 - .05, -d / 2 + .05, seat), (w / 2 - .06, d / 2 - .1, seat),
                       (-w / 2 + .06, d / 2 - .1, seat)], .08, 5, closed=True)
    piece.add(geo.tube(ring, .012, 10, closed=True), 'estructura', 'x')
    piece.add(geo.soft_box(w - .1, d - .14, .025, (.06, .06, .01), (0, 0, .003), at=(0, -.025, seat - .012), density=.03),
              'trenzado', 'x', 0)
    band = geo.arc(0, -.02, h - .12, w * .5, 22, 158, 18)
    piece.add(geo.sweep(band, geo.rounded_rect(.18, .016, .006, 2), up=(0, 0, 1)), 'trenzado', 'x', 0)
    for z in (h - .03, h - .21):
        piece.add(geo.tube(geo.arc(0, -.02, z, w * .5, 22, 158, 18), .01, 8, round_ends=.01), 'estructura', 'x')


def chair_rope(piece, spec):
    """Butaca de exterior con estructura de teca o aluminio y asiento y respaldo de cuerda trenzada."""
    w, d, h = _dims(spec)
    seat, arm_h, frame = .4, .62, 'estructura'
    for sx in (-1, 1):
        x = sx * (w / 2 - .03)
        for y in (-d / 2 + .04, d / 2 - .06):
            piece.add(geo.box(.04, .04, arm_h if y < 0 else seat + .02, .004, 2, at=(x, y, 0)), frame, 'z')
        piece.add(geo.box(.06, d - .02, .025, .005, 2, at=(x, -.01, arm_h)), frame, 'y')
        piece.add(geo.box(.03, d - .1, .05, .004, 2, at=(x, -.01, seat - .05)), frame, 'y')
    for y in (-d / 2 + .04, d / 2 - .06):
        piece.add(geo.box(w - .08, .03, .05, .004, 2, at=(0, y, seat - .05)), frame, 'x')
    tilt = math.radians(16)
    back_len = h - seat
    for sx in (-1, 1):
        post = geo.box(.035, .035, back_len, .004, 2)
        geo.transform(post, rot=(-tilt, 0, 0))
        piece.add(geo.transform(post, loc=(sx * (w / 2 - .07), d / 2 - .1, seat - .02)), frame, 'z')
    top_y, top_z = d / 2 - .1 + back_len * math.sin(tilt), seat - .02 + back_len * math.cos(tilt) - .03
    piece.add(geo.box(w - .12, .03, .04, .004, 2, at=(0, top_y, top_z - .02)), frame, 'x')
    cords, span = [], w - .14
    count = round(span / .026)
    for i in range(count):
        x = -span / 2 + span * (i + .5) / count
        cords.append(geo.tube([(x, -d / 2 + .05, seat - .025), (x, -.1, seat - .04), (x, d / 2 - .08, seat - .025)], .006, 6))
        cords.append(geo.tube([(x, d / 2 - .09, seat - .01), (x, top_y - .02, top_z - .02)], .006, 6))
    piece.add(geo.merge(cords), 'cuerda', 'z', 0)


def lounger(piece, spec):
    """Tumbona de lamas con respaldo reclinable, ruedas y colchoneta."""
    w, d, h = _dims(spec)
    frame, rail_z = spec['params'].get('frame', 'madera'), .22
    for sx in (-1, 1):
        x = sx * (w / 2 - .02)
        piece.add(geo.box(.035, d - .1, .09, .004, 2, at=(x, -.05, rail_z)), frame, 'y')
        piece.add(geo.box(.05, .05, rail_z + .05, .004, 2, at=(x, -d / 2 + .1, 0)), frame, 'z')
        wheel = geo.lathe([(0, -.02), (.1, -.02), (.11, -.01), (.11, .01), (.1, .02), (0, .02)], 20)
        geo.transform(wheel, rot=(0, math.pi / 2, 0))
        piece.add(geo.transform(wheel, loc=(x + sx * .03, d / 2 - .12, .11)), 'patas', 'x')
    hinge = d / 2 - .72
    flat = hinge - (-d / 2 + .05)
    for i in range(round(flat / .085)):
        y = -d / 2 + .05 + .085 * (i + .5)
        piece.add(geo.box(w - .08, .065, .02, .004, 2, at=(0, y, rail_z + .09)), frame, 'x')
    tilt = math.radians(38)
    for i in range(8):
        slat = geo.box(w - .1, .065, .02, .004, 2, at=(0, .085 * (i + .5), 0))
        geo.transform(slat, rot=(tilt, 0, 0))
        piece.add(geo.transform(slat, loc=(0, hinge, rail_z + .1)), frame, 'x')
    piece.add(geo.soft_box(w - .1, flat, .055, (.035, .03, .022), (0, 0, .008), wrinkle=.0015, at=(0, -d / 2 + .05 + flat / 2, rail_z + .11),
                           density=.04), 'tapiceria', 'y', 0)
    pad = geo.soft_box(w - .1, .7, .055, (.035, .03, .022), (0, 0, .008), wrinkle=.0015, at=(0, .35, 0), density=.04)
    geo.transform(pad, rot=(tilt, 0, 0))
    piece.add(geo.transform(pad, loc=(0, hinge + .01, rail_z + .125)), 'tapiceria', 'y', 0)


def slat_table(piece, spec):
    """Mesa de exterior de lamas (teca o aluminio); las bajas de centro llevan balda inferior de lamas."""
    w, d, h = _dims(spec)
    slot = spec['params'].get('frame', 'madera')
    th = .025
    count = max(5, round(d / .1))
    pitch = (d - .02) / count
    for i in range(count):
        piece.add(geo.box(w, pitch - .009, th, .003, 2, at=(0, -d / 2 + .01 + pitch * (i + .5), h - th)), 'sobre', 'x')
    fw, fd = w - .08, d - .08
    for sy in (-1, 1):
        piece.add(geo.box(fw, .03, .07, .003, 1, at=(0, sy * fd / 2, h - th - .07)), slot, 'x')
    for sx in (-1, 1):
        piece.add(geo.box(.03, fd, .07, .003, 1, at=(sx * fw / 2, 0, h - th - .07)), slot, 'y')
    leg = .06 if slot == 'madera' else .045
    for sx in (-1, 1):
        for sy in (-1, 1):
            piece.add(geo.box(leg, leg, h - th, .004, 2, at=(sx * (w / 2 - .06), sy * (d / 2 - .06), 0)), slot, 'z')
    if h < .5:
        for i in range(count - 1):
            piece.add(geo.box(w - .16, pitch - .012, .018, .003, 1, at=(0, -d / 2 + .06 + (d - .12) / (count - 1) * (i + .5), .1)),
                      'sobre', 'x')


def coffee_rattan(piece, spec):
    """Mesa de centro de ratán trenzado con sobre de cristal."""
    w, d, h = _dims(spec)
    piece.add(geo.box(w - .02, d - .02, h - .012, .02, 3, at=(0, 0, 0)), 'trenzado', 'x', 0)
    piece.add(geo.box(w, d, .012, .003, 2, at=(0, 0, h - .012)), 'sobre', 'x')


def chair_metal(piece, spec):
    fam_comedor.chair(piece, {**spec, 'params': {**spec['params'], 'style': 'metalica'}})


BUILDERS = {'sofa_rattan': sofa_rattan, 'chillout': chillout, 'sofa_teak': sofa_teak, 'sofa_aluminium': sofa_aluminium,
            'chair_stack': chair_stack, 'chair_rattan': chair_rattan, 'chair_rope': chair_rope, 'chair_metal': chair_metal,
            'lounger': lounger, 'slat_table': slat_table, 'coffee_rattan': coffee_rattan}
