"""Sanitarios de la familia baño: lavabos, muebles de lavabo con seno integrado, inodoros y bidés.

Metros; frente hacia -Y; la pared de instalación en +Y (y = fondo / 2); suelo en z = 0. Las piezas colgadas se
construyen a su altura real y la fábrica registra la cota de su punto más bajo como elevación.
Huecos: «ceramica», «griferia», «carcasa» (mueble), «tirador» (tiradores y patas), «encimera» (tablero de los
lavabos de sobre encimera).
"""
import math

import hk_geo as geo

import fam_bano_formas as formas
import fam_bano_griferia as grifo

RIM = .85          # altura del borde del lavabo (mm de mercado: 850)
BOWL_RIM = .40     # altura del borde de inodoros y bidés


def dims(spec):
    return tuple(value / 1000 for value in spec['dims'])


def _rect(x0, x1, y0, y1, radius, corners=(True, True, True, True)):
    """Forma desplazable: delta → r(θ) de un rectángulo redondeado retranqueado delta (centro fijado después)."""
    def shape(center):
        def at(delta):
            pts = formas.rect_points(x0 + delta, x1 - delta, y0 + delta, y1 - delta, max(radius - delta, .001), 5, corners)
            return formas.polygon(pts, center)
        return at
    return shape


def basin_top(piece, x0, x1, d, z_top, thickness, bowl_a, bowl_b, depth, corners=(True, True, True, True), cy=-.025,
              outer_radius=.006, slot='ceramica', taper=0.0):
    """Losa de loza entre x0 y x1 con un seno superelíptico; devuelve el centro del seno."""
    center = ((x0 + x1) / 2, cy)
    outer = _rect(x0, x1, -d / 2, d / 2, outer_radius, corners)(center)
    bottom = None
    if taper:
        bottom = _rect(x0 + taper * .4, x1 - taper * .4, -d / 2 + taper, d / 2, outer_radius, corners)(center)
    pts = formas.rect_points(x0, x1, -d / 2, d / 2, outer_radius, 5, corners)
    thetas = formas.angles(96, pts, center)
    bowl = formas.superellipse(bowl_a, bowl_b, 5)
    piece.add(formas.basin_slab(outer, bowl, center, z_top, thickness, depth, thetas, edge=min(.006, thickness * .3),
                                bottom=bottom), slot, 'x', 0)
    piece.add(geo.lathe([(0, 0), (.032, 0), (.033, .002), (.03, .004), (0, .004)], 24,
                        at=(center[0], center[1], z_top - .008 - depth - .001)), 'griferia', 'x', 0)
    return center


# --- Lavabos -------------------------------------------------------------------------------------------------------

def vessel_basin(piece, spec):
    """Lavabo de sobre encimera (redondo, rectangular u ovalado) sobre encimera suspendida, con grifo de caño alto y
    sifón de botella cromado."""
    w, d, _h = dims(spec)
    p = spec['params']
    top = p.get('top_h', 760) / 1000
    bw, bd, bh = (p['basin'][k] / 1000 for k in range(3))
    piece.add(geo.box(w, d, .04, .003, 3, at=(0, 0, top - .04)), 'encimera', 'x')
    cy = d / 2 - .075 - bd / 2
    shape = {'redondo': formas.superellipse(bw / 2, bd / 2, 2.0),
             'ovalado': formas.superellipse(bw / 2, bd / 2, 2.0),
             'rectangular': formas.superellipse(bw / 2, bd / 2, 5.0)}[p['shape']]
    thetas = formas.angles(96)
    flare = .55 if p['shape'] == 'rectangular' else 1.0
    piece.add(formas.vessel(shape, thetas, bh, .007, .58 if p['shape'] != 'rectangular' else .86, (0, cy), top, flare),
              'ceramica', 'x', 0)
    piece.add(geo.lathe([(0, 0), (.03, 0), (.031, .002), (.028, .004), (0, .004)], 24, at=(0, cy, top + .009)), 'griferia', 'x', 0)
    piece.add(grifo.basin_mixer(0, cy + bd / 2 + .04, top, height=.3, reach=bd / 2 + .02, slim=True, lever_side=True), 'griferia', 'x', 0)
    piece.add(grifo.bottle_trap(0, cy, top - .045, d / 2, top - .2), 'griferia', 'x', 0)


def _d_column(y_back, z0, z1, a0, f0, a1, f1, thetas, waist=0.0, cap=True):
    """Columna cerámica en «D» pegada a la pared (pie o semipie de lavabo): contorno de a0/f0 abajo a a1/f1 arriba."""
    rings = []
    steps = 8
    for k in range(steps + 1):
        t = k / steps
        a = a0 + (a1 - a0) * t - waist * math.sin(math.pi * t)
        f = f0 + (f1 - f0) * t - waist * 1.2 * math.sin(math.pi * t)
        shape = formas.superellipse(a, .02, 6, front=f, n_front=2.2)
        rings.append(formas.ring(shape, thetas, z0 + (z1 - z0) * t, (0, y_back - .02)))
    if cap:
        first = formas.superellipse(a0 * .85, .015, 6, front=f0 * .85, n_front=2.2)
        rings.insert(0, formas.ring(first, thetas, z0 - .012, (0, y_back - .02)))
        rings.insert(0, (0, y_back - .02 - f0 * .4, z0 - .016))
    else:
        rings.insert(0, (0, y_back - .02 - f0 * .4, z0))
    rings.append((0, y_back - .02 - f1 * .4, z1))
    return formas.loft(rings)


def wall_basin(piece, spec):
    """Lavabo de pared: suspendido (con sifón cromado visto), de semipedestal o de pedestal, con monomando."""
    w, d, _h = dims(spec)
    support = spec['params']['support']
    th = .13
    bowl_a, bowl_b = w / 2 - .075, d / 2 - .095
    center = basin_top(piece, -w / 2, w / 2, d, RIM, th, bowl_a, bowl_b, .12, cy=-.035, outer_radius=.05,
                       corners=(True, True, False, False), taper=.03)
    piece.add(grifo.basin_mixer(0, center[1] + bowl_b + .055, RIM, reach=.115), 'griferia', 'x', 0)
    thetas = formas.angles(64)
    if support == 'suspendido':
        piece.add(grifo.bottle_trap(0, center[1], RIM - .14, d / 2, RIM - .3), 'griferia', 'x', 0)
    elif support == 'semipedestal':
        piece.add(_d_column(d / 2, RIM - .46, RIM - th + .01, .085, .12, .1, .15, thetas), 'ceramica', 'x', 0)
    elif support == 'pedestal':
        piece.add(_d_column(d / 2, .0, RIM - th + .01, .12, .17, .1, .15, thetas, waist=.022, cap=False), 'ceramica', 'x', 0)
    else:
        raise ValueError(f'Soporte de lavabo desconocido: {support}')


def _bar_handle(x, y, z, length, vertical=False):
    """Tirador de barra con dos pies; (x, y, z) es el centro sobre el frente (el frente mira a -Y)."""
    half = length / 2
    off = .022
    if vertical:
        bar = geo.tube([(x, y - off, z - half), (x, y - off, z + half)], .0055, 12, round_ends=.004)
        feet = [geo.tube([(x, y, z + s * (half - .015)), (x, y - off, z + s * (half - .015))], .004, 10) for s in (-1, 1)]
    else:
        bar = geo.tube([(x - half, y - off, z), (x + half, y - off, z)], .0055, 12, round_ends=.004)
        feet = [geo.tube([(x + s * (half - .015), y, z), (x + s * (half - .015), y - off, z)], .004, 10) for s in (-1, 1)]
    return geo.merge([bar, *feet])


def fronts(piece, x0, x1, y_front, z0, z1, rows, cols, thickness=.018, gap=.003, handle=True, vertical=False):
    """Frentes de cajón o puerta en rejilla con holgura y tirador de barra centrado arriba (hueco «carcasa»)."""
    cw, rh = (x1 - x0) / cols, (z1 - z0) / rows
    for c in range(cols):
        for r in range(rows):
            fx0, fz0 = x0 + c * cw + gap / 2, z0 + r * rh + gap / 2
            fw, fh = cw - gap, rh - gap
            piece.add(geo.box(fw, thickness, fh, .002, 2, at=(fx0 + fw / 2, y_front + thickness / 2, fz0)), 'carcasa', 'x')
            if handle:
                if vertical:
                    hx = fx0 + (fw - .05 if c % 2 == 0 else .05)
                    piece.add(_bar_handle(hx, y_front, fz0 + fh / 2, min(.25, fh * .5), True), 'tirador', 'z', 0)
                else:
                    piece.add(_bar_handle(fx0 + fw / 2, y_front, fz0 + fh - min(.05, fh * .2), min(.22, fw * .45)), 'tirador', 'x', 0)


def vanity(piece, spec):
    """Mueble de baño con lavabo integrado: suspendido (base a 35 cm) o de suelo con patas; uno o dos senos."""
    w, d, _h = dims(spec)
    p = spec['params']
    bowls = p.get('bowls', 1)
    top_th = .018
    floor = p['mount'] == 'suelo'
    bottom = .12 if floor else RIM - .5
    body_top = RIM - top_th
    front_y = -d / 2 + .012
    # Cuerpo abierto por arriba (costados, fondo y trasera): el vientre del seno queda dentro.
    t, body_h, body_d = .016, body_top - bottom, d - .03
    for sx in (-1, 1):
        piece.add(geo.box(t, body_d, body_h, .002, 2, at=(sx * (w / 2 - .002 - t / 2), .015, bottom)), 'carcasa', 'y')
    piece.add(geo.box(w - .004 - 2 * t, body_d, t, .001, 1, at=(0, .015, bottom)), 'carcasa', 'y')
    piece.add(geo.box(w - .004 - 2 * t, t, body_h - t, .001, 1, at=(0, d / 2 - t / 2, bottom + t)), 'carcasa', 'x')
    cols = 2 if w > 1.0 else 1
    fronts(piece, -w / 2 + .002, w / 2 - .002, front_y, bottom, body_top - .002, 3 if floor else 2, cols)
    if bowls == 2:
        halves = ((-w / 2, 0, (True, False, False, True)), (0, w / 2, (False, True, True, False)))
    else:
        halves = ((-w / 2, w / 2, (True, True, True, True)),)
    for x0, x1, corners in halves:
        half = x1 - x0
        a = min(.26, half / 2 - .08)
        center = basin_top(piece, x0, x1, d, RIM, top_th, a, .15, .115, corners, cy=-.025, outer_radius=.004)
        piece.add(grifo.basin_mixer(center[0], center[1] + .15 + .045, RIM, reach=.115), 'griferia', 'x', 0)
    if floor:
        for sx in (-1, 1):
            for sy in (-1, 1):
                x, y = sx * (w / 2 - .05), .015 + sy * ((d - .03) / 2 - .05)
                piece.add(geo.lathe([(0, 0), (.011, 0), (.014, bottom - .004), (.018, bottom)], 16, at=(x, y, 0)), 'tirador', 'z', 0)


# --- Inodoros y bidés ----------------------------------------------------------------------------------------------

def _egg(a, back, front, n_back=4.5):
    return formas.superellipse(a, back, n_back, front=front, n_front=2.3)


def _bowl_body(d, style, a=.18, open_bowl=False):
    """Cuerpo de inodoro o bidé como un único loft: exterior (con pie, faldón o colgado), borde y seno interior.

    Devuelve (malla, y_c, kb, kf): centro del huevo y longitudes trasera y delantera."""
    y_back = d / 2 - (.03 if style == 'pie' else 0)
    kb = .2 if style == 'colgado' else .25
    kf = (y_back + d / 2) - kb
    y_c = y_back - kb
    shape = _egg(a, kb, kf)
    thetas = formas.angles(80)
    rings = []

    def about_back(s):
        return (0, y_back + s * (y_c - y_back))
    if style == 'colgado':
        z0 = .2
        rings.append((0, y_back - .12, z0))
        for s, z in ((.5, z0), (.72, z0 + .028), (.86, z0 + .07), (.95, z0 + .12), (.99, z0 + .16), (1.0, BOWL_RIM - .025)):
            rings.append(formas.ring(shape, thetas, z, about_back(s), s))
    elif style == 'faldon':
        rings.append((0, y_c, 0))
        for s, z in ((.93, 0), (.935, .01), (.96, .2), (.99, .33), (1.0, BOWL_RIM - .025)):
            rings.append(formas.ring(shape, thetas, z, about_back(s), s))
    elif style == 'pie':
        foot = formas.superellipse(.115, .16, 2.6, front=.13)
        fc = (0, y_c + .07)
        rings.append((fc[0], fc[1], 0))
        rings.append(formas.ring(foot, thetas, 0, fc, .98))
        rings.append(formas.ring(foot, thetas, .012, fc, 1.0))
        rings.append(formas.ring(foot, thetas, .12, fc, .9))
        for s, z in ((.78, .24), (.92, .3), (.985, .345), (1.0, BOWL_RIM - .025)):
            rings.append(formas.ring(shape, thetas, z, about_back(s), s))
    else:
        raise ValueError(f'Cuerpo de sanitario desconocido: {style}')
    center = (0, y_c)
    rings.append(formas.ring(shape, thetas, BOWL_RIM - .006, center, 1.0, -.004))
    rings.append(formas.ring(shape, thetas, BOWL_RIM, center, 1.0, -.014))
    lip = .036 if open_bowl else .045
    inner = formas.superellipse(a - lip, kb - (.1 if open_bowl else .075), 3.0, front=kf - lip, n_front=2.3)
    rings.append(formas.ring(inner, thetas, BOWL_RIM, center, 1.0, .012))
    rings.append(formas.ring(inner, thetas, BOWL_RIM - .005, center, 1.0, .002))
    rings.append(formas.ring(inner, thetas, BOWL_RIM - .015, center, 1.0, -.002))
    profile = ((.85, .045), (.62, .1), (.4, .14), (.25, .16)) if not open_bowl else ((.86, .035), (.62, .075), (.4, .1))
    for s, dz in profile:
        rings.append(formas.ring(inner, thetas, BOWL_RIM - .015 - dz, (0, y_c - .015), s))
    rings.append((0, y_c - .015, BOWL_RIM - .015 - profile[-1][1] - .008))
    return formas.loft(rings), y_c, kb, kf


def _seat_and_lid(piece, y_c, kb, kf, lid_back, a=.18):
    shape = _egg(a - .002, lid_back, kf + .006, 4.0)
    thetas = formas.angles(80)
    piece.add(formas.pillow_slab(shape, thetas, BOWL_RIM + .001, .02, (0, y_c), .008), 'ceramica', 'x', 0)
    piece.add(formas.pillow_slab(shape, thetas, BOWL_RIM + .023, .024, (0, y_c), .01, .006), 'ceramica', 'x', 0)
    for sx in (-1, 1):
        hinge = geo.lathe([(0, -.016), (.009, -.016), (.009, .016), (0, .016)], 12)
        geo.transform(hinge, rot=(0, math.pi / 2, 0))
        piece.add(geo.transform(hinge, loc=(sx * .07, y_c + lid_back + .004, BOWL_RIM + .016)), 'griferia', 'x', 0)


def toilet(piece, spec):
    """Inodoro con tapa amortiguada: a suelo con cisterna vista, compacto «back to wall» o suspendido con pulsador."""
    w, d, _h = dims(spec)
    style = spec['params']['style']
    body = {'cisterna': 'pie', 'compacto': 'faldon', 'suspendido': 'colgado'}[style]
    a = w / 2
    mesh, y_c, kb, kf = _bowl_body(d, body, a)
    piece.add(mesh, 'ceramica', 'x', 0)
    if style == 'suspendido':
        _seat_and_lid(piece, y_c, kb, kf, kb - .075, a)
        piece.add(grifo.flush_plate(0, d / 2, 1.0), 'griferia', 'x', 0)
        return
    tank_d, tank_h = .175, .37
    tank_w = w if style == 'compacto' else w + .02
    tank_y = d / 2 - tank_d / 2 - (.0 if style == 'compacto' else .005)
    _seat_and_lid(piece, y_c, kb, kf, (tank_y - tank_d / 2) - y_c - .02, a)
    piece.add(geo.soft_box(tank_w, tank_d, tank_h, (.03, .03, .03), (.002, .004, 0), at=(0, tank_y, BOWL_RIM - .005),
                           density=.03), 'ceramica', 'x', 0)
    piece.add(geo.soft_box(tank_w + .006, tank_d + .006, .026, (.012, .012, .01), at=(0, tank_y, BOWL_RIM - .005 + tank_h - .004),
                           density=.03), 'ceramica', 'x', 0)
    piece.add(grifo.push_button(0, tank_y, BOWL_RIM - .005 + tank_h + .02), 'griferia', 'x', 0)


def bidet(piece, spec):
    """Bidé a suelo (faldón contra la pared) o suspendido, con seno abierto y monomando sobre la repisa trasera."""
    w, d, _h = dims(spec)
    style = spec['params']['style']
    mesh, y_c, kb, _kf = _bowl_body(d, 'colgado' if style == 'suspendido' else 'faldon', w / 2, open_bowl=True)
    piece.add(mesh, 'ceramica', 'x', 0)
    piece.add(grifo.basin_mixer(0, y_c + kb - .055, BOWL_RIM, height=.11, reach=.08), 'griferia', 'x', 0)
    piece.add(geo.lathe([(0, 0), (.02, 0), (.02, .003), (0, .003)], 16, at=(0, y_c - .015, BOWL_RIM - .123)), 'griferia', 'x', 0)
