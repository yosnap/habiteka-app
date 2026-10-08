"""Constructor común de almacenaje: «cuerpo con cajones y puertas» (metros; frente hacia -Y; pared detrás en +Y).

Lo usan cómodas, sinfonieres, mesillas, armarios, muebles de TV, aparadores, librerías, zapateros y muebles de recibidor.
casework(w, d, h, params) devuelve las partes [(bmesh, hueco, veta, arista viva)] de un mueble centrado en x = y = 0 y
apoyado en z = 0 (o colgado a params['elev'] mm si la base es «suspendido»). Ocupa exactamente w × d × h: el vuelo de
los tiradores y del tablero se descuenta del fondo del cuerpo.

Parámetros (mm salvo que se indique):
  grid        columnas de izquierda a derecha; cada una es «peso:celdas» o «celdas», con las celdas de arriba abajo
              separadas por espacios y un peso opcional «*n». Celdas: C cajón, P puerta, PP pareja de puertas,
              B abatible, V puerta de vidrio, A hueco abierto. Ej.: ['C C C', '2:P*2 A'].
  base        zocalo | patas | bastidor (postes metálicos) | suspendido | ninguno;  base_h, leg (conica, recta,
              metal, laton, horquilla), leg_size, elev (solo suspendido)
  fronts      sobre (frentes que tapan el cuerpo) | inset (frentes enrasados dentro del marco)
  front       liso | ranurado | marco | lamas | rejilla | espejo  (estilo de puertas y abatibles)
  drawer_front estilo de los cajones (por defecto liso, o el de front si es ranurado o lamas)
  handle      barra | barra_larga | pomo | unero (perfil de aluminio) | ranura (gola) | ninguno
  panel, divider, front_th  gruesos de tablero exterior, de divisiones y de frentes; back (bool, true) trasera
  top_th, top_over          tablero superior aparte (hueco «sobre») y su vuelo
  relleno     (bool) libros en los huecos abiertos (huecos libro1, libro2 y libro3)

Huecos de material: cuerpo, frente, tirador, patas, sobre, fondo, zocalo, rejilla, espejo, vidrio, perfil, estructura y
libro1–3. Los secundarios que la especificación no define toman el de FALLBACK.
"""
import math

import hk_geo as geo
import hk_parts as parts

EDGE = .0015          # chaflán del canto de los tableros (arista viva: brillo fino en el borde)
GAP = .003            # junta entre frentes
GRIP = .022           # alto del perfil uñero o de la gola
HANDLE_PROJ = {'barra': .03, 'barra_larga': .03, 'pomo': .03}
KINDS = {'A', 'C', 'P', 'PP', 'B', 'V'}
BASES = {'zocalo', 'patas', 'bastidor', 'suspendido', 'ninguno'}
FALLBACK = {'frente': 'cuerpo', 'sobre': 'cuerpo', 'fondo': 'cuerpo', 'zocalo': 'cuerpo', 'patas': 'cuerpo',
            'tirador': 'patas', 'perfil': 'tirador', 'estructura': 'patas', 'rejilla': 'frente', 'espejo': 'frente',
            'vidrio': 'frente'}


def slot(piece, name):
    """Hueco de material que existe en la especificación, siguiendo FALLBACK."""
    wanted = name
    while name not in piece.finishes:
        if name not in FALLBACK:
            raise KeyError(f'{piece.name}: la especificación no define el material «{wanted}»')
        name = FALLBACK[name]
    return name


def emit(piece, items, loc=(0.0, 0.0, 0.0)):
    """Añade las partes desplazadas `loc`, resolviendo cada hueco con FALLBACK."""
    for bm, name, grain, sharp in items:
        if any(loc):
            geo.transform(bm, loc=loc)
        piece.add(bm, slot(piece, name), grain, sharp)


def board(w, d, h, x=0.0, y=0.0, z=0.0, r=EDGE):
    """Tablero w × d × h con la base en (x, y, z) y canto achaflanado."""
    return geo.box(w, d, h, r, 1, at=(x, y, z))


def parse_grid(grid):
    if not isinstance(grid, list) or not grid:
        raise ValueError('grid debe ser una lista de columnas')
    columns = []
    for text in grid:
        weight, cells = text.split(':', 1) if ':' in text else ('1', text)
        parsed = []
        for token in cells.split():
            kind, _, cell_weight = token.partition('*')
            if kind not in KINDS:
                raise ValueError(f'Celda desconocida «{token}» en {text!r}')
            parsed.append((kind, float(cell_weight or 1)))
        if not parsed:
            raise ValueError(f'Columna vacía en {grid!r}')
        columns.append((float(weight), parsed))
    return columns


def cuts(a, b, weights):
    """Posiciones que reparten [a, b] según los pesos (n + 1 valores, de a a b)."""
    total, out, acc = sum(weights), [a], 0.0
    for weight in weights:
        acc += weight
        out.append(a + (b - a) * acc / total)
    return out


# ---------------------------------------------------------------------------------------------- tiradores
def bar(cx, yf, cz, length, axis, r=.006, standoff=.03):
    """Tirador de barra con dos patillas que salen de la cara del frente (yf) `standoff` hacia -Y."""
    near, far = yf + .002, yf - standoff + r
    if axis == 'x':
        pts = [(cx - length / 2, near, cz), (cx - length / 2, far, cz), (cx + length / 2, far, cz), (cx + length / 2, near, cz)]
    else:
        pts = [(cx, near, cz - length / 2), (cx, far, cz - length / 2), (cx, far, cz + length / 2), (cx, near, cz + length / 2)]
    return geo.tube(geo.fillet(pts, .01, 3), r, 10)


def knob(cx, yf, cz, r=.015):
    """Pomo torneado que sale de la cara del frente hacia -Y."""
    bm = geo.lathe([(0, 0), (.006, 0), (.006, .011), (r * .75, .016), (r, .021), (r, .025), (r * .7, .029), (0, .03)], 20)
    geo.transform(bm, rot=(math.pi / 2, 0, 0))
    return geo.transform(bm, loc=(cx, yf + .002, cz))


def _unero(gx0, gx1, gz0, gz1, yf, ft, vertical, side):
    """Perfil tirador de aluminio en J: labio delantero, pared y fondo; deja un canal para los dedos."""
    lip = GRIP * .65
    if not vertical:
        w, cx = gx1 - gx0, (gx0 + gx1) / 2
        return [(board(w, .003, lip, cx, yf + .0015, gz0, .0008), 'perfil', 'x', 35),
                (board(w, ft, .003, cx, yf + ft / 2, gz0, .0008), 'perfil', 'x', 35),
                (board(w, .003, gz1 - gz0, cx, yf + ft - .0015, gz0, .0008), 'perfil', 'x', 35)]
    h = gz1 - gz0
    lip_x = gx0 + lip / 2 if side > 0 else gx1 - lip / 2
    wall_x = gx0 + .0015 if side > 0 else gx1 - .0015
    return [(board(lip, .003, h, lip_x, yf + .0015, gz0, .0008), 'perfil', 'z', 35),
            (board(.003, ft, h, wall_x, yf + ft / 2, gz0, .0008), 'perfil', 'z', 35),
            (board(gx1 - gx0, .003, h, (gx0 + gx1) / 2, yf + ft - .0015, gz0, .0008), 'perfil', 'z', 35)]


def _grips(handle, kind, x0, x1, z0, z1, yf, side):
    fw, fh = x1 - x0, z1 - z0
    if kind in ('C', 'B'):
        cz = (z0 + z1) / 2 if kind == 'C' and fh < .24 else z1 - .055
        if handle == 'pomo':
            xs = [(x0 + x1) / 2] if fw < .7 else [x0 + fw / 4, x1 - fw / 4]
            return [(knob(x, yf, cz), 'tirador', 'z', 50) for x in xs]
        length = min(.5 if handle == 'barra_larga' else .16, fw * .55)
        return [(bar((x0 + x1) / 2, yf, cz, length, 'x'), 'tirador', 'x', 50)]
    cx = x1 - .045 if side > 0 else x0 + .045
    if handle == 'pomo':
        cz = z1 - .1 if z1 < 1.25 else min(max(1.05, z0 + .2), z1 - .2)
        return [(knob(cx, yf, cz), 'tirador', 'z', 50)]
    length = min(.8, fh * .45) if handle == 'barra_larga' else (.128 if fh < .9 else .32)
    cz = z1 - .06 - length / 2 if z1 < 1.25 else min(max(1.05, z0 + .1 + length / 2), z1 - .1 - length / 2)
    return [(bar(cx, yf, cz, length, 'z'), 'tirador', 'z', 50)]


# ---------------------------------------------------------------------------------------------- frentes
def _fluted(fw, fh, ft, cx, cy, z0, pitch=.022):
    """Frente ranurado: medias cañas verticales casi semicirculares (sombra marcada en cada junta) en un solo perfil."""
    n = max(3, round(fw / pitch))
    p, steps = fw / n, 6
    b = min(p * .42, ft * .55)
    pts = [(fw / 2, ft / 2), (-fw / 2, ft / 2)]
    for i in range(n):
        xa = -fw / 2 + i * p
        for k in range(0 if i == 0 else 1, steps + 1):
            a = math.pi * k / steps
            pts.append((xa + p * (1 - math.cos(a)) / 2, -ft / 2 + b * (1 - math.sin(a))))
    return geo.sweep([(cx, cy, z0), (cx, cy, z0 + fh)], pts)


def front(style, x0, x1, z0, z1, yf, ft, grain):
    """Frente (puerta, cajón o abatible) de cara delantera en yf y grueso ft."""
    fw, fh = x1 - x0, z1 - z0
    cx, cy = (x0 + x1) / 2, yf + ft / 2
    if style == 'liso':
        return [(board(fw, ft, fh, cx, cy, z0), 'frente', grain, 35)]
    if style == 'ranurado':
        return [(_fluted(fw, fh, ft, cx, cy, z0), 'frente', 'z', 50)]
    if style == 'espejo':
        return [(board(fw, ft - .004, fh, cx, cy + .002, z0), 'frente', 'z', 35),
                (board(fw - .012, .004, fh - .012, cx, yf + .002, z0 + .006, .001), 'espejo', 'z', 35)]
    if style == 'lamas':
        out = [(board(fw, .006, fh, cx, yf + ft - .003, z0), 'fondo', 'z', 35)]
        n = max(2, round(fw / .034))
        pitch = fw / n
        for k in range(n):
            out.append((board(pitch - .01, ft - .006, fh, x0 + pitch * (k + .5), yf + (ft - .006) / 2, z0, .002),
                        'frente', 'z', 35))
        return out
    if style not in ('marco', 'rejilla', 'vidrio'):
        raise ValueError(f'Estilo de frente desconocido: {style}')
    m = min(.065 if style == 'marco' else .045, fw * .18, fh * .18)
    out = [(board(m, ft, fh, x0 + m / 2, cy, z0), 'frente', 'z', 35),
           (board(m, ft, fh, x1 - m / 2, cy, z0), 'frente', 'z', 35),
           (board(fw - 2 * m, ft, m, cx, cy, z1 - m), 'frente', 'x', 35),
           (board(fw - 2 * m, ft, m, cx, cy, z0), 'frente', 'x', 35)]
    iw, ih = fw - 2 * m + .004, fh - 2 * m + .004
    if style == 'marco':
        out.append((board(iw, ft - .008, ih, cx, cy + .004, z0 + m - .002), 'frente', 'z', 35))
    else:
        out.append((board(iw, .004, ih, cx, cy, z0 + m - .002, .0008), 'rejilla' if style == 'rejilla' else 'vidrio', 'z', 35))
    return out


def _leaf(kind, x0, x1, z0, z1, yf, ft, style, p, side):
    """Un frente con su tirador. side = +1 si abre por la derecha (tirador a la derecha), -1 por la izquierda."""
    handle = p.get('handle', 'ninguno')
    grain = 'x' if kind == 'C' or (kind == 'B' and x1 - x0 > z1 - z0) else 'z'
    vertical = kind in ('P', 'V') and z1 - z0 > .7
    grip, items = None, []
    if handle in ('unero', 'ranura'):
        if vertical:
            grip = (x1 - GRIP, x1, z0, z1) if side > 0 else (x0, x0 + GRIP, z0, z1)
            x0, x1 = (x0, x1 - GRIP) if side > 0 else (x0 + GRIP, x1)
        else:
            grip = (x0, x1, z1 - GRIP, z1)
            z1 -= GRIP
    items += front(style, x0, x1, z0, z1, yf, ft, grain)
    if grip and handle == 'unero':
        items += _unero(*grip, yf, ft, vertical, side)
    elif grip:
        # Gola: canal de aluminio rehundido el grueso del frente, visible en la junta.
        gx0, gx1, gz0, gz1 = grip
        items.append((board(gx1 - gx0, .003, gz1 - gz0, (gx0 + gx1) / 2, yf + ft - .0015, gz0, .0008), 'perfil',
                      'z' if vertical else 'x', 35))
    elif handle in HANDLE_PROJ:
        items += _grips(handle, kind, x0, x1, z0, z1, yf, side)
    elif handle != 'ninguno':
        raise ValueError(f'Tirador desconocido: {handle}')
    return items


def _cell(kind, x0, x1, z0, z1, yf, ft, p, side):
    style = p.get('front', 'liso')
    if kind == 'C':
        style = p.get('drawer_front', style if style in ('ranurado', 'lamas') else 'liso')
    elif kind == 'V':
        style = 'vidrio'
    if kind == 'PP':
        mid = (x0 + x1) / 2
        return (_leaf('P', x0, mid - GAP / 2, z0, z1, yf, ft, style, p, 1)
                + _leaf('P', mid + GAP / 2, x1, z0, z1, yf, ft, style, p, -1))
    return _leaf(kind, x0, x1, z0, z1, yf, ft, style, p, side)


# ---------------------------------------------------------------------------------------------- base y relleno
def legs(kind, xs, ys, h, size=1.0):
    """Patas con la parte superior a la altura h en cada (x, y)."""
    out = []
    for x in xs:
        for y in ys:
            sx = 0 if abs(x) < 1e-6 else (1 if x > 0 else -1)
            sy = 1 if y > 0 else -1
            if kind == 'horquilla':
                path = geo.fillet([(x, y - .05 * sy, h), (x, y, .006), (x, y + .03 * sy, h)], .02, 4)
                bm = geo.tube(path, .0055, 8)
            elif kind == 'laton':
                bm = parts.leg('metal', h, x, y, sx, sy, size * 1.25, splay=2)
            elif kind == 'conica':
                bm = parts.leg('conica', h, x, y, sx, sy, size, splay=5)
            else:
                bm = parts.leg(kind, h, x, y, sx, sy, size)
            out.append((bm, 'patas', 'z', 35))
    return out


def books(x0, x1, z0, zmax, y_back, depth, seed):
    """Hilera de libros (algunos tumbados) apoyada en z0 entre x0 y x1, con el lomo hacia -Y."""
    state = [seed * 7919 + 17]

    def rand():
        state[0] = (state[0] * 1103515245 + 12345) % 2147483648
        return state[0] / 2147483648

    out, x, end = [], x0 + .01, x0 + (x1 - x0) * (.55 + .35 * rand())
    tall = min(.3, zmax - z0 - .02)
    if tall < .12:
        return out
    while x < end:
        th, hh = .018 + .025 * rand(), tall * (.7 + .3 * rand())
        dd = min(depth - .02, .15 + .08 * rand())
        out.append((geo.box(th, dd, hh, .0015, 1, at=(x + th / 2, y_back - dd / 2 - .01, z0)), f'libro{1 + int(rand() * 3)}', 'z', 35))
        x += th + .001
    if x1 - x > .15 and rand() > .35:
        # Pila de libros tumbados junto a la hilera, siempre dentro del hueco.
        z, width = z0, min(.22, x1 - x - .03)
        for _ in range(2 + int(rand() * 3)):
            th, bw = .02 + .02 * rand(), width * (.8 + .2 * rand())
            out.append((geo.box(bw, .13 + .05 * rand(), th, .0015, 1, at=(x + .01 + width / 2, y_back - .1, z)),
                        f'libro{1 + int(rand() * 3)}', 'x', 35))
            z += th
    return out


# ---------------------------------------------------------------------------------------------- cuerpo
def casework(w, d, h, p):
    t = p.get('panel', 18) / 1000
    td = p.get('divider', p.get('panel', 18)) / 1000
    ft = p.get('front_th', 19) / 1000
    base = p.get('base', 'zocalo')
    if base not in BASES:
        raise ValueError(f'Base desconocida: {base}')
    base_h = p.get('base_h', 0 if base in ('ninguno', 'suspendido') else 70) / 1000
    z0 = p.get('elev', 0) / 1000 if base == 'suspendido' else 0.0
    top_th = p.get('top_th', 0) / 1000
    over = p.get('top_over', 0) / 1000 if top_th else 0.0
    inset = p.get('fronts', 'sobre') == 'inset'
    post = .03 if base == 'bastidor' else 0.0
    yf = -d / 2 + max(HANDLE_PROJ.get(p.get('handle', 'ninguno'), 0.0), over)
    wc = w - 2 * max(over, post)
    yc0, yb = (yf if inset else yf + ft), d / 2
    dc, ycm = yb - yc0, (yc0 + yb) / 2
    zb, zt = z0 + base_h, z0 + h - top_th
    columns = parse_grid(p['grid'])
    items = []

    def add(bm, name, grain='z', sharp=35):
        items.append((bm, name, grain, sharp))

    for sx in (-1, 1):
        add(board(t, dc, zt - t - zb, sx * (wc / 2 - t / 2), ycm, zb), 'cuerpo', 'z')
    add(board(wc, dc, t, 0, ycm, zt - t), 'cuerpo', 'x')
    add(board(wc - 2 * t, dc - .008, t, 0, ycm - .004, zb), 'cuerpo', 'x')
    if p.get('back', True):
        add(board(wc - 2 * t, .008, zt - zb - 2 * t, 0, yb - .004, zb + t), 'fondo', 'z')
    if top_th:
        y_front = yf - over
        add(board(w, yb - y_front, top_th, 0, (yb + y_front) / 2, zt, .003), 'sobre', 'x')

    xs = cuts(-wc / 2 + t / 2, wc / 2 - t / 2, [weight for weight, _ in columns])
    for i, (_weight, cells) in enumerate(columns):
        xl, xr = xs[i], xs[i + 1]
        last_col = i == len(columns) - 1
        if i:
            add(board(td, dc - .008, zt - zb - 2 * t, xl, ycm - .004, zb + t), 'cuerpo', 'z')
        zs = cuts(zt - t / 2, zb + t / 2, [weight for _, weight in cells])
        center = (xl + xr) / 2
        side = -1 if center > .01 else 1
        for j, (kind, _w) in enumerate(cells):
            ztop, zbot = zs[j], zs[j + 1]
            last_row = j == len(cells) - 1
            if j and not (kind == 'C' and cells[j - 1][0] == 'C'):
                add(board(xr - xl - td, dc - .008, td, center, ycm - .004, ztop - td / 2), 'cuerpo', 'x')
            inner_l = xl + (t if i == 0 else td) / 2
            inner_r = xr - (t if last_col else td) / 2
            inner_b = zbot + (t if last_row else td) / 2
            inner_t = ztop - (t if j == 0 else td) / 2
            if kind in ('A', 'V') and inner_t - inner_b > .5:
                count = round((inner_t - inner_b) / .36) - 1
                for k in range(1, count + 1):
                    z = inner_b + (inner_t - inner_b) * k / (count + 1)
                    add(board(inner_r - inner_l, dc - .02, td, center, ycm - .004, z - td / 2), 'cuerpo', 'x')
            if kind == 'A':
                if p.get('relleno'):
                    items += books(inner_l, inner_r, inner_b, inner_t, yb - .008, dc - .008, i * 13 + j)
                continue
            if inset:
                fx0, fx1, fz0, fz1 = inner_l + .002, inner_r - .002, inner_b + .002, inner_t - .002
            else:
                fx0 = -wc / 2 + .001 if i == 0 else xl + GAP / 2
                fx1 = wc / 2 - .001 if last_col else xr - GAP / 2
                fz1 = zt - .001 if j == 0 else ztop - GAP / 2
                fz0 = zb + .001 if last_row else zbot + GAP / 2
            items += _cell(kind, fx0, fx1, fz0, fz1, yf, ft, p, side)

    if base == 'zocalo':
        add(board(wc - .02, yb - .01 - (yc0 + .025), base_h, 0, (yc0 + .025 + yb - .01) / 2, z0), 'zocalo', 'x')
    elif base == 'patas':
        inset_leg = p.get('leg_inset', 45) / 1000
        xs_leg = [-(wc / 2 - inset_leg), wc / 2 - inset_leg] + ([0.0] if wc > 1.5 else [])
        items += legs(p.get('leg', 'conica'), xs_leg, [yc0 + inset_leg, yb - inset_leg], base_h, p.get('leg_size', 1.0))
    elif base == 'bastidor':
        s = post
        for sx in (-1, 1):
            for y in (yc0 + s / 2, yb - s / 2):
                add(board(s, s, zt - z0, sx * (w / 2 - s / 2), y, z0, .002), 'estructura', 'z')
            for z in (zb - s, zt - s):
                add(board(s, dc - 2 * s, s, sx * (w / 2 - s / 2), ycm, z, .002), 'estructura', 'y')
        for y in (yc0 + s / 2, yb - s / 2):
            add(board(w - 2 * s, s, s, 0, y, zb - s, .002), 'estructura', 'x')
    return items
