"""Geometría de la familia «plantas» con UV propias: hojas (láminas curvadas), tallos, macetas y tierra.

`Piece.add` proyecta UV cúbicas a escala real; las hojas, en cambio, apuntan a celdas del atlas y los tallos y macetas
llevan UV cilíndricas. Por eso aquí las mallas se construyen con `MeshBuf` (vértices, caras y UV por esquina) y se
añaden a `piece.objects` con su material; la capa se llama «UVMap», como la de `Piece.add`, para que `join` las una.
Metros, Z arriba, suelo en Z = 0 y frente hacia -Y.
"""
import math
import random
import zlib

import bpy
from mathutils import Vector, noise

import hk_geo as geo


class MeshBuf:
    """Malla en construcción: vértices, caras y UV por esquina de cara."""

    def __init__(self):
        self.verts, self.faces, self.uvs = [], [], []

    def grid(self, points, uvs):
        """Rejilla de cuadriláteros: points[i][j] (i a lo largo, j a lo ancho) y uvs con la misma forma."""
        start = len(self.verts)
        rows, cols = len(points), len(points[0])
        for row in points:
            self.verts.extend(tuple(p) for p in row)
        index = lambda i, j: start + i * cols + j  # noqa: E731
        for i in range(rows - 1):
            for j in range(cols - 1):
                self.faces.append((index(i, j), index(i, j + 1), index(i + 1, j + 1), index(i + 1, j)))
                self.uvs.append((uvs[i][j], uvs[i][j + 1], uvs[i + 1][j + 1], uvs[i + 1][j]))

    def fan(self, center, ring, center_uv, ring_uvs, flip=False):
        """Tapa en abanico: un vértice central unido a un anillo cerrado."""
        c = len(self.verts)
        self.verts.append(tuple(center))
        start = len(self.verts)
        self.verts.extend(tuple(p) for p in ring)
        n = len(ring)
        for k in range(n):
            a, b = start + k, start + (k + 1) % n
            face, uv = (c, a, b), (center_uv, ring_uvs[k], ring_uvs[(k + 1) % n])
            self.faces.append(face[::-1] if flip else face)
            self.uvs.append(uv[::-1] if flip else uv)

    def to_object(self, piece, name, material, smooth=True):
        if not self.faces:
            return None
        mesh = bpy.data.meshes.new(f'{piece.name}-{name}')
        mesh.from_pydata(self.verts, [], self.faces)
        layer = mesh.uv_layers.new(name='UVMap')
        layer.data.foreach_set('uv', [c for face in self.uvs for uv in face for c in uv])
        mesh.update()
        if smooth:
            mesh.shade_smooth()
        mesh.materials.append(material)
        obj = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        piece.objects.append(obj)
        return obj


# ---------------------------------------------------------------- curvas y tubos

def bezier(p0, p1, p2, p3, n):
    p0, p1, p2, p3 = (Vector(p) for p in (p0, p1, p2, p3))
    return [(1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3
            for t in (k / n for k in range(n + 1))]


def hermite(p0, d0, p1, d1, n, tension=1.0):
    """Curva de p0 (dirección d0) a p1 (llega con dirección d1)."""
    p0, p1 = Vector(p0), Vector(p1)
    span = (p1 - p0).length * tension / 3
    return bezier(p0, p0 + Vector(d0).normalized() * span, p1 - Vector(d1).normalized() * span, p1, n)


def resample(points, n):
    """Reparte n + 1 puntos a distancias iguales a lo largo de una polilínea."""
    pts = [Vector(p) for p in points]
    lengths = [0.0]
    for a, b in zip(pts, pts[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    total, out, k = lengths[-1], [], 0
    for i in range(n + 1):
        target = total * i / n
        while k < len(pts) - 2 and lengths[k + 1] < target:
            k += 1
        span = max(lengths[k + 1] - lengths[k], 1e-9)
        out.append(pts[k].lerp(pts[k + 1], (target - lengths[k]) / span))
    return out


def tube(buf, points, radii, segments=8, rect=None, tile=None, cap=False, jitter=0.0, seed=0, ribs=0, rib_depth=.12):
    """Tubo de radio variable a lo largo de `points` (transporte paralelo del marco).

    UV: `rect` = (u0, v0, u1, v1) de una celda del atlas (vuelta completa a lo ancho, longitud a lo alto) o `tile` =
    tamaño real (m) de una textura que se repite. jitter deforma ligeramente la sección (tallos leñosos). ribs > 0
    acanala la sección (costillas de cactus) y entonces la textura da una vuelta exacta (u de 0 a 1).
    """
    pts = [Vector(p) for p in points]
    n = len(pts)
    if isinstance(radii, (int, float)):
        radii = [radii] * n
    tangents = []
    for i in range(n):
        t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        tangents.append(t.normalized() if t.length > 1e-9 else Vector((0, 0, 1)))
    ref = Vector((0, 0, 1)) if abs(tangents[0].z) < .9 else Vector((1, 0, 0))
    normal = (ref - tangents[0] * ref.dot(tangents[0])).normalized()
    arc, rows, uvs = 0.0, [], []
    total = sum((b - a).length for a, b in zip(pts, pts[1:])) or 1e-6
    for i, (p, t) in enumerate(zip(pts, tangents)):
        if i:
            normal.rotate(tangents[i - 1].rotation_difference(t))
            arc += (p - pts[i - 1]).length
        normal = (normal - t * normal.dot(t)).normalized()
        binormal = t.cross(normal)
        ring, ring_uv = [], []
        for k in range(segments + 1):
            a = 2 * math.pi * k / segments
            r = radii[i]
            if jitter:
                r *= 1 + jitter * noise.noise(Vector((math.cos(a) * 2, math.sin(a) * 2, arc * 9 + seed)))
            if ribs:
                r *= 1 - rib_depth + rib_depth * abs(math.cos(ribs * a / 2)) ** .6
            ring.append(p + (normal * math.cos(a) + binormal * math.sin(a)) * r)
            if ribs:
                ring_uv.append((k / segments, arc / tile))
            elif rect:
                ring_uv.append((rect[0] + (rect[2] - rect[0]) * k / segments, rect[1] + (rect[3] - rect[1]) * arc / total))
            else:
                ring_uv.append((2 * math.pi * radii[i] * k / segments / tile, arc / tile))
        rows.append(ring)
        uvs.append(ring_uv)
    buf.grid(rows, uvs)
    if cap:
        end = rows[-1][:-1]
        uv_c = ((rect[0] + rect[2]) / 2, rect[3]) if rect else (0, arc / tile)
        buf.fan(pts[-1] + tangents[-1] * radii[-1] * .3, end, uv_c, [uv_c] * len(end))
    return pts


# ---------------------------------------------------------------- hojas

def leaf(buf, atlas, rect, base, yaw, pitch, length, width, attach=0.0, droop=0.0, roll=0.0, fold=0.0, cup=0.0,
         wave=0.0, waves=3.0, side=0.0, nu=6, nv=8, phase=0.0, twist=0.0):
    """Lámina de hoja con el punto de unión del pecíolo en `base` (celda `rect` del atlas).

    yaw: rumbo (rad) de la hoja; pitch: inclinación inicial sobre la horizontal; droop: caída acumulada hasta la punta
    (rad, por peso); roll: giro sobre su eje; fold: pliegue en V del nervio (pendiente); cup: abarquillado de los bordes
    (fracción del ancho, > 0 bordes arriba); wave: ondulación del margen (fracción del ancho); side: curvatura lateral
    del eje (fracción del largo); twist: giro progresivo hacia la punta (rad). attach es la t (0..1) del pecíolo en la
    celda (las hojas acorazonadas tienen los lóbulos por debajo). Devuelve la dirección inicial del eje.
    """
    base = Vector(base)
    h = Vector((math.cos(yaw), math.sin(yaw), 0))
    right0 = h.cross(Vector((0, 0, 1)))
    up = Vector((0, 0, 1))
    ts = [k / nv for k in range(nv + 1)]
    if attach > 0 and attach not in ts:
        ts = sorted(ts + [attach])

    def angle(t):
        if t <= attach:
            return pitch
        return pitch - droop * ((t - attach) / max(1e-6, 1 - attach)) ** 1.6

    centers = {attach: base.copy()}
    ordered = sorted(ts)
    i0 = ordered.index(attach) if attach in ordered else 0
    if attach not in ordered:
        centers[ordered[0]] = base.copy()
    for k in range(i0, len(ordered) - 1):
        t0, t1 = ordered[k], ordered[k + 1]
        a = angle((t0 + t1) / 2)
        centers[t1] = centers[t0] + (h * math.cos(a) + up * math.sin(a)) * length * (t1 - t0)
    for k in range(i0, 0, -1):
        t0, t1 = ordered[k - 1], ordered[k]
        centers[t0] = centers[t1] - (h * math.cos(pitch) + up * math.sin(pitch)) * length * (t1 - t0)
    rows, uvs = [], []
    for t in ordered:
        a = angle(t)
        tangent = h * math.cos(a) + up * math.sin(a)
        normal = -h * math.sin(a) + up * math.cos(a)
        r_angle = roll + twist * max(0.0, t - attach)
        right = right0 * math.cos(r_angle) + normal * math.sin(r_angle)
        nrm = -right0 * math.sin(r_angle) + normal * math.cos(r_angle)
        center = centers[t] + right0 * side * length * max(0.0, t - attach) ** 2
        row, row_uv = [], []
        for j in range(nu + 1):
            s = j / nu
            x = (s - .5) * width
            rel = abs(2 * x / width)
            lift = fold * abs(x) + cup * width * rel * rel
            lift += wave * width * rel * rel * math.sin(2 * math.pi * waves * t + phase + (0 if x >= 0 else 1.7))
            row.append(center + right * x + nrm * lift)
            row_uv.append(atlas.uv(rect, s, t))
        rows.append(row)
        uvs.append(row_uv)
    buf.grid(rows, uvs)
    return h * math.cos(pitch) + up * math.sin(pitch)


def petiole(buf, start, start_dir, end, end_dir, r0, r1, rect, segments=6, steps=10, tension=1.0):
    """Pecíolo o tallo verde de start a end (llega tangente a la hoja). Devuelve sus puntos."""
    pts = hermite(start, start_dir, end, end_dir, steps, tension)
    radii = [r0 + (r1 - r0) * k / steps for k in range(steps + 1)]
    tube(buf, pts, radii, segments, rect=rect)
    return pts


# ---------------------------------------------------------------- macetas

def _ring(r, shape, segments, exponent):
    pts = []
    for k in range(segments + 1):
        a = 2 * math.pi * k / segments + (math.pi / 4 if shape == 'square' else 0)
        c, s = math.cos(a), math.sin(a)
        if shape == 'square':
            m = 2 / exponent
            c, s = math.copysign(abs(c) ** m, c), math.copysign(abs(s) ** m, s)
        pts.append(Vector((r * c, r * s, 0)))
    return pts


def vessel(buf, profile, shape='round', segments=48, tile=.5, exponent=8):
    """Recipiente de revolución (o de planta cuadrada redondeada) a partir de un perfil [(r, z), ...].

    UV a escala real: u = longitud a lo largo del anillo, v = longitud a lo largo del perfil (sin estirar el borde).
    """
    rows, uvs, v = [], [], 0.0
    for i, (r, z) in enumerate(profile):
        if i:
            v += math.hypot(r - profile[i - 1][0], z - profile[i - 1][1])
        ring = [p + Vector((0, 0, z)) for p in _ring(max(r, 1e-5), shape, segments, exponent)]
        u, ring_uv = 0.0, []
        for k, p in enumerate(ring):
            if k:
                u += (p - ring[k - 1]).length
            ring_uv.append((u / tile, v / tile))
        rows.append(ring)
        uvs.append(ring_uv)
    buf.grid(rows, uvs)


def soil(buf, radius, z, shape='round', mound=.008, tile=.4, seed=0, rings=7, segments=40, exponent=8):
    """Superficie de tierra (disco algo abombado y con grumos) con UV planas a escala real."""
    rows, uvs = [], []
    for i in range(rings + 1):
        f = i / rings
        r = radius * (1 - f) + 1e-4
        ring = _ring(r, shape, segments, exponent)
        row, row_uv = [], []
        for p in ring:
            bump = mound * (1 - (r / radius) ** 2) + .003 * noise.noise(Vector((p.x * 30 + seed, p.y * 30, 0)))
            q = Vector((p.x, p.y, z + bump * min(1.0, (1 - r / radius) * 6)))
            row.append(q)
            row_uv.append((q.x / tile, q.y / tile))
        rows.append(row)
        uvs.append(row_uv)
    buf.grid(rows, uvs)


def pot_profile(kind, radius, height, wall=.01, soil_depth=.025):
    """Perfil exterior + borde + pared interior hasta bajo la tierra. Devuelve (perfil, z de la tierra, radio útil)."""
    R, H = radius, height
    soil_z = H - soil_depth
    if kind == 'terracota':
        out = [(0, .0), (R * .70 - .006, 0), (R * .70, .004), (R * .86, H * .74), (R * .87, H * .76), (R * .985, H * .78),
               (R, H * .84), (R, H - .006), (R - .004, H)]
    elif kind in ('cilindro', 'hormigon'):
        k = .93 if kind == 'cilindro' else .96
        out = [(0, 0), (R * k - .012, 0), (R * k - .003, .003), (R * k, .012), (R, H - .004), (R - .003, H)]
    elif kind == 'bola':
        out = [(0, 0), (R * .55, 0), (R * .62, .006)]
        out += [(R * (.62 + .38 * math.sin(math.pi * (.08 + .8 * f)) ** .7), .006 + (H - .02) * f) for f in (.15, .3, .45, .6, .75, .9)]
        out += [(R * .86, H - .008), (R * .86 - .002, H)]
        R = R * .86
    elif kind == 'cesta':
        out = [(0, 0), (R * .88 - .01, 0), (R * .88, .008), (R * .985, H - .025), (R + .006, H - .015), (R + .007, H - .006),
               (R + .002, H), (R - .006, H - .002)]
        wall = .008
    elif kind == 'cuenco':
        out = [(0, 0), (R * .45, 0), (R * .5, .004), (R * .78, H * .35), (R * .95, H * .75), (R, H - .006), (R - .004, H)]
        wall, soil_z = .014, H - .014
    elif kind == 'colgante':
        out = [(0, 0), (R * .35, .002), (R * .7, H * .2), (R * .93, H * .55), (R, H - .006), (R - .004, H)]
    else:
        raise ValueError(f'Maceta desconocida: {kind}')
    top_r = out[-1][0]
    inner = [(top_r - wall, H - .003), (top_r - wall - (R - top_r) * 0, soil_z), (top_r - wall - .01, soil_z - .03),
             (0, soil_z - .03)]
    return out + inner, soil_z, top_r - wall


def tile_of(finish, default=.5):
    return max((finish or {}).get('tile_mm', default * 1000), 1) / 1000


def pot(piece, kind, radius, height, slot='maceta', shape='round', at_z=0.0, segments=48):
    """Maceta con su borde y la pared interior visible por encima de la tierra; si es de barro, con plato."""
    profile, soil_z, inner_r = pot_profile(kind, radius, height)
    profile = [(r, z + at_z) for r, z in profile]
    buf = MeshBuf()
    vessel(buf, profile, shape, segments, tile_of(piece.finishes.get(slot)))
    buf.to_object(piece, slot, piece.material(slot))
    if kind == 'terracota' and at_z > 0:
        saucer = MeshBuf()
        rs = radius * .86
        vessel(saucer, [(0, 0), (rs - .01, 0), (rs, .004), (rs + .006, at_z + .012), (rs + .004, at_z + .016),
                        (rs - .006, at_z + .012), (rs - .012, .006), (0, .006)], shape, segments,
               tile_of(piece.finishes.get(slot)))
        saucer.to_object(piece, 'plato', piece.material(slot))
    return soil_z + at_z, inner_r


def add_soil(piece, radius, z, shape='round', slot='tierra', seed=0, mound=.008):
    buf = MeshBuf()
    soil(buf, radius, z, shape, mound, tile_of(piece.finishes.get(slot), .4), seed)
    buf.to_object(piece, slot, piece.material(slot))


def handles(piece, radius, height, slot):
    """Asas de cuerda a los lados de una cesta."""
    for side in (-1, 1):
        pts = [Vector((side * (radius + .004), -.035, height - .03)), Vector((side * (radius + .03), -.03, height - .01)),
               Vector((side * (radius + .034), 0, height + .005)), Vector((side * (radius + .03), .03, height - .01)),
               Vector((side * (radius + .004), .035, height - .03))]
        piece.add(geo.tube(geo.fillet(pts, .02, 4), .0055, 8), slot, 'x', 0)


class Plant:
    """Planta en construcción: medidas de la especificación, maceta con tierra y follaje (malla con UV del atlas)."""

    def __init__(self, piece, spec):
        self.piece, self.params = piece, spec.get('params', {})
        self.w, self.d, self.h = (v / 1000 for v in spec['dims'])
        self.rng = random.Random(zlib.crc32(spec['id'].encode()))
        self.foliage = MeshBuf()
        self.soil_z = self.soil_r = self.pot_r = self.pot_h = 0.0
        self.shape = 'round'

    def pot(self, at_z=0.0):
        """Maceta (a la cota at_z si va colgada) con su tierra; devuelve la cota de la tierra."""
        p = self.params['pot']
        kind, radius, height = p['kind'], p['d'] / 2000, p['h'] / 1000
        self.shape = 'square' if p.get('square') else 'round'
        lift = .012 if kind == 'terracota' else at_z
        self.soil_z, self.soil_r = pot(self.piece, kind, radius, height, shape=self.shape, at_z=lift)
        if kind == 'cesta':
            handles(self.piece, radius, height, 'maceta')
        add_soil(self.piece, self.soil_r, self.soil_z, self.shape, seed=self.rng.random() * 50)
        self.pot_r, self.pot_h = radius, height + lift
        return self.soil_z

    def around(self, radius):
        """Punto al azar sobre la tierra dentro de `radius` del centro."""
        a, r = self.rng.uniform(0, 2 * math.pi), radius * math.sqrt(self.rng.random())
        return Vector((r * math.cos(a), r * math.sin(a), self.soil_z - .01))

    def fit(self, buffers, lo=.8, hi=1.25, floor=True):
        """Ajusta el follaje a las medidas de la especificación (escala desde el centro de la tierra).

        Corrige solo lo que sobra o falta respecto a `dims` (entre lo y hi por eje) para que el modelo mida lo
        especificado; nada baja de Z = 0 en las plantas apoyadas.
        """
        verts = [v for buf in buffers for v in buf.verts]
        if not verts:
            return
        span = lambda k: max(v[k] for v in verts) - min(v[k] for v in verts)  # noqa: E731
        top = max(v[2] for v in verts)
        clamp = lambda k: min(hi, max(lo, k))  # noqa: E731
        kx = clamp(self.w / max(span(0), 1e-3))
        ky = clamp(self.d / max(span(1), 1e-3))
        kz = clamp((self.h - self.soil_z) / max(top - self.soil_z, 1e-3))
        print(f'HK-AJUSTE {self.piece.name}: x{kx:.2f} y{ky:.2f} z{kz:.2f}', flush=True)
        for buf in buffers:
            buf.verts = [(x * kx, y * ky, max(.002 if floor else -1e9, self.soil_z + (z - self.soil_z) * kz))
                         for x, y, z in buf.verts]
