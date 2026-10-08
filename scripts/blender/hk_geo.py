"""Primitivas paramétricas (bmesh) de la fábrica de muebles de Habiteka.

Unidades en metros. Ejes de Blender: X = ancho, Y = fondo con el FRENTE del mueble hacia -Y, Z = alto y suelo en
Z = 0. El exportador glTF convierte -Y en +Z, que es el frente que espera el editor (frontRotation = 0).
"""
import math

import bmesh
from mathutils import Matrix, Vector, noise


def transform(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    """Escala, gira (X, luego Y, luego Z; radianes) y traslada toda la malla."""
    matrix = (Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y')
              @ Matrix.Rotation(rot[0], 4, 'X') @ Matrix.Diagonal((*scale, 1)))
    bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)
    return bm


def mirrored_x(bm):
    """Copia simétrica respecto al plano X = 0 (con las caras reorientadas)."""
    out = bm.copy()
    transform(out, scale=(-1, 1, 1))
    bmesh.ops.reverse_faces(out, faces=out.faces)
    return out


def merge(meshes):
    """Une varias mallas bmesh en una sola (las originales se liberan)."""
    import bpy
    out, scratch = bmesh.new(), bpy.data.meshes.new('hk-merge')
    for item in meshes:
        item.to_mesh(scratch)
        out.from_mesh(scratch)
        item.free()
    bpy.data.meshes.remove(scratch)
    return out


def box(w, d, h, r=0.0, segments=3, at=(0, 0, 0)):
    """Caja apoyada por el centro de su base en `at`, con todas las aristas redondeadas con radio r."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    r = min(r, w * .49, d * .49, h * .49)
    if r > 1e-5:
        bmesh.ops.bevel(bm, geom=bm.verts[:] + bm.edges[:], offset=r, offset_type='OFFSET', segments=segments,
                        profile=.5, affect='EDGES', clamp_overlap=True)
    return transform(bm, loc=(at[0], at[1], at[2] + h / 2))


def _ease(t):
    # Reparte más vértices cerca de las aristas, donde está el redondeo.
    return math.sin(t * math.pi / 2)


def soft_box(w, d, h, radius, bulge=(0, 0, 0), cuts=None, wrinkle=0.0, seed=0, deform=None, at=(0, 0, 0),
             density=.045, uniform=False):
    """Volumen tapizado (cojín, brazo, cabecero): caja de esquinas redondeadas y caras abombadas.

    radius: radio de redondeo (escalar o por eje X, Y, Z). bulge: abombado máximo de las caras normales a X, Y y Z.
    wrinkle: amplitud de arrugas suaves. deform(p, normal) -> p aplica deformaciones locales (capitoné, caída).
    El volumen queda centrado en X/Y sobre `at` con la base en at.z. density es la separación aproximada entre
    vértices; uniform=True los reparte por igual (capitoné) en lugar de concentrarlos en los redondeos.
    """
    half = Vector((w / 2, d / 2, h / 2))
    rad = radius if isinstance(radius, (tuple, list)) else (radius, radius, radius)
    rad = Vector(tuple(max(1e-4, min(rad[k], half[k] * .995)) for k in range(3)))
    inner = half - rad
    cuts = cuts or tuple(max(4, min(64, 2 * round(half[k] / density))) for k in range(3))
    offset = Vector((seed * 1.37, seed * 2.11, seed * .73))

    def position(key):
        ease = (lambda t: t) if uniform else _ease
        q = Vector(tuple(ease(key[k] / cuts[k] * 2 - 1) * half[k] for k in range(3)))
        core = Vector(tuple(max(-inner[k], min(inner[k], q[k])) for k in range(3)))
        e = Vector(tuple((q[k] - core[k]) / rad[k] for k in range(3)))
        n = e.normalized() if e.length > 1e-9 else Vector((0, 0, 1))
        p = Vector(tuple(core[k] + n[k] * rad[k] for k in range(3)))
        normal = Vector(tuple(n[k] / rad[k] for k in range(3))).normalized()
        for k in range(3):
            if not bulge[k]:
                continue
            fall = 1.0
            for o in range(3):
                if o != k and inner[o] > 1e-6:
                    fall *= max(0.0, 1 - (core[o] / inner[o]) ** 2)
            p[k] += math.copysign(bulge[k] * n[k] ** 2 * fall, n[k])
        if wrinkle:
            p += normal * wrinkle * noise.noise(p * 7.0 + offset)
        return deform(p, normal) if deform else p

    bm, verts = bmesh.new(), {}

    def vert(key):
        if key not in verts:
            verts[key] = bm.verts.new(position(key))
        return verts[key]

    for a in range(3):
        b, c = (a + 1) % 3, (a + 2) % 3
        for side in (0, cuts[a]):
            for i in range(cuts[b]):
                for j in range(cuts[c]):
                    quad = []
                    for di, dj in ((0, 0), (1, 0), (1, 1), (0, 1)):
                        key = [0, 0, 0]
                        key[a], key[b], key[c] = side, i + di, j + dj
                        quad.append(vert(tuple(key)))
                    bm.faces.new(quad if side else quad[::-1])
    return transform(bm, loc=(at[0], at[1], at[2] + h / 2))


def lathe(profile, segments=24, at=(0, 0, 0)):
    """Sólido de revolución alrededor de Z: profile = [(radio, z), ...] de abajo arriba; radio 0 cierra en punta."""
    bm, rings = bmesh.new(), []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segments),
                                        r * math.sin(2 * math.pi * i / segments), z)) for i in range(segments)])
    for lower, upper in zip(rings, rings[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            if len(lower) == 1 and len(upper) == 1:
                break
            if len(lower) == 1:
                bm.faces.new((lower[0], upper[j], upper[i]))
            elif len(upper) == 1:
                bm.faces.new((lower[i], lower[j], upper[0]))
            else:
                bm.faces.new((lower[i], lower[j], upper[j], upper[i]))
    for ring, z in ((rings[0], profile[0][1]), (rings[-1], profile[-1][1])):
        if len(ring) > 1:
            center = bm.verts.new((0, 0, z))
            for i in range(segments):
                bm.faces.new((center, ring[i], ring[(i + 1) % segments]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return transform(bm, loc=at)


def circle(r, n=10):
    return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def rounded_rect(w, h, r, n=3):
    """Perfil 2D (contrario a las agujas del reloj) de un rectángulo w × h con esquinas de radio r."""
    r = min(r, w * .49, h * .49)
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def fillet(points, radius, steps=4, closed=False):
    """Redondea las esquinas de una polilínea 3D (tubos doblados, marcos curvados)."""
    pts, out, n = [Vector(p) for p in points], [], len(points)
    for i in range(n):
        if not closed and i in (0, n - 1):
            out.append(pts[i])
            continue
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        a, b = p0 - p1, p2 - p1
        r = min(radius, a.length * .45, b.length * .45)
        start, end = p1 + a.normalized() * r, p1 + b.normalized() * r
        for k in range(steps + 1):
            t = k / steps
            out.append((1 - t) ** 2 * start + 2 * (1 - t) * t * p1 + t * t * end)
    return out


def arc(cx, cy, z, radius, a0, a1, steps=24):
    """Puntos de un arco horizontal (grados) centrado en (cx, cy) a la altura z."""
    return [(cx + radius * math.cos(math.radians(a0 + (a1 - a0) * k / steps)),
             cy + radius * math.sin(math.radians(a0 + (a1 - a0) * k / steps)), z) for k in range(steps + 1)]


def sweep(path, profile, closed=False, cap=True, round_ends=0.0, up=None):
    """Barre un perfil 2D cerrado a lo largo de una trayectoria 3D (tubos, vivos, cuerdas, respaldos curvos).

    El perfil se coloca en el plano normal a la trayectoria (x = normal, y = binormal). round_ends redondea los
    extremos abiertos con un casquete de ese radio en vez de una tapa plana.
    """
    pts = [Vector(p) for p in path]
    n = len(pts)
    tangents = []
    for i in range(n):
        if closed:
            t = pts[(i + 1) % n] - pts[i - 1]
        else:
            t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        tangents.append(t.normalized())
    ref = Vector(up) if up else (Vector((0, 0, 1)) if abs(tangents[0].z) < .9 else Vector((1, 0, 0)))
    normal = (ref - tangents[0] * ref.dot(tangents[0])).normalized()
    frames = []
    for i, t in enumerate(tangents):
        if i:
            normal.rotate(tangents[i - 1].rotation_difference(t))
        normal = (normal - t * normal.dot(t)).normalized()
        frames.append((normal.copy(), t.cross(normal)))
    sections = [(p, nrm, bin_, 1.0) for p, (nrm, bin_) in zip(pts, frames)]
    if round_ends and not closed:
        steps = 4
        head = [(pts[0] - tangents[0] * round_ends * math.sin(math.pi / 2 * k / steps), *frames[0],
                 math.cos(math.pi / 2 * k / steps)) for k in range(steps, 0, -1)]
        tail = [(pts[-1] + tangents[-1] * round_ends * math.sin(math.pi / 2 * k / steps), *frames[-1],
                 math.cos(math.pi / 2 * k / steps)) for k in range(1, steps + 1)]
        sections = head + sections + tail
    bm = bmesh.new()
    rings = [[bm.verts.new(p + nrm * (x * s) + bin_ * (y * s)) for x, y in profile]
             for p, nrm, bin_, s in [(p, nrm, bin_, max(s, .08)) for p, nrm, bin_, s in sections]]
    m = len(profile)
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for a, b in pairs:
        for k in range(m):
            bm.faces.new((a[k], a[(k + 1) % m], b[(k + 1) % m], b[k]))
    if cap and not closed:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def tube(path, radius, segments=10, closed=False, round_ends=0.0):
    return sweep(path, circle(radius, segments), closed=closed, round_ends=round_ends)


def surface(nu, nv, fn):
    """Lámina abierta de nu × nv cuadriláteros; fn(u, v) con u, v en [0, 1] devuelve la posición 3D."""
    bm = bmesh.new()
    grid = [[bm.verts.new(fn(i / nu, j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    return bm


def thicken(bm, thickness):
    """Da grosor a una lámina (edredón, manta) hacia el lado contrario de su normal."""
    bm.normal_update()
    result = bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=thickness)
    del result
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def sphere(radius, at=(0, 0, 0), segments=12, flatten=1.0):
    """Esfera (botones de capitoné, remates de forja); flatten < 1 la aplasta en Z."""
    rings = 4 if segments <= 8 else 6
    profile = [(radius * math.sin(math.pi * k / rings), -radius * math.cos(math.pi * k / rings) * flatten)
               for k in range(rings + 1)]
    return lathe(profile, segments, at)
