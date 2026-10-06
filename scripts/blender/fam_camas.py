"""Familia de camas: base (tapizada, canapé, madera o metal), cabecero y ropa de cama con caída.

Metros; el cabecero queda atrás (+Y) y los pies delante (-Y). La ropa de cama se drapea analíticamente: la lámina
descansa sobre el colchón, dobla por su canto redondeado y cae con pliegues que crecen hacia abajo.
"""
import math

from mathutils import Vector, noise

import hk_geo as geo
import hk_parts as parts


def drape(half_w, y0, y1, z, drop, rho, foot=True, folds=.012, wavelength=.24, seed=0, nu=None, nv=None):
    """Lámina sobre el rectángulo [-half_w, half_w] × [y0, y1] a la altura z que cae `drop` por los lados (y por
    los pies si foot). rho es el radio del canto por el que dobla. Devuelve la superficie abierta (normal arriba)."""
    bend = math.pi * rho / 2
    span_x, span_y = 2 * (half_w + bend + drop), (y1 - y0) + (bend + drop if foot else 0)
    nu = nu or max(16, round(span_x / .05))
    nv = nv or max(12, round(span_y / .05))
    start_y = y0 - (bend + drop if foot else 0)
    shift = Vector((seed * 3.1, seed * 1.7, 0))

    def point(u, v):
        sx, sy = -half_w - bend - drop + u * span_x, start_y + v * span_y
        dx, dy = max(abs(sx) - half_w, 0.0), max(y0 - sy, 0.0) if foot else 0.0
        d = math.hypot(dx, dy)
        edge = Vector((max(-half_w, min(half_w, sx)), max(y0, min(y1, sy)), z))
        if d < 1e-9:
            fx, fy = abs(sx) / half_w, (sy - y0) / max(y1 - y0, 1e-6)
            lump = .006 * noise.noise(Vector((sx * 3, sy * 3, 0)) + shift)
            return edge + Vector((0, 0, .012 * (1 - fx ** 6) + lump * (1 - fx ** 4) * min(1, fy * 4)))
        out = Vector((math.copysign(dx, sx), -dy, 0)) / d
        # En las esquinas la lámina sobrante se recoge: misma caída que en los lados, sin picos hasta el suelo.
        gather = max(abs(out.x), abs(out.y))
        d *= gather
        if d <= bend:
            angle = d / rho
            offset, down = rho * math.sin(angle), rho * (1 - math.cos(angle))
        else:
            hang = d - bend
            offset, down = rho + .03 * hang * hang, rho + hang
            along = sy if dx >= dy else sx
            ramp = min(1.0, hang / max(drop, 1e-6)) ** 1.4 * (1 - .6 * min(1.0, max(0.0, hang - (drop - .06)) / .06))
            offset += folds * ramp * (2.2 - 1.2 * gather) * (math.sin(2 * math.pi * along / wavelength) + .5 * math.sin(2 * math.pi * along / (wavelength * .43) + 1.3))
            # El bajo se recoge un poco hacia dentro: el canto de la lámina nunca queda a la vista.
            offset -= .3 * max(0.0, hang - (drop - .04))
        return edge + out * offset - Vector((0, 0, down))

    return geo.surface(nu, nv, point)


def throw(half_w, y0, y1, z, rho, drop, thickness=.012):
    """Plaid a los pies de la cama, por encima del edredón (lámina [-half_w, half_w] × [y0, y1] a la altura z).

    Dobla por el mismo canto que el edredón con un radio algo mayor y cae recto por los lados con dos pliegues anchos
    hacia fuera. Queda siempre por fuera del edredón, aunque este tenga sus propios pliegues (hasta 12 mm). Así ninguno
    lo atraviesa, y el bajo es una línea recta con el canto ligeramente recogido, sin ondas ni dientes.
    """
    lift = .004 + thickness
    radius = rho + lift
    bend = math.pi * radius / 2
    # Vértices donde hacen falta: pocos en el tablero plano, muchos en el canto y algunos en la caída.
    top = [-half_w + 2 * half_w * k / max(8, math.ceil(2 * half_w / .1)) for k in range(max(8, math.ceil(2 * half_w / .1)) + 1)]
    n_bend, n_hang = max(6, math.ceil(bend / .012)), max(6, math.ceil(drop / .025))
    edge = [bend * k / n_bend for k in range(1, n_bend + 1)] + [bend + drop * k / n_hang for k in range(1, n_hang + 1)]
    xs = [-(half_w + d) for d in reversed(edge)] + top + [half_w + d for d in edge]
    nu, nv = len(xs) - 1, 12

    def point(u, v):
        sx, sy = xs[round(u * nu)], y0 + v * (y1 - y0)
        side, d = math.copysign(1.0, sx), max(abs(sx) - half_w, 0.0)
        if d <= 1e-9:
            fx = abs(sx) / half_w
            return Vector((sx, sy, z + .012 * (1 - fx ** 6) + lift))
        if d <= bend:
            angle = d / radius
            return Vector((side * (half_w + radius * math.sin(angle)), sy, z - rho + radius * math.cos(angle)))
        hang = d - bend
        ramp = min(1.0, hang / drop) ** 1.2
        fold = .006 * ramp * (.5 + .5 * math.sin(2 * math.pi * (sy - y0) / ((y1 - y0) / 2) - math.pi / 2))
        # Holgura extra al caer (los pliegues del edredón crecen hacia abajo) y bajo recogido unos milímetros.
        hem = .003 * min(1.0, max(0.0, hang - (drop - .02)) / .02) ** 2
        offset = radius + .008 * min(1.0, hang / .04) + .03 * hang * hang + fold - hem
        return Vector((side * (half_w + offset), sy, z - rho - hang))

    return geo.thicken(geo.surface(nu, nv, point), thickness)


def _base(piece, kind, w, length, y_center, top, leg, frame_slot):
    """Base de la cama bajo el colchón. Devuelve la cota sobre la que apoya el colchón."""
    if kind == 'canape':
        piece.add(geo.soft_box(w, length, top - .02, (.03, .03, .03), (.004, .006, .004), at=(0, y_center, .02),
                               density=.08), 'tapiceria', 'x', 0)
        piece.add(parts.piping(w + .004, length + .004, top - .05, .03, .005, (0, y_center)), 'tapiceria', 'x', 0)
        piece.add(geo.box(w - .06, length - .06, .02, .004, 2, at=(0, y_center, 0)), 'patas', 'x')
        return top - .02
    if kind == 'tapizada':
        leg_h = .12
        piece.add(geo.soft_box(w, length, top - leg_h, (.03, .03, .03), (.004, .008, .004),
                               at=(0, y_center, leg_h), density=.08), 'tapiceria', 'x', 0)
        parts.four_legs(piece, 'patas', leg, w, length, leg_h, inset=.08, middle=True)
        return top - .04
    if kind == 'madera':
        rail_h, rail_t = .2, .035
        for sx in (-1, 1):
            piece.add(geo.box(rail_t, length - .1, rail_h, .004, 2, at=(sx * (w / 2 - rail_t / 2 - .03), y_center, top - rail_h)),
                      frame_slot, 'y')
        piece.add(geo.box(w, rail_t, rail_h, .004, 2, at=(0, y_center - length / 2 + rail_t / 2, top - rail_h)), frame_slot, 'x')
        for sx in (-1, 1):
            piece.add(geo.box(.065, .065, top + .02, .006, 2, at=(sx * (w / 2 - .0325), y_center - length / 2 + .0325, 0)),
                      frame_slot, 'z')
        piece.add(geo.box(w - .1, length - .12, .03, .003, 1, at=(0, y_center, top - .13)), frame_slot, 'y')
        return top - .12
    if kind == 'metal':
        bars = [geo.tube([(sx * (w / 2 - .015), y_center + length / 2, top - .02), (sx * (w / 2 - .015), y_center - length / 2 + .015, top - .02)], .014, 12)
                for sx in (-1, 1)]
        foot = y_center - length / 2 + .015
        # El larguero de los pies va bajo el colchón para que el edredón caiga limpio por delante.
        bars.append(geo.tube([(-w / 2 + .015, foot + .025, top - .02), (w / 2 - .015, foot + .025, top - .02)], .014, 12))
        # Pies de forja con remate de bola y un travesaño bajo (por debajo del edredón): la cama apoya en sus cuatro esquinas.
        for sx in (-1, 1):
            x = sx * (w / 2 - .015)
            bars.append(geo.tube([(x, foot, 0), (x, foot, top + .1)], .016, 12))
            bars.append(geo.sphere(.026, (x, foot, top + .1), 12))
            bars.append(geo.lathe([(.019, 0), (.022, .02), (.017, .04)], 12, at=(x, foot, 0)))
        bars.append(geo.tube([(-w / 2 + .015, foot, .2), (w / 2 - .015, foot, .2)], .011, 10))
        piece.add(geo.merge(bars), frame_slot, 'x')
        return top - .03
    raise ValueError(f'Base de cama desconocida: {kind}')


def _headboard(piece, kind, w, height, y, z0, slot):
    th = .08
    if kind in ('tapizado', 'capitone'):
        h = height - z0
        if kind == 'capitone':
            half = (w / 2, th / 2, h / 2)
            deform, pins = parts.tufting(1, -1, half, .17, .04, margin=.09)
            board = geo.soft_box(w, th + .02, h, (.035, .035, .045), (0, .012, .006), deform=deform, at=(0, y, z0),
                                 density=.03, uniform=True)
            knobs = parts.buttons([p for p in pins if p.z > -half[2] + .12], 1, -1)
            geo.transform(knobs, loc=(0, y, z0 + h / 2))
            piece.add(knobs, slot, 'x', 0)
        else:
            board = geo.soft_box(w, th, h, (.03, .035, .04), (0, .012, .006), wrinkle=.0008, at=(0, y, z0), density=.05)
        piece.add(board, slot, 'x', 0)
        return th
    if kind == 'madera':
        piece.add(geo.box(w - .1, .04, height - .3, .006, 3, at=(0, y, .3)), slot, 'x')
        for sx in (-1, 1):
            piece.add(geo.box(.06, .06, height, .008, 3, at=(sx * (w / 2 - .03), y, 0)), slot, 'z')
        return .06
    if kind == 'listones':
        for sx in (-1, 1):
            piece.add(geo.box(.06, .05, height, .006, 2, at=(sx * (w / 2 - .03), y, 0)), slot, 'z')
        piece.add(geo.box(w - .12, .05, .07, .006, 2, at=(0, y, height - .07)), slot, 'x')
        piece.add(geo.box(w - .12, .05, .07, .006, 2, at=(0, y, .32)), slot, 'x')
        count = max(5, round((w - .12) / .1))
        pitch = (w - .12) / count
        for i in range(count):
            piece.add(geo.box(pitch * .55, .025, height - .45, .004, 2, at=(-w / 2 + .06 + pitch * (i + .5), y, .38)), slot, 'z')
        return .05
    if kind == 'forja':
        rail = []
        for sx in (-1, 1):
            x = sx * (w / 2 - .02)
            rail.append(geo.tube([(x, y, 0), (x, y, height - .03)], .016, 12))
            rail.append(geo.sphere(.03, (x, y, height - .03), 14))
            rail.append(geo.lathe([(.019, 0), (.022, .02), (.017, .04)], 12, at=(x, y, 0)))
        top = [(-w / 2 + .02 + (w - .04) * k / 24, y, height - .12 + .07 * math.sin(math.pi * k / 24)) for k in range(25)]
        rail.append(geo.tube(top, .011, 10))
        rail.append(geo.tube([(-w / 2 + .02, y, .5), (w / 2 - .02, y, .5)], .011, 10))
        count = max(6, round((w - .04) / .11))
        for i in range(1, count):
            x = -w / 2 + .02 + (w - .04) * i / count
            peak = height - .12 + .07 * math.sin(math.pi * i / count)
            rail.append(geo.tube([(x, y, .5), (x, y, peak)], .006, 8))
            if i % 2:
                ring = [(x + .045 * math.cos(2 * math.pi * k / 20), y, (.5 + peak) / 2 + .06 * math.sin(2 * math.pi * k / 20)) for k in range(20)]
                rail.append(geo.tube(ring, .005, 8, closed=True))
        piece.add(geo.merge(rail), slot, 'z')
        return .04
    raise ValueError(f'Cabecero desconocido: {kind}')


def bed(piece, spec):
    w, d, h = (value / 1000 for value in spec['dims'])
    params = spec['params']
    mw, ml = params['mattress'][0] / 1000, params['mattress'][1] / 1000
    head, base = params['headboard'], params['base']
    frame_slot = 'madera' if 'madera' in piece.finishes else 'metal' if 'metal' in piece.finishes else 'tapiceria'
    head_slot = 'tapiceria' if head in ('tapizado', 'capitone') else frame_slot
    side = (w - mw) / 2
    top = {'canape': .36, 'tapizada': .34, 'madera': .38, 'metal': .42}[base]
    th = _headboard(piece, head, w, h, d / 2 - .04, .22 if base != 'canape' else .3, head_slot)
    yh = d / 2 - th - .005
    length = d - th - .005
    rest = _base(piece, base, w, length, yh - length / 2, top, params.get('leg', 'conica'), frame_slot)
    yf = yh - ml
    mattress_h = .22
    piece.add(geo.soft_box(mw, ml, mattress_h, (.035, .035, .05), (.003, .003, .006), at=(0, yh - ml / 2, rest),
                           density=.09), 'sabanas', 'y', 0)
    mt = rest + mattress_h + .008
    fold_y = yh - (.62 if mw > 1.1 else .55)
    rho = max(.04, side + .015)
    duvet = drape(mw / 2, yf, fold_y, mt, min(.3, mt - .14), rho, folds=.008, seed=1)
    piece.add(geo.thicken(duvet, .02), 'edredon', 'y', 0)
    piece.add(geo.soft_box(mw + .05, .32, .05, (.03, .05, .024), (0, .008, .012), wrinkle=.004, seed=3,
                           at=(0, fold_y + .12, mt - .005)), 'sabanas', 'x', 0)
    count = 2 if mw > 1.1 else 1
    pw = min(.8, mw / count - .05)
    for i in range(count):
        x = (i - (count - 1) / 2) * (mw / count)
        pillow = parts.pillow(pw, .5, .17, seed=20 + i)
        geo.transform(pillow, rot=(math.radians(24), 0, 0))
        geo.transform(pillow, loc=(x, yh - .26, mt + .04))
        piece.add(pillow, 'sabanas', 'x', 0)
    decor = 2 if mw > 1.1 else 1
    for i in range(decor):
        x = (i - (decor - 1) / 2) * .48
        cushion = parts.pillow(.45, .45, .15, seed=30 + i, pinch=.4)
        geo.transform(cushion, rot=(math.radians(62), 0, math.radians(4 * (1 if i else -1))))
        geo.transform(cushion, loc=(x, yh - .52, mt + .2))
        piece.add(cushion, 'cojines', 'x', 0)
    # Mismo canto (rho) y misma cota que el edredón: el plaid lo cubre con holgura y cae 20 cm por cada lado.
    piece.add(throw(mw / 2, yf + .22, yf + .72, mt, rho, .2), 'plaid', 'y', 0)


BUILDERS = {'bed': bed}
