"""Piezas comunes de electrodomésticos (metros; frente hacia -Y; pared detrás en +Y).

Cajas redondeadas de caras planas, piezas de revolución orientadas al frente, aros de ojo de buey, mandos giratorios,
pulsadores, pantallas con dígitos de siete segmentos, rejillas de ventilación, tiradores de barra, patas y placas de
marca genéricas (sin marca real). Las partes son tuplas (bmesh, hueco, veta, arista viva) que emit() añade a la pieza;
los huecos secundarios que la especificación no define toman el de FALLBACK.
"""
import math

import bmesh

import hk_geo as geo

FALLBACK = {'frente': 'carcasa', 'panel': 'frente', 'aro': 'frente', 'cajetin': 'carcasa', 'tirador': 'mandos',
            'logo': 'mandos', 'led': 'mandos', 'indicador': 'led', 'esfera': 'led', 'filtro': 'interior',
            'interior': 'goma', 'ventana': 'pantalla', 'rejilla': 'goma'}
SEGMENTS = {'0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc',
            '8': 'abcdefg', '9': 'abcdfg', '-': 'g'}


def slot(piece, name):
    wanted = name
    while name not in piece.finishes:
        if name not in FALLBACK:
            raise KeyError(f'{piece.name}: la especificación no define el material «{wanted}»')
        name = FALLBACK[name]
    return name


def emit(piece, items):
    for bm, name, grain, sharp in items:
        piece.add(bm, slot(piece, name), grain, sharp)


def rbox(w, d, h, r, segments=3, at=(0, 0, 0)):
    """Caja de aristas redondeadas con la base en `at`. Lleva un aro de apoyo en cada cara grande para que el
    sombreado suave (arista viva 0) redondee solo los cantos y deje las caras planas, como la chapa de un aparato."""
    bm = geo.box(w, d, h, r, segments, at=at)
    bm.normal_update()
    ring = min(r * .6, .003)
    faces = [face for face in bm.faces if max(abs(c) for c in face.normal) > .9999 and face.calc_area() > (4 * r) ** 2]
    if faces and ring > 1e-5:
        bmesh.ops.inset_individual(bm, faces=faces, thickness=ring, depth=0, use_even_offset=True)
    return bm


def axial(profile, x, y, z, segments=32):
    """Sólido de revolución con el eje hacia el frente: profile = [(radio, avance hacia -Y desde y), ...]."""
    bm = geo.lathe(profile, segments)
    geo.transform(bm, rot=(math.pi / 2, 0, 0))
    return geo.transform(bm, loc=(x, y, z))


def ring(radius, depth, width, x, y, z, segments=48, corner=.004):
    """Aro de radio medio `radius` que sale `depth` hacia -Y desde y, con `width` de ancho radial."""
    path = [(x + radius * math.cos(2 * math.pi * k / segments), y - depth / 2, z + radius * math.sin(2 * math.pi * k / segments))
            for k in range(segments)]
    return geo.sweep(path, geo.rounded_rect(depth, width, corner, 2), closed=True, up=(0, 1, 0))


def dial(x, y, z, r, depth=.022, mark='led'):
    """Mando giratorio que sale de la cara y, con su marca de posición."""
    body = axial([(0, 0), (r, 0), (r, depth * .8), (r * .93, depth), (0, depth)], x, y, z, 32)
    tick = geo.box(.003, .002, r * .5, 0, at=(x, y - depth - .0006, z + r * .35))
    return [(body, 'mandos', 'x', 40), (tick, mark, 'x', 0)]


def button(x, y, z, r=.007, depth=.004):
    """Pulsador redondo que sale de la cara y."""
    return axial([(0, 0), (r, 0), (r, depth * .7), (r * .82, depth), (0, depth)], x, y, z, 20)


def digits(text, x0, y, zc, height):
    """Dígitos de siete segmentos (cifras, «-», «:» y espacios) en el plano y, empezando en x0."""
    dw, s = height * .55, height * .14
    out, x = [], x0
    for char in text:
        if char == ' ':
            x += dw * .8
            continue
        if char == ':':
            for dz in (-height * .2, height * .2):
                out.append(geo.box(s, .001, s, 0, at=(x + s / 2, y, zc + dz - s / 2)))
            x += s * 2.4
            continue
        h2 = height / 2
        spots = {'a': (x + dw / 2, zc + h2 - s / 2, dw, s), 'd': (x + dw / 2, zc - h2 + s / 2, dw, s),
                 'g': (x + dw / 2, zc, dw, s), 'b': (x + dw - s / 2, zc + h2 / 2, s, h2), 'c': (x + dw - s / 2, zc - h2 / 2, s, h2),
                 'f': (x + s / 2, zc + h2 / 2, s, h2), 'e': (x + s / 2, zc - h2 / 2, s, h2)}
        for key in SEGMENTS[char]:
            cx, cz, sw, sh = spots[key]
            out.append(geo.box(sw * .88, .001, sh * .88, 0, at=(cx, y, cz - sh * .44)))
        x += dw + s * 1.6
    return geo.merge(out)


def display(x, y, z, w, h, text):
    """Pantalla de cristal negro centrada en (x, z) sobre la cara y, con dígitos claros."""
    items = [(rbox(w, .003, h, .0015, 2, at=(x, y - .0015, z - h / 2)), 'pantalla', 'x', 0)]
    if text:
        height = h * .55
        items.append((digits(text, x - w / 2 + h * .35, y - .0035, z, height), 'led', 'x', 0))
    return items


def logo(x, y, z, w=.07, h=.012):
    """Placa de marca genérica: pletina pulida sin texto ni marca real."""
    return rbox(w, .002, h, .001, 1, at=(x, y - .001, z - h / 2))


def vents(x0, x1, z0, z1, y, count, slot_name='rejilla'):
    """Rejilla de ranuras horizontales oscuras sobre la cara y."""
    pitch = (z1 - z0) / count
    bars = [geo.box(x1 - x0, .002, pitch * .45, 0, at=((x0 + x1) / 2, y - .001, z0 + pitch * (k + .275))) for k in range(count)]
    return (geo.merge(bars), slot_name, 'x', 0)


def bar(cx, yf, cz, length, axis, r=.008, standoff=.04):
    """Tirador de barra con patillas que salen `standoff` hacia -Y desde la cara yf."""
    near, far = yf + .002, yf - standoff + r
    if axis == 'x':
        pts = [(cx - length / 2, near, cz), (cx - length / 2, far, cz), (cx + length / 2, far, cz), (cx + length / 2, near, cz)]
    else:
        pts = [(cx, near, cz - length / 2), (cx, far, cz - length / 2), (cx, far, cz + length / 2), (cx, near, cz + length / 2)]
    return geo.tube(geo.fillet(pts, min(.02, standoff * .5), 4), r, 12)


def feet(xs, ys, z0, h, r=.014):
    """Patas regulables de goma bajo el aparato (base en z0)."""
    out = [geo.lathe([(0, z0), (r, z0), (r * 1.08, z0 + h * .5), (r * .85, z0 + h), (0, z0 + h)], 16, at=(x, y, 0))
           for x in xs for y in ys]
    return (geo.merge(out), 'goma', 'z', 40)
