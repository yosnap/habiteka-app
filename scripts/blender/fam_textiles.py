"""Cortinas, estores y persianas de ventana (metros; frente hacia -Y, hacia la estancia; pared detrás en +Y).

Cada pieza es un ESTADO (medida nominal y cobertura, params['coverage'] de 0 a 1) que la app elige y escala a la
ventana. Los soportes, cadenas, guías y cordones ocupan siempre la misma caja en todas las coberturas para que el
escalado sea igual en cada estado. Huecos: tela, lamas, madera, barra, perfil, soporte, cadena, cordon, mando y goma.
"""
import math
import random

import bmesh

import hk_geo as geo


def _dims(spec):
    return tuple(value / 1000 for value in spec['dims'])


def _fabric_uv(obj, columns, rows, arc, tile):
    """UV de una lámina de geo.surface: u = longitud de tela recorrida (sin saltos en los pliegues), v = altura."""
    layer = obj.data.uv_layers['UVMap']
    vertices = obj.data.vertices
    for polygon in obj.data.polygons:
        for index in polygon.loop_indices:
            vertex = obj.data.loops[index].vertex_index
            column = vertex // (rows + 1)
            if column > columns:
                continue
            layer.data[index].uv = (arc[column] / tile, vertices[vertex].co.z / tile)


def _prism_x(profile, x0, x1):
    """Prisma recto a lo largo de X con sección `profile` [(y, z), ...] (polígono convexo o en estrella desde su centro)."""
    bm = bmesh.new()
    left = [bm.verts.new((x0, y, z)) for y, z in profile]
    right = [bm.verts.new((x1, y, z)) for y, z in profile]
    n = len(profile)
    for k in range(n):
        bm.faces.new((left[k], left[(k + 1) % n], right[(k + 1) % n], right[k]))
    bm.faces.new(left[::-1])
    bm.faces.new(right)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def _cylinder_x(radius, x0, x1, y, z, segments=20):
    return _prism_x([(y + radius * math.cos(2 * math.pi * k / segments), z + radius * math.sin(2 * math.pi * k / segments))
                     for k in range(segments)], x0, x1)


def _tassel(x, y, z_bottom, height=.045, radius=.007):
    """Bellota del cordón (tirador) con la base en z_bottom."""
    profile = [(0, 0), (radius * .55, .002), (radius, height * .35), (radius * .8, height * .75), (radius * .35, height), (0, height)]
    return geo.lathe(profile, 12, at=(x, y, z_bottom))


# --- Cortina de onda ----------------------------------------------------------------------------------------------

def curtain(piece, spec):
    """Cortina de onda en dos paños colgados de anillas sobre una barra con soportes y remates.

    Cada paño tiene params['waves'] ondas que se comprimen hacia su extremo según la cobertura; la profundidad de la onda
    es la misma en todos los estados (la caja no cambia) y se abre un poco en el bajo, con variaciones suaves por onda.
    """
    w, d, h = _dims(spec)
    p = spec['params']
    coverage, waves = p['coverage'], p['waves']
    y_wall = d / 2
    rod_r, ring_mid, ring_tube = .0125, .019, .0035
    z_rod = h - rod_r - 2 * ring_tube
    # Soportes de 126 mm: la onda (±50 mm, algo más abierta en el bajo) queda dentro del fondo de la pieza.
    y_rod = y_wall - .126
    amp = .05
    track = w - .09
    top, bottom = z_rod - .052, .005
    rows_z = [bottom, bottom + .006, .05, .12, .25, .45, .7, 1.0, 1.35, 1.75, top - .25, top - .1, top - .03, top]
    rows_z = sorted(z for z in rows_z if bottom <= z <= top)
    rows = len(rows_z) - 1
    tile = max(piece.finishes['tela'].get('tile_mm', 270), 1) / 1000
    hardware = []
    for sign, seed in ((-1, 3), (1, 11)):
        rng = random.Random(seed + int(coverage * 100) + int(w * 1000))
        jitter = [.9 + .1 * rng.random() for _ in range(waves + 1)]
        drift = rng.random() * 6.28
        outer = sign * track / 2
        width = max(coverage * track / 2 - .006, .06)
        columns = waves * 16

        def point(u, v, sign=sign, outer=outer, width=width, jitter=jitter, drift=drift):
            z = rows_z[round(v * rows)]
            x = outer - sign * u * width
            wave = u * waves
            k = min(int(wave), waves - 1)
            blend = .5 - .5 * math.cos(math.pi * (wave - k))
            local = jitter[k] + (jitter[k + 1] - jitter[k]) * blend
            flare = .9 + .1 * max(0.0, 1 - (z - bottom) / .35) ** 2
            pinned = min(1.0, (top - z) / .6)
            phase = .18 * pinned * math.sin(z * 1.7 + drift + wave * .9)
            y = y_rod + amp * local * flare * math.sin(2 * math.pi * wave + phase * math.sin(math.pi * u))
            return (x, y, z)

        sheet = geo.surface(columns, rows, point)
        if sign > 0:
            bmesh.ops.reverse_faces(sheet, faces=sheet.faces)
        arc, last = [0.0], point(0, 1)
        for i in range(1, columns + 1):
            current = point(i / columns, 1)
            arc.append(arc[-1] + math.dist(last, current))
            last = current
        obj = piece.add(sheet, 'tela', 'z', 0)
        _fabric_uv(obj, columns, rows, arc, tile)
        hem = [point(i / columns, 0) for i in range(columns + 1)]
        piece.add(geo.tube([(x, y, z + .003) for x, y, z in hem], .004, 6), 'tela', 'z', 0)
        piece.add(geo.tube([point(i / columns, 1) for i in range(columns + 1)], .003, 6), 'tela', 'z', 0)
        leading = [point(1, j / rows) for j in range(rows + 1)]
        piece.add(geo.tube(leading, .0035, 6), 'tela', 'z', 0)
        # Anillas con su gancho en cada cruce trasero de la onda (una por onda más la del extremo).
        z_ring = z_rod - (ring_mid - rod_r - ring_tube)
        for k in range(waves + 1):
            x = outer - sign * (k / waves) * width
            ring = geo.tube([(x, y_rod + ring_mid * math.cos(2 * math.pi * s / 14), z_ring + ring_mid * math.sin(2 * math.pi * s / 14))
                             for s in range(14)], ring_tube, 6, closed=True)
            hardware.append(ring)
            hardware.append(geo.tube([(x, y_rod, z_ring - ring_mid - ring_tube * .5), (x, y_rod, top - .004)], .0016, 5))
    # Barra, remates y soportes.
    hardware.append(_cylinder_x(rod_r, -w / 2 + .03, w / 2 - .03, y_rod, z_rod, 20))
    for sign in (-1, 1):
        finial = geo.lathe([(0, 0), (.015, 0), (.018, .006), (.018, .02), (.012, .028), (0, .03)], 18)
        geo.transform(finial, rot=(0, sign * math.pi / 2, 0), loc=(sign * (w / 2 - .03), y_rod, z_rod))
        hardware.append(finial)
        xb = sign * (track / 2 - .06)
        plate = geo.lathe([(0, 0), (.028, 0), (.03, .003), (.026, .008), (0, .008)], 20)
        geo.transform(plate, rot=(math.pi / 2, 0, 0), loc=(xb, y_wall, z_rod - .02))
        hardware.append(plate)
        hardware.append(geo.tube([(xb, y_wall - .006, z_rod - .02), (xb, y_rod + .006, z_rod - .02), (xb, y_rod, z_rod - .014)], .006, 10))
    piece.add(geo.merge(hardware), 'barra', 'x', 40)


# --- Estor enrollable ------------------------------------------------------------------------------------------------

def roller(piece, spec):
    """Estor enrollable de caída frontal: tubo con la tela enrollada (más gruesa cuanto más recogida), tela tensa, barra
    de carga de aluminio y cadena de bolas a la derecha hasta el bajo de la pieza."""
    w, d, h = _dims(spec)
    coverage = spec['params']['coverage']
    y_t, z_t = 0.0, h - .038
    drop_max = z_t - .024
    fabric_w = w - .06
    rolled = (1 - coverage) * drop_max
    radius = math.sqrt(.016 ** 2 + .00055 * rolled / math.pi)
    piece.add(_cylinder_x(radius, -fabric_w / 2, fabric_w / 2, y_t, z_t, 28), 'tela', 'x', 0)
    piece.add(_cylinder_x(.0165, -w / 2 + .012, w / 2 - .012, y_t, z_t, 20), 'perfil', 'x', 40)
    y_f = y_t - radius
    z_b = z_t - coverage * drop_max
    if coverage > 0:
        cloth = geo.box(fabric_w, .0008, z_t - z_b, 0, at=(0, y_f, z_b))
        piece.add(cloth, 'tela', 'z', 0)
    bar = geo.sweep([(-fabric_w / 2, y_f, z_b - .011), (fabric_w / 2, y_f, z_b - .011)],
                    [(.011 * math.cos(a), .0055 * math.sin(a)) for a in (2 * math.pi * k / 16 for k in range(16))], round_ends=.004)
    piece.add(bar, 'perfil', 'x', 0)
    supports = []
    for sign in (-1, 1):
        plate = geo.box(.012, d, .075, .012, 3, at=(sign * (w / 2 - .006), 0, h - .075))
        supports.append(plate)
    piece.add(geo.merge(supports), 'soporte', 'x', 0)
    xc = w / 2 - .02
    # Cadena en bucle: dos ramales desde la polea hasta abajo, unidos por la curva inferior, y el tensor bajo ella.
    loop = [(xc, y_t + .014, z_t)] + [(xc, y_t + .014 * math.cos(math.pi * k / 8), .032 - .014 * math.sin(math.pi * k / 8))
                                      for k in range(9)] + [(xc, y_t - .014, z_t)]
    chain = [geo.tube(loop, .0018, 6),
             geo.lathe([(0, 0), (.006, .002), (.0065, .01), (.003, .015), (0, .015)], 10, at=(xc, y_t, 0))]
    piece.add(geo.merge(chain), 'cadena', 'z', 40)


# --- Venecianas de 50 mm -------------------------------------------------------------------------------------------

def _slat(length, width, thickness, wood):
    """Lama a lo largo de X centrada en el origen: madera de canto redondeado o aluminio curvado (bombeado)."""
    if wood:
        profile = geo.rounded_rect(width, thickness, thickness * .45, 2)
    else:
        n, crown = 8, .0035
        top = [(-width / 2 + width * k / n, crown * (1 - (2 * k / n - 1) ** 2) + thickness / 2) for k in range(n + 1)]
        profile = top + [(y, z - thickness) for y, z in reversed(top)]
    return _prism_x(profile, -length / 2, length / 2)


def venetian(piece, spec):
    """Veneciana de lamas de 50 mm: cabezal, paquete de lamas recogidas bajo él, lamas bajadas e inclinadas, barra
    inferior, cordones de escalera, cordón de subida con bellota hasta el bajo y varilla de orientación."""
    w, d, h = _dims(spec)
    p = spec['params']
    coverage, wood = p['coverage'], bool(p.get('wood'))
    mat = 'madera' if wood else 'lamas'
    slat_w, slat_th = .05, (.0026 if wood else .0005)
    head_h = .05 if wood else .04
    y_s = -.0025
    rail_h = .02 if wood else .012
    usable = h - head_h - .006 - rail_h
    count = max(4, round(usable / .043))
    pitch = usable / count
    lowered = round(coverage * count)
    stacked = count - lowered
    stack_pitch = .0034 if wood else .0016
    length = w - .01
    piece.add(geo.box(w - .004, .057, head_h, .003, 2, at=(0, y_s, h - head_h)), mat, 'x', 30)
    brackets = [geo.box(.03, .006, head_h * .8, 0, at=(s * (w / 2 - .09), d / 2 - .003, h - head_h * .9)) for s in (-1, 1)]
    piece.add(geo.merge(brackets), mat, 'x', 30)
    slats = []
    z = h - head_h - .004
    for _ in range(stacked):
        slat = _slat(length, slat_w, slat_th, wood)
        geo.transform(slat, loc=(0, y_s, z - stack_pitch / 2))
        slats.append(slat)
        z -= stack_pitch
    tilt = math.radians(35)
    for _ in range(lowered):
        z -= pitch
        slat = _slat(length, slat_w, slat_th, wood)
        geo.transform(slat, rot=(tilt, 0, 0), loc=(0, y_s, z + pitch / 2))
        slats.append(slat)
    piece.add(geo.merge(slats), mat, 'x', 0 if not wood else 30)
    z_rail = z - rail_h - .002
    piece.add(geo.box(length + .004, slat_w + .002, rail_h, .003, 2, at=(0, y_s, z_rail)), mat, 'x', 30)
    strings = []
    ladders = [-(w / 2 - .1), w / 2 - .1] + ([0.0] if w > 1.4 else [])
    for x in ladders:
        for side in (-1, 1):
            strings.append(geo.tube([(x, y_s + side * .021, h - head_h), (x, y_s + side * .021, z_rail + rail_h * .5)], .0007, 4))
    x_cord = -(w / 2 - .05)
    for dx in (-.004, .004):
        strings.append(geo.tube([(x_cord + dx, -.027, h - head_h), (x_cord + dx, -.027, .044)], .0011, 5))
    piece.add(geo.merge(strings), 'cordon', 'z', 40)
    controls = [_tassel(x_cord, -.027, 0.0)]
    x_wand = w / 2 - .05
    controls.append(geo.tube([(x_wand, -.0275, h - head_h - .005), (x_wand, -.0275, h - head_h - min(.9, .55 * h))], .0042, 10, round_ends=.004))
    piece.add(geo.merge(controls), 'mando', 'z', 40)


# --- Cortina de lamas verticales -----------------------------------------------------------------------------------

def vertical_blind(piece, spec):
    """Cortina de lamas verticales de 89 mm: riel con soportes, lamas casi cerradas extendidas desde un paquete a la
    izquierda (perpendicular a la ventana), cadenilla inferior y mando de cadena y cordón a la derecha hasta el bajo."""
    w, d, h = _dims(spec)
    coverage = spec['params']['coverage']
    y_h, head_h = -.004, .032
    piece.add(geo.box(w - .01, .045, head_h, .004, 2, at=(0, y_h, h - head_h)), 'perfil', 'x', 30)
    brackets = [geo.box(.03, d / 2 - .0185, .026, 0, at=(s * (w / 2 - .15), (d / 2 + .0185) / 2, h - head_h + .003)) for s in (-1, 1)]
    piece.add(geo.merge(brackets), 'perfil', 'x', 30)
    xa, xb = -w / 2 + .015, w / 2 - .015
    track = xb - xa
    total = max(3, round(track / .08))
    spread_pitch = track / total
    spread = min(total, round(coverage * track / spread_pitch))
    stack = total - spread
    slat_top = h - head_h - .014
    slat_bottom = .008
    blades, carriers = [], []
    x = xa + .0065
    angles = []
    for _ in range(stack):
        angles.append((x, math.radians(88)))
        x += .013
    x_first = x
    for k in range(spread):
        angles.append((x + spread_pitch * (k + .5), math.radians(14)))
    for cx, angle in angles:
        blade = geo.box(.089, .0012, slat_top - slat_bottom, 0, at=(0, 0, slat_bottom))
        geo.transform(blade, rot=(0, 0, angle), loc=(cx, y_h, 0))
        blades.append(blade)
        carriers.append(geo.box(.012, .012, .014, .002, 1, at=(cx, y_h, slat_top)))
    piece.add(geo.merge(blades), 'tela', 'z', 0)
    piece.add(geo.merge(carriers), 'perfil', 'x', 30)
    hardware = []
    if spread > 1:
        hardware.append(geo.tube([(x_first + spread_pitch * .5, y_h, .035), (x_first + spread_pitch * (spread - .5), y_h, .035)], .0008, 4))
    xc = w / 2 - .03
    hardware.append(geo.tube([(xc, -.040, h - head_h), (xc, -.040, .03)], .0014, 5))
    hardware.append(geo.tube([(xc, -.047, h - head_h), (xc, -.047, .03)], .0014, 5))
    hardware.append(geo.lathe([(0, 0), (.006, .002), (.0065, .014), (.003, .02), (0, .02)], 10, at=(xc, -.0435, 0)))
    piece.add(geo.merge(hardware), 'cadena', 'z', 40)


# --- Persiana enrollable exterior ----------------------------------------------------------------------------------

def _lama(length, height, depth):
    """Lama de aluminio con espuma: cara exterior bombeada hacia -Y y enganche plano detrás."""
    n = 8
    front = [(-depth / 2 - .0025 * math.sin(math.pi * k / n), height / 2 - height * k / n) for k in range(n + 1)]
    back = [(depth / 2, -height / 2), (depth / 2, height / 2)]
    return _prism_x(front + back, -length / 2, length / 2)


def shutter(piece, spec):
    """Persiana enrollable exterior: cajón compacto de aluminio con chaflán, guías laterales hasta el bajo, lamas
    bajadas según la cobertura y lama final con burlete de goma."""
    w, d, h = _dims(spec)
    coverage = spec['params']['coverage']
    box_h = .165
    piece.add(_prism_x([(-d / 2, h - box_h + .05), (-d / 2, h - .006), (-d / 2 + .008, h), (d / 2, h),
                        (d / 2, h - box_h), (-d / 2 + .055, h - box_h)], -w / 2, w / 2), 'lamas', 'x', 30)
    y_l = -.035
    guides = []
    for sign in (-1, 1):
        x = sign * (w / 2 - .011)
        guides.append(geo.box(.022, .046, h - box_h, .002, 1, at=(x, y_l, 0)))
    piece.add(geo.merge(guides), 'lamas', 'z', 30)
    pitch, lama_h, lama_d = .037, .039, .0085
    space = h - box_h - .05
    count = max(1, math.floor(space / pitch))
    lowered = round(coverage * count)
    length = w - .02
    lamas = []
    z_top = h - box_h
    for k in range(lowered):
        lama = _lama(length, lama_h, lama_d)
        geo.transform(lama, loc=(0, y_l, z_top - k * pitch - lama_h / 2))
        lamas.append(lama)
    z_final = z_top - lowered * pitch
    final = _lama(length, .045, .012)
    geo.transform(final, loc=(0, y_l, z_final - .0225))
    lamas.append(final)
    piece.add(geo.merge(lamas), 'lamas', 'x', 30)
    piece.add(geo.box(length, .008, .005, .002, 1, at=(0, y_l, z_final - .05)), 'goma', 'x', 0)


BUILDERS = {
    'curtain': curtain,
    'roller': roller,
    'venetian': venetian,
    'vertical_blind': vertical_blind,
    'shutter': shutter,
}
