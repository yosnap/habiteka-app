"""Piezas reutilizables entre familias: patas, capitoné, vivos y botones (metros, frente hacia -Y)."""
import math

from mathutils import Vector

import hk_geo as geo


def _tilted(bm, h, x, y, splay, sx, sy):
    """Inclina una pata construida hacia abajo desde (0, 0, 0) para que el pie se abra hacia fuera."""
    angle = math.radians(splay)
    geo.transform(bm, rot=(angle * sy, -angle * sx, 0))
    return geo.transform(bm, loc=(x, y, h))


def leg(kind, h, x=0.0, y=0.0, sx=0, sy=0, size=1.0, splay=None):
    """Una pata con su parte superior en (x, y, h) y el pie en el suelo.

    kind: conica (madera torneada cónica y abierta), recta (madera cuadrada), taco (taco bajo), metal (varilla fina),
    torneada (clásica con anillos), bola (pie de bollo), cuadrada_metal (tubo cuadrado).
    """
    s = size
    if kind == 'conica':
        splay = 7 if splay is None else splay
        length = h / math.cos(math.radians(splay))
        bm = geo.lathe([(.013 * s, -length), (.015 * s, -length + .004), (.022 * s, -.02), (.023 * s, 0)], 16)
        return _tilted(bm, h, x, y, splay, sx, sy)
    if kind == 'metal':
        splay = 4 if splay is None else splay
        length = h / math.cos(math.radians(splay))
        bm = geo.lathe([(.005 * s, -length), (.007 * s, -length + .003), (.011 * s, -.004), (.012 * s, 0)], 12)
        return _tilted(bm, h, x, y, splay, sx, sy)
    if kind == 'recta':
        return geo.box(.045 * s, .045 * s, h, .004, 2, at=(x, y, 0))
    if kind == 'cuadrada_metal':
        return geo.box(.03 * s, .03 * s, h, .003, 2, at=(x, y, 0))
    if kind == 'taco':
        return geo.box(.06 * s, .06 * s, h, .006, 2, at=(x, y, 0))
    if kind == 'bola':
        r = h / 2
        return geo.lathe([(0, 0), (r * .55, .002), (r * .95, r * .5), (r, r), (r * .9, r * 1.55), (r * .55, h - .004),
                          (r * .6, h)], 16, at=(x, y, 0))
    if kind == 'torneada':
        p = [(.012, 0), (.014, .01), (.02, .025), (.016, .04), (.024, .07), (.026, .09), (.02, .11), (.018, h * .7),
             (.026, h * .78), (.022, h * .86), (.03, h * .93), (.03, h)]
        return geo.lathe([(r * s, min(z, h)) for r, z in p], 16, at=(x, y, 0))
    raise ValueError(f'Pata desconocida: {kind}')


def four_legs(piece, slot, kind, w, d, h, inset=.06, middle=False, size=1.0):
    """Cuatro patas (y dos centrales ocultas si el mueble es largo) bajo una huella w × d centrada."""
    spots = [(sx, sy) for sx in (-1, 1) for sy in (-1, 1)]
    for sx, sy in spots:
        piece.add(leg(kind, h, sx * (w / 2 - inset), sy * (d / 2 - inset), sx, sy, size), slot, grain='z')
    if middle:
        for sy in (-1, 1):
            piece.add(leg(kind, h, 0, sy * (d / 2 - inset), 0, sy, size), slot, grain='z')


def tufting(face_axis, face_sign, half, spacing, depth, margin=.06):
    """Capitoné en rombo sobre la cara de normal face_sign·face_axis de un soft_box de semitamaño `half`.

    Devuelve (deform, botones): deform hunde los puntos de capitoné y marca los pliegues entre ellos; botones son las
    posiciones locales (centradas en la caja) donde va cada botón.
    """
    a = face_axis
    u_axis, v_axis = [k for k in range(3) if k != a]
    span_u, span_v = 2 * (half[u_axis] - margin), 2 * (half[v_axis] - margin)
    cols = max(1, round(span_u / spacing))
    rows = max(1, round(span_v / (spacing * .85)))
    su, sv = span_u / cols, span_v / rows
    centers = []
    for j in range(rows + 1):
        v = -span_v / 2 + j * sv
        for i in range(cols + 1 - (j % 2)):
            centers.append((-span_u / 2 + i * su + (su / 2 if j % 2 else 0), v))
    sigma, crease = spacing * .2, spacing * .05

    def segment(u, v, p, q):
        du, dv = q[0] - p[0], q[1] - p[1]
        t = max(0.0, min(1.0, ((u - p[0]) * du + (v - p[1]) * dv) / (du * du + dv * dv)))
        return math.hypot(u - p[0] - t * du, v - p[1] - t * dv)

    def deform(p, normal):
        weight = normal[a] * face_sign
        if weight <= .3:
            return p
        u, v = p[u_axis], p[v_axis]
        dist2, cu, cv = min(((u - x) ** 2 + (v - y) ** 2, x, y) for x, y in centers)
        dent = math.exp(-dist2 / sigma ** 2)
        pleat = 0.0
        for du, dv in ((su / 2, sv), (-su / 2, sv), (su / 2, -sv), (-su / 2, -sv)):
            pleat = max(pleat, math.exp(-(segment(u, v, (cu, cv), (cu + du, cv + dv)) / crease) ** 2))
        p[a] -= face_sign * depth * max(dent, .4 * pleat) * min(1.0, (weight - .3) / .4)
        return p

    buttons = []
    for cu, cv in centers:
        position = [0.0, 0.0, 0.0]
        position[u_axis], position[v_axis], position[a] = cu, cv, face_sign * (half[a] - depth * .7)
        buttons.append(Vector(position))
    return deform, buttons


def buttons(positions, axis, sign, radius=.011):
    """Botones forrados (esferas aplastadas) orientados según la cara."""
    out = []
    rot = {0: (0, math.pi / 2 * sign, 0), 1: (-math.pi / 2 * sign, 0, 0), 2: (0, 0, 0)}[axis]
    for position in positions:
        bm = geo.sphere(radius, segments=8, flatten=.45)
        geo.transform(bm, rot=rot)
        out.append(geo.transform(bm, loc=tuple(position)))
    return geo.merge(out)


def piping(w, d, z, corner, radius=.0045, at=(0, 0)):
    """Vivo (cordón) cerrado alrededor de un rectángulo w × d a la altura z, con esquinas de radio `corner`."""
    hw, hd = w / 2, d / 2
    corner = min(corner, hw * .9, hd * .9)
    path = []
    for cx, cy, a0 in ((hw - corner, hd - corner, 0), (-hw + corner, hd - corner, 90),
                       (-hw + corner, -hd + corner, 180), (hw - corner, -hd + corner, 270)):
        path += geo.arc(at[0] + cx, at[1] + cy, z, corner, a0, a0 + 90, 5)
    return geo.tube(path, radius, 8, closed=True)


def cushion_piping(w, d, h, rad, z0=0.0, at=(0, 0), both=True, radius=.0045):
    """Vivos en las costuras superior (e inferior) de un cojín soft_box del mismo tamaño."""
    rx, ry, rz = rad if isinstance(rad, (tuple, list)) else (rad, rad, rad)
    inset = .29 * min(rx, ry)
    loops = [piping(w - 2 * inset, d - 2 * inset, z0 + h - .29 * rz, min(rx, ry), radius, at)]
    if both:
        loops.append(piping(w - 2 * inset, d - 2 * inset, z0 + .29 * rz, min(rx, ry), radius, at))
    return geo.merge(loops)


def pillow(w, d, h, seed=0, pinch=.55, at=(0, 0, 0)):
    """Almohada o cojín: abombado en el centro, con las esquinas pellizcadas y arrugas suaves."""
    hw, hd = w / 2, d / 2

    def deform(p, _normal):
        fx, fy = min(1.0, abs(p.x) / hw), min(1.0, abs(p.y) / hd)
        p.z *= (1 - pinch * fx ** 3 * fy ** 3) * (1 - .3 * max(fx, fy) ** 4)
        return p

    r = min(w, d) * .16
    return geo.soft_box(w, d, h, (r, r, h * .48), (.008, .008, h * .16), wrinkle=.004, seed=seed, deform=deform,
                        at=at, density=.035)


def place(items, loc=(0, 0, 0), rz=0.0):
    """Gira (Z) y traslada un grupo de partes (bm, hueco, veta, arista viva) antes de añadirlas."""
    for bm, *_ in items:
        geo.transform(bm, loc=loc, rot=(0, 0, rz))
    return items


def emit(piece, items):
    for bm, slot, grain, sharp in items:
        piece.add(bm, slot, grain, sharp)
