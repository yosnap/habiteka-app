"""Duchas y bañeras de la familia baño: platos extraplanos de resina, mamparas (walk-in fija, frontal corredera y
angular), columnas o rociador de techo, y bañeras empotrada, exenta, de esquina y de hidromasaje.

Metros; frente hacia -Y; pared trasera en +Y. Las mamparas frontales y angulares suponen la pared lateral en -X.
Huecos: «plato», «cristal», «perfil», «griferia», «acrilico».
"""
import math

import hk_geo as geo

import fam_bano_formas as formas
import fam_bano_griferia as grifo

TRAY = .03           # plato extraplano de 3 cm
GLASS_TOP = 1.98     # canto superior del cristal sobre el suelo
GLASS = .008         # vidrio templado de 8 mm


def dims(spec):
    return tuple(value / 1000 for value in spec['dims'])


def _tray(piece, w, d, drain):
    """Plato de resina con textura pizarra y válvula cuadrada enrasada: tapa del mismo acabado y marco cromado."""
    piece.add(geo.box(w, d, TRAY, .004, 3), 'plato', 'x', 30)
    x, y = drain
    # Rejilla enrasada: asoma 0,4 mm (marco) y 0,2 mm (tapa) para no coincidir con la cara del plato.
    frame = [geo.box(.14, .006, .002, .0005, 1, at=(x, y + sy * .067, TRAY - .0016)) for sy in (-1, 1)]
    frame += [geo.box(.006, .128, .002, .0005, 1, at=(x + sx * .067, y, TRAY - .0016)) for sx in (-1, 1)]
    piece.add(geo.merge(frame), 'griferia', 'x', 0)
    piece.add(geo.box(.124, .124, .0028, .0005, 1, at=(x, y, TRAY - .0026)), 'plato', 'x', 30)


def _drain(w, d):
    return (0.0, 0.0) if abs(w - d) < .05 else (w / 2 - .2, 0.0)


def shower_tray(piece, spec):
    """Plato de ducha extraplano de resina (sin mampara)."""
    w, d, _h = dims(spec)
    _tray(piece, w, d, _drain(w, d))


def _glass(piece, x0, x1, y, z0=TRAY + .006, z1=GLASS_TOP, along='x'):
    """Hoja de vidrio de 8 mm entre x0 y x1 (o entre y0 = x0 e y1 = x1 si along = 'y')."""
    length = abs(x1 - x0)
    mid = (x0 + x1) / 2
    if along == 'x':
        pane = geo.box(length, GLASS, z1 - z0, .002, 1, at=(mid, y, z0))
    else:
        pane = geo.box(GLASS, length, z1 - z0, .002, 1, at=(y, mid, z0))
    piece.add(pane, 'cristal', 'x', 30)


def _wall_profile(piece, x, y, along='x', z0=TRAY, z1=GLASS_TOP):
    """Perfil en U de pared que recibe el vidrio."""
    w, d = (.03, .022) if along == 'x' else (.022, .03)
    piece.add(geo.box(w, d, z1 - z0 + .004, .002, 1, at=(x, y, z0)), 'perfil', 'z')


def _bar(piece, a, b, r=.0095):
    piece.add(geo.tube([a, b], r, 14, round_ends=.004), 'perfil', 'x', 0)


def _door_handle(piece, x, y, along='x', length=.32, z=1.05):
    """Tirador vertical pasante a ambos lados del vidrio."""
    parts = []
    for side in (-1, 1):
        if along == 'x':
            off = (0, side * .03, 0)
            parts.append(geo.tube([(x, y + off[1], z - length / 2), (x, y + off[1], z + length / 2)], .009, 14, round_ends=.005))
            parts += [geo.tube([(x, y, z + s * (length / 2 - .03)), (x, y + off[1], z + s * (length / 2 - .03))], .006, 10)
                      for s in (-1, 1)]
        else:
            off = (side * .03, 0, 0)
            parts.append(geo.tube([(x + off[0], y, z - length / 2), (x + off[0], y, z + length / 2)], .009, 14, round_ends=.005))
            parts += [geo.tube([(x, y, z + s * (length / 2 - .03)), (x + off[0], y, z + s * (length / 2 - .03))], .006, 10)
                      for s in (-1, 1)]
    piece.add(geo.merge(parts), 'perfil', 'z', 0)


def _rollers(piece, x0, x1, y, z, along='x'):
    for t in (.12, .88):
        c = x0 + (x1 - x0) * t
        wheel = geo.lathe([(0, -.008), (.018, -.008), (.02, 0), (.018, .008), (0, .008)], 18)
        if along == 'x':
            geo.transform(wheel, rot=(math.pi / 2, 0, 0), loc=(c, y, z))
            plate = geo.box(.03, .004, .05, .001, 1, at=(c, y + .006, z - .045))
        else:
            geo.transform(wheel, rot=(0, math.pi / 2, 0), loc=(y, c, z))
            plate = geo.box(.004, .03, .05, .001, 1, at=(y + .006, c, z - .045))
        piece.add(geo.merge([wheel, plate]), 'perfil', 'x', 0)


def _screen_walk_in(piece, w, d):
    length = min(w - .45, max(.7, w * .6))
    y = -d / 2 + .05
    _glass(piece, -w / 2 + .012, -w / 2 + length, y)
    _wall_profile(piece, -w / 2 + .015, y)
    piece.add(geo.box(length - .01, .024, .025, .002, 1, at=(-w / 2 + length / 2 + .006, y, TRAY)), 'perfil', 'x')
    bx = -w / 2 + length - .12
    _bar(piece, (bx, y + .006, GLASS_TOP - .06), (bx, d / 2 - .004, GLASS_TOP - .06))
    piece.add(geo.box(.03, .024, .04, .003, 1, at=(bx, y, GLASS_TOP - .08)), 'perfil', 'x', 0)
    piece.add(grifo._wall_disc(bx, d / 2, GLASS_TOP - .06, .02), 'perfil', 'x', 0)
    return -w / 2 + length / 2


def _screen_sliding(piece, w, d):
    y_fixed, y_door = -d / 2 + .07, -d / 2 + .047
    _glass(piece, -w / 2 + .014, .03, y_fixed)
    _glass(piece, -.05, w / 2 - .01, y_door, z1=GLASS_TOP - .03)
    for sx in (-1, 1):
        _wall_profile(piece, sx * (w / 2 - .015), y_fixed)
    rail_z = GLASS_TOP + .01
    _bar(piece, (-w / 2 + .004, y_door - .012, rail_z), (w / 2 - .004, y_door - .012, rail_z), .012)
    for sx in (-1, 1):
        disc = geo.lathe([(0, 0), (.025, 0), (.025, .01), (0, .012)], 20)
        geo.transform(disc, rot=(0, sx * -math.pi / 2, 0), loc=(sx * w / 2, y_door - .012, rail_z))
        piece.add(disc, 'perfil', 'x', 0)
    _rollers(piece, -.05, w / 2 - .01, y_door - .006, rail_z - .016)
    piece.add(geo.box(w / 2 + .04, .02, .012, .002, 1, at=(w / 4 - .02, y_fixed - .012, TRAY)), 'perfil', 'x')
    _door_handle(piece, -.05 + .08, y_door)
    return 0.0


def _screen_corner(piece, w, d):
    y_front, x_side = -d / 2 + .058, w / 2 - .058
    # Lado frontal: fija contra la pared izquierda y hoja corredera por fuera hasta la esquina.
    _glass(piece, -w / 2 + .014, -w / 2 + w * .52, y_front)
    _glass(piece, -w / 2 + w * .44, x_side + .012, y_front - .022, z1=GLASS_TOP - .03)
    # Lado derecho: fija contra la pared trasera y hoja corredera por fuera hasta la esquina.
    _glass(piece, d / 2 - .014, d / 2 - d * .52, x_side, along='y')
    _glass(piece, d / 2 - d * .44, y_front - .012, x_side + .022, z1=GLASS_TOP - .03, along='y')
    _wall_profile(piece, -w / 2 + .015, y_front)
    _wall_profile(piece, x_side, d / 2 - .015, along='y')
    rail_z = GLASS_TOP + .01
    corner = (x_side + .034, y_front - .034, rail_z)
    _bar(piece, (-w / 2 + .004, y_front - .034, rail_z), corner, .011)
    _bar(piece, (x_side + .034, d / 2 - .004, rail_z), corner, .011)
    piece.add(geo.box(.036, .036, .03, .006, 2, at=(corner[0], corner[1], rail_z - .015)), 'perfil', 'x', 0)
    _rollers(piece, -w / 2 + w * .44, x_side, y_front - .028, rail_z - .016)
    _rollers(piece, d / 2 - d * .44, y_front, x_side + .028, rail_z - .016, along='y')
    _door_handle(piece, x_side - .09, y_front - .022)
    _door_handle(piece, x_side + .022, y_front + .09, along='y')
    return -w / 2 + w * .45


def shower(piece, spec):
    """Plato de ducha con mampara (walk-in fija, frontal corredera o angular) y columna termostática o rociador de
    techo con termostática empotrada."""
    w, d, _h = dims(spec)
    p = spec['params']
    drain = _drain(w, d)
    if p['screen'] == 'walk_in':
        drain = (w / 2 - .25, 0.0)
    _tray(piece, w, d, drain)
    x = {'walk_in': _screen_walk_in, 'corredera': _screen_sliding, 'angular': _screen_corner}[p['screen']](piece, w, d)
    if p.get('shower', 'columna') == 'techo':
        piece.add(grifo.ceiling_shower(x, 0.0, d / 2, hand_x=x + .3), 'griferia', 'x', 0)
    else:
        piece.add(grifo.shower_column(x, d / 2, square=p.get('head') == 'cuadrado'), 'griferia', 'x', 0)


# --- Bañeras --------------------------------------------------------------------------------------------------------

TUB_WALL = ((.35, .995), (.6, .98), (.78, .93), (.88, .8), (.94, .6), (.975, .35), (1.0, 0.0))


def _tub_h(spec):
    return spec['params'].get('tub_h', 560) / 1000


def _built_in_tub(piece, w, d, h, depth=.42, slot='acrilico'):
    """Bañera de obra con faldón: losa hasta el suelo con un seno de respaldo inclinado hacia -X."""
    center = (.02, -.005)
    pts = formas.rect_points(-w / 2, w / 2, -d / 2, d / 2, .012, 4)
    outer = lambda delta: formas.polygon(formas.rect_points(-w / 2 + delta, w / 2 - delta, -d / 2 + delta, d / 2 - delta,  # noqa: E731
                                                            max(.012 - delta, .001), 4), center)
    thetas = formas.angles(112, pts, center)
    a, b = w / 2 - .09, d / 2 - .075
    bowl = formas.superellipse(a, b, 5.5)
    piece.add(formas.basin_slab(outer, bowl, center, h, h, depth, thetas, edge=.01, rim=.014, bowl_wall=TUB_WALL), slot, 'x', 0)
    drain_x = center[0] + a * .62
    piece.add(geo.lathe([(0, 0), (.035, 0), (.036, .003), (0, .004)], 24, at=(drain_x, center[1], h - .014 - depth - .001)),
              'griferia', 'x', 0)
    overflow = geo.lathe([(0, 0), (.03, 0), (.03, .006), (0, .008)], 20)
    geo.transform(overflow, rot=(0, -math.pi / 2, 0), loc=(center[0] + a * .973, center[1], h - .014 - depth * .3))
    piece.add(overflow, 'griferia', 'x', 0)
    return center, a, b, drain_x


def bath_built_in(piece, spec):
    """Bañera empotrada de faldón (o de hidromasaje) con grifo de pared y teleducha, o con grifo de repisa
    (params.faucet = 'repisa', como en la de hidromasaje)."""
    w, d, _h = dims(spec)
    h = _tub_h(spec)
    p = spec['params']
    depth = .42
    center, a, b, drain_x = _built_in_tub(piece, w, d, h, depth)
    deck = p.get('jets') or p.get('faucet') == 'repisa'
    if p.get('jets'):
        points = []
        bowl = formas.superellipse(a, b, 5.5)
        z = h - .014 - depth * .45
        for theta in (math.radians(v) for v in (60, 120, 240, 300, 0, 180)):
            r = bowl(theta) * .955
            pos = (center[0] + math.cos(theta) * r, center[1] + math.sin(theta) * r, z)
            points.append((pos, (-math.cos(theta), -math.sin(theta), 0)))
        piece.add(grifo.jets(points), 'griferia', 'x', 0)
        for k in range(3):
            piece.add(geo.lathe([(0, 0), (.016, 0), (.016, .004), (0, .005)], 16, at=(-w / 2 + .05, -d / 2 + .25 + k * .05, h)),
                      'griferia', 'x', 0)
    if deck:
        piece.add(grifo.deck_bath_mixer(drain_x, d / 2 - .065, h, 0), 'griferia', 'x', 0)
        return
    piece.add(grifo.wall_bath_mixer(drain_x, d / 2, h + .2, hand_x=drain_x - .4, hand_z=h + .62), 'griferia', 'x', 0)


def bath_freestanding(piece, spec):
    """Bañera exenta ovalada de pared doble con zócalo retranqueado y grifo de pie detrás."""
    w, _d, _h = dims(spec)
    p = spec['params']
    h = _tub_h(spec)
    tub_d = p['tub_depth'] / 1000
    a, b = w / 2, tub_d / 2
    shape = formas.superellipse(a, b, 2.3)
    thetas = formas.angles(112)
    rings = [(0, 0, 0), formas.ring(shape, thetas, 0, (0, 0), .78), formas.ring(shape, thetas, .03, (0, 0), .785)]
    rings.append(formas.ring(shape, thetas, .035, (0, 0), .8))
    for t in (.12, .3, .5, .7, .86, .96):
        rings.append(formas.ring(shape, thetas, .035 + (h - .045) * t, (0, 0), .8 + .2 * (1 - (1 - t) ** 1.8)))
    rings += [formas.ring(shape, thetas, h - .008, (0, 0), 1.0), formas.ring(shape, thetas, h, (0, 0), 1.0, -.008),
              formas.ring(shape, thetas, h, (0, 0), 1.0, -.016), formas.ring(shape, thetas, h - .008, (0, 0), 1.0, -.024)]
    for t, s in ((.9, .965), (.7, .93), (.5, .88), (.3, .8), (.15, .7), (.06, .56)):
        rings.append(formas.ring(shape, thetas, .14 + (h - .16) * t, (.04, 0), s, -.024))
    rings += [formas.ring(shape, thetas, .135, (.04, 0), .4), (.04, 0, .13)]
    piece.add(formas.loft(rings), 'acrilico', 'x', 0)
    piece.add(geo.lathe([(0, 0), (.035, 0), (.036, .003), (0, .004)], 24, at=(.04, 0, .131)), 'griferia', 'x', 0)
    piece.add(grifo.floor_bath_faucet(0, b + .1, height=h + .32, reach=.26), 'griferia', 'x', 0)


def bath_corner(piece, spec):
    """Bañera de esquina simétrica con faldón curvo, seno oval en diagonal y grifo de repisa en la esquina."""
    w, d, _h = dims(spec)
    h = _tub_h(spec)
    radius = w * 1.06
    cx, cy = -w / 2, d / 2

    def poly(delta):
        """Contorno retranqueado delta: paredes trasera e izquierda, retornos rectos y frente en arco desde la esquina."""
        r = radius - delta
        s = math.atan2(-(d - delta), math.sqrt(r ** 2 - (d - delta) ** 2))
        e = math.atan2(-math.sqrt(r ** 2 - (w - delta) ** 2), w - delta)
        curve = [(cx + r * math.cos(s + (e - s) * k / 20), cy + r * math.sin(s + (e - s) * k / 20)) for k in range(21)]
        return [(cx + delta, cy - delta), (cx + delta, -d / 2 + delta)] + curve + [(w / 2 - delta, cy - delta)]

    diag = math.radians(-45)
    along = .86
    center = (cx + along * math.cos(diag), cy + along * math.sin(diag))
    outer = lambda delta: formas.polygon(poly(delta), center)  # noqa: E731
    thetas = formas.angles(112, poly(0.0), center)
    bowl = formas.superellipse(.52, .4, 2.4, rot=diag)
    depth = .42
    piece.add(formas.basin_slab(outer, bowl, center, h, h, depth, thetas, edge=.01, rim=.014, bowl_wall=TUB_WALL), 'acrilico', 'x', 0)
    piece.add(geo.lathe([(0, 0), (.035, 0), (.036, .003), (0, .004)], 24, at=(center[0], center[1], h - .014 - depth - .001)),
              'griferia', 'x', 0)
    piece.add(grifo.basin_mixer(cx + .15, cy - .15, h, height=.2, reach=.16, rot=math.radians(45)), 'griferia', 'x', 0)
