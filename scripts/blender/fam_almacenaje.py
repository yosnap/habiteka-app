"""Familia de almacenaje: armarios, cómodas, sinfonieres, mesillas, muebles de TV, aparadores, librerías, estanterías,
zapateros, consolas y muebles de recibidor (metros; frente hacia -Y; pared detrás en +Y).

Casi todo se construye con el cuerpo común de fam_almacenaje_cuerpo (declarado en FAMILY.dependsOn de
families/almacenaje.mjs para que la huella del generador lo incluya); aquí quedan las piezas que no son un cuerpo con
frentes: armario de puertas correderas, vitrina de metal y vidrio, estantería escalera, estantes de pared, consolas,
percheros, banco zapatero y composición de salón.
"""
import math

import hk_geo as geo
import hk_parts as parts
import fam_almacenaje_cuerpo as cw


def _dims(spec):
    return tuple(value / 1000 for value in spec['dims'])


def casework(piece, spec):
    """Cualquier cuerpo con cajones, puertas y huecos (ver los parámetros en fam_almacenaje_cuerpo)."""
    w, d, h = _dims(spec)
    cw.emit(piece, cw.casework(w, d, h, spec['params']))


def wardrobe_sliding(piece, spec):
    """Armario de puertas correderas: cuerpo con zócalo, dos guías de aluminio y hojas con perfiles tirador.

    params.sections: tramos de cada hoja de arriba abajo [[estilo, peso], ...] (liso, espejo, marco…) separados por
    junquillos de aluminio; params.panels: número de hojas (2 o 3).
    """
    w, d, h = _dims(spec)
    p = spec['params']
    t, n, base_h = .018, p.get('panels', 2), p.get('base_h', 60) / 1000
    sections = p.get('sections', [['liso', 1]])
    items = []

    def add(bm, name, grain='z', sharp=35):
        items.append((bm, name, grain, sharp))

    for sx in (-1, 1):
        add(cw.board(t, d, h, sx * (w / 2 - t / 2), 0, 0), 'cuerpo', 'z')
    wi = w - 2 * t
    add(cw.board(wi, d, t, 0, 0, h - t), 'cuerpo', 'x')
    add(cw.board(wi, d - .07, t, 0, .035, base_h), 'cuerpo', 'x')
    add(cw.board(wi, .008, h - base_h - 2 * t, 0, d / 2 - .004, base_h + t), 'fondo', 'z')
    add(cw.board(wi - .02, d - .12, base_h, 0, .05, 0), 'zocalo', 'x')
    # Guías: superior (oculta la parte alta de las hojas) e inferior, sobre el suelo del cuerpo.
    add(cw.board(wi, .062, .032, 0, -d / 2 + .036, h - t - .032), 'perfil', 'x')
    add(cw.board(wi, .062, .012, 0, -d / 2 + .036, base_h), 'perfil', 'x')
    z0, z1 = base_h + .014, h - t - .03
    overlap = .04
    pw = (wi + (n - 1) * overlap) / n
    weights = [weight for _, weight in sections]
    for i in range(n):
        x0 = -wi / 2 + i * (pw - overlap)
        x1 = x0 + pw
        yf = -d / 2 + .006 + (i % 2) * .028
        zs = cw.cuts(z1, z0, weights)
        for k, (style, _weight) in enumerate(sections):
            top, bottom = zs[k] - (.003 if k else 0), zs[k + 1] + (.003 if k < len(sections) - 1 else 0)
            items += cw.front(style, x0 + .012, x1 - .012, bottom, top, yf + .002, .016, 'z')
            if k:
                add(cw.board(pw - .024, .02, .006, (x0 + x1) / 2, yf + .01, zs[k] - .003, .001), 'perfil', 'x')
        for x in (x0 + .006, x1 - .006):
            add(cw.board(.012, .026, z1 - z0, x, yf + .01, z0, .002), 'perfil', 'z')
    cw.emit(piece, items)


def glass_cabinet(piece, spec):
    """Vitrina industrial: bastidor de tubo cuadrado, costados, trasera y dos puertas de vidrio y baldas de vidrio."""
    w, d, h = _dims(spec)
    knob = .026
    d -= knob
    s, zb = .02, .1
    items = []

    def add(bm, name, grain='z', sharp=35):
        items.append((bm, name, grain, sharp))

    for sx in (-1, 1):
        for sy in (-1, 1):
            add(cw.board(s, s, h, sx * (w / 2 - s / 2), sy * (d / 2 - s / 2), 0, .002), 'estructura', 'z')
    for z in (zb, h - s):
        for sy in (-1, 1):
            add(cw.board(w - 2 * s, s, s, 0, sy * (d / 2 - s / 2), z, .002), 'estructura', 'x')
        for sx in (-1, 1):
            add(cw.board(s, d - 2 * s, s, sx * (w / 2 - s / 2), 0, z, .002), 'estructura', 'y')
    add(cw.board(w - 2 * s, d - 2 * s, .004, 0, 0, zb + s - .004, .001), 'estructura', 'x')
    add(cw.board(w - 2 * s, d - 2 * s, .004, 0, 0, h - s, .001), 'estructura', 'x')
    span = h - s - (zb + s)
    for sx in (-1, 1):
        add(cw.board(.005, d - 2 * s, span, sx * (w / 2 - s / 2), 0, zb + s, .001), 'vidrio', 'z')
    add(cw.board(w - 2 * s, .005, span, 0, d / 2 - s / 2, zb + s, .001), 'vidrio', 'z')
    for k in (1, 2, 3):
        add(cw.board(w - 2 * s - .004, d - 2 * s - .01, .006, 0, .004, zb + s + span * k / 4, .001), 'vidrio', 'x')
    # Puertas: marco de pletina con vidrio, pomo en el encuentro.
    f, yf = .015, -d / 2 - .002
    for sx in (-1, 1):
        x_in, x_out = sx * .0015, sx * (w / 2 - s)
        x0, x1 = min(x_in, x_out), max(x_in, x_out)
        for x in (x0 + f / 2, x1 - f / 2):
            add(cw.board(f, .012, span, x, yf + .006, zb + s, .0015), 'estructura', 'z')
        for z in (zb + s, h - s - f):
            add(cw.board(x1 - x0 - 2 * f, .012, f, (x0 + x1) / 2, yf + .006, z, .0015), 'estructura', 'x')
        add(cw.board(x1 - x0 - 2 * f + .004, .004, span - 2 * f + .004, (x0 + x1) / 2, yf + .006, zb + s + f - .002, .0008), 'vidrio', 'z')
        bm = geo.lathe([(0, 0), (.004, 0), (.004, .012), (.009, .018), (.009, .022), (0, .024)], 16)
        geo.transform(bm, rot=(math.pi / 2, 0, 0))
        add(geo.transform(bm, loc=(sx * .03, yf, zb + s + span * .55)), 'estructura', 'z', 50)
    cw.emit(piece, items, loc=(0, knob / 2, 0))


def ladder_shelf(piece, spec):
    """Estantería escalera apoyada en la pared: largueros inclinados y verticales y baldas de fondo decreciente."""
    w, d, h = _dims(spec)
    n = spec['params'].get('shelves', 5)
    rail = geo.rounded_rect(.022, .04, .004, 2)
    y_front0, y_front1, y_back = -d / 2 + .02, d / 2 - .06, d / 2 - .02
    items = []
    for sx in (-1, 1):
        x = sx * (w / 2 - .011)
        items.append((geo.sweep([(x, y_front0, 0), (x, y_front1, h)], rail), 'cuerpo', 'z', 35))
        items.append((cw.board(.022, .03, h - .03, x, y_back, 0, .003), 'cuerpo', 'z', 35))
    for k in range(n):
        z = .14 + (h - .3) * k / max(1, n - 1)
        yf = y_front0 + (y_front1 - y_front0) * (z + .02) / h
        items.append((cw.board(w - .044, y_back - yf - .01, .02, 0, (yf + y_back) / 2 - .005, z, .002), 'cuerpo', 'x', 35))
    cw.emit(piece, items)


def wall_shelf(piece, spec):
    """Estante de pared flotante o sobre escuadras metálicas, colgado a params.elev mm (hueco inferior)."""
    w, d, h = _dims(spec)
    p = spec['params']
    z0 = p['elev'] / 1000
    if p.get('style', 'flotante') == 'flotante':
        cw.emit(piece, [(cw.board(w, d, h, 0, 0, z0, .002), 'cuerpo', 'x', 35)])
        return
    th = .025
    items = [(cw.board(w, d, th, 0, 0, z0 + h - th, .002), 'cuerpo', 'x', 35)]
    for sx in (-1, 1):
        x = sx * (w / 2 - .16)
        items.append((cw.board(.03, .005, h - th, x, d / 2 - .0025, z0, .001), 'estructura', 'z', 35))
        items.append((cw.board(.03, d - .03, .005, x, .015, z0 + h - th - .005, .001), 'estructura', 'y', 35))
        brace = geo.sweep([(x, d / 2 - .006, z0 + .03), (x, -d / 2 + .09, z0 + h - th - .006)], geo.rounded_rect(.02, .005, .001, 1))
        items.append((brace, 'estructura', 'z', 35))
    cw.emit(piece, items)


def console(piece, spec):
    """Consola de recibidor: nórdica (cajones, patas cónicas y balda), de metal y mármol, o clásica estrecha."""
    w, d, h = _dims(spec)
    style = spec['params']['style']
    items = []

    def add(bm, name, grain='x', sharp=35):
        items.append((bm, name, grain, sharp))

    if style == 'nordica':
        top, apron = .025, .13
        add(cw.board(w, d, top, 0, 0, h - top, .003), 'sobre')
        z_ap = h - top - apron
        inset = .075
        for sx in (-1, 1):
            add(cw.board(.018, d - .07, apron, sx * (w / 2 - inset), .01, z_ap), 'cuerpo', 'z')
        add(cw.board(w - 2 * inset, .018, apron, 0, d / 2 - .045, z_ap), 'cuerpo')
        add(cw.board(w - 2 * inset - .018, d - .09, .016, 0, .01, z_ap), 'cuerpo')
        yf = -d / 2 + .03
        mid = 0.0
        for x0, x1 in ((-w / 2 + inset - .009, mid - .0015), (mid + .0015, w / 2 - inset + .009)):
            items += cw.front('liso', x0, x1, z_ap + .004, h - top - .004, yf, .018, 'x')
            items.append((cw.knob((x0 + x1) / 2, yf, z_ap + apron / 2, .013), 'tirador', 'z', 50))
        for sx in (-1, 1):
            for sy in (-1, 1):
                items.append((parts.leg('conica', z_ap, sx * (w / 2 - inset), sy * (d / 2 - .07), sx, sy, 1.15, splay=3),
                              'patas', 'z', 35))
        add(cw.board(w - 2 * inset, d - .14, .02, 0, 0, .2), 'sobre')
    elif style == 'metal_marmol':
        top = .02
        add(cw.board(w, d, top, 0, 0, h - top, .003), 'sobre')
        frame = geo.rounded_rect(.02, .02, .002, 1)
        for sx in (-1, 1):
            x = sx * (w / 2 - .04)
            loop = [(x, -d / 2 + .03, .01), (x, d / 2 - .03, .01), (x, d / 2 - .03, h - top - .01), (x, -d / 2 + .03, h - top - .01)]
            add(geo.sweep(geo.fillet(loop, .004, 2, closed=True), frame, closed=True), 'estructura', 'z')
        for sy in (-1, 1):
            add(cw.board(w - .1, .02, .02, 0, sy * (d / 2 - .04), h - top - .02, .002), 'estructura')
        add(cw.board(w - .1, d - .06, .006, 0, 0, .16, .001), 'estructura')
    elif style == 'clasica':
        top, apron = .024, .1
        add(cw.board(w, d, top, 0, 0, h - top, .006), 'sobre')
        add(cw.board(w - .02, d - .02, .012, 0, 0, h - top - .012, .002), 'sobre')
        z_ap = h - top - .012 - apron
        for sx in (-1, 1):
            add(cw.board(.018, d - .06, apron, sx * (w / 2 - .04), 0, z_ap), 'cuerpo', 'z')
        add(cw.board(w - .08, .018, apron, 0, d / 2 - .04, z_ap), 'cuerpo')
        yf = -d / 2 + .032
        for x0, x1 in ((-w / 2 + .031, -w / 2 + .12), (w / 2 - .12, w / 2 - .031)):
            add(cw.board(x1 - x0, .018, apron, (x0 + x1) / 2, yf + .009, z_ap), 'frente')
        items += cw.front('liso', -w / 2 + .1215, w / 2 - .1215, z_ap + .006, z_ap + apron - .006, yf - .002, .02, 'x')
        items.append((cw.knob(0, yf - .002, z_ap + apron / 2, .012), 'tirador', 'z', 50))
        for sx in (-1, 1):
            for sy in (-1, 1):
                items.append((parts.leg('torneada', z_ap, sx * (w / 2 - .04), sy * (d / 2 - .035), size=.9), 'patas', 'z', 35))
        add(cw.board(w - .1, .02, .03, 0, d / 2 - .035, .14), 'patas')
        for sx in (-1, 1):
            add(cw.board(.02, d - .09, .03, sx * (w / 2 - .04), 0, .14), 'patas', 'y')
    else:
        raise ValueError(f'Consola desconocida: {style}')
    cw.emit(piece, items)


def coat_stand(piece, spec):
    """Perchero de pie: mástil torneado, cuatro patas abiertas en cruz y colgadores con bola a dos alturas."""
    w, _d, h = _dims(spec)
    junction, r_tube = .45, .014
    items = [(geo.lathe([(.017, junction - .05), (.019, junction), (.018, h - .07), (.022, h - .04), (.024, h - .02),
                         (.014, h - .003), (0, h)], 16), 'cuerpo', 'z', 40)]
    reach = (w / 2 - r_tube) * math.sqrt(2)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        top = (.014 * math.cos(a), .014 * math.sin(a), junction)
        foot = (reach * math.cos(a), reach * math.sin(a), .008)
        items.append((geo.tube([top, foot], r_tube, 10, round_ends=.004), 'cuerpo', 'z', 40))
    for k in range(8):
        a = math.radians(22.5 * (1 if k % 2 else 0) + 45 * k)
        z = h - .12 - (.17 if k % 2 else 0)
        root = (.016 * math.cos(a), .016 * math.sin(a), z)
        tip = (.13 * math.cos(a), .13 * math.sin(a), z + .08)
        items.append((geo.tube([root, tip], .009, 8), 'cuerpo', 'z', 40))
        items.append((geo.sphere(.016, at=tip, segments=10), 'cuerpo', 'z', 40))
    cw.emit(piece, items)


def coat_rack_wall(piece, spec):
    """Perchero de pared: estante sobre un listón con ganchos metálicos y escuadras, colgado a params.elev mm."""
    w, d, h = _dims(spec)
    z0 = spec['params']['elev'] / 1000
    th, rail = .022, .16
    z_rail = z0 + h - th - rail
    yb = d / 2 - .02
    items = [(cw.board(w, .02, rail, 0, d / 2 - .01, z_rail, .002), 'cuerpo', 'x', 35),
             (cw.board(w, d, th, 0, 0, z0 + h - th, .002), 'cuerpo', 'x', 35)]
    count = max(3, round(w / .16))
    for k in range(count):
        x = -w / 2 + w * (k + .5) / count
        hook = geo.fillet([(x, yb, z_rail + .05), (x, yb - .045, z0 - .008), (x, yb - .085, z0 + .05)], .03, 5)
        items.append((geo.tube(hook, .006, 8, round_ends=.005), 'estructura', 'y', 40))
    for sx in (-1, 1):
        x = sx * (w / 2 - .12)
        items.append((geo.sweep([(x, yb, z_rail + .03), (x, -d / 2 + .08, z0 + h - th - .002)],
                                geo.rounded_rect(.025, .004, .001, 1)), 'estructura', 'z', 35))
    cw.emit(piece, items)


def shoe_bench(piece, spec):
    """Banco zapatero: costados y tablero de madera, dos baldas de listones y cojín tapizado."""
    w, d, h = _dims(spec)
    cushion, top = .06, .025
    z_top = h - cushion - top
    items = []
    for sx in (-1, 1):
        items.append((cw.board(.03, d, z_top, sx * (w / 2 - .015), 0, 0, .003), 'cuerpo', 'z', 35))
    items.append((cw.board(w, d, top, 0, 0, z_top, .003), 'cuerpo', 'x', 35))
    for z in (.06, .06 + (z_top - .06) / 2):
        slats = 5
        for k in range(slats):
            y = -d / 2 + .03 + (d - .06) * k / (slats - 1)
            items.append((cw.board(w - .06, .045, .018, 0, y, z, .002), 'cuerpo', 'x', 35))
    items.append((geo.soft_box(w - .012, d - .012, cushion - .01, (.025, .025, .022), (.004, .004, .008), wrinkle=.0012,
                               at=(0, 0, h - cushion + .002), density=.035), 'tapiceria', 'x', 0))
    cw.emit(piece, items)


def tv_wall(piece, spec):
    """Composición de salón: dos columnas altas, bajo de TV con abatibles, puente colgado y panel de madera detrás."""
    w, d, h = _dims(spec)
    p = spec['params']
    col_w, low_h, bridge_h, gap = p['column_w'] / 1000, p['low_h'] / 1000, p['bridge_h'] / 1000, .006
    common = {'fronts': 'sobre', 'handle': p.get('handle', 'ninguno'), 'base': 'zocalo', 'base_h': 60}
    for sx in (-1, 1):
        column = cw.casework(col_w, d, h, {**common, 'grid': ['V*2 P*3']})
        cw.emit(piece, column, loc=(sx * (w / 2 - col_w / 2), 0, 0))
    mid = w - 2 * col_w - 2 * gap
    cw.emit(piece, cw.casework(mid, d, low_h, {**common, 'grid': ['B', 'B', 'B']}))
    bridge_d = d - .05
    bridge = cw.casework(mid, bridge_d, bridge_h, {**common, 'base': 'suspendido', 'elev': round((h - bridge_h) * 1000),
                                                    'grid': ['B', 'B', 'B']})
    cw.emit(piece, bridge, loc=(0, d / 2 - bridge_d / 2, 0))
    panel = cw.board(mid, .02, h - bridge_h - low_h, 0, d / 2 - .01, low_h)
    cw.emit(piece, [(panel, 'sobre', 'x', 35)])
    shelf_z = low_h + (h - bridge_h - low_h) * .78
    cw.emit(piece, [(cw.board(mid * .32, .24, .03, mid / 2 - mid * .16 - .04, d / 2 - .02 - .12, shelf_z, .002), 'sobre', 'x', 35)])


BUILDERS = {
    'casework': casework, 'wardrobe_sliding': wardrobe_sliding, 'glass_cabinet': glass_cabinet,
    'ladder_shelf': ladder_shelf, 'wall_shelf': wall_shelf, 'console': console, 'coat_stand': coat_stand,
    'coat_rack_wall': coat_rack_wall, 'shoe_bench': shoe_bench, 'tv_wall': tv_wall,
}
