"""Formas de cerámica sanitaria de la familia baño (metros; frente hacia -Y; Z arriba).

Toda la loza (lavabos, inodoros, bidés, bañeras) se construye con «lofts» de anillos polares: cada anillo es un
contorno descrito por su radio r(θ) alrededor de un centro y todos comparten los mismos ángulos, de modo que se cosen
en cuadriláteros sin costuras. Así se obtienen bordes redondeados, senos con paredes que caen y vientres bajo el
lavabo sin booleanas ni aristas vivas.
"""
import math

import bmesh

TAU = 2 * math.pi


def angles(n=72, polygon=None, center=(0.0, 0.0)):
    """Ángulos de los anillos: n uniformes más los vértices de `polygon` (para no achaflanar sus esquinas)."""
    out = [TAU * i / n for i in range(n)]
    if polygon:
        for x, y in polygon:
            out.append(math.atan2(y - center[1], x - center[0]) % TAU)
    out.sort()
    unique = [out[0]]
    for a in out[1:]:
        if a - unique[-1] > 1e-3:
            unique.append(a)
    if TAU - unique[-1] + unique[0] < 1e-3:
        unique.pop()
    return unique


def superellipse(a, b, n=2.0, front=None, n_front=None, rot=0.0):
    """r(θ) de una superelipse de semiejes a (X) y b (Y, hacia +Y). front/n_front cambian la mitad delantera (-Y):
    huevos y formas en «D» de inodoros y lavabos. rot gira la forma (radianes)."""
    front = b if front is None else front
    n_front = n if n_front is None else n_front

    def radius(theta):
        phi = theta - rot
        c, s = math.cos(phi), math.sin(phi)
        bb, nn = (b, n) if s >= 0 else (front, n_front)
        value = (abs(c) / a) ** nn + (abs(s) / bb) ** nn
        return value ** (-1 / nn) if value > 1e-12 else max(a, bb)
    return radius


def rect_points(x0, x1, y0, y1, radius=0.0, steps=5, corners=(True, True, True, True)):
    """Rectángulo (antihorario) con esquinas redondeadas; corners = (inf. izq., inf. der., sup. der., sup. izq.)."""
    r = min(radius, (x1 - x0) * .49, (y1 - y0) * .49)
    pts = []
    spec = ((x0, y0, 180, corners[0]), (x1, y0, 270, corners[1]), (x1, y1, 0, corners[2]), (x0, y1, 90, corners[3]))
    for x, y, a0, rounded in spec:
        if not rounded or r < 1e-5:
            pts.append((x, y))
            continue
        cx = x + r if x == x0 else x - r
        cy = y + r if y == y0 else y - r
        for k in range(steps + 1):
            a = math.radians(a0 + 90 * k / steps)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def polygon(points, center):
    """r(θ) de un polígono estrellado respecto a `center` (intersección del rayo con su contorno)."""
    cx, cy = center
    edges = list(zip(points, points[1:] + points[:1]))

    def radius(theta):
        ux, uy = math.cos(theta), math.sin(theta)
        best = None
        for (px, py), (qx, qy) in edges:
            ex, ey = qx - px, qy - py
            denom = ux * ey - uy * ex
            if abs(denom) < 1e-12:
                continue
            wx, wy = px - cx, py - cy
            t = (wx * ey - wy * ex) / denom
            s = (wx * uy - wy * ux) / denom
            if -1e-9 <= s <= 1 + 1e-9 and t > 1e-9 and (best is None or t < best):
                best = t
        if best is None:
            raise ValueError('El centro del anillo queda fuera del contorno')
        return best
    return radius


def ring(radius, thetas, z, center=(0.0, 0.0), scale=1.0, offset=0.0):
    """Anillo 3D: centro + dirección·(r(θ)·scale + offset) a la altura z."""
    cx, cy = center
    return [(cx + math.cos(t) * (radius(t) * scale + offset), cy + math.sin(t) * (radius(t) * scale + offset), z)
            for t in thetas]


def loft(rings):
    """Cose anillos consecutivos con el mismo número de puntos; un anillo de un solo punto (x, y, z) es un polo."""
    bm = bmesh.new()
    verts = [[bm.verts.new(item)] if isinstance(item[0], (int, float)) else [bm.verts.new(p) for p in item]
             for item in rings]
    for a, b in zip(verts, verts[1:]):
        n = max(len(a), len(b))
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(n):
            j = (i + 1) % n
            if len(a) == 1:
                bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[j], b[0]))
            else:
                bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


# Perfil de las paredes de un seno: (fracción del radio del borde, fracción de la profundidad bajo el borde).
BOWL_WALL = ((.35, .99), (.6, .95), (.75, .87), (.86, .72), (.93, .52), (.97, .3), (1.0, 0.0))


def basin_slab(outer, bowl, center, z_top, thickness, depth, thetas, edge=.006, rim=.008, wall=.012,
               bowl_wall=BOWL_WALL, bottom=None):
    """Pieza de loza con un seno: encimera de lavabo integrado, lavabo suspendido, bañera o bidé.

    outer(delta) y bowl son funciones r(θ) respecto a `center`; outer acepta un retranqueo delta para redondear el
    canto exterior. thickness es el canto visible; si el seno es más hondo, la cara inferior sigue su vientre con el
    grueso `wall`. bottom(delta) permite otro contorno inferior (bañeras y lavabos que se estrechan hacia abajo).
    """
    cx, cy = center
    floor_z = z_top - rim - depth
    rings = [(cx, cy, floor_z)]
    for s, h in bowl_wall:
        rings.append(ring(bowl, thetas, z_top - rim - depth * h, center, s))
    rings.append(ring(bowl, thetas, z_top - rim * .3, center, 1.0, rim * .3))
    rings.append(ring(bowl, thetas, z_top, center, 1.0, rim))
    o0, oe = outer(0.0), outer(edge)
    inner = lambda t: bowl(t) + rim  # noqa: E731 - contorno del borde del seno ya redondeado
    for f in (.5,):
        rings.append([(cx + math.cos(t) * (inner(t) * (1 - f) + oe(t) * f),
                       cy + math.sin(t) * (inner(t) * (1 - f) + oe(t) * f), z_top) for t in thetas])
    rings.append(ring(oe, thetas, z_top, center))
    rings.append(ring(outer(edge * .3), thetas, z_top - edge * .3, center))
    rings.append(ring(o0, thetas, z_top - edge, center))
    low = z_top - thickness
    base = bottom or outer
    rings.append(ring(base(0.0), thetas, low + edge, center))
    rings.append(ring(base(edge * .3), thetas, low + edge * .3, center))
    rings.append(ring(base(edge), thetas, low, center))
    if depth + rim + wall > thickness - .002:
        # Vientre del seno: la cara inferior se cuelga del contorno del seno engrosado.
        rings.append(ring(bowl, thetas, low, center, 1.0, wall + rim))
        for s, h in reversed(bowl_wall[1:-1]):
            z = z_top - rim - depth * h - wall
            if z < low - .002:
                rings.append(ring(bowl, thetas, z, center, s, wall))
        rings.append((cx, cy, floor_z - wall))
    else:
        rings.append((cx, cy, low))
    return loft(rings)


def vessel(shape, thetas, height, wall=.008, base=.62, center=(0.0, 0.0), z0=0.0, flare=1.0):
    """Lavabo de sobre encimera (o bañera exenta): pared fina que sube desde una base menor hasta el borde.

    shape es r(θ) del borde exterior; base, la escala del apoyo; flare < 1 hace la pared más recta.
    """
    cx, cy = center
    outer = []
    for k in range(7):
        t = k / 6
        s = base + (1 - base) * (1 - (1 - t) ** (1.6 * flare))
        outer.append(ring(shape, thetas, z0 + .004 + (height - .004) * t ** 1.15, center, s))
    rings = [(cx, cy, z0), ring(shape, thetas, z0, center, base - .03)] + outer[:-1]
    rings.append(ring(shape, thetas, z0 + height - wall * .4, center, 1.0))
    rings.append(ring(shape, thetas, z0 + height, center, 1.0, -wall * .5))
    rings.append(ring(shape, thetas, z0 + height - wall * .4, center, 1.0, -wall))
    for k in range(5, 0, -1):
        t = k / 6
        s = base + (1 - base) * (1 - (1 - t) ** (1.6 * flare))
        rings.append(ring(shape, thetas, z0 + .004 + (height - .004) * t ** 1.15 + wall * (1 - t) * 1.5, center, s,
                          -wall * (1.2 if k < 3 else 1.0)))
    rings.append(ring(shape, thetas, z0 + wall * 1.6, center, base * .6))
    rings.append((cx, cy, z0 + wall * 1.4))
    return loft(rings)


def pillow_slab(shape, thetas, z0, height, center=(0.0, 0.0), edge=None, dome=0.0):
    """Losa de cantos muy redondeados (tapa y asiento de inodoro, cisterna): contorno r(θ), alto y abombado."""
    cx, cy = center
    e = min(edge if edge is not None else height * .45, height * .49)
    rings = [(cx, cy, z0)]
    for k in range(4):
        a = math.pi / 2 * k / 3
        rings.append(ring(shape, thetas, z0 + e * (1 - math.cos(a)), center, 1.0, -e * (1 - math.sin(a))))
    for k in range(4):
        a = math.pi / 2 * k / 3
        rings.append(ring(shape, thetas, z0 + height - e + e * math.sin(a), center, 1.0, -e * (1 - math.cos(a))))
    if dome:
        rings.append(ring(shape, thetas, z0 + height + dome * .6, center, .55))
    rings.append((cx, cy, z0 + height + dome))
    return loft(rings)
