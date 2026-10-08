"""Complementos de la familia baño: espejos (rectangular, redondo y con luz LED), columna suspendida, toalleros de
barra, radiador toallero, portarrollos y estante de vidrio. Todos van colgados en la pared trasera (y = fondo / 2) a su
cota real; la fábrica registra esa cota como elevación.

Huecos: «espejo», «marco», «led», «carcasa», «tirador», «griferia» (metal cromado o negro), «estructura» (radiador),
«toalla», «papel» y «cristal».
"""
import math

import hk_geo as geo

import fam_bano_formas as formas
import fam_bano_sanitarios as sanitarios


def _dims(spec):
    return tuple(value / 1000 for value in spec['dims'])


def _upright(bm, y):
    """Lleva una lámina construida en el plano XY (normal +Z) al plano de la pared, mirando a -Y, en la cota y."""
    geo.transform(bm, rot=(math.pi / 2, 0, 0))
    return geo.transform(bm, loc=(0, y, 0))


def mirror(piece, spec):
    """Espejo de baño: rectangular de canto pulido, redondo con marco metálico o con banda LED perimetral."""
    w, d, h = _dims(spec)
    p = spec['params']
    z0 = p.get('bottom', 1050) / 1000
    zc = z0 + h / 2
    glass_y = d / 2 - .02
    if p['shape'] == 'redondo':
        r = w / 2 - (.012 if p.get('frame') else 0)
        disc = geo.lathe([(0, 0), (r, 0), (r, .005), (0, .005)], 72)
        geo.transform(disc, rot=(-math.pi / 2, 0, 0), loc=(0, glass_y, zc))
        piece.add(disc, 'espejo', 'x', 30)
        back = geo.lathe([(0, 0), (r - .03, 0), (r - .03, .014), (0, .014)], 48)
        geo.transform(back, rot=(-math.pi / 2, 0, 0), loc=(0, glass_y + .006, zc))
        piece.add(back, 'marco', 'x', 30)
        if p.get('frame'):
            ring_ = geo.tube(geo.arc(0, 0, 0, w / 2 - .009, 0, 360, 96)[:-1], .009, 14, closed=True)
            geo.transform(ring_, rot=(math.pi / 2, 0, 0), loc=(0, glass_y - .004, zc))
            piece.add(ring_, 'marco', 'x', 0)
        return
    radius = .045 if p.get('led') else .004
    glass = geo.box(w, .005, h, min(radius, .0025), 2, at=(0, glass_y + .0025, z0))
    if p.get('led'):
        pts = formas.rect_points(-w / 2, w / 2, -h / 2, h / 2, radius, 6)
        thetas = formas.angles(96, pts)
        outer = formas.polygon(pts, (0, 0))
        glass = formas.loft([(0, 0, 0), formas.ring(outer, thetas, 0, scale=1.0), formas.ring(outer, thetas, -.005),
                             (0, 0, -.005)])
        _upright(glass, glass_y)
        geo.transform(glass, loc=(0, 0, zc))
        band_in = formas.polygon(formas.rect_points(-w / 2 + .075, w / 2 - .075, -h / 2 + .075, h / 2 - .075, max(radius - .075, .004), 6), (0, 0))
        band_out = formas.polygon(formas.rect_points(-w / 2 + .035, w / 2 - .035, -h / 2 + .035, h / 2 - .035, max(radius - .035, .004), 6), (0, 0))
        band = formas.loft([formas.ring(band_out, thetas, .0006), formas.ring(band_in, thetas, .0006),
                            formas.ring(band_in, thetas, .0001), formas.ring(band_out, thetas, .0001),
                            formas.ring(band_out, thetas, .0006)])
        _upright(band, glass_y)
        geo.transform(band, loc=(0, 0, zc))
        piece.add(band, 'led', 'x', 0)
    piece.add(glass, 'espejo', 'x', 30)
    piece.add(geo.box(w - .04, .014, h - .04, .002, 1, at=(0, d / 2 - .007, z0 + .02)), 'marco', 'x')


def tall_cabinet(piece, spec):
    """Columna de baño suspendida (o de suelo con patas si params.legs): puerta baja y alta con tiradores
    verticales y hueco abierto central con balda."""
    w, d, h = _dims(spec)
    p = spec['params']
    z0 = p.get('bottom', 350) / 1000
    if p.get('legs'):
        h -= z0
        for sx in (-1, 1):
            for sy in (-1, 1):
                piece.add(geo.lathe([(0, 0), (.011, 0), (.014, z0 - .004), (.018, z0)], 16,
                                    at=(sx * (w / 2 - .04), sy * (d / 2 - .05), 0)), 'tirador', 'z', 0)
    front_y, t = -d / 2, .018
    niche = .3
    low_h = (h - niche) * .55
    body_y, body_d = t / 2, d - t
    piece.add(geo.box(w, body_d, low_h, .002, 2, at=(0, body_y, z0)), 'carcasa', 'y')
    piece.add(geo.box(w, body_d, h - low_h - niche, .002, 2, at=(0, body_y, z0 + low_h + niche)), 'carcasa', 'y')
    # Hueco abierto: costados y trasera; las tapas de los cuerpos hacen de balda y techo.
    for sx in (-1, 1):
        piece.add(geo.box(t, d, niche, .001, 1, at=(sx * (w / 2 - t / 2), 0, z0 + low_h)), 'carcasa', 'z')
    piece.add(geo.box(w - 2 * t, t, niche, .001, 1, at=(0, d / 2 - t / 2, z0 + low_h)), 'carcasa', 'x')
    sanitarios.fronts(piece, -w / 2, w / 2, front_y, z0, z0 + low_h, 1, 1, vertical=True)
    sanitarios.fronts(piece, -w / 2, w / 2, front_y, z0 + low_h + niche, z0 + h, 1, 1, vertical=True)


def _post(x, y_wall, z, reach, r=.009):
    """Pie de toallero: roseta en la pared y brazo hasta la barra."""
    rosette = geo.lathe([(0, 0), (.025, 0), (.025, .008), (.018, .012), (0, .012)], 24)
    geo.transform(rosette, rot=(math.pi / 2, 0, 0), loc=(x, y_wall, z))
    arm = geo.tube([(x, y_wall - .01, z), (x, y_wall - reach, z)], r, 14)
    return geo.merge([rosette, arm])


def _towel(w, y, z, front_drop=.42, back_drop=.32, seed=0):
    """Toalla doblada colgando de una barra: lámina con caída a ambos lados y pliegues suaves."""
    import mathutils

    def point(u, v):
        x = (u - .5) * w
        # v recorre: caída trasera (abajo → arriba), vuelta sobre la barra y caída delantera (arriba → abajo).
        total = back_drop + .045 + front_drop
        s = v * total
        wave = .004 * mathutils.noise.noise(mathutils.Vector((x * 9 + seed, s * 6, 0)))
        if s < back_drop:
            return (x, y + .018 + wave, z - back_drop + s)
        if s < back_drop + .045:
            a = (s - back_drop) / .045 * math.pi
            return (x, y + .018 * math.cos(a), z + .018 * math.sin(a))
        t = s - back_drop - .045
        flare = .006 * (t / front_drop) ** 2
        return (x, y - .018 - flare + wave, z - t)
    sheet = geo.surface(16, 30, point)
    return geo.thicken(sheet, .006)


def towel_bar(piece, spec):
    """Toallero de barra de pared con toalla doblada."""
    w, d, _h = _dims(spec)
    z = spec['params'].get('height', 1100) / 1000
    reach = d - .02
    bar_y = d / 2 - reach
    parts = [_post(sx * (w / 2 - .04), d / 2, z, reach) for sx in (-1, 1)]
    parts.append(geo.tube([(-w / 2 + .01, bar_y, z), (w / 2 - .01, bar_y, z)], .009, 16, round_ends=.009))
    piece.add(geo.merge(parts), 'griferia', 'x', 0)
    if 'toalla' in spec['finishes']:
        piece.add(_towel(w * .62, bar_y, z + .009 + .003, seed=1), 'toalla', 'z', 0)


def towel_radiator(piece, spec):
    """Radiador toallero de escalera: colectores verticales, grupos de barras, soportes y llaves de paso.

    dims[2] es el alto visible con las llaves; los colectores miden 11 cm menos y arrancan en params.bottom."""
    w, d, h = _dims(spec)
    z0 = spec['params'].get('bottom', 150) / 1000
    h -= .11
    y = d / 2 - .07
    parts = []
    for sx in (-1, 1):
        x = sx * (w / 2 - .015)
        parts.append(geo.lathe([(0, 0), (.015, 0), (.015, h), (0, h)], 16, at=(x, y, z0)))
        for zb in (z0 + .12, z0 + h - .12):
            parts.append(_post(x, d / 2, zb, .07, .008))
    groups, per_group = 4, 4
    span = h - .12
    for g in range(groups):
        g0 = z0 + .06 + g * span / groups
        for k in range(per_group):
            zz = g0 + .03 + k * .045
            parts.append(geo.tube([(-w / 2 + .015, y, zz), (w / 2 - .015, y, zz)], .011, 14))
    for sx in (-1, 1):
        x = sx * (w / 2 - .015)
        parts.append(geo.lathe([(0, 0), (.018, 0), (.018, .05), (0, .05)], 16, at=(x, y, z0 - .05)))
        parts.append(geo.tube(geo.fillet([(x, y, z0 - .03), (x, y, z0 - .1), (x, d / 2 - .005, z0 - .1)], .02, 4), .008, 12))
    piece.add(geo.merge(parts), 'estructura', 'x', 0)


def paper_holder(piece, spec):
    """Portarrollos de pared con rollo de papel."""
    w, d, _h = _dims(spec)
    z = spec['params'].get('height', 700) / 1000
    arm_y = d / 2 - .06
    rosette = geo.lathe([(0, 0), (.028, 0), (.028, .01), (.02, .014), (0, .014)], 28)
    geo.transform(rosette, rot=(math.pi / 2, 0, 0), loc=(-w / 2 + .03, d / 2, z))
    arm = geo.tube(geo.fillet([(-w / 2 + .03, d / 2 - .01, z), (-w / 2 + .03, arm_y, z), (w / 2 - .01, arm_y, z)], .02, 5),
                   .006, 12, round_ends=.006)
    piece.add(geo.merge([rosette, arm]), 'griferia', 'x', 0)
    roll = geo.lathe([(.022, 0), (.055, 0), (.057, .004), (.057, .096), (.055, .1), (.022, .1), (.022, 0)], 40)
    geo.transform(roll, rot=(0, math.pi / 2, 0), loc=(-w / 2 + .05, arm_y, z))
    piece.add(roll, 'papel', 'x', 0)
    sheet = geo.box(.094, .0015, .1, .0005, 1, at=(-w / 2 + .1, arm_y - .056, z - .1))
    piece.add(sheet, 'papel', 'x', 0)


def glass_shelf(piece, spec):
    """Estante de vidrio templado con soportes cromados y barandilla delantera."""
    w, d, _h = _dims(spec)
    z = spec['params'].get('height', 1150) / 1000
    piece.add(geo.box(w, d - .02, .008, .003, 2, at=(0, .01, z)), 'cristal', 'x', 30)
    parts = []
    for sx in (-1, 1):
        x = sx * (w / 2 - .06)
        parts.append(geo.box(.04, .018, .05, .004, 2, at=(x, d / 2 - .009, z - .02)))
        parts.append(geo.box(.03, d - .03, .006, .002, 1, at=(x, .0, z - .006)))
        parts.append(geo.tube([(x, -d / 2 + .01, z), (x, -d / 2 + .01, z + .05)], .004, 10))
    parts.append(geo.tube([(-w / 2 + .05, -d / 2 + .01, z + .05), (w / 2 - .05, -d / 2 + .01, z + .05)], .005, 12, round_ends=.005))
    piece.add(geo.merge(parts), 'griferia', 'x', 0)
