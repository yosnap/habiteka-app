"""Familia de electrodomésticos de libre instalación (metros; frente hacia -Y; pared detrás en +Y).

Lavadora, secadora y lavasecadora de carga frontal (ojo de buey), lavavajillas, frigorífico combi y americano,
microondas y horno de sobremesa, cafetera espresso, campana decorativa de pared y termo eléctrico. Los aparatos de
encimera se construyen apoyados en z = 0 (el editor los sube al mueble sobre el que se sueltan); los colgados, a su
altura real (params.elev, mm) para que la fábrica derive su cota.
Las piezas comunes están en fam_electrodomesticos_partes (declarado en FAMILY.dependsOn de families/electrodomesticos.mjs).

Huecos: carcasa, frente, panel, aro, vidrio, interior, goma, mandos, pantalla, led, tirador, logo, cajetin, ventana,
filtro, indicador, esfera, frio y calor (los secundarios caen en los de FALLBACK de las partes).
"""
import math

import bmesh

import hk_geo as geo
import fam_electrodomesticos_partes as ap
from fam_electrodomesticos_placa import ceramic_hob


def _dims(spec):
    return tuple(value / 1000 for value in spec['dims'])


def washer(piece, spec):
    """Lavadora, secadora o lavasecadora: cuerpo, encimera, panel de mandos, cajetín o depósito y ojo de buey."""
    w, d, h = _dims(spec)
    p = spec['params']
    kind = p.get('kind', 'lavadora')
    proj, foot, top_th = .05, .012, .014
    y0, yb = -d / 2 + proj, d / 2
    items = [ap.feet([-(w / 2 - .05), w / 2 - .05], [y0 + .05, yb - .05], 0, foot),
             (ap.rbox(w - .004, yb - y0, h - foot - top_th, .006, 3, at=(0, (y0 + yb) / 2, foot)), 'carcasa', 'z', 0),
             (ap.rbox(w, yb - y0 + .004, top_th, .004, 2, at=(0, (y0 - .004 + yb) / 2, h - top_th)), 'carcasa', 'x', 0)]
    pz1 = h - top_th - .006
    pz0 = pz1 - .11
    zc = (pz0 + pz1) / 2
    yp = y0 - .006
    items.append((ap.rbox(w - .012, .008, pz1 - pz0, .003, 2, at=(0, y0 - .002, pz0)), 'panel', 'x', 0))
    drawer_w = .2 if kind == 'secadora' else .17
    dx = -w / 2 + .018 + drawer_w / 2
    items.append((ap.rbox(drawer_w, .008, .084, .004, 2, at=(dx, yp - .003, zc - .042)), 'cajetin', 'x', 0))
    items.append((geo.box(drawer_w * .55, .003, .005, 0, at=(dx, yp - .0075, zc - .036)), 'goma', 'x', 0))
    kx = -w / 2 + .018 + drawer_w + .075
    items += ap.dial(kx, yp, zc, .03)
    items.append((ap.ring(.037, .004, .008, kx, yp, zc, 40, .0015), 'logo', 'x', 40))
    marks = [geo.box(.004, .001, .004, 0, at=(kx + .05 * math.cos(a), yp - .0005, zc + .05 * math.sin(a) - .002))
             for a in (math.radians(-60 + 20 * k) for k in range(13)) if abs(math.cos(a)) > .05 or math.sin(a) > 0]
    items.append((geo.merge(marks), 'goma', 'x', 0))
    disp_x = kx + .055 + .075
    items += ap.display(disp_x, yp, zc + .014, .13, .04, '2:40' if kind == 'secadora' else '1:25')
    for k in range(4):
        items.append((ap.button(disp_x - .045 + k * .03, yp, zc - .028), 'mandos', 'x', 40))
    items.append((ap.button(w / 2 - .035, yp, zc, .011, .006), 'mandos', 'x', 40))
    items.append((ap.logo(-w / 2 + .07, y0, pz0 - .03), 'logo', 'x', 0))
    # Ojo de buey: aro, cristal abombado, junta y tambor visto a través del cristal.
    radius, cz = p.get('door_r', 170) / 1000, p.get('door_z', 420) / 1000
    band = radius * .3
    items.append((ap.ring(radius - band / 2, proj - .004, band, 0, y0, cz, 64, .01), 'aro', 'x', 40))
    glass_r = radius - band * .8
    items.append((ap.axial([(0, .006), (glass_r, .006), (glass_r, .018), (glass_r * .8, .031), (glass_r * .45, .038),
                            (0, .04)], 0, y0, cz, 48), 'vidrio', 'x', 50))
    items.append((ap.ring(glass_r - .012, .008, .024, 0, y0, cz, 48, .004), 'goma', 'x', 40))
    items.append((ap.axial([(0, 0), (glass_r, 0), (glass_r, .002), (0, .002)], 0, y0, cz, 48), 'interior', 'x', 40))
    for k in range(3):
        a = math.radians(90 + 120 * k)
        paddle = geo.box(.022, .01, .05, .004, 2)
        geo.transform(paddle, rot=(0, -a + math.pi / 2, 0))
        items.append((geo.transform(paddle, loc=(.07 * math.cos(a), y0 - .006, cz + .07 * math.sin(a) - .025)), 'interior', 'x', 40))
    items.append((ap.rbox(.026, .03, .075, .008, 2, at=(radius - band * .35, y0 - (proj - .004) / 2 - .002, cz - .0375)), 'aro', 'x', 0))
    if kind == 'secadora':
        items.append((ap.rbox(w - .06, .004, .1, .003, 2, at=(0, y0 - .001, foot + .02)), 'carcasa', 'x', 0))
        items.append(ap.vents(w / 2 - .2, w / 2 - .06, foot + .04, foot + .1, y0 - .003, 5))
    else:
        items.append((ap.rbox(.13, .004, .075, .003, 2, at=(-w / 2 + .1, y0 - .001, foot + .025)), 'carcasa', 'x', 0))
    ap.emit(piece, items)


def dishwasher(piece, spec):
    """Lavavajillas: puerta entera con banda de mandos, tirador de barra, zócalo rehundido y encimera."""
    w, d, h = _dims(spec)
    proj, door_th, kick, top_th = .03, .022, .09, .014
    yf, yb = -d / 2 + proj, d / 2
    y_body = yf + door_th + .002
    items = [(ap.rbox(w - .004, yb - y_body, h - top_th, .004, 2, at=(0, (y_body + yb) / 2, 0)), 'carcasa', 'z', 0),
             (ap.rbox(w, yb - yf + .004, top_th, .004, 2, at=(0, (yf - .004 + yb) / 2, h - top_th)), 'carcasa', 'x', 0),
             (ap.rbox(w - .03, .012, kick - .014, .002, 1, at=(0, y_body - .004, .008)), 'goma', 'x', 0)]
    zd0, zd1 = kick, h - top_th - .005
    items.append((ap.rbox(w - .006, door_th, zd1 - zd0, .005, 3, at=(0, yf + door_th / 2, zd0)), 'frente', 'z', 0))
    band0, band1 = zd1 - .075, zd1 - .012
    items.append((ap.rbox(w - .03, .004, band1 - band0, .002, 1, at=(0, yf - .001, band0)), 'panel', 'x', 0))
    zc = (band0 + band1) / 2
    yp = yf - .003
    for k in range(5):
        items.append((ap.button(-w / 2 + .05 + k * .035, yp, zc, .0065), 'mandos', 'x', 40))
    items += ap.display(w / 2 - .11, yp, zc, .11, .034, '2:45')
    items.append((ap.button(w / 2 - .03, yp, zc, .009, .005), 'mandos', 'x', 40))
    items.append((ap.bar(0, yf, band0 - .03, min(.42, w * .7), 'x', .007, proj - .002), 'tirador', 'x', 50))
    items.append((ap.logo(-w / 2 + .07, yf, band0 - .07), 'logo', 'x', 0))
    ap.emit(piece, items)


def _fridge_body(w, d, h, proj, door_d, kick):
    """Cuerpo, patas, zócalo con rejilla y junta de un frigorífico; devuelve (partes, cara de las puertas)."""
    yf, yb = -d / 2 + proj, d / 2
    y_body = yf + door_d + .004
    items = [ap.feet([-(w / 2 - .06), w / 2 - .06], [y_body + .05, yb - .06], 0, .012, .018),
             (ap.rbox(w - .004, yb - y_body, h - .012, .006, 3, at=(0, (y_body + yb) / 2, .012)), 'carcasa', 'z', 0),
             (ap.rbox(w - .03, .006, kick - .022, .002, 1, at=(0, y_body - .003, .016)), 'carcasa', 'x', 0),
             ap.vents(-w / 2 + .05, w / 2 - .05, .024, kick - .012, y_body - .006, 4),
             (geo.box(w - .02, .004, h - kick - .012, 0, at=(0, yf + door_d + .002, kick + .004)), 'goma', 'x', 0)]
    return items, yf


def fridge_combi(piece, spec):
    """Frigorífico combi: dos puertas redondeadas (frigorífico arriba, congelador abajo), tiradores de barra y pantalla."""
    w, d, h = _dims(spec)
    p = spec['params']
    proj, door_d, kick = .045, .065, .07
    items, yf = _fridge_body(w, d, h, proj, door_d, kick)
    split = kick + p.get('freezer_h', 620) / 1000
    for z0, z1 in ((kick, split - .002), (split + .002, h - .004)):
        items.append((ap.rbox(w, door_d, z1 - z0, .014, 4, at=(0, yf + door_d / 2, z0)), 'frente', 'z', 0))
    x = w / 2 - .045
    items.append((ap.bar(x, yf, split + .06 + .22, .44, 'z', .01, proj), 'tirador', 'z', 50))
    items.append((ap.bar(x, yf, split - .06 - .17, .34, 'z', .01, proj), 'tirador', 'z', 50))
    if p.get('display'):
        items += ap.display(-w / 2 + .12, yf, h - .26, .1, .036, '4 -18')
    items.append((ap.logo(0, yf, h - .11), 'logo', 'x', 0))
    ap.emit(piece, items)


def fridge_american(piece, spec):
    """Frigorífico americano: dos puertas verticales, tiradores largos y dispensador de agua y hielo con pantalla."""
    w, d, h = _dims(spec)
    proj, door_d, kick = .05, .07, .08
    items, yf = _fridge_body(w, d, h, proj, door_d, kick)
    for x0, x1 in ((-w / 2, -.002), (.002, w / 2)):
        items.append((ap.rbox(x1 - x0, door_d, h - .004 - kick, .014, 4, at=((x0 + x1) / 2, yf + door_d / 2, kick)), 'frente', 'z', 0))
    for x in (-.045, .045):
        items.append((ap.bar(x, yf, 1.05, 1.0, 'z', .011, proj), 'tirador', 'z', 50))
    cx, z0 = -w / 4 - .02, 1.0
    items.append((ap.rbox(.2, .006, .36, .012, 3, at=(cx, yf - .003, z0)), 'pantalla', 'x', 0))
    items.append((ap.rbox(.15, .006, .2, .01, 3, at=(cx, yf - .006, z0 + .04)), 'interior', 'x', 0))
    items.append((ap.rbox(.06, .02, .1, .008, 2, at=(cx, yf - .016, z0 + .1)), 'goma', 'x', 0))
    items.append((ap.rbox(.15, .03, .012, .004, 2, at=(cx, yf - .02, z0 + .035)), 'aro', 'x', 0))
    items += ap.display(cx, yf - .006, z0 + .31, .16, .036, '3 -18')
    items.append((ap.logo(w / 4, yf, h - .12), 'logo', 'x', 0))
    ap.emit(piece, items)


def _countertop_body(w, d, h, z0, y_front, foot=.01):
    """Cuerpo redondeado de un aparato de encimera con patas, con la cara delantera en y_front."""
    yb = d / 2
    return [ap.feet([-(w / 2 - .04), w / 2 - .04], [y_front + .04, yb - .04], z0, foot, .011),
            (ap.rbox(w, yb - y_front, h - foot, .012, 3, at=(0, (y_front + yb) / 2, z0 + foot)), 'carcasa', 'x', 0)]


def _top_vents(w, d, z, count=8):
    """Ranuras de ventilación en la tapa, junto a la trasera."""
    slots = [geo.box(.006, .07, .001, 0, at=(-w * .3 + k * w * .6 / (count - 1), d / 2 - .07, z - .0009)) for k in range(count)]
    return geo.merge(slots), 'rejilla', 'x', 0


def microwave(piece, spec):
    """Microondas de sobremesa: puerta de cristal con ventana, tirador lateral y panel con pantalla y mandos."""
    w, d, h = _dims(spec)
    p = spec['params']
    z0, foot = p.get('elev', 0) / 1000, .01
    panel_w = .115
    y_face = -d / 2 + .024  # cara de la puerta: los mandos y el tirador salen hasta -d/2
    items = _countertop_body(w, d, h, z0, y_face + .008, foot)
    dz0, dz1 = z0 + foot + .01, z0 + h - .01
    dx0, dx1 = -w / 2 + .006, w / 2 - panel_w - .004
    items.append((ap.rbox(dx1 - dx0, .012, dz1 - dz0, .005, 2, at=((dx0 + dx1) / 2, y_face + .006, dz0)), 'frente', 'x', 0))
    win_w, win_h = (dx1 - dx0) * .7, (dz1 - dz0) * .62
    items.append((ap.rbox(win_w, .002, win_h, .008, 2, at=((dx0 + dx1) / 2 - .015, y_face - .0005, (dz0 + dz1) / 2 - win_h / 2)),
                  'ventana', 'x', 0))
    items.append((ap.rbox(.018, .03, (dz1 - dz0) * .78, .006, 2, at=(dx1 - .016, -d / 2 + .015, (dz0 + dz1) / 2 - (dz1 - dz0) * .39)),
                  'tirador', 'z', 0))
    px = w / 2 - panel_w / 2 - .003
    items.append((ap.rbox(panel_w - .008, .012, dz1 - dz0, .005, 2, at=(px, y_face + .006, dz0)), 'panel', 'x', 0))
    items += ap.display(px, y_face, dz1 - .035, panel_w * .72, .03, '12:00')
    items += ap.dial(px, y_face, dz1 - .1, .022)
    items += ap.dial(px, y_face, dz1 - .165, .022)
    items.append((ap.rbox(panel_w * .6, .006, .024, .006, 2, at=(px, y_face - .003, dz0 + .02)), 'mandos', 'x', 0))
    items.append(_top_vents(w, d, z0 + h))
    ap.emit(piece, items)


def mini_oven(piece, spec):
    """Horno de sobremesa: puerta de cristal con interior esmaltado y parrilla, barra superior y tres mandos."""
    w, d, h = _dims(spec)
    p = spec['params']
    z0, foot, proj = p.get('elev', 0) / 1000, .012, .03
    panel_w = .12
    yd = -d / 2 + proj
    items = _countertop_body(w, d, h, z0, yd + .02, foot)
    dz0, dz1 = z0 + foot + .012, z0 + h - .014
    dx0, dx1 = -w / 2 + .008, w / 2 - panel_w - .004
    cx = (dx0 + dx1) / 2
    m = .03
    for bx0, bx1, bz0, bz1 in ((dx0, dx1, dz1 - m - .02, dz1), (dx0, dx1, dz0, dz0 + m), (dx0, dx0 + m, dz0, dz1), (dx1 - m, dx1, dz0, dz1)):
        items.append((ap.rbox(bx1 - bx0, .018, bz1 - bz0, .003, 2, at=((bx0 + bx1) / 2, yd + .009, bz0)), 'frente', 'x', 0))
    gx0, gx1, gz0, gz1 = dx0 + m - .004, dx1 - m + .004, dz0 + m - .004, dz1 - m - .016
    items.append((ap.rbox(gx1 - gx0, .004, gz1 - gz0, .002, 1, at=(cx, yd + .006, gz0)), 'vidrio', 'x', 0))
    items.append((ap.rbox(gx1 - gx0, .004, gz1 - gz0, .002, 1, at=(cx, yd + .024, gz0)), 'interior', 'x', 0))
    rack_z = gz0 + (gz1 - gz0) * .38
    rods = [geo.tube([(x, yd + .02, rack_z), (x, yd + .013, rack_z + .004)], .0018, 6)
            for x in (gx0 + .02 + k * (gx1 - gx0 - .04) / 9 for k in range(10))]
    rods.append(geo.tube([(gx0 + .01, yd + .014, rack_z + .004), (gx1 - .01, yd + .014, rack_z + .004)], .0025, 6))
    items.append((geo.merge(rods), 'tirador', 'x', 50))
    items.append((ap.bar(cx, yd, dz1 - .02, (dx1 - dx0) * .8, 'x', .007, proj), 'tirador', 'x', 50))
    px = w / 2 - panel_w / 2 - .003
    items.append((ap.rbox(panel_w - .008, .016, dz1 - dz0, .004, 2, at=(px, yd + .012, dz0)), 'panel', 'x', 0))
    for k in range(3):
        items += ap.dial(px, yd + .004, dz1 - .055 - k * .075, .021)
    items.append((ap.button(px + .035, yd + .004, dz0 + .02, .004, .002), 'indicador', 'x', 40))
    items.append(_top_vents(w, d, z0 + h, 10))
    ap.emit(piece, items)


def espresso(piece, spec):
    """Cafetera espresso: cuerpo de acero, grupo y portafiltro, manómetro, lanza de vapor, bandeja y calientatazas."""
    w, d, h = _dims(spec)
    z0 = spec['params'].get('elev', 0) / 1000
    foot, yb = .012, d / 2
    body_d = d - .1
    yfb = yb - body_d
    zt = z0 + h - .03
    items = [ap.feet([-(w / 2 - .04), w / 2 - .04], [yfb + .04, yb - .04], z0, foot, .01),
             (ap.rbox(w, body_d, zt - z0 - foot, .01, 3, at=(0, (yfb + yb) / 2, z0 + foot)), 'carcasa', 'z', 0),
             (ap.rbox(w - .03, body_d - .03, .004, .002, 1, at=(0, (yfb + yb) / 2, zt)), 'tirador', 'x', 0)]
    rail = geo.fillet([(-w / 2 + .012, yfb + .012, zt + .024), (w / 2 - .012, yfb + .012, zt + .024),
                       (w / 2 - .012, yb - .012, zt + .024), (-w / 2 + .012, yb - .012, zt + .024)], .02, 3, closed=True)
    items.append((geo.tube(rail, .004, 8, closed=True), 'tirador', 'x', 50))
    posts = [geo.tube([(sx * (w / 2 - .012), y, zt), (sx * (w / 2 - .012), y, zt + .024)], .003, 6)
             for sx in (-1, 1) for y in (yfb + .012, yb - .012)]
    items.append((geo.merge(posts), 'tirador', 'z', 50))
    tray_z = z0 + foot
    items.append((ap.rbox(w - .04, .11, .032, .004, 2, at=(0, yfb - .045, tray_z)), 'carcasa', 'x', 0))
    items.append((ap.rbox(w - .06, .09, .003, .001, 1, at=(0, yfb - .045, tray_z + .032)), 'tirador', 'x', 0))
    grille = [geo.box(w - .07, .004, .001, 0, at=(0, yfb - .085 + k * .01, tray_z + .0352)) for k in range(8)]
    items.append((geo.merge(grille), 'goma', 'x', 0))
    gy, gz = yfb - .045, z0 + .21
    items.append((ap.rbox(.075, .06, .05, .008, 2, at=(0, yfb - .025, gz + .015)), 'tirador', 'x', 0))
    items.append((geo.lathe([(0, gz - .005), (.034, gz - .005), (.04, gz + .005), (.04, gz + .02), (.03, gz + .03), (0, gz + .03)], 32,
                            at=(0, gy, 0)), 'tirador', 'z', 50))
    items.append((geo.lathe([(0, gz - .035), (.03, gz - .035), (.035, gz - .028), (.036, gz - .005), (0, gz - .005)], 32,
                            at=(0, gy, 0)), 'tirador', 'z', 50))
    items.append((geo.tube([(0, gy - .035, gz - .02), (0, -d / 2 + .02, gz - .03)], .011, 12, round_ends=.012), 'goma', 'y', 50))
    items.append((ap.ring(.03, .014, .008, 0, yfb, z0 + .3, 40, .002), 'tirador', 'x', 40))
    items.append((ap.axial([(0, 0), (.027, 0), (.027, .006), (0, .006)], 0, yfb, z0 + .3, 32), 'esfera', 'x', 40))
    needle = geo.box(.0015, .001, .02, 0, at=(0, 0, 0))
    geo.transform(needle, rot=(0, math.radians(-35), 0))
    items.append((geo.transform(needle, loc=(0, yfb - .0075, z0 + .3)), 'goma', 'x', 0))
    wx = w / 2 - .035
    wand = geo.fillet([(wx, yfb, z0 + .27), (wx, yfb - .035, z0 + .27), (wx + .012, yfb - .045, z0 + .25), (wx + .012, yfb - .05, z0 + .13)], .015, 4)
    items.append((geo.tube(wand, .0045, 8, round_ends=.004), 'tirador', 'z', 50))
    for x in (-w / 2 + .045, w / 2 - .045):
        items += ap.dial(x, yfb, z0 + .3, .017, .02)
    items.append((ap.button(-w / 2 + .045, yfb, z0 + .24, .007, .005), 'indicador', 'x', 40))
    items.append((ap.logo(0, yfb, zt - .02, .06, .01), 'logo', 'x', 0))
    ap.emit(piece, items)


def _frustum(bottom, top):
    """Tronco de pirámide entre dos rectángulos horizontales (x0, x1, y0, y1, z)."""
    bm = bmesh.new()
    corners = []
    for x0, x1, y0, y1, z in (bottom, top):
        corners += [bm.verts.new(v) for v in ((x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z))]
    v = corners
    for face in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in face])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def hood(piece, spec):
    """Campana decorativa de pared: visera con mandos y filtros, pirámide y chimenea telescópica hasta la cota alta."""
    w, d, h = _dims(spec)
    z0 = spec['params']['elev'] / 1000
    canopy = .06
    zc = z0 + .003
    items = [(ap.rbox(w, d, canopy, .004, 2, at=(0, 0, zc)), 'carcasa', 'x', 0)]
    fw = (w - .12) / 2
    for sx in (-1, 1):
        items.append((ap.rbox(fw, d - .14, .004, .001, 1, at=(sx * (fw / 2 + .02), .01, z0)), 'filtro', 'x', 0))
    for sx in (-1, 1):
        led = geo.lathe([(0, z0 + .001), (.022, z0 + .001), (.022, zc + .001), (0, zc + .001)], 20, at=(sx * w * .3, -d / 2 + .05, 0))
        items.append((led, 'led', 'x', 40))
    mid = zc + canopy / 2
    for k in range(4):
        items.append((ap.button(w / 2 - .19 + k * .032, -d / 2, mid, .007, .003), 'mandos', 'x', 40))
    items.append((ap.button(w / 2 - .05, -d / 2, mid, .004, .002), 'led', 'x', 40))
    items.append((ap.logo(-w / 2 + .08, -d / 2, mid, .06, .01), 'logo', 'x', 0))
    chimney_w, chimney_d = (.26, .22) if w > .7 else (.24, .2)
    z_pyr = zc + canopy
    z_top = z_pyr + (.3 if w > .7 else .25)
    items.append((_frustum((-w / 2 + .012, w / 2 - .012, -d / 2 + .012, d / 2, z_pyr),
                           (-chimney_w / 2, chimney_w / 2, d / 2 - chimney_d, d / 2, z_top)), 'carcasa', 'x', 30))
    lower = (z0 + h - z_top) * .72  # tramo fijo largo y tramo telescópico corto, apenas más estrecho
    items.append((ap.rbox(chimney_w, chimney_d, lower, .003, 2, at=(0, d / 2 - chimney_d / 2, z_top)), 'carcasa', 'z', 0))
    items.append((ap.rbox(chimney_w - .004, chimney_d - .004, z0 + h - z_top - lower, .003, 2,
                          at=(0, d / 2 - (chimney_d - .004) / 2, z_top + lower)), 'carcasa', 'z', 0))
    ap.emit(piece, items)


def water_heater(piece, spec):
    """Termo eléctrico vertical: cilindro esmaltado con fondos abombados, panel con termostato, tomas de agua y soporte."""
    w, d, h = _dims(spec)
    z0 = spec['params']['elev'] / 1000
    pipes = .1
    radius = w / 2 - .003
    zc0, zc1 = z0 + pipes, z0 + h
    yc = d / 2 - radius - .003
    profile = [(0, zc0), (radius * .55, zc0 + .008), (radius * .85, zc0 + .03), (radius, zc0 + .07),
               (radius, zc1 - .07), (radius * .85, zc1 - .03), (radius * .55, zc1 - .008), (0, zc1)]
    items = [(geo.lathe(profile, 48, at=(0, yc, 0)), 'carcasa', 'z', 0)]
    for z in (zc0 + .07, zc1 - .07):
        items.append((geo.lathe([(radius * .99, z - .006), (radius + .003, z - .006), (radius + .003, z + .006),
                                 (radius * .99, z + .006)], 48, at=(0, yc, 0)), 'panel', 'z', 40))
    y_face = yc - radius - .002
    items.append((ap.rbox(.17, .03, .11, .008, 3, at=(0, y_face + .015, zc0 + .085)), 'panel', 'x', 0))
    items += ap.dial(-.04, y_face, zc0 + .14, .019, .018)
    items.append((ap.ring(.016, .006, .005, .04, y_face, zc0 + .14, 32, .0015), 'aro', 'x', 40))
    items.append((ap.axial([(0, 0), (.014, 0), (.014, .004), (0, .004)], .04, y_face, zc0 + .14, 24), 'esfera', 'x', 40))
    items.append((ap.button(.0, y_face, zc0 + .105, .004, .002), 'indicador', 'x', 40))
    items.append((ap.logo(0, yc - radius + .0005, zc0 + (zc1 - zc0) * .62, .06, .012), 'logo', 'x', 0))
    for x, ring_slot in ((-.06, 'frio'), (.06, 'calor')):
        items.append((geo.tube([(x, yc, zc0 + .03), (x, yc, z0)], .011, 12), 'tirador', 'z', 50))
        items.append((geo.lathe([(0, z0 + .03), (.015, z0 + .03), (.015, z0 + .045), (0, z0 + .045)], 16, at=(x, yc, 0)), ring_slot, 'z', 40))
    items.append((ap.rbox(.03, .025, .045, .004, 2, at=(-.1, yc, z0 + .045)), 'frio', 'x', 0))
    items.append((geo.tube([(-.1, yc, z0 + .07), (-.06, yc, z0 + .07)], .006, 8), 'tirador', 'x', 50))
    for z in (zc0 + .16, zc1 - .16):
        # Pletina de cuelgue: queda tapada por el cilindro, como en un termo real.
        items.append((ap.rbox(.09, .02, .035, .004, 2, at=(0, d / 2 - .01, z)), 'goma', 'x', 0))
    ap.emit(piece, items)


BUILDERS = {
    'ceramic_hob': ceramic_hob,
    'washer': washer, 'dishwasher': dishwasher, 'fridge_combi': fridge_combi, 'fridge_american': fridge_american,
    'microwave': microwave, 'mini_oven': mini_oven, 'espresso': espresso, 'hood': hood, 'water_heater': water_heater,
}
