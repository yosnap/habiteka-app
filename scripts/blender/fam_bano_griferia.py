"""Grifería y piezas metálicas de la familia baño: monomandos, grifos de bañera, columnas y rociadores de ducha,
sifones y pulsadores. Metros; frente hacia -Y; la pared de instalación está en +Y. Cada función devuelve una malla
bmesh ya colocada que el constructor añade al hueco «griferia».
"""
import math

import hk_geo as geo


def _lever(z, length=.07, tilt=12):
    """Maneta plana de monomando que nace en el eje y apunta hacia atrás (+Y), algo levantada."""
    bm = geo.box(.012, length, .009, .003, 2, at=(0, length / 2, -.0045))
    geo.transform(bm, rot=(math.radians(tilt), 0, 0))
    return geo.transform(bm, loc=(0, 0, z))


def basin_mixer(x, y, z, height=.165, reach=.125, rot=0.0, slim=False, lever_side=False):
    """Monomando de lavabo de cuerpo cilíndrico, caño recto con la boca hacia abajo y maneta superior (o lateral
    en los de caño alto).

    (x, y, z) es el centro de la base sobre la encimera; height el alto del cuerpo; reach el vuelo del caño.
    """
    r = .016 if slim else .02
    body = geo.lathe([(0, 0), (r + .007, 0), (r + .008, .003), (r + .005, .008), (r, .013), (r, height - .012),
                      (r + .0005, height - .005), (r - .001, height), (0, height)], 28)
    spout_z = height - .032
    path = geo.fillet([(0, -r * .5, spout_z), (0, -reach + .012, spout_z - .004), (0, -reach, spout_z - .03)], .02, 6)
    spout = geo.tube(path, .0085, 16)
    aerator = geo.lathe([(0, spout_z - .036), (.0092, spout_z - .036), (.0095, spout_z - .03), (.0088, spout_z - .02),
                         (0, spout_z - .02)], 16, at=(0, -reach, 0))
    cap = geo.lathe([(0, height - .001), (r - .002, height - .001), (r - .003, height + .01), (0, height + .012)], 24)
    if lever_side:
        stub = geo.lathe([(0, 0), (.011, 0), (.011, .02), (0, .02)], 16)
        geo.transform(stub, rot=(0, math.pi / 2, 0), loc=(r - .002, 0, height - .06))
        lever = _lever(0, .06, 0)
        geo.transform(lever, rot=(0, 0, -math.pi / 2), loc=(r + .012, 0, height - .06))
        lever = geo.merge([stub, lever])
    else:
        lever = _lever(height + .011, .055, 18)
    out = geo.merge([body, spout, aerator, cap, lever])
    geo.transform(out, rot=(0, 0, rot))
    return geo.transform(out, loc=(x, y, z))


def bottle_trap(x, y, z_top, y_wall, z_pipe=None):
    """Sifón de botella cromado: válvula bajo el desagüe, botella y tubo horizontal hasta la pared con su embellecedor."""
    z_pipe = z_top - .2 if z_pipe is None else z_pipe
    zb = z_pipe - .1
    parts = [
        geo.lathe([(.017, z_pipe + .04), (.017, z_top + .002), (.024, z_top + .002), (.024, z_top + .012),
                   (0, z_top + .012)], 18, at=(x, y, 0)),
        geo.lathe([(0, zb), (.021, zb), (.025, zb + .006), (.025, zb + .1), (.023, zb + .11), (.016, zb + .13),
                   (.016, zb + .14), (0, zb + .14)], 22, at=(x, y, 0)),
        geo.tube([(x, y, z_pipe), (x, y_wall - .006, z_pipe)], .016, 16),
    ]
    rosette = geo.lathe([(0, 0), (.032, 0), (.032, .004), (.02, .01), (0, .01)], 22)
    geo.transform(rosette, rot=(math.pi / 2, 0, 0))
    parts.append(geo.transform(rosette, loc=(x, y_wall, z_pipe)))
    return geo.merge(parts)


def flush_plate(x, y_wall, z_center, w=.245, h=.165):
    """Pulsador de doble descarga en la pared (cisterna empotrada): placa y dos teclas."""
    plate = geo.box(w, .012, h, .004, 3, at=(x, y_wall - .006, z_center - h / 2))
    keys = [geo.box(w * .42, .006, h * .7, .004, 2, at=(x + sx * w * .225, y_wall - .014, z_center - h * .35))
            for sx in (-1, 1)]
    return geo.merge([plate, *keys])


def push_button(x, y, z, r=.026):
    """Pulsador redondo de doble descarga sobre la tapa de la cisterna."""
    ring_ = geo.lathe([(0, 0), (r, 0), (r, .004), (r - .002, .006), (0, .006)], 24, at=(x, y, z))
    half = geo.lathe([(0, .005), (r * .45, .005), (r * .45, .008), (0, .008)], 16, at=(x - r * .45, y, z))
    big = geo.lathe([(0, .005), (r * .45, .005), (r * .45, .008), (0, .008)], 16, at=(x + r * .45, y, z))
    return geo.merge([ring_, half, big])


def _hand_shower(length=.23, head_r=.05):
    """Teleducha apoyada en el origen (base del mango) y orientada hacia +Z."""
    handle = geo.lathe([(0, 0), (.011, 0), (.012, .01), (.014, length - .02), (.02, length - .005), (0, length - .005)], 18)
    head = geo.lathe([(0, 0), (head_r, 0), (head_r + .002, .006), (head_r - .004, .02), (0, .022)], 28)
    geo.transform(head, rot=(math.pi / 2, 0, 0))
    geo.transform(head, loc=(0, .008, length + head_r - .01))
    return geo.merge([handle, head])


def _wall_disc(x, y_wall, z, r=.03, depth=.012):
    disc = geo.lathe([(0, 0), (r, 0), (r, depth * .6), (r * .7, depth), (0, depth)], 24)
    geo.transform(disc, rot=(math.pi / 2, 0, 0))
    return geo.transform(disc, loc=(x, y_wall, z))


def _hose(points):
    return geo.tube(geo.fillet(points, .05, 6), .0075, 10)


def hand_shower_on_holder(x, y_wall, z_holder, z_outlet, x_outlet):
    """Soporte de pared con teleducha y su flexo desde la toma (z_outlet)."""
    holder = geo.box(.035, .05, .05, .008, 2, at=(x, y_wall - .025, z_holder - .025))
    shower = _hand_shower()
    geo.transform(shower, rot=(math.radians(18), 0, 0))
    geo.transform(shower, loc=(x, y_wall - .055, z_holder - .14))
    hose = _hose([(x_outlet, y_wall - .03, z_outlet), (x_outlet, y_wall - .07, z_outlet - .25),
                  ((x + x_outlet) / 2, y_wall - .09, min(z_outlet, z_holder) - .55), (x, y_wall - .06, z_holder - .16)])
    return geo.merge([holder, shower, hose, _wall_disc(x_outlet, y_wall, z_outlet, .022)])


def wall_bath_mixer(x, y_wall, z, hand_x=None, hand_z=None):
    """Grifo bimando-monomando de bañera visto en la pared: excéntricas, cuerpo, caño, maneta y teleducha."""
    parts = []
    for sx in (-1, 1):
        parts.append(_wall_disc(x + sx * .075, y_wall, z, .028))
        parts.append(geo.tube([(x + sx * .075, y_wall - .01, z), (x + sx * .075, y_wall - .055, z)], .011, 14))
    body = geo.lathe([(0, -.13), (.024, -.13), (.026, -.12), (.026, .12), (.024, .13), (0, .13)], 24)
    geo.transform(body, rot=(0, math.pi / 2, 0))
    parts.append(geo.transform(body, loc=(x, y_wall - .065, z)))
    spout = geo.fillet([(x, y_wall - .07, z - .01), (x, y_wall - .17, z - .02), (x, y_wall - .175, z - .05)], .02, 5)
    parts.append(geo.tube(spout, .013, 16))
    lever = _lever(0, .07, 15)
    geo.transform(lever, rot=(0, 0, math.pi))
    parts.append(geo.transform(lever, loc=(x + .07, y_wall - .065, z + .028)))
    parts.append(geo.lathe([(0, 0), (.018, 0), (.016, .02), (0, .022)], 16, at=(x + .07, y_wall - .065, z + .022)))
    parts.append(geo.lathe([(0, 0), (.01, 0), (.01, .03), (0, .03)], 12, at=(x - .02, y_wall - .065, z + .022)))
    hx = x - .35 if hand_x is None else hand_x
    hz = z + .45 if hand_z is None else hand_z
    holder = geo.box(.035, .05, .05, .008, 2, at=(hx, y_wall - .025, hz - .025))
    shower = _hand_shower()
    geo.transform(shower, rot=(math.radians(18), 0, 0))
    geo.transform(shower, loc=(hx, y_wall - .055, hz - .14))
    hose = _hose([(x - .09, y_wall - .07, z - .02), (x - .1, y_wall - .1, z - .2), ((x + hx) / 2, y_wall - .11, z - .25),
                  (hx, y_wall - .07, z - .05), (hx, y_wall - .06, hz - .16)])
    return geo.merge(parts + [holder, shower, hose])


def shower_column(x, y_wall, z_mixer=1.05, top=2.1, reach=.4, head_r=.125, square=False):
    """Columna de ducha termostática: barra mezcladora, tubo vertical, brazo con rociador y teleducha en deslizador."""
    parts = []
    for sx in (-1, 1):
        parts.append(_wall_disc(x + sx * .075, y_wall, z_mixer, .026))
        parts.append(geo.tube([(x + sx * .075, y_wall - .01, z_mixer), (x + sx * .075, y_wall - .05, z_mixer)], .011, 14))
    bar = geo.lathe([(0, -.16), (.03, -.16), (.032, -.15), (.032, .15), (.03, .16), (0, .16)], 28)
    geo.transform(bar, rot=(0, math.pi / 2, 0))
    parts.append(geo.transform(bar, loc=(x, y_wall - .06, z_mixer)))
    for sx in (-1, 1):
        knob = geo.lathe([(0, 0), (.034, 0), (.035, .03), (.03, .036), (0, .036)], 28)
        geo.transform(knob, rot=(0, sx * math.pi / 2, 0))
        parts.append(geo.transform(knob, loc=(x + sx * .155, y_wall - .06, z_mixer)))
    yp = y_wall - .06
    parts.append(geo.tube([(x, yp, z_mixer + .03), (x, yp, top - .03)], .012, 16))
    parts.append(geo.tube(geo.fillet([(x, yp, top - .06), (x, yp, top), (x, yp - reach, top)], .04, 6), .011, 16))
    parts.append(geo.box(.02, .045, .045, .006, 2, at=(x, y_wall - .022, top - .1)))
    hz = top - reach * .2 - .06
    if square:
        head = geo.box(head_r * 2, head_r * 2, .008, .004, 2, at=(0, 0, -.004))
    else:
        head = geo.lathe([(0, -.006), (head_r - .004, -.006), (head_r, -.003), (head_r, .002), (head_r - .01, .006),
                          (0, .008)], 48)
    parts.append(geo.transform(head, loc=(x, yp - reach, hz + .05)))
    parts.append(geo.lathe([(0, 0), (.013, 0), (.013, .02), (0, .02)], 12, at=(x, yp - reach, top - .025)))
    slider_z = z_mixer + .42
    parts.append(geo.box(.04, .04, .05, .008, 2, at=(x, yp - .02, slider_z - .025)))
    shower = _hand_shower()
    geo.transform(shower, rot=(math.radians(14), 0, 0))
    parts.append(geo.transform(shower, loc=(x, yp - .05, slider_z - .14)))
    parts.append(_hose([(x + .02, yp - .03, z_mixer - .03), (x + .05, yp - .06, z_mixer - .25), (x + .02, yp - .07, z_mixer - .3),
                        (x, yp - .055, slider_z - .16)]))
    return geo.merge(parts)


def ceiling_shower(x, y, y_wall, z_ceiling=2.4, drop=.2, size=.3, z_mixer=1.1, hand_x=None):
    """Rociador cuadrado de techo con su brazo, termostática empotrada en la pared y teleducha en soporte."""
    parts = [geo.lathe([(0, 0), (.035, 0), (.035, .006), (0, .006)], 24, at=(x, y, z_ceiling - .006)),
             geo.tube([(x, y, z_ceiling - .004), (x, y, z_ceiling - drop + .01)], .012, 16),
             geo.box(size, size, .009, .004, 2, at=(x, y, z_ceiling - drop - .009))]
    plate = geo.box(.15, .012, .15, .006, 3, at=(x, y_wall - .006, z_mixer - .075))
    knob = geo.lathe([(0, 0), (.026, 0), (.026, .028), (.022, .034), (0, .034)], 24)
    geo.transform(knob, rot=(math.pi / 2, 0, 0))
    parts += [plate, geo.transform(knob, loc=(x, y_wall - .012, z_mixer))]
    hx = x + .3 if hand_x is None else hand_x
    parts.append(hand_shower_on_holder(hx, y_wall, z_mixer + .35, z_mixer - .2, hx))
    return geo.merge(parts)


def floor_bath_faucet(x, y, height=.95, reach=.24, rot=0.0):
    """Grifo de bañera exenta de pie: columna con base, caño curvado sobre el borde y teleducha en su horquilla.

    El caño sale hacia -Y antes de girarlo con rot (radianes, alrededor del eje vertical)."""
    column = geo.lathe([(0, 0), (.07, 0), (.072, .006), (.06, .014), (.024, .02), (.022, .05), (.022, height - .04),
                        (.024, height - .02), (.022, height), (0, height)], 32)
    spout = geo.tube(geo.fillet([(0, 0, height - .03), (0, 0, height + .06), (0, -reach, height + .06),
                                 (0, -reach, height - .02)], .06, 8), .012, 16)
    aerator = geo.lathe([(0, height - .035), (.014, height - .035), (.014, height - .015), (0, height - .015)], 16,
                        at=(0, -reach, 0))
    levers = []
    for sz in (.0, .07):
        lever = _lever(0, .06, 0)
        geo.transform(lever, rot=(0, 0, math.pi / 2))
        levers.append(geo.transform(lever, loc=(.022, 0, height - .12 - sz)))
    cradle = geo.box(.03, .03, .05, .006, 2, at=(-.04, 0, height - .25))
    shower = _hand_shower(.21, .035)
    geo.transform(shower, loc=(-.055, 0, height - .28))
    out = geo.merge([column, spout, aerator, *levers, cradle, shower])
    geo.transform(out, rot=(0, 0, rot))
    return geo.transform(out, loc=(x, y, 0))


def deck_bath_mixer(x, y, z, rot=0.0):
    """Grifo de repisa de bañera: caño en cascada bajo y dos maneras, con teleducha extraíble."""
    spout = geo.box(.16, .12, .04, .01, 3, at=(0, 0, 0))
    lip = geo.box(.16, .02, .012, .004, 2, at=(0, -.07, .015))
    parts = [spout, lip]
    for sx in (-1, 1):
        parts.append(geo.lathe([(0, 0), (.025, 0), (.025, .03), (.02, .04), (0, .042)], 24, at=(sx * .15, .02, 0)))
    parts.append(geo.lathe([(0, 0), (.022, 0), (.02, .05), (.016, .06), (0, .06)], 20, at=(.26, .02, 0)))
    out = geo.merge(parts)
    geo.transform(out, rot=(0, 0, rot))
    return geo.transform(out, loc=(x, y, z))


def jets(points):
    """Boquillas de hidromasaje: discos cromados orientados según la normal de la pared de la bañera.

    points = [((x, y, z), (nx, ny, nz))]."""
    from mathutils import Vector
    out = []
    for position, normal in points:
        disc = geo.lathe([(0, 0), (.03, 0), (.03, .004), (.018, .008), (.012, .006), (0, .004)], 20)
        quat = Vector((0, 0, 1)).rotation_difference(Vector(normal))
        euler = quat.to_euler()
        geo.transform(disc, rot=(euler.x, euler.y, euler.z))
        out.append(geo.transform(disc, loc=position))
    return geo.merge(out)
