"""Follaje de exterior de la familia «jardin»: ramilletes pintados con hojas CC0 y tarjetas con recorte alfa.

Un árbol de 4 m no cabe con hojas sueltas en el presupuesto de 40 000 triángulos. Cada tarjeta es un ramillete: una
ramita con 8–16 hojas recortadas de un atlas CC0 (ambientCG LeafSet, una hoja por componente conexa del alfa) y
compuestas con numpy en una celda del atlas de la pieza, con su mapa de normales girado con cada hoja. Las celdas
interiores se pintan más oscuras (sombra propia de la copa). Las tarjetas son láminas de 2 × 3 cuadros, curvadas y
abarquilladas, con la base de la ramita hacia la rama que las sostiene. El material es el de las plantas de interior
(fam_plantas_img: recorte alfa MASK a doble cara).

Las superficies opacas (seto, bolas de boj) usan además una textura continua (`fill`) pintada con los mismos
ramilletes en modo toroidal para que se repita sin costuras. Metros, Z arriba, suelo en Z = 0 y frente hacia -Y.
"""
import math

import numpy as np
from mathutils import Vector

import fam_plantas_geo as pg
import fam_plantas_img as img

UP = Vector((0, 0, 1))


# ---------------------------------------------------------------- hojas CC0 sueltas

def _components(mask):
    """Componentes conexas (4 vecinos) de una máscara booleana pequeña: lista de arrays (y, x)."""
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    found = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        stack, points = [(y0, x0)], []
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            points.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        found.append(np.array(points))
    return found


def leaves_of(finish, min_area=.004, block=8):
    """Hojas sueltas de un atlas CC0 con alfa: [{rgba, normal}] recortadas con la base abajo y la punta arriba.

    Los atlas LeafSet de ambientCG traen cada hoja aislada y en vertical, con el pecíolo abajo; cada componente conexa
    del alfa (a 1/8 de resolución) es una hoja. Se descartan las motas de menos de `min_area` de la imagen.
    """
    source = img.Source(finish)
    alpha = source.rgba[..., 3]
    h, w = alpha.shape
    small = alpha[:h // block * block, :w // block * block].reshape(h // block, block, w // block, block).mean(axis=(1, 3))
    result = []
    for points in _components(small > .25):
        if len(points) * block * block < min_area * h * w:
            continue
        y0, x0 = (points.min(axis=0) - 1) * block
        y1, x1 = (points.max(axis=0) + 2) * block
        y0, x0, y1, x1 = max(0, y0), max(0, x0), min(h, y1), min(w, x1)
        crop = alpha[y0:y1, x0:x1] > .5
        rows, cols = np.nonzero(crop.any(axis=1))[0], np.nonzero(crop.any(axis=0))[0]
        y0, y1, x0, x1 = y0 + rows[0], y0 + rows[-1] + 1, x0 + cols[0], x0 + cols[-1] + 1
        result.append({'rgba': source.rgba[y0:y1, x0:x1].copy(), 'normal': source.normal[y0:y1, x0:x1].copy()})
    if not result:
        raise ValueError('El atlas CC0 no tiene hojas sueltas')
    return result


def leaves_from_atlas(atlas, rects):
    """Hojas pintadas en celdas de un Atlas (siluetas propias): mismas claves que leaves_of, base abajo."""
    out = []
    for x0, y0, w, h in rects:
        rgba = np.concatenate([atlas.color[y0:y0 + h, x0:x0 + w], atlas.alpha[y0:y0 + h, x0:x0 + w, None]], -1)
        out.append({'rgba': rgba.copy(), 'normal': atlas.normal[y0:y0 + h, x0:x0 + w].copy()})
    return out


# ---------------------------------------------------------------- pintura en celdas

def _over(atlas, ys, xs, rgb, a, normal):
    """Compone «encima» (alfa recto) color, alfa y normales en la región (ys, xs) del atlas."""
    old_a = atlas.alpha[ys, xs]
    out_a = a + old_a * (1 - a)
    keep = np.maximum(out_a, 1e-6)[..., None]
    atlas.color[ys, xs] = (rgb * a[..., None] + atlas.color[ys, xs] * (old_a * (1 - a))[..., None]) / keep
    atlas.alpha[ys, xs] = out_a
    if normal is not None:
        atlas.normal[ys, xs] = normal * a[..., None] + atlas.normal[ys, xs] * (1 - a[..., None])


def _regions(rect, box, wrap):
    """Ventanas (filas, columnas, desplazamiento) donde cae la caja `box` (x0, y0, x1, y1) dentro de la celda."""
    x0, y0, cw, ch = rect
    shifts = [(dx, dy) for dx in (-cw, 0, cw) for dy in (-ch, 0, ch)] if wrap else [(0, 0)]
    for dx, dy in shifts:
        bx0, by0 = max(0, int(box[0] + dx)), max(0, int(box[1] + dy))
        bx1, by1 = min(cw, int(math.ceil(box[2] + dx)) + 1), min(ch, int(math.ceil(box[3] + dy)) + 1)
        if bx1 > bx0 and by1 > by0:
            yield slice(y0 + by0, y0 + by1), slice(x0 + bx0, x0 + bx1), (bx0 - dx, by0 - dy)


def paint_leaf(atlas, rect, leaf, base, angle, length, gain=1.0, hue=None, wrap=False):
    """Hoja CC0 con la base en `base` (px de la celda, y hacia abajo), girada `angle` (rad, horario desde arriba)."""
    src, nrm = leaf['rgba'], leaf['normal']
    sh, sw = src.shape[:2]
    scale = length / sh
    d = np.array([math.sin(angle), -math.cos(angle)])
    right = np.array([-d[1], d[0]])
    half = sw * scale / 2
    corners = [np.asarray(base) + right * s * half + d * t * length for s in (-1, 1) for t in (0, 1)]
    box = (min(c[0] for c in corners), min(c[1] for c in corners), max(c[0] for c in corners), max(c[1] for c in corners))
    for ys, xs, (ox, oy) in _regions(rect, box, wrap):
        gy, gx = np.mgrid[0:ys.stop - ys.start, 0:xs.stop - xs.start].astype(np.float32)
        px, py = gx + ox + .5 - base[0], gy + oy + .5 - base[1]
        along, across = (px * d[0] + py * d[1]) / scale, (px * right[0] + py * right[1]) / scale
        sx, sy = sw / 2 + across, sh - 1 - along
        inside = ((sx >= 0) & (sx < sw - 1) & (sy >= 0) & (sy < sh - 1)).astype(np.float32)
        rgba = img.sample(src, sx, sy)
        a = rgba[..., 3] * inside
        if not a.any():
            continue
        rgb = rgba[..., :3] * gain
        if hue is not None:
            rgb = hue(rgb)
        n = img.sample(nrm, sx, sy) * 2 - 1
        c, s = math.cos(angle), math.sin(angle)
        rotated = np.stack([n[..., 0] * c + n[..., 1] * s, -n[..., 0] * s + n[..., 1] * c, n[..., 2]], -1)
        _over(atlas, ys, xs, rgb, a, rotated * .5 + .5)


def paint_twig(atlas, rect, points, radii, color, wrap=False):
    """Ramita (polilínea en px de la celda) con sección redonda: color con estrías y normales de cilindro."""
    color = np.array(color, np.float32)
    for (p, q), (r0, r1) in zip(zip(points, points[1:]), zip(radii, radii[1:])):
        p, q = np.asarray(p, np.float32), np.asarray(q, np.float32)
        r = max(r0, r1) + 1
        box = (min(p[0], q[0]) - r, min(p[1], q[1]) - r, max(p[0], q[0]) + r, max(p[1], q[1]) + r)
        seg = q - p
        length = max(float(np.hypot(*seg)), 1e-3)
        unit, perp = seg / length, np.array([-seg[1], seg[0]]) / length
        for ys, xs, (ox, oy) in _regions(rect, box, wrap):
            gy, gx = np.mgrid[0:ys.stop - ys.start, 0:xs.stop - xs.start].astype(np.float32)
            vx, vy = gx + ox + .5 - p[0], gy + oy + .5 - p[1]
            t = np.clip((vx * unit[0] + vy * unit[1]) / length, 0, 1)
            side = vx * perp[0] + vy * perp[1]
            dist = np.hypot(vx - t * seg[0], vy - t * seg[1])
            radius = r0 + (r1 - r0) * t
            a = np.clip(radius - dist + .5, 0, 1)
            if not a.any():
                continue
            k = np.clip(side / np.maximum(radius, .5), -1, 1)
            shade = (.75 + .25 * np.sqrt(1 - k * k))[..., None]
            normal = np.stack([k * perp[0], -k * perp[1], np.sqrt(np.maximum(0, 1 - k * k))], -1) * .5 + .5
            _over(atlas, ys, xs, color * shade, a, normal)


def _bezier2(p0, p1, p2, n):
    return [tuple((1 - t) ** 2 * np.asarray(p0) + 2 * (1 - t) * t * np.asarray(p1) + t * t * np.asarray(p2))
            for t in (k / n for k in range(n + 1))]


def _along(path, f):
    x = f * (len(path) - 1)
    k = min(len(path) - 2, int(x))
    a, b = np.asarray(path[k]), np.asarray(path[k + 1])
    point = a + (b - a) * (x - k)
    tangent = b - a
    return point, math.atan2(tangent[0], -tangent[1])


def spray(atlas, rect, leaves, rng, count=10, leaf=.34, spread=48, twig=(.32, .25, .16), width=2.4, gain=(.78, 1.04),
          hue=None, pairs=False, sides=2, wrap=False, base=None, tilt=0.0, reach=.86):
    """Ramillete en una celda: ramita de la base (abajo) a la punta con `count` hojas, alternas u opuestas (`pairs`).

    leaf es el largo de la hoja en fracción del alto de la celda; las hojas menguan hacia la punta y las de abajo se
    pintan más oscuras (gain). sides añade ramitas laterales con hojas propias. hue(rgb) da el tono de la especie.
    """
    x0, y0, cw, ch = rect
    start = np.array(base if base is not None else (cw / 2, ch - 2.0), np.float32)
    end = start + np.array([math.sin(tilt) * ch * reach + rng.uniform(-.1, .1) * cw, -math.cos(tilt) * ch * reach])
    mid = (start + end) / 2 + np.array([rng.uniform(-.12, .12) * cw, 0])
    path = _bezier2(start, mid, end, 12)
    paint_twig(atlas, rect, path, np.linspace(width, width * .45, len(path)), twig, wrap)
    branches = [(path, count)]
    for k in range(sides):
        f = rng.uniform(.25, .6)
        point, ang = _along(path, f)
        ang += (1 if k % 2 else -1) * math.radians(rng.uniform(28, 48))
        tip = point + np.array([math.sin(ang), -math.cos(ang)]) * ch * reach * rng.uniform(.35, .55)
        sub = _bezier2(point, (point + tip) / 2 + rng.uniform(-6, 6, 2), tip, 8)
        paint_twig(atlas, rect, sub, np.linspace(width * .7, width * .35, len(sub)), twig, wrap)
        branches.append((sub, max(3, count // 3)))
    for index, (branch, n) in enumerate(branches):
        for i in range(n):
            f = .16 + .8 * i / max(1, n - 1)
            point, ang = _along(branch, f)
            size = leaf * ch * (1 - .32 * f) * rng.uniform(.82, 1.08) * (1 if index == 0 else .85)
            g = gain[0] + (gain[1] - gain[0]) * f + rng.uniform(-.05, .05)
            sides_here = (-1, 1) if pairs else ((-1 if i % 2 else 1),)
            for side in sides_here:
                a = ang + side * math.radians(spread + rng.uniform(-14, 14))
                paint_leaf(atlas, rect, leaves[rng.integers(len(leaves))], point, a, size, g, hue, wrap)
        point, ang = _along(branch, 1.0)
        paint_leaf(atlas, rect, leaves[rng.integers(len(leaves))], point, ang + rng.uniform(-.2, .2),
                   leaf * ch * .62, gain[1], hue, wrap)


def cluster(atlas, rect, leaves, rng, count=7, leaf=.8, spread=55, gain=(.8, 1.05), hue=None, wrap=False):
    """Ramilletes que ya son ramitas (boj, LeafSet002): `count` brotes que salen en abanico de la base."""
    x0, y0, cw, ch = rect
    base = (cw / 2, ch - 2.0)
    for i in range(count):
        f = i / max(1, count - 1)
        angle = math.radians(rng.uniform(-spread, spread))
        size = leaf * ch * rng.uniform(.72, 1.0)
        paint_leaf(atlas, rect, leaves[rng.integers(len(leaves))], base, angle, size,
                   gain[0] + (gain[1] - gain[0]) * f + rng.uniform(-.05, .05), hue, wrap)


def fill(atlas, rect, leaves, rng, density=60, leaf=.22, base_rgb=(.05, .09, .03), gain=(.55, 1.0), hue=None):
    """Textura opaca y continua (se repite sin costuras) de follaje denso: fondo oscuro cubierto de hojas."""
    x0, y0, cw, ch = rect
    atlas.color[y0:y0 + ch, x0:x0 + cw] = base_rgb
    atlas.alpha[y0:y0 + ch, x0:x0 + cw] = 1
    for i in range(density):
        point = (rng.uniform(0, cw), rng.uniform(0, ch))
        g = gain[0] + (gain[1] - gain[0]) * i / max(1, density - 1)
        paint_leaf(atlas, rect, leaves[rng.integers(len(leaves))], point, rng.uniform(0, 2 * math.pi),
                   leaf * ch * rng.uniform(.75, 1.1), g, hue, wrap=True)
    atlas.alpha[y0:y0 + ch, x0:x0 + cw] = 1


def shade(rgb_fn, factor):
    """Tono de especie oscurecido (celdas interiores de la copa)."""
    return lambda rgb: rgb_fn(rgb) * factor if rgb_fn else rgb * factor


# ---------------------------------------------------------------- tarjetas y copas

def card(buf, atlas, rect, base, axis, facing, height, width, bend=.12, cup=.1, nu=2, nv=3):
    """Lámina de un ramillete: base de la ramita en `base`, punta hacia `axis`, cara hacia `facing`."""
    a = Vector(axis).normalized()
    side = Vector(facing).cross(a)
    if side.length < 1e-4:
        side = a.orthogonal()
    side.normalize()
    n = a.cross(side).normalized()
    rows, uvs = [], []
    for i in range(nv + 1):
        t = i / nv
        row, row_uv = [], []
        for j in range(nu + 1):
            s = j / nu
            p = Vector(base) + a * height * t + side * width * (s - .5) + n * (bend * height * t * t + cup * width * (2 * s - 1) ** 2)
            row.append(p)
            row_uv.append(atlas.uv(rect, s, t))
        rows.append(row)
        uvs.append(row_uv)
    buf.grid(rows, uvs)


def random_unit(rng):
    z = rng.uniform(-1, 1)
    a = rng.uniform(0, 2 * math.pi)
    r = math.sqrt(1 - z * z)
    return Vector((r * math.cos(a), r * math.sin(a), z))


def _tangent_frame(out, rng, lift, tilt):
    """Eje de la ramita (tangente a la copa, algo hacia arriba y hacia fuera) y cara hacia fuera con giro al azar."""
    facing = (out + random_unit(rng) * .35).normalized()
    t = UP * lift + random_unit(rng)
    t = (t - facing * t.dot(facing))
    if t.length < 1e-4:
        t = facing.orthogonal()
    axis = (t.normalized() + facing * tilt).normalized()
    return axis, facing


def spray_cards(buf, atlas, cells, inner_cells, rng, anchors, center, radii, per_anchor, size, spread=.3,
                lift=.6, tilt=.35, aspect=1.0, top_cells=None):
    """Racimos de tarjetas alrededor de las puntas de rama (`anchors`), de cara hacia fuera de la copa.

    Cada ramillete mira hacia fuera (como las hojas buscando la luz) y su ramita corre tangente a la copa, algo hacia
    arriba: desde cualquier punto de vista, también desde arriba en la planta, se ven hojas y no láminas de canto. Las
    que quedan en el interior (menos del 70 % del radio) usan las celdas oscuras `inner_cells` y las de la mitad alta
    de la copa, las celdas al sol `top_cells` si las hay.
    """
    c = Vector(center)
    for anchor in anchors:
        anchor = Vector(anchor)
        for _ in range(per_anchor):
            p = anchor + random_unit(rng) * spread * rng.uniform(.2, 1.0)
            rel = Vector(((p.x - c.x) / radii[0], (p.y - c.y) / radii[1], (p.z - c.z) / radii[2]))
            out = rel.normalized() if rel.length > 1e-4 else UP
            axis, facing = _tangent_frame(out, rng, lift, tilt)
            h = size * rng.uniform(.75, 1.15)
            inner = rel.length < .7
            pool = inner_cells if inner and inner_cells else top_cells if top_cells and rel.z > .35 else cells
            card(buf, atlas, pool[rng.integers(len(pool))], p - axis * h * .4, axis, facing, h, h * aspect,
                 bend=rng.uniform(.05, .2), cup=rng.uniform(.04, .14))


def surface_cards(buf, atlas, cells, rng, samples, size, lift=.3, tilt=.5, nu=1, nv=2):
    """Tarjetas cortas sobre una superficie: samples = [(punto, normal)], de cara hacia fuera y brotando de ella."""
    for point, normal in samples:
        axis, facing = _tangent_frame(Vector(normal).normalized(), rng, lift, tilt)
        h = size * rng.uniform(.7, 1.2)
        card(buf, atlas, cells[rng.integers(len(cells))], Vector(point) - axis * h * .45, axis, facing, h, h,
             bend=rng.uniform(.0, .15), cup=rng.uniform(.0, .1), nu=nu, nv=nv)


# ---------------------------------------------------------------- volúmenes con textura de follaje

def opaque_buf(bm, tile):
    """Malla bmesh → MeshBuf con UV cúbicas en metros / tile (para la textura continua de follaje)."""
    buf = pg.MeshBuf()
    bm.normal_update()
    index = {v: k for k, v in enumerate(bm.verts)}
    buf.verts = [tuple(v.co) for v in bm.verts]
    for face in bm.faces:
        n = face.normal
        axis = max(range(3), key=lambda k: abs(n[k]))
        u_axis, v_axis = [k for k in range(3) if k != axis]
        buf.faces.append(tuple(index[v] for v in face.verts))
        buf.uvs.append(tuple((v.co[u_axis] / tile, v.co[v_axis] / tile) for v in face.verts))
    bm.free()
    return buf


def fit(buffers, w, d, h, floor=0.0, keep_x=False):
    """Escala todo (follaje, ramas y suelo) para que la caja mida exactamente w × d × h, centrada y apoyada en Z = 0.

    keep_x deja X tal cual (módulos que se repiten y ya miden su ancho exacto).
    """
    verts = [v for buf in buffers for v in buf.verts]
    lo = [min(v[k] for v in verts) for k in range(3)]
    hi = [max(v[k] for v in verts) for k in range(3)]
    k = [w / max(hi[0] - lo[0], 1e-6), d / max(hi[1] - lo[1], 1e-6), (h - floor) / max(hi[2] - lo[2], 1e-6)]
    cx, cy = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
    if keep_x:
        k[0], cx = 1.0, 0.0
    print(f'HK-AJUSTE x{k[0]:.2f} y{k[1]:.2f} z{k[2]:.2f}', flush=True)
    for buf in buffers:
        buf.verts = [((x - cx) * k[0], (y - cy) * k[1], floor + (z - lo[2]) * k[2]) for x, y, z in buf.verts]


def mulch(piece, radius, slot='suelo', seed=0):
    """Alcorque de mantillo (disco algo abombado) al pie de un árbol o una mata."""
    buf = pg.MeshBuf()
    pg.soil(buf, radius, .004, mound=.012, tile=pg.tile_of(piece.finishes.get(slot), .6), seed=seed)
    return buf
