"""Familia de sofás, butacas y pufs (metros; frente hacia -Y; respaldo hacia +Y).

Cada estilo es un preajuste de proporciones de mercado; la especificación aporta medidas reales y puede sobrescribir
cualquier valor en `params`. Los tramos (run) se combinan para chaise longue, rinconeras, modulares y sofás cama.
"""
import math

import hk_geo as geo
import hk_parts as parts

T, P, M = 'tapiceria', 'patas', 'madera'

STYLES = {
    'moderno': dict(arm='track', arm_w=.17, arm_h=.6, leg='taco', leg_h=.045, back='cushions', back_frame_h=.64,
                    seat_th=.17, seat_top=.44, back_th=.2, back_cushion_th=.19, r=.035, seats=None, piping=False,
                    tilt=9),
    'escandinavo': dict(arm='scandi', arm_w=.12, arm_h=.6, leg='conica', leg_h=.17, back='cushions', back_frame_h=.6,
                        seat_th=.15, seat_top=.45, back_th=.16, back_cushion_th=.17, r=.04, seats=None, piping=False,
                        tilt=11),
    'brazos_finos': dict(arm='slim', arm_w=.07, arm_h=.57, leg='metal', leg_h=.16, back='cushions', back_frame_h=.58,
                         seat_th=.14, seat_top=.44, back_th=.13, back_cushion_th=.16, r=.025, seats=1, piping=False,
                         tilt=10),
    'capitone': dict(arm='rolled', arm_w=.22, arm_h=.73, leg='bola', leg_h=.08, back='tufted', back_frame_h=None,
                     seat_th=.14, seat_top=.46, back_th=.22, back_cushion_th=0, r=.03, seats=None, piping=True, tilt=0),
    'club': dict(arm='club', arm_w=.21, arm_h=.6, leg='bola', leg_h=.06, back='tight', back_frame_h=None,
                 seat_th=.14, seat_top=.44, back_th=.24, back_cushion_th=0, r=.045, seats=None, piping=True, tilt=0),
    'orejero': dict(arm='track', arm_w=.13, arm_h=.63, leg='conica', leg_h=.18, back='tight', back_frame_h=None,
                    seat_th=.13, seat_top=.45, back_th=.2, back_cushion_th=0, r=.03, seats=None, piping=True, tilt=0),
}


def _style(spec):
    params = spec.get('params', {})
    base = dict(STYLES[params.get('style', 'moderno')])
    base.update({k: v for k, v in params.items() if k in base})
    return base


def _dims(spec):
    return tuple(value / 1000 for value in spec['dims'])


def _arm(st, aw, depth, cx, side, height):
    """Brazo tapizado en x = cx; side = -1 izquierda, +1 derecha."""
    z0, kind = st['leg_h'], st['arm']
    h = height - z0
    if kind == 'rolled':
        roll = aw * .42
        body_w = aw - .025
        half = (body_w / 2, depth / 2, (h - roll * .7) / 2)
        deform, pins = parts.tufting(0, -side, half, .15, .024, margin=.07)
        bx = cx - side * .0125
        body = geo.soft_box(body_w, depth, h - roll * .7, (.03, .03, .03), (.01, .006, 0), deform=deform,
                            at=(bx, 0, z0), density=.03, uniform=True)
        knobs = parts.buttons([p for p in pins if p.z < half[2] - .05], 0, -side)
        geo.transform(knobs, loc=(bx, 0, z0 + half[2]))
        rx = cx + side * (aw / 2 - roll + .012)
        scroll = geo.sweep([(rx, -depth / 2 + roll * .55, height - roll), (rx, depth / 2 - .04, height - roll)],
                           geo.circle(roll, 18), round_ends=roll * .45)
        return [(body, T, 'x', 0), (knobs, T, 'x', 0), (scroll, T, 'y', 0)]
    shapes = {'track': ((.035, .035, .035), (.006, .008, .012)), 'scandi': ((.045, .05, .065), (.006, .01, .01)),
              'slim': ((.018, .02, .022), (.002, .004, .004)), 'club': ((.09, .08, .1), (.014, .012, .02))}
    radius, bulge = shapes[kind]
    arm = geo.soft_box(aw, depth, h, radius, bulge, wrinkle=.0012, seed=side + 3, at=(cx, 0, z0))
    return [(arm, T, 'y', 0)]


def run(length, depth, st, height, arms=(True, True), seats=None, seat_cushions=True, back_cushions=True,
        inset=(0.0, 0.0)):
    """Tramo recto de sofá centrado en el origen: base, brazos, respaldo, cojines de asiento y de respaldo."""
    out = []
    aw = st['arm_w']
    left, right = (aw if arms[0] else 0), (aw if arms[1] else 0)
    z0, seat_top = st['leg_h'], st['seat_top']
    base_top = seat_top - st['seat_th']
    x0, x1 = -length / 2 + left, length / 2 - right
    out.append((geo.soft_box(x1 - x0 + .02, depth - .004, base_top - z0, .022, (0, .006, 0),
                             at=((x0 + x1) / 2, 0, z0), density=.07), T, 'x', 0))
    arm_h = st['arm_h']
    for side, on in ((-1, arms[0]), (1, arms[1])):
        if on:
            out += _arm(st, aw, depth, side * (length / 2 - aw / 2), side, arm_h)
    bt = st['back_th']
    back_h = (st['back_frame_h'] or height) - z0
    by = depth / 2 - bt / 2
    if st['back'] == 'tufted':
        half = (length / 2, bt / 2, back_h / 2)
        deform, pins = parts.tufting(1, -1, half, .16, .03, margin=.08)
        frame = geo.soft_box(length, bt, back_h, (.04, .04, .05), (0, .012, .008), deform=deform,
                             at=(0, by, z0), density=.03, uniform=True)
        knobs = parts.buttons([p for p in pins if p.z > -half[2] + (seat_top - z0) + .06], 1, -1)
        geo.transform(knobs, loc=(0, by, z0 + half[2]))
        out += [(frame, T, 'x', 0), (knobs, T, 'x', 0)]
    else:
        bulge = (0, .03, .01) if st['back'] == 'tight' else (0, .01, .008)
        radius = (.05, .06, .06) if st['back'] == 'tight' else (.035, .035, .04)
        out.append((geo.soft_box(length, bt, back_h, radius, bulge, wrinkle=.0012, seed=7, at=(0, by, z0),
                                 density=.055), T, 'x', 0))
    span = x1 - x0 - inset[0] - inset[1]
    count = seats or st['seats'] or max(1, round(span / .62))
    width = span / count
    seat_depth = depth - bt + .012
    th = st['seat_th']
    r = st['r']
    for i in range(count if seat_cushions else 0):
        cx = x0 + inset[0] + width * (i + .5)
        cy = -depth / 2 - .012 + seat_depth / 2
        out.append((geo.soft_box(width - .006, seat_depth, th, (r + .01, r + .01, th * .42), (.004, .008, .016),
                                 wrinkle=.002, seed=i, at=(cx, cy, base_top), density=.04), T, 'y', 0))
        if st['piping']:
            out.append((parts.cushion_piping(width - .006, seat_depth, th, (r + .01, r + .01, th * .42), base_top,
                                             (cx, cy)), T, 'x', 0))
    if back_cushions and st['back'] == 'cushions':
        ct = st['back_cushion_th']
        bottom = seat_top - .025
        ch = height - bottom
        tilt = math.radians(st['tilt'])
        for i in range(count):
            cx = x0 + inset[0] + width * (i + .5)
            cushion = geo.soft_box(width - .012, ct, ch, (.05, .065, .06), (.008, .028, .012), wrinkle=.003,
                                   seed=11 + i, density=.04)
            geo.transform(cushion, rot=(-tilt, 0, 0))
            geo.transform(cushion, loc=(cx, depth / 2 - bt - ct / 2 + .025, bottom))
            out.append((cushion, T, 'x', 0))
    return out


def _legs(piece, st, length, depth, cx=0.0, cy=0.0, rz=0.0):
    if st['leg_h'] <= 0:
        return
    inset = .09 if st['leg'] == 'conica' else .07
    spots = [(sx, sy) for sx in (-1, 1) for sy in (-1, 1)] + ([(0, -1), (0, 1)] if length > 2.1 else [])
    for sx, sy in spots:
        bm = parts.leg(st['leg'], st['leg_h'], sx * (length / 2 - inset), sy * (depth / 2 - inset), sx, sy)
        geo.transform(bm, loc=(cx, cy, 0), rot=(0, 0, rz))
        piece.add(bm, P, 'z')


def corner_back(st, depth, height, x, y0, y1):
    """Respaldo lateral (con su cojín) que cierra la esquina de una rinconera o del módulo de esquina."""
    bt, z0 = st['back_th'], st['leg_h']
    back_h = (st['back_frame_h'] or height) - z0
    length = y1 - y0
    out = [(geo.soft_box(bt, length, back_h, (.035, .035, .04), (.01, 0, .008), at=(x, (y0 + y1) / 2, z0)),
            T, 'y', 0)]
    if st['back'] == 'cushions':
        ct, bottom = st['back_cushion_th'], st['seat_top'] - .025
        cushion = geo.soft_box(ct, length - bt - .01, height - bottom, (.065, .05, .06), (.028, .008, .012),
                               wrinkle=.003, seed=31)
        geo.transform(cushion, rot=(0, math.radians(st['tilt']) * (1 if x < 0 else -1), 0))
        geo.transform(cushion, loc=(x + (bt / 2 + ct / 2 - .025) * (1 if x < 0 else -1), (y0 + y1 - bt) / 2,
                                    bottom))
        out.append((cushion, T, 'y', 0))
    return out


def sofa(piece, spec):
    w, d, h = _dims(spec)
    st = _style(spec)
    parts.emit(piece, run(w, d, st, h, seats=spec['params'].get('seats')))
    _legs(piece, st, w, d)


def chaise(piece, spec):
    """Sofá con chaise longue; side = izquierda/derecha visto de frente."""
    w, d, h = _dims(spec)
    st, params = _style(spec), spec['params']
    sd, cw = params['seat_depth'] / 1000, params['chaise_w'] / 1000
    s = -1 if params['side'] == 'izquierda' else 1
    main_len = w - cw
    # La parte principal lleva el brazo en el lado contrario a la chaise.
    main = run(main_len, sd, st, h, arms=(s > 0, s < 0))
    parts.emit(piece, parts.place(main, (-s * cw / 2, d / 2 - sd / 2, 0)))
    longue = run(cw, d, st, h, arms=(s < 0, s > 0), seats=1)
    parts.emit(piece, parts.place(longue, (s * (w / 2 - cw / 2), 0, 0)))
    _legs(piece, st, main_len, sd, -s * cw / 2, d / 2 - sd / 2)
    _legs(piece, st, cw, d, s * (w / 2 - cw / 2), 0)


def corner(piece, spec):
    """Rinconera en L: tramo trasero y ala lateral (side = lado del ala visto de frente)."""
    w, d, h = _dims(spec)
    st, params = _style(spec), spec['params']
    sd = params['seat_depth'] / 1000
    s = -1 if params['side'] == 'izquierda' else 1
    bt = st['back_th']
    rear = run(w, sd, st, h, arms=(s > 0, s < 0), inset=((bt, 0) if s < 0 else (0, bt)),
               seats=params.get('rear_seats'))
    parts.emit(piece, parts.place(rear, (0, d / 2 - sd / 2, 0)))
    parts.emit(piece, corner_back(st, sd, h, s * (w / 2 - bt / 2), d / 2 - sd, d / 2))
    wing_len = d - sd
    wing = run(wing_len, sd, st, h, arms=(s < 0, s > 0), seats=params.get('wing_seats'))
    # El ala se gira 90°: su respaldo queda contra el lateral y su brazo en el extremo delantero.
    parts.emit(piece, parts.place(wing, (s * (w / 2 - sd / 2), -d / 2 + wing_len / 2, 0), rz=-s * math.pi / 2))
    _legs(piece, st, w, sd, 0, d / 2 - sd / 2)
    _legs(piece, st, wing_len, sd, s * (w / 2 - sd / 2), -d / 2 + wing_len / 2, -s * math.pi / 2)


def sofa_bed(piece, spec):
    """Sofá cama: cerrado como un sofá de asiento corrido o abierto con el colchón desplegado."""
    w, d, h = _dims(spec)
    st, params = _style(spec), spec['params']
    if not params.get('open'):
        sofa(piece, spec)
        return
    sd = params['seat_depth'] / 1000
    rear_y = d / 2 - sd / 2
    parts.emit(piece, parts.place(run(w, sd, st, h, seat_cushions=False), (0, rear_y, 0)))
    _legs(piece, st, w, sd, 0, rear_y)
    aw = st['arm_w']
    mw, ml = w - 2 * aw - .03, d - st['back_th'] - .02
    my = d / 2 - st['back_th'] - ml / 2 - .01
    piece.add(geo.soft_box(mw, ml, .13, (.04, .04, .05), (.004, .004, .01), wrinkle=.002, seed=4,
                           at=(0, my, .3)), 'sabanas', 'y', 0)
    frame = []
    for sx in (-1, 1):
        x = sx * (mw / 2 - .08)
        frame.append(geo.tube(geo.fillet([(x, my - ml / 2 + .07, 0), (x, my - ml / 2 + .07, .3),
                                          (x, my + ml / 2 - .3, .3)], .04), .011, 10))
    frame.append(geo.tube([(-mw / 2 + .08, my - ml / 2 + .07, .3), (mw / 2 - .08, my - ml / 2 + .07, .3)], .011, 10))
    piece.add(geo.merge(frame), 'metal', 'x')
    for i in (-1, 1):
        pillow = parts.pillow(.62, .42, .16, seed=40 + i)
        geo.transform(pillow, rot=(math.radians(14), 0, 0))
        geo.transform(pillow, loc=(i * mw / 4, my + ml / 2 - .26, .5))
        piece.add(pillow, 'sabanas', 'x', 0)
    piece.add(geo.soft_box(mw * .55, .36, .045, (.03, .03, .02), (0, .006, .008), wrinkle=.006, seed=9,
                           at=(mw * .18, my - ml / 2 + .45, .425)), 'plaid', 'x', 0)


def module(piece, spec):
    """Módulos combinables de un sofá modular: central, brazo a izquierda o derecha, esquina, chaise y puf."""
    w, d, h = _dims(spec)
    st, kind = _style(spec), spec['params']['module']
    if kind == 'puf':
        parts.emit(piece, [(geo.soft_box(w, d, st['seat_top'] - st['leg_h'], (st['r'] + .01,) * 2 + (.06,),
                                   (.006, .006, .014), wrinkle=.002, at=(0, 0, st['leg_h'])), T, 'x', 0)])
    elif kind == 'esquina':
        bt = st['back_th']
        parts.emit(piece, run(w, d, st, h, arms=(False, False), inset=(bt, 0), seats=1))
        parts.emit(piece, corner_back(st, d, h, -w / 2 + bt / 2, -d / 2, d / 2))
    else:
        arms = {'central': (False, False), 'brazo_izq': (True, False), 'brazo_dcho': (False, True),
                'chaise': (False, False)}[kind]
        parts.emit(piece, run(w, d, st, h, arms=arms, seats=1))
    _legs(piece, st, w, d)


def armchair_round(piece, spec):
    """Butaca envolvente de respaldo curvo (tipo tub chair), muy de tendencia en bouclé."""
    w, d, h = _dims(spec)
    st = _style(spec)
    z0, seat_top = st['leg_h'], st['seat_top']
    base_top = seat_top - st['seat_th']
    rad = min(w, d) / 2
    piece.add(geo.soft_box(w - .05, d - .05, base_top - z0, (rad * .8, rad * .8, .03), (0, 0, 0),
                           at=(0, 0, z0)), T, 'x', 0)
    thick = .13
    bh = h - z0
    rx, ry = w / 2 - thick / 2, d / 2 - thick / 2
    path = [(x * rx, y * ry, z0 + bh / 2) for x, y, _ in geo.arc(0, 0, 0, 1.0, -25, 205, 28)]
    back = geo.sweep(path, geo.rounded_rect(bh, thick, thick * .48, 4), round_ends=thick * .5)
    piece.add(back, T, 'x', 0)
    piece.add(geo.soft_box(w - 2 * thick + .02, d - thick - .05, st['seat_th'], (rad * .55, rad * .5, .06),
                           (.006, .008, .018), wrinkle=.002, at=(0, -thick / 2 + .02, base_top)), T, 'y', 0)
    _legs(piece, st, w * .78, d * .78)


def armchair_wood(piece, spec):
    """Butaca escandinava de estructura de madera vista con cojines de asiento y respaldo."""
    w, d, h = _dims(spec)
    arm_h, seat = .6, .27
    wood = []
    for sx in (-1, 1):
        x = sx * (w / 2 - .03)
        wood.append(parts.leg('recta', arm_h - .03, x, -d / 2 + .07, size=.95))
        back_post = geo.box(.045, .045, h - .02, .005, 2)
        geo.transform(back_post, rot=(math.radians(-14), 0, 0))
        geo.transform(back_post, loc=(x, d / 2 - .2, 0))
        wood.append(back_post)
        wood.append(geo.box(.075, d - .02, .03, .012, 3, at=(x, -.01, arm_h - .03)))
        wood.append(geo.box(.035, d - .2, .05, .006, 2, at=(x, -.05, seat - .05)))
    for y in (-d / 2 + .07, d / 2 - .2):
        wood.append(geo.box(w - .06, .035, .06, .006, 2, at=(0, y, seat - .06)))
    top = geo.box(w - .06, .035, .05, .008, 2)
    geo.transform(top, loc=(0, d / 2 - .2 + math.sin(math.radians(14)) * (h - .1), h - .1))
    wood.append(top)
    for bm in wood:
        piece.add(bm, M, 'z' if bm is not wood[-1] else 'x')
    piece.add(geo.soft_box(w - .1, d - .22, .12, (.04, .04, .05), (.004, .008, .016), wrinkle=.002,
                           at=(0, -.06, seat)), T, 'y', 0)
    back = geo.soft_box(w - .12, .12, h - seat - .16, (.04, .05, .05), (.006, .022, .01), wrinkle=.003, seed=5)
    geo.transform(back, rot=(math.radians(-14), 0, 0))
    geo.transform(back, loc=(0, d / 2 - .26, seat + .1))
    piece.add(back, T, 'x', 0)


def wingback(piece, spec):
    """Butaca de orejas: respaldo alto tapizado, orejas laterales y patas cónicas de madera."""
    w, d, h = _dims(spec)
    st = _style(spec)
    parts.emit(piece, run(w, d, st, h, seats=1))
    aw, bt = st['arm_w'], st['back_th']
    for side in (-1, 1):
        wing = geo.soft_box(aw * .8, .36, h - st['arm_h'] - .04, (.035, .06, .08), (.004, .01, .02), wrinkle=.0015)
        geo.transform(wing, rot=(0, 0, side * math.radians(8)))
        geo.transform(wing, loc=(side * (w / 2 - aw * .45), d / 2 - bt - .1, st['arm_h'] - .04))
        piece.add(wing, T, 'y', 0)
    _legs(piece, st, w, d)


def pouf(piece, spec):
    """Puf redondo (tambor con vivos) o cuadrado."""
    w, d, h = _dims(spec)
    if spec['params'].get('shape') == 'redondo':
        r = w / 2
        piece.add(geo.lathe([(0, 0), (r - .03, 0), (r - .006, .012), (r + .004, .05), (r + .01, h / 2),
                             (r + .004, h - .05), (r - .006, h - .012), (r - .03, h), (0, h)], 40), T, 'x', 0)
        for z in (.016, h - .016):
            piece.add(geo.tube(geo.arc(0, 0, z, r - .003, 0, 360, 48), .005, 8, closed=True), T, 'x', 0)
        return
    piece.add(geo.soft_box(w, d, h - .05, (.05, .05, .06), (.01, .01, .02), wrinkle=.002, at=(0, 0, .05)), T, 'x', 0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            piece.add(parts.leg('taco', .05, sx * (w / 2 - .07), sy * (d / 2 - .07), size=.8), P, 'z')


def daybed(piece, spec):
    """Diván o meridiana independiente: un extremo alzado, respaldo parcial y cojín cilíndrico."""
    w, d, h = _dims(spec)
    st, params = _style(spec), spec['params']
    s = -1 if params['side'] == 'izquierda' else 1
    z0, seat_top, aw, bt = st['leg_h'], st['seat_top'], .2, .16
    base_top = seat_top - st['seat_th']
    piece.add(geo.soft_box(w, d, base_top - z0, .025, (0, .006, 0), at=(0, 0, z0), density=.07), T, 'x', 0)
    piece.add(geo.soft_box(aw, d, h - z0, (.06, .05, .09), (.01, .008, .02), wrinkle=.0012, at=(s * (w / 2 - aw / 2), 0, z0)),
              T, 'y', 0)
    back_len = w * .62
    hx = s * (w / 2 - aw)

    def slope(p, _normal):
        t = max(0.0, min(1.0, (back_len / 2 - s * p.x) / back_len))
        if p.z > 0:
            p.z *= 1 - .55 * t * t
        return p

    piece.add(geo.soft_box(back_len, bt, st['arm_h'] + .1 - z0, (.06, .04, .06), (0, .012, .006), deform=slope,
                           at=(hx - s * back_len / 2, d / 2 - bt / 2, z0)), T, 'x', 0)
    cushion_w = w - aw
    piece.add(geo.soft_box(cushion_w, d - .02, st['seat_th'], (.05, .05, st['seat_th'] * .42), (.004, .008, .016), wrinkle=.002,
                           at=(-s * aw / 2, -.01, base_top), density=.04), T, 'x', 0)
    piece.add(parts.cushion_piping(cushion_w, d - .02, st['seat_th'], (.05, .05, st['seat_th'] * .42), base_top, (-s * aw / 2, -.01)),
              T, 'x', 0)
    bolster_x = s * (w / 2 - aw - .1)
    piece.add(geo.sweep([(bolster_x, -d / 2 + .12, seat_top + .09), (bolster_x, d / 2 - bt - .02, seat_top + .09)],
                        geo.circle(.09, 20), round_ends=.06), T, 'y', 0)
    _legs(piece, st, w, d)


def chaise_classic(piece, spec):
    """Chaise longue de dormitorio: cabecera enrollada, respaldo parcial descendente y asiento capitoné."""
    w, d, h = _dims(spec)
    params = spec['params']
    s = -1 if params['side'] == 'izquierda' else 1
    leg_h, seat_top, head = .18, .44, .24
    half = (w / 2, d / 2, (seat_top - leg_h) / 2)
    deform, pins = parts.tufting(2, 1, half, .17, .026, margin=.1)
    piece.add(geo.soft_box(w, d, seat_top - leg_h, (.05, .05, .05), (.006, .006, .012), deform=deform, at=(0, 0, leg_h),
                           density=.03, uniform=True), T, 'x', 0)
    knobs = parts.buttons(pins, 2, 1)
    piece.add(geo.transform(knobs, loc=(0, 0, leg_h + half[2])), T, 'x', 0)
    piece.add(parts.cushion_piping(w, d, seat_top - leg_h, (.05, .05, .05), leg_h), T, 'x', 0)
    hx = s * (w / 2 - head / 2)
    piece.add(geo.soft_box(head, d, h - leg_h - .08, (.07, .05, .08), (.01, .008, .02), at=(hx, 0, leg_h)), T, 'y', 0)
    roll_x = s * (w / 2 - head + .07)
    piece.add(geo.sweep([(roll_x, -d / 2 + .05, h - .085), (roll_x, d / 2 - .03, h - .085)], geo.circle(.085, 20),
                        round_ends=.05), T, 'y', 0)
    back_len = w * .5

    def slope(p, _normal):
        t = max(0.0, min(1.0, (back_len / 2 - s * p.x) / back_len))
        if p.z > 0:
            p.z *= 1 - .7 * t
        return p

    piece.add(geo.soft_box(back_len, .12, h - .1 - leg_h, (.06, .04, .06), (0, .014, .006), deform=slope,
                           at=(s * (w / 2 - head) - s * back_len / 2, d / 2 - .06, leg_h)), T, 'x', 0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            piece.add(parts.leg('torneada', leg_h, sx * (w / 2 - .07), sy * (d / 2 - .07)), P, 'z')


BUILDERS = {'sofa': sofa, 'chaise': chaise, 'corner': corner, 'sofa_bed': sofa_bed, 'module': module,
            'armchair': sofa, 'armchair_round': armchair_round, 'armchair_wood': armchair_wood,
            'wingback': wingback, 'pouf': pouf, 'daybed': daybed,
            'chaise_classic': chaise_classic}
